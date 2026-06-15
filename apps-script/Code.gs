// ========================================
// 後慈湖 POS Apps Script v4.3 PRO
// GitHub Pages 售票前台專用後端｜免 POS_KEY 版
// Designed & Developed by Abby Luo
// ========================================

const TX_SHEET = "交易紀錄";
const LOG_SHEET = "log";
const TZ = "Asia/Taipei";

function props_(){ return PropertiesService.getScriptProperties(); }
function sheetId_(){ return String(props_().getProperty("POS_SHEET_ID") || "").trim(); }
function now_(){ return Utilities.formatDate(new Date(), TZ, "yyyy/MM/dd HH:mm:ss"); }
function dayKey_(){ return Utilities.formatDate(new Date(), TZ, "yyyyMMdd"); }
function json_(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function db_(){
  const id = sheetId_();
  if(id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if(active) return active;
  throw new Error("missing POS_SHEET_ID");
}

function getSheet_(name, headers){
  let sh = db_().getSheetByName(name);
  if(!sh){
    sh = db_().insertSheet(name);
    if(headers && headers.length) sh.appendRow(headers);
  }
  return sh;
}

function txHeaders_(){
  return ["票號","時間","日期鍵","操作員","總張數","總金額","現金金額","悠遊卡金額","免費張數","明細JSON","前端時間"];
}

function txSheet_(){
  const sh = getSheet_(TX_SHEET, txHeaders_());
  const headers = txHeaders_();
  const current = sh.getRange(1,1,1,headers.length).getValues()[0];
  for(let i=0;i<headers.length;i++){
    if(String(current[i] || "") !== headers[i]) sh.getRange(1,i+1).setValue(headers[i]);
  }
  return sh;
}

function log_(action, msg){
  getSheet_(LOG_SHEET, ["時間","動作","內容"]).appendRow([now_(), action, msg]);
}

function doGet(e){
  return json_({success:true, ok:true, service:"Houcihu POS API", mode:"no-key", message:"POST only for sale actions"});
}

function doPost(e){
  const action = String((e.parameter.action || "")).toLowerCase();

  if(action === "verify") return json_({success:true, ok:true, message:"no key required", time:now_()});
  if(action === "sale") return saveSale_(e);
  if(action === "summary") return summary_();

  return json_({success:false, ok:false, message:"unknown action"});
}

function nextTicketNo_(sh, key){
  const rows = sh.getDataRange().getValues();
  let max = 0;
  for(let i=1;i<rows.length;i++){
    if(String(rows[i][2]) !== key) continue;
    const no = String(rows[i][0] || "");
    const m = no.match(/-(\d+)$/);
    if(m) max = Math.max(max, Number(m[1]));
  }
  return "HCH" + key + "-" + String(max + 1).padStart(5,"0");
}

function saveSale_(e){
  const lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try{
    const sh = txSheet_();
    const key = dayKey_();
    const ticketNo = nextTicketNo_(sh, key);
    const operator = String(e.parameter.operator || "staff").trim();
    const totalQty = Math.max(0, Number(e.parameter.totalQty || 0));
    const totalAmount = Math.max(0, Number(e.parameter.totalAmount || 0));
    const cashAmount = Math.max(0, Number(e.parameter.cashAmount || 0));
    const easycardAmount = Math.max(0, Number(e.parameter.easycardAmount || 0));
    const freeQty = Math.max(0, Number(e.parameter.freeQty || 0));
    const items = String(e.parameter.items || "[]");
    const clientTime = String(e.parameter.clientTime || "");

    if(totalQty <= 0) return json_({success:false, ok:false, message:"empty sale"});

    sh.appendRow([ticketNo, now_(), key, operator, totalQty, totalAmount, cashAmount, easycardAmount, freeQty, items, clientTime]);
    log_("SALE", ticketNo + " qty=" + totalQty + " amount=" + totalAmount);
    return json_({success:true, ok:true, ticketNo:ticketNo, time:now_()});
  }catch(err){
    try{ log_("ERROR", err.message); }catch(_){ }
    return json_({success:false, ok:false, message:err.message});
  }finally{
    try{ lock.releaseLock(); }catch(_){ }
  }
}

function summary_(){
  const sh = txSheet_();
  const rows = sh.getDataRange().getValues();
  const key = dayKey_();
  let count = 0, qty = 0, amount = 0, cash = 0, easycard = 0, freeQty = 0;
  for(let i=1;i<rows.length;i++){
    if(String(rows[i][2]) !== key) continue;
    count++;
    qty += Number(rows[i][4] || 0);
    amount += Number(rows[i][5] || 0);
    cash += Number(rows[i][6] || 0);
    easycard += Number(rows[i][7] || 0);
    freeQty += Number(rows[i][8] || 0);
  }
  return json_({success:true, ok:true, date:key, count, qty, amount, cash, easycard, freeQty, time:now_()});
}
