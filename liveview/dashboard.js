(() => {
  "use strict";

  const scriptUrl = document.currentScript?.src || window.location.href;
  const defaultContext = {
    latitude: 24.8283,
    longitude: 121.2961,
    name: "後慈湖",
  };
  const cacheDuration = 10 * 60 * 1000;
  const refreshInterval = 10 * 60 * 1000;
  let currentContext = { ...defaultContext };
  let activeRequest = null;
  let contextTimer = null;

  function installStyles() {
    if (document.getElementById("field-dashboard-styles")) return;

    const link = document.createElement("link");
    link.id = "field-dashboard-styles";
    link.rel = "stylesheet";
    link.href = new URL("dashboard.css?v=1", scriptUrl).href;
    document.head.appendChild(link);
  }

  function dashboardMarkup() {
    return `
      <div class="field-dashboard__header">
        <div>
          <p class="field-dashboard__kicker">LIVE CONDITIONS</p>
          <h2 id="field-dashboard-title">後慈湖現場判斷</h2>
          <p class="field-dashboard__intro">天氣與降雨自動更新；塞車、道路通阻與測速點可依目前鏡頭位置快速查詢。</p>
        </div>
        <div class="field-dashboard__tools">
          <span class="field-dashboard__status" id="field-dashboard-status" data-tone="loading" role="status" aria-live="polite">
            <i aria-hidden="true"></i><span>正在取得天氣</span>
          </span>
          <button class="field-dashboard__refresh" id="field-dashboard-refresh" type="button" aria-label="重新整理天氣資訊">
            <span aria-hidden="true">↻</span>更新
          </button>
        </div>
      </div>

      <div class="field-dashboard__grid">
        <article class="condition-card" aria-labelledby="field-weather-title">
          <div class="condition-card__heading">
            <span class="condition-card__icon" id="field-weather-icon" aria-hidden="true">◌</span>
            <p><small>即時天氣</small><strong id="field-weather-title">載入中</strong></p>
          </div>
          <div class="condition-card__value">
            <strong id="field-temperature">--</strong><span>°C</span>
          </div>
          <p class="condition-card__detail">
            體感 <span id="field-apparent">--</span>°C ・風速 <span id="field-wind">--</span> km/h
          </p>
        </article>

        <article class="condition-card" aria-labelledby="field-rain-title">
          <div class="condition-card__heading">
            <span class="condition-card__icon" aria-hidden="true">傘</span>
            <p><small>未來 3 小時</small><strong id="field-rain-title">降雨機率</strong></p>
          </div>
          <div class="condition-card__value">
            <strong id="field-rain-probability">--</strong><span>%</span>
          </div>
          <p class="condition-card__detail">
            目前降雨 <span id="field-precipitation">--</span> mm ・陣風 <span id="field-gust">--</span> km/h
          </p>
        </article>

        <article class="condition-card condition-card--link" aria-labelledby="field-traffic-title">
          <div class="condition-card__heading">
            <span class="condition-card__icon" aria-hidden="true">路</span>
            <p><small>GOOGLE 即時車流</small><strong id="field-traffic-title">塞車快查</strong></p>
          </div>
          <div class="condition-card__value condition-card__value--words">
            <strong>查看壅塞</strong>
          </div>
          <p class="condition-card__detail">依目前鏡頭座標開啟交通圖層，查看周邊道路紅黃綠車流。</p>
          <a class="condition-card__action" id="field-traffic-link" href="#" target="_blank" rel="noopener noreferrer">
            打開即時路況 <span aria-hidden="true">↗</span>
          </a>
        </article>

        <article class="condition-card condition-card--link" aria-labelledby="field-speed-title">
          <div class="condition-card__heading">
            <span class="condition-card__icon" aria-hidden="true">限</span>
            <p><small>桃園市官方資料</small><strong id="field-speed-title">測速／科技執法</strong></p>
          </div>
          <div class="condition-card__value condition-card__value--words">
            <strong>官方點位</strong>
          </div>
          <p class="condition-card__detail">查詢設備位置、取締項目與速限；實際仍以現場標誌為準。</p>
          <a class="condition-card__action" href="https://data.gov.tw/dataset/25935" target="_blank" rel="noopener noreferrer">
            查看測速點 <span aria-hidden="true">↗</span>
          </a>
        </article>
      </div>

      <nav class="field-dashboard__quick" aria-label="行前快速查詢">
        <a class="field-dashboard__quick-link" href="https://168.thb.gov.tw/" target="_blank" rel="noopener noreferrer">
          <strong>道路通阻</strong><small>台 7、北橫施工與事件</small><span aria-hidden="true">↗</span>
        </a>
        <a class="field-dashboard__quick-link" href="https://www.cwa.gov.tw/V8/C/" target="_blank" rel="noopener noreferrer">
          <strong>氣象警特報</strong><small>豪雨、雷雨與颱風警報</small><span aria-hidden="true">↗</span>
        </a>
        <a class="field-dashboard__quick-link" id="field-location-link" href="#" target="_blank" rel="noopener noreferrer">
          <strong>目前位置地圖</strong><small id="field-current-place">後慈湖</small><span aria-hidden="true">↗</span>
        </a>
      </nav>

      <p class="field-dashboard__source">
        天氣資料：<a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>。
        行前仍請以<a href="https://www.cwa.gov.tw/" target="_blank" rel="noopener noreferrer">中央氣象署</a>、
        <a href="https://168.thb.gov.tw/" target="_blank" rel="noopener noreferrer">公路局即時路況</a>與現場標誌為準。
      </p>
    `;
  }

  function mountDashboard() {
    if (document.getElementById("field-dashboard")) return;

    const hero = document.querySelector(".hero");
    if (!hero) return;

    const section = document.createElement("section");
    section.className = "field-dashboard";
    section.id = "field-dashboard";
    section.setAttribute("aria-labelledby", "field-dashboard-title");
    section.innerHTML = dashboardMarkup();
    hero.insertAdjacentElement("afterend", section);

    document
      .getElementById("field-dashboard-refresh")
      ?.addEventListener("click", () => updateWeather(true));

    watchCameraContext();
    updateContext(true);
    window.setInterval(() => updateWeather(false), refreshInterval);
  }

  function readCameraContext() {
    const coordinateText =
      document.querySelector(".info-strip div:first-child strong")?.textContent || "";
    const matches = coordinateText.match(
      /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
    );
    const rawName =
      document.querySelector(".camera-heading h2")?.textContent?.trim() || "";
    const name =
      rawName
        .replace(/現場即時影像/g, "")
        .replace(/即時影像/g, "")
        .trim() || defaultContext.name;

    return {
      latitude: matches ? Number(matches[1]) : defaultContext.latitude,
      longitude: matches ? Number(matches[2]) : defaultContext.longitude,
      name,
    };
  }

  function updateContext(forceWeather = false) {
    const nextContext = readCameraContext();
    const locationChanged =
      Math.abs(nextContext.latitude - currentContext.latitude) > 0.0001 ||
      Math.abs(nextContext.longitude - currentContext.longitude) > 0.0001;
    const nameChanged = nextContext.name !== currentContext.name;
    currentContext = nextContext;

    const title = document.getElementById("field-dashboard-title");
    const place = document.getElementById("field-current-place");
    const trafficLink = document.getElementById("field-traffic-link");
    const locationLink = document.getElementById("field-location-link");

    if (title) title.textContent = `${currentContext.name}現場判斷`;
    if (place) place.textContent = currentContext.name;
    if (trafficLink) {
      const center = `${currentContext.latitude},${currentContext.longitude}`;
      trafficLink.href =
        "https://www.google.com/maps/@?api=1&map_action=map" +
        `&center=${encodeURIComponent(center)}&zoom=14&basemap=roadmap&layer=traffic`;
    }
    if (locationLink) {
      locationLink.href =
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(
          `${currentContext.latitude},${currentContext.longitude}`,
        );
    }

    if (forceWeather || locationChanged || nameChanged) {
      updateWeather(forceWeather);
    }
  }

  function watchCameraContext() {
    const targets = [
      document.querySelector(".camera-heading h2"),
      document.querySelector(".info-strip"),
    ].filter(Boolean);

    if (!targets.length || typeof MutationObserver === "undefined") return;

    const observer = new MutationObserver(() => {
      window.clearTimeout(contextTimer);
      contextTimer = window.setTimeout(() => updateContext(false), 180);
    });

    targets.forEach((target) =>
      observer.observe(target, {
        childList: true,
        characterData: true,
        subtree: true,
      }),
    );
  }

  function cacheKey() {
    return `daxi-live-weather:${currentContext.latitude.toFixed(3)}:${currentContext.longitude.toFixed(3)}`;
  }

  function readCache() {
    try {
      const cached = JSON.parse(window.localStorage.getItem(cacheKey()));
      if (!cached || !cached.savedAt || !cached.data) return null;
      return cached;
    } catch {
      return null;
    }
  }

  function writeCache(data) {
    try {
      window.localStorage.setItem(
        cacheKey(),
        JSON.stringify({ savedAt: Date.now(), data }),
      );
    } catch {
      // Weather still works when storage is unavailable.
    }
  }

  function buildWeatherUrl() {
    const params = new URLSearchParams({
      latitude: String(currentContext.latitude),
      longitude: String(currentContext.longitude),
      current:
        "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day",
      hourly: "precipitation_probability,precipitation",
      forecast_days: "2",
      timezone: "Asia/Taipei",
    });
    return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  }

  async function updateWeather(force = false) {
    const refresh = document.getElementById("field-dashboard-refresh");
    const status = document.getElementById("field-dashboard-status");
    if (!refresh || !status) return;

    const cached = readCache();
    if (cached) {
      renderWeather(cached.data, cached.savedAt);
      if (!force && Date.now() - cached.savedAt < cacheDuration) return;
    }

    if (activeRequest) activeRequest.abort();
    const controller = new AbortController();
    activeRequest = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);

    refresh.classList.add("is-loading");
    refresh.setAttribute("aria-busy", "true");
    setStatus("正在更新天氣", "loading");

    try {
      const response = await fetch(buildWeatherUrl(), {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);

      const data = await response.json();
      if (!data.current) throw new Error("Weather response is incomplete");

      writeCache(data);
      renderWeather(data, Date.now());
    } catch {
      if (activeRequest === controller) renderWeatherError();
    } finally {
      window.clearTimeout(timeoutId);
      if (activeRequest === controller) {
        activeRequest = null;
        refresh.classList.remove("is-loading");
        refresh.removeAttribute("aria-busy");
      }
    }
  }

  function renderWeather(data, savedAt) {
    const current = data.current || {};
    const code = Number(current.weather_code);
    const rainProbability = nextRainProbability(data);
    const weather = weatherDescription(code, Number(current.is_day));

    setText("field-weather-icon", weather.icon);
    setText("field-weather-title", weather.label);
    setText("field-temperature", rounded(current.temperature_2m));
    setText("field-apparent", rounded(current.apparent_temperature));
    setText("field-wind", rounded(current.wind_speed_10m));
    setText("field-rain-probability", rounded(rainProbability));
    setText("field-precipitation", decimal(current.precipitation));
    setText("field-gust", rounded(current.wind_gusts_10m));

    const advice = weatherAdvice(
      code,
      rainProbability,
      Number(current.wind_gusts_10m),
    );
    const time = current.time?.split("T")[1] || formatTime(savedAt);
    setStatus(`${advice.label}・${time} 更新`, advice.tone);
  }

  function renderWeatherError() {
    [
      "field-temperature",
      "field-apparent",
      "field-wind",
      "field-rain-probability",
      "field-precipitation",
      "field-gust",
    ].forEach((id) => setText(id, "--"));
    setText("field-weather-icon", "！");
    setText("field-weather-title", "暫時無法取得");
    setStatus("天氣連線失敗・可稍後更新", "error");
  }

  function nextRainProbability(data) {
    const times = data.hourly?.time || [];
    const values = data.hourly?.precipitation_probability || [];
    if (!times.length || !values.length) return 0;

    const hour = `${data.current?.time?.slice(0, 13) || ""}:00`;
    let start = times.findIndex((time) => time >= hour);
    if (start < 0) start = 0;

    return Math.max(
      0,
      ...values
        .slice(start, start + 4)
        .map((value) => Number(value))
        .filter(Number.isFinite),
    );
  }

  function weatherDescription(code, isDay) {
    if (code === 0) return { label: "晴朗", icon: isDay ? "晴" : "月" };
    if (code === 1) return { label: "大致晴朗", icon: isDay ? "晴" : "月" };
    if (code === 2) return { label: "局部多雲", icon: "雲" };
    if (code === 3) return { label: "多雲", icon: "雲" };
    if (code === 45 || code === 48) return { label: "有霧", icon: "霧" };
    if (code >= 51 && code <= 57) return { label: "毛毛雨", icon: "雨" };
    if (code >= 61 && code <= 67) return { label: "下雨", icon: "雨" };
    if (code >= 71 && code <= 77) return { label: "降雪", icon: "雪" };
    if (code >= 80 && code <= 82) return { label: "陣雨", icon: "雨" };
    if (code >= 85 && code <= 86) return { label: "陣雪", icon: "雪" };
    if (code >= 95) return { label: "雷雨", icon: "雷" };
    return { label: "天氣變化中", icon: "氣" };
  }

  function weatherAdvice(code, rainProbability, gust) {
    if (code >= 95 || rainProbability >= 80 || gust >= 60) {
      return { label: "先看警報路況", tone: "danger" };
    }
    if (
      rainProbability >= 50 ||
      (code >= 45 && code <= 82) ||
      gust >= 40
    ) {
      return { label: "帶傘慢行", tone: "watch" };
    }
    return { label: "天氣尚可", tone: "good" };
  }

  function setStatus(message, tone) {
    const status = document.getElementById("field-dashboard-status");
    if (!status) return;
    const text = status.querySelector("span");
    if (text) text.textContent = message;
    status.dataset.tone = tone;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
  }

  function rounded(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : "--";
  }

  function decimal(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(1) : "--";
  }

  function formatTime(timestamp) {
    return new Intl.DateTimeFormat("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Taipei",
    }).format(new Date(timestamp));
  }

  function start() {
    installStyles();
    window.setTimeout(mountDashboard, 350);
    window.setTimeout(mountDashboard, 1600);
  }

  if (document.readyState === "complete") {
    start();
  } else {
    window.addEventListener("load", start, { once: true });
  }
})();
