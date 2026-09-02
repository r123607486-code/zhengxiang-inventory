// KYB utility patch — defines 5 helper functions missing from this version of core.js
// Using var / function declarations so they can safely coexist with a later fixed core.js
var PENDING_STOCK_CODE = "尚未入庫";
function kybLocQty(val){ return Number(val) || 0; }
function kybHasPendingStock(item){
  return kybLocQty((item.locations||{})[PENDING_STOCK_CODE]) > 0;
}
function kybLocList(item){
  const locs = item.locations || {};
  const rows = Object.keys(locs).map(code=>({code, qty:kybLocQty(locs[code])})).filter(r=>r.qty>0);
  rows.sort((a,b)=> a.code.localeCompare(b.code, "zh-Hant"));
  return rows;
}
function kybLocSummary(item){
  const list = kybLocList(item);
  return list.map(l=>`${l.code}x${l.qty}`).join("、") || "-";
}
