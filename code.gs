// ===============================
// 全域設定
// ===============================
const SHEET_ID = "1bW8HA7i2iaxT8v4nIlqCLP0GsYZXFBj_hykmLwD7qRE";
const SHEET_NAME = "交易紀錄";
const STATUS_SHEET_NAME = "RealTimeStatus";
const MAX_VISITORS = 50;

function getSpreadsheet() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function getSheet() {
  const sheet = getSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("找不到工作表：" + SHEET_NAME);
  return sheet;
}

function getStatusSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(STATUS_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(STATUS_SHEET_NAME);
  }

  if (sheet.getLastRow() < 1) {
    sheet.appendRow(["時間", "類型", "人數", "來源"]);
  }

  return sheet;
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === "getCount") {
    return jsonOutput(getCounts(getStatusSheet()));
  }

  const page = e && e.parameter && e.parameter.page ? e.parameter.page : "index";

  if (page === "status") {
    return HtmlService.createHtmlOutputFromFile("Status")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  return HtmlService.createHtmlOutputFromFile("index")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function buildIndexMap(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const map = {};

  for (let i = 0; i < data.length; i++) {
    map[String(data[i][0])] = i + 2;
  }

  return map;
}

function saveOrder(order) {
  if (!order || !order.ticketId) {
    throw new Error("缺少票號");
  }

  const sheet = getSheet();
  const index = buildIndexMap(sheet);

  if (index[String(order.ticketId)]) {
    throw new Error("票號重複");
  }

  const row = sheet.getLastRow() + 1;

  const ticketType = (Number(order.cash_group || 0) > 0 || Number(order.card_group || 0) > 0) ? "團體" : "散客";

sheet.getRange(row, 1, 1, 13).setValues([[ order.ticketId, new Date(), order.cash_full || 0, order.cash_group || 0, order.cash_discount || 0, order.card_full || 0, order.card_group || 0, order.card_discount || 0, order.free || 0, order.total || 0, "尚未使用", ticketType, order.people || 0 ]]);






  return order.ticketId;
}

function verifyTicketAndGetDetail(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet();
    const indexMap = buildIndexMap(sheet);
    const row = indexMap[String(id)];

    if (!row) {
      return {
        ok: false,
        msg: "❌ 查無此票",
        detail: null
      };
    }

    const values = sheet.getRange(row, 1, 1, 13).getValues()[0];

    const detail = {
      people: values[12],
      cash_full: values[2],
      cash_group: values[3],
      cash_discount: values[4],
      card_full: values[5],
      card_group: values[6],
      card_discount: values[7],
      free: values[8]
    };

    if (values[10] === "已使用") {
      return {
        ok: false,
        msg: "⚠️ 重複掃描",
        detail: detail
      };
    }

    sheet.getRange(row, 11).setValue("已使用");

    return {
      ok: true,
      msg: "🟢 驗票成功",
      detail: detail
    };

  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  const logSheet = getStatusSheet();

  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("缺少 POST 資料");
    }

    const data = JSON.parse(e.postData.contents);

    if (data.type === "OUT" || (data.type === "IN" && !data.id)) {
      appendStatusLog(logSheet, data);
      return returnCount(logSheet);
    }

    const id = data.id;
    if (!id) throw new Error("缺少票號");

    const result = verifyTicketAndGetDetail(id);

    if (result.ok) {
      appendStatusLog(logSheet, {
        type: "IN",
        delta: Number(result.detail.people || 1),
        source: "掃描入園",
        note: id
      });
    }

    const counts = getCounts(logSheet);

    return jsonOutput({
      ok: result.ok,
      msg: result.msg,
      detail: result.detail,
      current: counts.current,
      remain: counts.remain,
      in: counts.in,
      out: counts.out
    });

  } catch (err) {
    return jsonOutput({
      ok: false,
      msg: err.message
    });
  }
}

function appendStatusLog(logSheet, data) {
  let type = data.type;
  let delta = Number(data.delta || 1);

  if (type === "IN" && delta < 0) {
    type = "OUT";
    delta = Math.abs(delta);
  }

  if (type === "OUT" && delta < 0) {
    type = "IN";
    delta = Math.abs(delta);
  }

  const row = logSheet.getLastRow() + 1;

  logSheet.getRange(row, 1, 1, 4).setValues([[
    new Date(),
    type,
    delta,
    data.note
      ? (data.source || "手動操作") + " / " + data.note
      : data.source || "手動操作"
  ]]);
}

function getCounts(sheet) {
  let currentIn = 0;
  let currentOut = 0;
  let todayIn = 0;
  let todayOut = 0;

  if (!sheet || sheet.getLastRow() <= 1) {
    return {
      current: 0,
      remain: MAX_VISITORS,
      in: 0,
      out: 0
    };
  }

  const vals = sheet.getDataRange().getValues();
  const todayStart = new Date().setHours(0, 0, 0, 0);

  for (let i = 1; i < vals.length; i++) {
    const time = new Date(vals[i][0]).getTime();
    const type = vals[i][1];
    const num = Number(vals[i][2]) || 0;

    if (type === "IN") currentIn += num;
    if (type === "OUT") currentOut += num;

    if (!isNaN(time) && time >= todayStart) {
      if (type === "IN") todayIn += num;
      if (type === "OUT") todayOut += num;
    }
  }

  const current = Math.max(0, currentIn - currentOut);

  return {
    current: current,
    remain: Math.max(0, MAX_VISITORS - current),
    in: todayIn,
    out: todayOut
  };
}

function returnCount(sheet) {
  const counts = getCounts(sheet);

  return jsonOutput({
    status: "success",
    current: counts.current,
    remain: counts.remain,
    in: counts.in,
    out: counts.out
  });
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function cleanOldStatus() {
  const sheet = getStatusSheet();
  const data = sheet.getDataRange().getValues();

  const todayStart = new Date().setHours(0, 0, 0, 0);

  const filtered = data.filter((row, i) => {
    if (i === 0) return true;
    return new Date(row[0]).getTime() >= todayStart;
  });

  sheet.clear();
  sheet.getRange(1, 1, filtered.length, filtered[0].length).setValues(filtered);
}
