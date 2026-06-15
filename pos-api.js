/*
Houcihu POS Portal v4.4
GitHub Pages frontend API helper - no login key
Designed & Developed by Abby Luo
*/

const POS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw63eJnsg0a70IbZXBYWktt8CCDfx0mm_MAwzMRDoxKNNvcT2FTTMpJuU8f3qfqHjo/exec";
const POS_TIMEOUT = 10000;

function operatorName(){
  return localStorage.getItem("houcihu_pos_operator") || "staff";
}

function setOperatorName(name="staff"){
  localStorage.setItem("houcihu_pos_operator", String(name || "staff"));
}

function clearPosToken(){
  localStorage.removeItem("houcihu_pos_token");
  localStorage.removeItem("houcihu_pos_api_key");
}

function getPosKey(){
  return "";
}

function savePosToken(){
  return { auth:true };
}

function createTicketId(){
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const randomNum = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return "HCH" + yy + mm + dd + randomNum;
}

function convertItemsToOrder(payload){
  const order = {
    action: "saveOrder",
    ticketId: payload.ticketId || createTicketId(),
    cash_full: 0,
    cash_group: 0,
    cash_discount: 0,
    card_full: 0,
    card_group: 0,
    card_discount: 0,
    free: 0,
    total: Number(payload.totalAmount || 0),
    people: Number(payload.totalQty || 0),
    operator: payload.operator || operatorName() || "staff",
    clientTime: new Date().toISOString()
  };

  (payload.items || []).forEach(function(item){
    const qty = Number(item.qty || 0);
    if (!qty) return;

    if (item.id === "cashFull") order.cash_full += qty;
    if (item.id === "cashGroup") order.cash_group += qty;
    if (item.id === "cashHalf") order.cash_discount += qty;
    if (item.id === "easyFull") order.card_full += qty;
    if (item.id === "easyGroup") order.card_group += qty;
    if (item.id === "easyHalf") order.card_discount += qty;
    if (item.id === "free") order.free += qty;
  });

  return order;
}

async function posApiPost(order={}, retry=1){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POS_TIMEOUT);

  try{
    await fetch(POS_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(order),
      cache: "no-store",
      signal: controller.signal
    });

    clearTimeout(timer);

    // no-cors 無法讀取 Apps Script 回應；只要請求成功送出，就回傳本機票號讓前端列印。
    return {
      success: true,
      ok: true,
      status: "sent",
      ticketNo: order.ticketId,
      ticketId: order.ticketId,
      message: "交易已送出"
    };

  }catch(error){
    clearTimeout(timer);
    if(retry > 0) return posApiPost(order, retry - 1);
    return {
      success: false,
      ok: false,
      ticketNo: order.ticketId,
      ticketId: order.ticketId,
      message: error.message || "network error"
    };
  }
}

async function verifyPosKey(){
  return true;
}

async function submitSale(payload){
  const order = convertItemsToOrder(payload);
  return posApiPost(order, 1);
}

async function getTodaySummary(){
  // GitHub Pages 跨網域無法直接讀 Apps Script JSON 回應；人流與報表請以 Monitor / Google Sheet 為準。
  return {
    success: false,
    ok: false,
    message: "今日摘要請至即時統計或 Google Sheet 查看"
  };
}
