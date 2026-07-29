#!/usr/bin/env python3
"""Sync Taoyuan's official speed-camera CSV into a web-friendly JSON file."""

from __future__ import annotations

import csv
import io
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

DATASET_ID = "ecd45ee5-4489-436b-bd08-7d4e4111c4a4"
DATASET_URL = "https://data.gov.tw/dataset/25935"
API_BASE = "https://opendata.tycg.gov.tw"
DATASET_API = f"{API_BASE}/api/v1/dataset.info?id={DATASET_ID}"
RESOURCE_API = f"{API_BASE}/api/v1/resource.info?pid={DATASET_ID}"
AREA_DISTRICTS = {"大溪區", "復興區", "龍潭區"}
TAIPEI_TIMEZONE = timezone(timedelta(hours=8))


def request_bytes(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json,text/csv,*/*",
            "User-Agent": "cihu-liveview-data-sync/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read()


def request_json(url: str) -> dict[str, Any]:
    payload = json.loads(request_bytes(url).decode("utf-8"))
    if not payload.get("success"):
        raise RuntimeError(f"Official API returned an error for {url}")
    return payload["payload"]


def decode_csv(content: bytes, preferred_encoding: str) -> str:
    encodings = [preferred_encoding, "utf-8-sig", "big5", "cp950"]
    for encoding in dict.fromkeys(
        value.strip() for value in encodings if value and value.strip()
    ):
        try:
            return content.decode(encoding)
        except (LookupError, UnicodeDecodeError):
            continue
    raise RuntimeError("Unable to decode the official speed-camera CSV")


def parse_source_time(value: str) -> str:
    if not value:
        return ""
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return value
    return parsed.replace(tzinfo=TAIPEI_TIMEZONE).isoformat()


def camera_rows(csv_text: str) -> list[dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(csv_text))
    cameras: list[dict[str, Any]] = []

    for raw_row in reader:
        row = {
            (key or "").lstrip("\ufeff").strip(): (value or "").strip()
            for key, value in raw_row.items()
        }
        if row.get("行政區") not in AREA_DISTRICTS:
            continue

        try:
            latitude = float(row["座標緯度"])
            longitude = float(row["座標經度"])
        except (KeyError, TypeError, ValueError):
            continue

        cameras.append(
            {
                "id": row.get("設備編號", ""),
                "type": row.get("型式", ""),
                "district": row.get("行政區", ""),
                "location": row.get("設置地點_路口或路段", ""),
                "enforcement": row.get("取締項目", ""),
                "latitude": latitude,
                "longitude": longitude,
                "direction": row.get("拍攝方向", ""),
                "speedLimit": row.get("速限", ""),
                "unit": row.get("管轄單位", ""),
                "note": row.get("備註", ""),
            }
        )

    cameras.sort(
        key=lambda camera: (
            int(camera["id"]) if str(camera["id"]).isdigit() else 999_999,
            str(camera["id"]),
        )
    )
    if not cameras:
        raise RuntimeError("The official CSV contained no cameras in the target area")
    return cameras


def load_existing(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def main() -> None:
    output_path = Path(sys.argv[1] if len(sys.argv) > 1 else "speed-cameras.json")
    dataset = request_json(DATASET_API)
    resources = request_json(RESOURCE_API)
    candidates = [
        resource
        for resource in resources
        if resource.get("state") == "active"
        and str(resource.get("file_format", "")).upper() == "CSV"
    ]
    if not candidates:
        raise RuntimeError("The official dataset has no active CSV resource")

    resource = max(
        candidates,
        key=lambda item: (
            item.get("last_modified", ""),
            item.get("created", ""),
        ),
    )
    resource_url = urllib.parse.urljoin(API_BASE, resource["url"])
    csv_text = decode_csv(
        request_bytes(resource_url),
        str(resource.get("encoding", "Big5")),
    )
    cameras = camera_rows(csv_text)

    applicable_match = re.search(
        r"(\d{4}-\d{2}-\d{2})\s*起適用",
        str(dataset.get("description", "")),
    )
    next_data: dict[str, Any] = {
        "datasetTitle": dataset.get("title", "桃園市測速照相設備地點"),
        "datasetUrl": DATASET_URL,
        "resourceUrl": resource_url,
        "resourceName": resource.get("name", ""),
        "sourceModifiedAt": parse_source_time(
            str(resource.get("last_modified", ""))
        ),
        "sourceHash": resource.get("hash", ""),
        "sourceFrequency": dataset.get("update_freq_desc", ""),
        "applicableFrom": applicable_match.group(1) if applicable_match else "",
        "sourceTotal": int(dataset.get("number_of_data") or len(cameras)),
        "areaTotal": len(cameras),
        "districts": sorted(AREA_DISTRICTS),
        "cameras": cameras,
    }

    existing = load_existing(output_path)
    if existing:
        comparable_existing = {
            key: value for key, value in existing.items() if key != "syncedAt"
        }
        if comparable_existing == next_data:
            print(
                f"No change: {len(cameras)} nearby cameras, "
                f"official hash {resource.get('hash', 'unknown')}"
            )
            return

    next_data["syncedAt"] = (
        datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(next_data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Updated {output_path}: {len(cameras)} cameras from "
        f"{resource.get('name', 'official CSV')}"
    )


if __name__ == "__main__":
    main()
