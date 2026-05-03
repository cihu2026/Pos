// ===============================
// 全域設定
// ===============================
const SHEET_ID = "1bW8HA7i2iaxT8v4nIlqCLP0GsYZXFBj_hykmLwD7qRE";
const SHEET_NAME = "交易紀錄";

function getSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("找不到工作表：" + SHEET_NAME);
  return sheet;
}

// ===============================
// 網頁入口 (doGet)
// ===============================
function doGet(e) {
  if (e.parameter.action === "getCount") {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName("RealTimeStatus");
    const counts = getCounts(logSheet);
    return ContentService.createTextOutput(JSON.stringify(counts))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const page = e?.parameter?.page || "index";
  if (page === "status") {
    return HtmlService.createHtmlOutputFromFile("Status").addMetaTag("viewport", "width=device-width, initial-scale=1");
  }
  return HtmlService.createHtmlOutputFromFile("index").addMetaTag("viewport", "width=device-width, initial-scale=1");
}

// ===============================
// 售票存檔
// ===============================
function saveOrder(order) {
  const sheet = getSheet();
  sheet.appendRow([
    order.ticketId, new Date(), 
    order.cash_full || 0, order.cash_group || 0, order.cash_discount || 0, 
    order.card_full || 0, order.card_group || 0, order.card_discount || 0, 
    order.free || 0, order.total || 0, 
    "尚未使用", order.type || "後慈湖門票", order.people || 0
  ]);
  return order.ticketId;
}

// ===============================
// ✅ 核心 API：處理所有 POST 請求
// ===============================
function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName("RealTimeStatus") || ss.insertSheet("RealTimeStatus");
  
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.type === "OUT" || (data.type === "IN" && !data.id)) {
      logSheet.appendRow([
        new Date(), 
        data.type, 
        Number(data.delta || 1), 
        data.source || "手動操作"
      ]);
      return returnCount(logSheet);
    }

    const id = data.id;
    if (!id) throw new Error("缺少票號");

    const detail = getTicketDetailForVerify(id);
    if (!detail) throw new Error("查無此票號");

    const result = verifyTicket(id);
    const isSuccess = result.includes("🟢");

    if (isSuccess) {
      logSheet.appendRow([
        new Date(), 
        "IN", 
        Number(detail.people || 1), 
        "掃描自動入園: " + id
      ]);
    }

    const counts = getCounts(logSheet);

    return ContentService.createTextOutput(JSON.stringify({
      ok: isSuccess,
      msg: result,
      detail: detail,
      current: counts.current
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      ok: false, 
      msg: err.message 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ===============================
// 輔助函式庫
// ===============================

function verifyTicket(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        if (data[i][10] === "已使用") return "❌ 已使用";
        sheet.getRange(i + 1, 11).setValue("已使用");
        return "🟢 驗票成功";
      }
    }
    return "❌ 查無此票";
  } finally { lock.releaseLock(); }
}

function getTicketDetailForVerify(id) {
  const data = getSheet().getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      return {
        people: data[i][12],
        cash_full: data[i][2],
        cash_group: data[i][3],
        cash_discount: data[i][4],
        card_full: data[i][5],
        card_group: data[i][6], // 修正 index
        card_discount: data[i][7],
        free: data[i][8]
      };
    }
  }
  return null;
}

// 💎 核心修改：整合後的 getCounts (支援主管網頁)
function getCounts(sheet) {
  let currentIn = 0, currentOut = 0;
  let todayIn = 0, todayOut = 0; 
  
  const vals = sheet.getDataRange().getValues();
  if (vals.length <= 1) return { current: 0, in: 0, out: 0 }; 

  const todayStart = new Date().setHours(0, 0, 0, 0);

  for (let i = 1; i < vals.length; i++) {
    const timeVal = vals[i][0];
    const time = (timeVal instanceof Date) ? timeVal.getTime() : new Date(timeVal).getTime();
    const type = vals[i][1];
    const num = Number(vals[i][2]) || 0;
    
    if (type === "IN") currentIn += num;
    if (type === "OUT") currentOut += num;

    if (time >= todayStart) {
      if (type === "IN") todayIn += num;
      if (type === "OUT") todayOut += num;
    }
  }

  return { 
    current: currentIn - currentOut,
    in: todayIn,
    out: todayOut
  };
}

function returnCount(sheet) {
  const counts = getCounts(sheet);
  return ContentService.createTextOutput(JSON.stringify({ 
    status: "success", 
    current: counts.current 
  })).setMimeType(ContentService.MimeType.JSON);
}
