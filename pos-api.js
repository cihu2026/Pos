/*
Houcihu POS Portal v4.3
GitHub Pages frontend API helper - no login key
Designed & Developed by Abby Luo
*/

const POS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw5VQi-dtLodRQbKTgzueGGXgMBBedA_Th93Skr_Dia3-JYbxtd00shnZ24axbznDY/exec";
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

async function posApiPost(data={}, retry=1){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POS_TIMEOUT);
  try{
    const response = await fetch(POS_WEB_APP_URL, {
      method:"POST",
      headers:{ "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8" },
      body:new URLSearchParams(data),
      cache:"no-store",
      signal:controller.signal
    });
    clearTimeout(timer);
    const text = await response.text();
    try{ return JSON.parse(text); }catch(_){ return { success:false, message:text || "empty response" }; }
  }catch(error){
    clearTimeout(timer);
    if(retry > 0) return posApiPost(data, retry - 1);
    return { success:false, message:error.message || "network error" };
  }
}

async function verifyPosKey(){
  return true;
}

async function submitSale(payload){
  return posApiPost({
    action:"sale",
    operator:payload.operator || operatorName() || "staff",
    totalQty:payload.totalQty || 0,
    totalAmount:payload.totalAmount || 0,
    cashAmount:payload.cashAmount || 0,
    easycardAmount:payload.easycardAmount || 0,
    freeQty:payload.freeQty || 0,
    items:JSON.stringify(payload.items || []),
    clientTime:new Date().toISOString()
  }, 1);
}

async function getTodaySummary(){
  return posApiPost({ action:"summary" }, 1);
}
