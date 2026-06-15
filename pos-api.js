/*
Houcihu POS Portal v4.2
GitHub Pages frontend API helper
Designed & Developed by Abby Luo
*/

const POS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbw5VQi-dtLodRQbKTgzueGGXgMBBedA_Th93Skr_Dia3-JYbxtd00shnZ24axbznDY/exec";
const POS_TOKEN_KEY = "houcihu_pos_token";
const POS_API_KEY = "houcihu_pos_api_key";
const POS_TIMEOUT = 10000;

function posNow(){ return Date.now(); }

function getPosKey(){
  try{
    const raw = localStorage.getItem(POS_TOKEN_KEY);
    const token = raw ? JSON.parse(raw) : null;
    if(token && token.auth && token.apiKey && posNow() < token.expire) return token.apiKey;
  }catch(_){ }
  return localStorage.getItem(POS_API_KEY) || "";
}

function savePosToken(apiKey, userName="staff"){
  const now = posNow();
  const token = { auth:true, apiKey, userName, time:now, expire:now + 12 * 60 * 60 * 1000 };
  localStorage.setItem(POS_TOKEN_KEY, JSON.stringify(token));
  localStorage.setItem(POS_API_KEY, apiKey);
  return token;
}

function clearPosToken(){
  localStorage.removeItem(POS_TOKEN_KEY);
  localStorage.removeItem(POS_API_KEY);
}

function requirePosKey(){
  const key = getPosKey();
  if(!key) throw new Error("missing pos key");
  return key;
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

async function verifyPosKey(apiKey){
  const res = await posApiPost({ action:"verify", key:apiKey }, 0);
  return !!(res && (res.success === true || res.ok === true));
}

async function submitSale(payload){
  return posApiPost({
    action:"sale",
    key:requirePosKey(),
    operator:payload.operator || "staff",
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
  return posApiPost({ action:"summary", key:requirePosKey() }, 1);
}
