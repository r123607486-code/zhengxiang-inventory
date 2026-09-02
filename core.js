// ============================================================
// 正享有限公司庫存管理系統 — 共用核心（常數／狀態／工具函式／登入／分類切換／分頁／監聽器啟動）
// ============================================================

// 效期反紅：改為由使用者在「庫存總表」頁面點擊選擇門檻年限（1-9年）才會反紅，不再自動顯示。
const DEFAULT_BRANDS = [
  "賽輪Sailun","韓泰Hankook","阿基里斯Achilles","安馳ANCHEE","薩馳輪胎ARDUZZA",
  "黑獅輪胎Blacklion","庫斯通KUSTONE","牛頓輪胎NEUTON","尼克森NEXEN",
  "路德斯通ROAD.STONE","萬峰馳輪胎WINDFORCE","薩提諾ZESTINO"
];

const ICONS = {
  query: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  master:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="10" x2="9" y2="20"/></svg>',
  txn:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h13l-2-3M21 17H8l2 3"/></svg>',
  loc:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  import:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><rect x="3" y="17" width="18" height="4" rx="1"/></svg>',
  users: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="18" cy="7" r="3"/><path d="M21 21v-1.5a3 3 0 0 0-2-2.83"/></svg>',
  orders:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>'
};

// ============================================================
// 狀態
// ============================================================
let currentUser = null;   // { uid, name, role }
let currentCategory = null; // 'tire' | 'kyb' | 'pad'

// 輪胎
let itemsCache = [];        // padItems snapshot
let txnCache = [];          // transactions snapshot
let locationsCache = [];    // locations snapshot
let ordersCache = [];       // orders (admin)
let myOrdersCache = [];     // orders (staff)

// KYB
let kybItemsCache = [];
let kybTxnCache = [];
let kybLocationsCache = [];
let kybOrdersCache = [];
let kybMyOrdersCache = [];

// PAD
let padItemsCache = [];
let padTxnCache = [];
let padLocationsCache = [];
let padOrdersCache = [];
let padMyOrdersCache = [];

// Firestore 監聽器解除函式
let unsubItems = null, unsubTxns = null, unsubLocations = null;
let unsubOrders = null, unsubMyOrders = null;
let unsubKybItems = null, unsubKybTxns = null, unsubKybLocations = null;
let unsubKybOrders = null, unsubKybMyOrders = null;
let unsubPadItems = null, unsubPadTxns = null, unsubPadLocations = null;
let unsubPadOrders = null, unsubPadMyOrders = null;

// ============================================================
// 常用工具
// ============================================================
function norm(s){ return (s||"").normalize("NFKC").toLowerCase(); }
function escapeHtml(s){
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function toTaipeiTimeStr(isoStr){
  if(!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleString("zh-TW",{timeZone:"Asia/Taipei",hour12:false});
}
function txnTypeLabel(t){
  if(t.type==="in") return "進貨";
  if(t.type==="out") return "銷貨";
  if(t.type==="adjust") return t.adjustSign==="+"?"調正":"調負";
  return t.type||"";
}
function txnSign(t){
  if(t.type==="in") return 1;
  if(t.type==="out") return -1;
  if(t.type==="adjust") return t.adjustSign==="+"?1:-1;
  return 0;
}
function salespersonFieldHtml(id, val){
  const opts = ["王小明","陳美玲","李志遠","張大偉","林雅惠","吳建宏","黃淑芬"];
  return `<div class="form-row"><label>業務姓名</label>
    <input type="text" id="${id}" list="${id}-list" value="${escapeHtml(val)}" placeholder="輸入或選擇業務姓名">
    <datalist id="${id}-list">${opts.map(o=>`<option value="${o}">`).join("")}</datalist>
  </div>`;
}

// ============================================================
// 輪胎庫存工具
// ============================================================
function qtyByLoc(item){
  const m = {};
  (item.locations||[]).forEach(l=>{ m[l.code] = (m[l.code]||0) + l.qty; });
  return m;
}
function totalQty(item){
  return (item.locations||[]).reduce((s,l)=>s+l.qty, 0);
}
function itemLabel(item){
  return [item.brand, item.model, item.spec].filter(Boolean).join(" ");
}

// ============================================================
// KYB 庫存工具
// ============================================================
function kybQtyByLoc(item){
  const locs = item.locations || {};
  if(Array.isArray(locs)){
    const m = {};
    locs.forEach(l=>{ m[l.code] = (m[l.code]||0) + l.qty; });
    return m;
  }
  return {...locs};
}
function kybTotalQty(item){
  const locs = item.locations||{};
  if(Array.isArray(locs)) return locs.reduce((s,l)=>s+l.qty,0);
  return Object.values(locs).reduce((s,v)=>s+(Number(v)||0),0);
}
function kybItemLabel(item){
  const parts = [item.carModel, item.brand, item.type].filter(Boolean);
  return parts.join(" ");
}

// ============================================================
// Pad 庫存工具
// ============================================================
function padLocQty(val){
  if(val === undefined || val === null) return 0;
  return Number(val) || 0;
}
function padTotalQty(item, side){
  const locs = side === "rear" ? (item.locationsRear||{}) : (item.locationsFront || item.locations || {});
  return Object.values(locs).reduce((s,v)=>s+(Number(v)||0), 0);
}
function padItemLabel(item){
  return [item.carModel, item.year, item.spec].filter(Boolean).join(" ");
}
function padLocList(item, side){
  const locs = side === "rear" ? (item.locationsRear||{}) : (item.locationsFront || item.locations || {});
  return Object.entries(locs)
    .map(([code, qty])=>({code, qty: Number(qty)||0}))
    .filter(o=>o.qty > 0)
    .sort((a,b)=>a.code.localeCompare(b.code,'zh-Hant'));
}

// ============================================================
// 週幾工具
// ============================================================
function isFriday(){
  return new Date().getDay() === 5;
}

// ============================================================
// 登入 / 登出
// ============================================================
document.getElementById("loginBtn").addEventListener("click", doLogin);
document.getElementById("loginPassword").addEventListener("keydown", e=>{ if(e.key==="Enter") doLogin(); });

async function doLogin(){
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginErr");
  errEl.textContent = "";
  if(!username||!password){ errEl.textContent="請輸入帳號和密碼"; return; }
  try{
    const snap = await db.collection("users").where("username","==",username).get();
    if(snap.empty){ errEl.textContent="帳號或密碼錯誤"; return; }
    const userDoc = snap.docs[0];
    const data = userDoc.data();
    if(data.password !== password){ errEl.textContent="帳號或密碼錯誤"; return; }
    if(data.active === false){ errEl.textContent="此帳號已停用，請聯絡管理者"; return; }
    currentUser = { uid: userDoc.id, name: data.name, role: data.role };
    document.getElementById("splash").classList.add("hidden");
    showCategoryScreen();
  }catch(e){
    console.error("登入錯誤", e);
    errEl.textContent = "登入失敗，請檢查網路連線";
  }
}

function doLogout(){
  stopAllListeners();
  currentUser = null;
  currentCategory = null;
  document.getElementById("app").classList.add("hidden");
  document.getElementById("categoryScreen").classList.add("hidden");
  document.getElementById("loginUsername").value = "";
  document.getElementById("loginPassword").value = "";
  document.getElementById("loginErr").textContent = "";
  document.getElementById("splash").classList.remove("hidden");
}

document.getElementById("logoutBtn").addEventListener("click", doLogout);

// ============================================================
// 改密碼
// ============================================================
document.getElementById("changePwBtn").addEventListener("click", ()=>{
  const html = `
    <div class="sheet-head"><h2>修改密碼</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>舊密碼</label><input type="password" id="oldPwInput"></div>
    <div class="form-row"><label>新密碼</label><input type="password" id="newPwInput"></div>
    <div class="form-row"><label>確認新密碼</label><input type="password" id="confirmPwInput"></div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="changePwSubmit">確認修改</button>
    </div>`;
  openModal(html);
  document.getElementById("changePwSubmit").addEventListener("click", async ()=>{
    const old = document.getElementById("oldPwInput").value;
    const nw  = document.getElementById("newPwInput").value;
    const cf  = document.getElementById("confirmPwInput").value;
    if(!old||!nw){ alert("請填寫所有欄位"); return; }
    if(nw !== cf){ alert("新密碼與確認不一致"); return; }
    const snap = await db.collection("users").doc(currentUser.uid).get();
    if(!snap.exists||snap.data().password!==old){ alert("舊密碼錯誤"); return; }
    await db.collection("users").doc(currentUser.uid).update({password:nw});
    alert("密碼已修改成功");
    closeModal();
  });
});

// ============================================================
// 品項分類選擇
// ============================================================
function showCategoryScreen(){
  stopAllListeners();
  currentCategory = null;
  document.getElementById("app").classList.add("hidden");
  document.getElementById("categoryScreen").classList.remove("hidden");

  // 顯示各分類圖示
  const catIconEl = (id) => document.getElementById(id);
  catIconEl("categoryIconTire").innerHTML  = ICONS.query;
  catIconEl("categoryIconKyb").innerHTML   = ICONS.master;
  catIconEl("categoryIconPad").innerHTML   = ICONS.txn;
}

document.querySelectorAll(".category-card").forEach(card=>{
  card.addEventListener("click", ()=>{
    const cat = card.dataset.category;
    currentCategory = cat;
    document.getElementById("categoryScreen").classList.add("hidden");
    enterCategory(cat);
  });
});

document.getElementById("switchCategoryBtn").addEventListener("click", showCategoryScreen);

function enterCategory(cat){
  renderTabs();
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("whoLabel").textContent = currentUser.name;
  const titleMap = { tire:"正享庫存管理系統", kyb:"KYB避震器庫存", pad:"YangPo來令片庫存" };
  document.getElementById("appTitle").textContent = titleMap[cat] || "正享庫存管理系統";
  startListeners();
  if(isFriday()){
    const banner = document.getElementById("backupBanner");
    banner.classList.remove("hidden");
  }
}

// ============================================================
// 頁籤定義
// ============================================================
const TIRE_TABS = [
  { id:"query",   label:"庫存查詢",   icon:ICONS.query,  roles:["admin","staff"] },
  { id:"master",  label:"庫存總表",   icon:ICONS.master, roles:["admin"] },
  { id:"txn",     label:"進銷貨管理", icon:ICONS.txn,    roles:["admin"] },
  { id:"orders",  label:"訂單管理",   icon:ICONS.orders, roles:["admin"] },
  { id:"myorders",label:"我的訂單",   icon:ICONS.orders, roles:["staff"] },
  { id:"loc",     label:"儲位管理",   icon:ICONS.loc,    roles:["admin"] },
  { id:"import",  label:"資料匯入",   icon:ICONS.import, roles:["admin"] },
  { id:"users",   label:"使用者管理", icon:ICONS.users,  roles:["admin"] }
];
const KYB_TABS = [
  { id:"kyb-query",   label:"庫存查詢",   icon:ICONS.query,  roles:["admin","staff"] },
  { id:"kyb-master",  label:"庫存總表",   icon:ICONS.master, roles:["admin"] },
  { id:"kyb-txn",     label:"進銷貨管理", icon:ICONS.txn,    roles:["admin"] },
  { id:"kyb-orders",  label:"訂單管理",   icon:ICONS.orders, roles:["admin"] },
  { id:"kyb-myorders",label:"我的訂單",   icon:ICONS.orders, roles:["staff"] },
  { id:"kyb-loc",     label:"儲位管理",   icon:ICONS.loc,    roles:["admin"] },
  { id:"kyb-import",  label:"資料匯入",   icon:ICONS.import, roles:["admin"] },
  { id:"users",       label:"使用者管理", icon:ICONS.users,  roles:["admin"] }
];
const PAD_TABS = [
  { id:"pad-query",   label:"庫存查詢",   icon:ICONS.query,  roles:["admin","staff"] },
  { id:"pad-master",  label:"庫存總表",   icon:ICONS.master, roles:["admin"] },
  { id:"pad-txn",     label:"進銷貨管理", icon:ICONS.txn,    roles:["admin"] },
  { id:"pad-orders",  label:"訂單管理",   icon:ICONS.orders, roles:["admin"] },
  { id:"pad-myorders",label:"我的訂單",   icon:ICONS.orders, roles:["staff"] },
  { id:"pad-loc",     label:"儲位管理",   icon:ICONS.loc,    roles:["admin"] },
  { id:"pad-import",  label:"資料匯入",   icon:ICONS.import, roles:["admin"] },
  { id:"users",       label:"使用者管理", icon:ICONS.users,  roles:["admin"] }
];
function currentTabDefs(){
  if(currentCategory==="kyb") return KYB_TABS;
  if(currentCategory==="pad") return PAD_TABS;
  return TIRE_TABS;
}

// ============================================================
// 頁籤渲染
// ============================================================
function renderTabs(){
  stopLazyTireOrdersListener();
  stopLazyKybOrdersListener();
  stopLazyPadOrdersListener();

  const nav = document.getElementById("tabs");
  const visible = currentTabDefs().filter(t=>t.roles.includes(currentUser.role));
  nav.innerHTML = visible.map((t,i)=>
    `<button data-tab="${t.id}" class="${i===0?'active':''}">` +
    `${t.icon}${t.label}` +
    `${t.id==='orders'?'<span class="badge-dot hidden" id="ordersTabBadge">0</span>':''}` +
    `${t.id==='kyb-orders'?'<span class="badge-dot hidden" id="kybOrdersTabBadge">0</span>':''}` +
    `${t.id==='pad-orders'?'<span class="badge-dot hidden" id="padOrdersTabBadge">0</span>':''}` +
    `</button>`
  ).join("");
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById("page-"+visible[0].id).classList.add("active");
  nav.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      nav.querySelectorAll("button").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
      document.getElementById("page-"+btn.dataset.tab).classList.add("active");
      if(btn.dataset.tab==="orders") startLazyTireOrdersListener();
      if(btn.dataset.tab==="kyb-orders") startLazyKybOrdersListener();
      if(btn.dataset.tab==="pad-orders") startLazyPadOrdersListener();
    });
  });
}

// ============================================================
// 監聽器開關
// ============================================================
function stopAllListeners(){
  [unsubItems,unsubTxns,unsubLocations,unsubOrders,unsubMyOrders,
   unsubKybItems,unsubKybTxns,unsubKybLocations,unsubKybOrders,unsubKybMyOrders,
   unsubPadItems,unsubPadTxns,unsubPadLocations,unsubPadOrders,unsubPadMyOrders
  ].forEach(u=>u&&u());
  unsubItems=unsubTxns=unsubLocations=unsubOrders=unsubMyOrders=null;
  unsubKybItems=unsubKybTxns=unsubKybLocations=unsubKybOrders=unsubKybMyOrders=null;
  unsubPadItems=unsubPadTxns=unsubPadLocations=unsubPadOrders=unsubPadMyOrders=null;
}

function startListeners(){
  if(currentCategory==="tire") startTireListeners();
  else if(currentCategory==="kyb") startKybListeners();
  else if(currentCategory==="pad") startPadListeners();
}

// ---- 輪胎監聽器 ----
function startTireListeners(){
  unsubItems = db.collection("items").onSnapshot(snap=>{
    itemsCache = snap.docs.map(d=>({id:d.id,...d.data()}));
    if(typeof renderQueryResults==="function") renderQueryResults();
    if(typeof renderMasterTable==="function") renderMasterTable();
  });
  unsubTxns = db.collection("transactions").onSnapshot(snap=>{
    txnCache = snap.docs.map(d=>({id:d.id,...d.data()}));
    if(typeof renderTxns==="function") renderTxns();
  });
  unsubLocations = db.collection("locations").onSnapshot(snap=>{
    locationsCache = snap.docs.map(d=>({id:d.id,...d.data()}));
    if(typeof renderLocations==="function") renderLocations();
  });
  if(currentUser.role==="admin"){
    startLazyTireOrdersListener();
  } else {
    unsubMyOrders = db.collection("orders").where("requestedBy","==",currentUser.uid).onSnapshot(snap=>{
      myOrdersCache = snap.docs.map(d=>({id:d.id,...d.data()}));
      if(typeof renderMyOrders==="function") renderMyOrders();
    });
  }
}
let _lazyTireOrdersStarted = false;
function startLazyTireOrdersListener(){
  if(!_lazyTireOrdersStarted && currentUser.role==="admin"){
    _lazyTireOrdersStarted = true;
    unsubOrders = db.collection("orders").onSnapshot(snap=>{
      ordersCache = snap.docs.map(d=>({id:d.id,...d.data()}));
      if(typeof renderOrders==="function") renderOrders();
      updateOrdersBadge();
    });
  }
}
function stopLazyTireOrdersListener(){
  if(_lazyTireOrdersStarted && unsubOrders){
    unsubOrders();
    unsubOrders = null;
    _lazyTireOrdersStarted = false;
  }
}

// ---- KYB 監聽器 ----
function startKybListeners(){
  unsubKybItems = db.collection("kybItems").onSnapshot(snap=>{
    kybItemsCache = snap.docs.map(d=>({id:d.id,...d.data()}));
    if(typeof renderKybQueryResults==="function") renderKybQueryResults();
    if(typeof renderKybMasterTable==="function") renderKybMasterTable();
  });
  unsubKybTxns = db.collection("kybTransactions").onSnapshot(snap=>{
    kybTxnCache = snap.docs.map(d=>({id:d.id,...d.data()}));
    if(typeof renderKybTxns==="function") renderKybTxns();
  });
  unsubKybLocations = db.collection("kybLocations").onSnapshot(snap=>{
    kybLocationsCache = snap.docs.map(d=>({id:d.id,...d.data()}));
    if(typeof renderKybLocations==="function") renderKybLocations();
  });
  if(currentUser.role==="admin"){
    startLazyKybOrdersListener();
  } else {
    unsubKybMyOrders = db.collection("kybOrders").where("requestedBy","==",currentUser.uid).onSnapshot(snap=>{
      kybMyOrdersCache = snap.docs.map(d=>({id:d.id,...d.data()}));
      if(typeof renderKybMyOrders==="function") renderKybMyOrders();
    });
  }
}
let _lazyKybOrdersStarted = false;
function startLazyKybOrdersListener(){
  if(!_lazyKybOrdersStarted && currentUser.role==="admin"){
    _lazyKybOrdersStarted = true;
    unsubKybOrders = db.collection("kybOrders").onSnapshot(snap=>{
      kybOrdersCache = snap.docs.map(d=>({id:d.id,...d.data()}));
      if(typeof renderKybOrders==="function") renderKybOrders();
      updateKybOrdersBadge();
    });
  }
}
function stopLazyKybOrdersListener(){
  if(_lazyKybOrdersStarted && unsubKybOrders){
    unsubKybOrders();
    unsubKybOrders = null;
    _lazyKybOrdersStarted = false;
  }
}

// ---- PAD 監聽器 ----
function startPadListeners(){
  // items：改用 changeSequence delta sync
  startPadItemsDeltaSync();
  unsubPadTxns = db.collection("padTransactions").onSnapshot(snap=>{
    padTxnCache = snap.docs.map(d=>({id:d.id,...d.data()}));
    if(typeof renderPadTxns==="function") renderPadTxns();
  });
  unsubPadLocations = db.collection("padLocations").onSnapshot(snap=>{
    padLocationsCache = snap.docs.map(d=>({id:d.id,...d.data()}));
    if(typeof renderPadLocations==="function") renderPadLocations();
  });
  if(currentUser.role==="admin"){
    startLazyPadOrdersListener();
  } else {
    unsubPadMyOrders = db.collection("padOrders").where("requestedBy","==",currentUser.uid).onSnapshot(snap=>{
      padMyOrdersCache = snap.docs.map(d=>({id:d.id,...d.data()}));
      if(typeof renderPadMyOrders==="function") renderPadMyOrders();
    });
  }
}
let _lazyPadOrdersStarted = false;
function startLazyPadOrdersListener(){
  if(!_lazyPadOrdersStarted && currentUser.role==="admin"){
    _lazyPadOrdersStarted = true;
    unsubPadOrders = db.collection("padOrders").onSnapshot(snap=>{
      padOrdersCache = snap.docs.map(d=>({id:d.id,...d.data()}));
      if(typeof renderPadOrders==="function") renderPadOrders();
      updatePadOrdersBadge();
    });
  }
}
function stopLazyPadOrdersListener(){
  if(_lazyPadOrdersStarted && unsubPadOrders){
    unsubPadOrders();
    unsubPadOrders = null;
    _lazyPadOrdersStarted = false;
  }
}

// ============================================================
// PAD Items Delta Sync（changeSequence 增量同步）
// ============================================================
let _padItemsLoaded = false;
let _padItemsChangeSeq = 0;
let _unsubPadItemsMarker = null;

async function startPadItemsDeltaSync(){
  _padItemsLoaded = false;
  _padItemsChangeSeq = 0;
  if(_unsubPadItemsMarker){ _unsubPadItemsMarker(); _unsubPadItemsMarker = null; }

  // 1. 先從 IndexedDB 讀快取
  const cached = await idbGetAll("zhx-pad", "padItems");
  const seqSnap = await idbGet("zhx-pad", "settings", "padCache");
  if(cached.length > 0){
    padItemsCache = cached;
    _padItemsChangeSeq = (seqSnap && seqSnap.changeSequence) || 0;
    _padItemsLoaded = true;
    if(typeof renderPadQueryResults==="function") renderPadQueryResults();
    if(typeof renderPadMasterTable==="function") renderPadMasterTable();
  }

  // 2. 訂閱 marker（settings/padCache）變化
  _unsubPadItemsMarker = db.collection("settings").doc("padCache").onSnapshot(async snap=>{
    const remoteSeq = snap.exists ? (snap.data().changeSequence||0) : 0;
    if(!_padItemsLoaded || remoteSeq > _padItemsChangeSeq){
      await fetchPadItemsDelta(remoteSeq);
    }
  });
  unsubPadItems = ()=>{ if(_unsubPadItemsMarker) _unsubPadItemsMarker(); };
}

async function fetchPadItemsDelta(remoteSeq){
  if(!_padItemsLoaded){
    // 全量讀取
    const snap = await db.collection("padItems").get();
    padItemsCache = snap.docs.map(d=>({id:d.id,...d.data()}));
    _padItemsChangeSeq = remoteSeq;
    _padItemsLoaded = true;
    await idbPutAll("zhx-pad", "padItems", padItemsCache);
    await idbPut("zhx-pad", "settings", {id:"padCache", changeSequence:remoteSeq});
  } else {
    // Delta：查 changeLog，只更新有變動的 item
    const changesSnap = await db.collection("padItemChanges")
      .where("changeSequence", ">", _padItemsChangeSeq)
      .orderBy("changeSequence")
      .get();
    if(changesSnap.empty){ _padItemsChangeSeq = remoteSeq; return; }
    const changedIds = [...new Set(changesSnap.docs.map(d=>d.data().itemId))];
    const fetched = await Promise.all(changedIds.map(id=>db.collection("padItems").doc(id).get()));
    fetched.forEach(snap=>{
      const idx = padItemsCache.findIndex(i=>i.id===snap.id);
      if(snap.exists){
        const updated = {id:snap.id,...snap.data()};
        if(idx>=0) padItemsCache[idx]=updated; else padItemsCache.push(updated);
        idbPut("zhx-pad", "padItems", updated);
      } else {
        if(idx>=0) padItemsCache.splice(idx,1);
        idbDelete("zhx-pad", "padItems", snap.id);
      }
    });
    _padItemsChangeSeq = remoteSeq;
    await idbPut("zhx-pad", "settings", {id:"padCache", changeSequence:remoteSeq});
  }
  if(typeof renderPadQueryResults==="function") renderPadQueryResults();
  if(typeof renderPadMasterTable==="function") renderPadMasterTable();
}

// ============================================================
// IndexedDB 工具（用於 PAD/KYB 的本地快取）
// ============================================================
function idbOpen(dbName, stores){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = e=>{
      const db = e.target.result;
      stores.forEach(s=>{ if(!db.objectStoreNames.contains(s)) db.createObjectStore(s, {keyPath:"id"}); });
    };
    req.onsuccess = e=>resolve(e.target.result);
    req.onerror   = e=>reject(e.target.error);
  });
}
async function idbGetAll(dbName, store){
  const db = await idbOpen(dbName, [store, "settings"]);
  return new Promise((resolve, reject)=>{
    const tx  = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = ()=>resolve(req.result||[]);
    req.onerror   = ()=>reject(req.error);
  });
}
async function idbGet(dbName, store, id){
  const db = await idbOpen(dbName, [store, "settings"]);
  return new Promise((resolve, reject)=>{
    const tx  = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(id);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror   = ()=>reject(req.error);
  });
}
async function idbPutAll(dbName, store, items){
  const db = await idbOpen(dbName, [store, "settings"]);
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, "readwrite");
    items.forEach(it=>tx.objectStore(store).put(it));
    tx.oncomplete = resolve;
    tx.onerror    = ()=>reject(tx.error);
  });
}
async function idbPut(dbName, store, item){
  const db = await idbOpen(dbName, [store, "settings"]);
  return new Promise((resolve, reject)=>{
    const tx  = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).put(item);
    req.onsuccess = resolve;
    req.onerror   = ()=>reject(req.error);
  });
}
async function idbDelete(dbName, store, id){
  const db = await idbOpen(dbName, [store, "settings"]);
  return new Promise((resolve, reject)=>{
    const tx  = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = resolve;
    req.onerror   = ()=>reject(req.error);
  });
}

// ============================================================
// 訂單 badge
// ============================================================
function updateOrdersBadge(){
  const badge = document.getElementById("ordersTabBadge");
  if(!badge) return;
  const pending = ordersCache.filter(o=>o.status==="pending").length;
  badge.textContent = pending;
  badge.classList.toggle("hidden", pending===0);
}
function updateKybOrdersBadge(){
  const badge = document.getElementById("kybOrdersTabBadge");
  if(!badge) return;
  const pending = kybOrdersCache.filter(o=>o.status==="pending").length;
  badge.textContent = pending;
  badge.classList.toggle("hidden", pending===0);
}
function updatePadOrdersBadge(){
  const badge = document.getElementById("padOrdersTabBadge");
  if(!badge) return;
  const pending = padOrdersCache.filter(o=>o.status==="pending").length;
  badge.textContent = pending;
  badge.classList.toggle("hidden", pending===0);
}

// ============================================================
// Banner
// ============================================================
document.getElementById("dismissBanner").addEventListener("click", ()=>{
  document.getElementById("backupBanner").classList.add("hidden");
});
document.getElementById("dismissOrdersBanner").addEventListener("click", ()=>{
  document.getElementById("ordersBanner").classList.add("hidden");
  // 切到訂單頁
  const btn = document.querySelector('[data-tab="orders"]');
  if(btn) btn.click();
});

// ============================================================
// 輪胎：搜尋（query 頁面）
// ============================================================
document.getElementById("queryBox").addEventListener("input", renderQueryResults);
function renderQueryResults(){
  const q = norm(document.getElementById("queryBox").value);
  const container = document.getElementById("queryResults");
  if(!q){ container.innerHTML=""; document.getElementById("queryCount").textContent=""; return; }
  const results = itemsCache.filter(item=>{
    const text = norm(itemLabel(item)) + norm(item.brand||"")+norm(item.model||"")+norm(item.spec||"");
    return text.includes(q);
  });
  document.getElementById("queryCount").textContent = `共 ${results.length} 筆`;
  container.innerHTML = results.map(item=>{
    const locMap = qtyByLoc(item);
    const total = totalQty(item);
    const locRows = Object.entries(locMap).map(([code,qty])=>`<div class="loc-chip">${escapeHtml(code)}: ${qty}</div>`).join("");
    return `<div class="query-card">
      <div class="query-card-title">${escapeHtml(itemLabel(item))}</div>
      <div class="query-card-meta">${escapeHtml(item.remark||"")} ${item.price!=null?`售價 ${item.price}`:""} ${item.discountPrice!=null?`20% ${item.discountPrice}`:""}</div>
      <div class="query-card-locs">${locRows||'<span class="empty-inline">目前無庫存</span>'}</div>
      <div class="query-card-total">總量：${total}</div>
    </div>`;
  }).join("") || `<div class="empty">沒有符合的品項</div>`;
}

// ============================================================
// 輪胎：庫存總表
// ============================================================
document.getElementById("masterBox").addEventListener("input", renderMasterTable);
document.getElementById("exportFilteredBtn").addEventListener("click", exportFilteredExcel);
document.getElementById("exportAllBtn").addEventListener("click", exportAllExcel);
let _expireYears = null;
document.getElementById("applyExpireBtn").addEventListener("click", ()=>{
  _expireYears = parseInt(document.getElementById("expireYearsSelect").value, 10);
  renderMasterTable();
});
document.getElementById("clearExpireBtn").addEventListener("click", ()=>{
  _expireYears = null;
  renderMasterTable();
});

function renderMasterTable(){
  const q = norm(document.getElementById("masterBox").value);
  const body = document.getElementById("masterBody");
  let list = itemsCache;
  if(q) list = list.filter(item=> norm(itemLabel(item)).includes(q) || norm(item.brand||item.model||item.spec||"").includes(q));
  list = list.slice().sort((a,b)=>{
    const ba = norm(a.brand||""), bb = norm(b.brand||"");
    if(ba<bb) return -1; if(ba>bb) return 1;
    return norm(itemLabel(a)).localeCompare(norm(itemLabel(b)),"zh-Hant");
  });
  document.getElementById("masterCount").textContent = `共 ${list.length} 筆`;
  const now = new Date();
  body.innerHTML = list.map(item=>{
    const locMap = qtyByLoc(item);
    const total = totalQty(item);
    const locChips = Object.entries(locMap).map(([code,qty])=>{
      let expired = false;
      if(_expireYears !== null){
        const loc = (item.locations||[]).find(l=>l.code===code);
        if(loc && loc.mfgDate){
          const mfg = new Date(loc.mfgDate + "-01");
          const diffYears = (now - mfg) / (1000*60*60*24*365.25);
          if(diffYears >= _expireYears) expired = true;
        }
      }
      return `<span class="loc-chip ${expired?'expired':''}" style="cursor:pointer" data-item-id="${item.id}" data-loc-code="${escapeHtml(code)}">${escapeHtml(code)}: ${qty}</span>`;
    }).join("");
    return `<tr>
      <td>${escapeHtml(item.brand||"")}</td>
      <td>${escapeHtml(item.model||"")}</td>
      <td>${escapeHtml(item.spec||"")}</td>
      <td>${total}</td>
      <td class="locs-cell">${locChips||'<span class="empty-inline">無庫存</span>'}</td>
      <td>${item.discountPrice!=null?item.discountPrice:""}</td>
      <td>${item.price!=null?item.price:""}</td>
      <td>${escapeHtml(item.remark||"")}</td>
      <td><button data-edit-item="${item.id}">編輯</button> <button data-del-item="${item.id}">刪除</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="9" class="empty">尚無品項</td></tr>`;
  body.querySelectorAll("[data-edit-item]").forEach(b=>b.addEventListener("click",()=>openEditItemModal(b.dataset.editItem)));
  body.querySelectorAll("[data-del-item]").forEach(b=>b.addEventListener("click",()=>deleteItem(b.dataset.delItem)));
  body.querySelectorAll("[data-item-id]").forEach(chip=>chip.addEventListener("click",()=>openLocDetailModal(chip.dataset.itemId, chip.dataset.locCode)));
}

function openLocDetailModal(itemId, locCode){
  const item = itemsCache.find(i=>i.id===itemId);
  if(!item) return;
  const locEntry = (item.locations||[]).find(l=>l.code===locCode);
  const qty = locEntry ? locEntry.qty : 0;
  const mfgDate = locEntry ? (locEntry.mfgDate||"") : "";
  const html = `
    <div class="sheet-head"><h2>${escapeHtml(itemLabel(item))} — ${escapeHtml(locCode)}</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>數量</label><input type="number" id="locDetailQty" value="${qty}" min="0"></div>
    <div class="form-row"><label>生產日期（年-月）</label><input type="month" id="locDetailMfg" value="${escapeHtml(mfgDate)}"></div>
    <div class="form-row"><label>搬到儲位</label>
      <select id="locDetailMoveTo"><option value="">（不搬倉）</option>${locationsCache.filter(l=>l.code!==locCode).map(l=>`<option value="${escapeHtml(l.code)}">${escapeHtml(l.code)}</option>`).join("")}</select>
    </div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="locDetailSaveBtn">儲存</button>
    </div>`;
  openModal(html);
  document.getElementById("locDetailSaveBtn").addEventListener("click", async ()=>{
    const newQty = parseInt(document.getElementById("locDetailQty").value, 10);
    const newMfg = document.getElementById("locDetailMfg").value;
    const moveTo = document.getElementById("locDetailMoveTo").value;
    if(isNaN(newQty)||newQty<0){ alert("請輸入正確的數量（0 代表清除此儲位）"); return; }
    const newLocs = (item.locations||[]).filter(l=>l.code!==locCode);
    if(newQty>0) newLocs.push({code:locCode, qty:newQty, mfgDate:newMfg||null});
    if(moveTo){
      const existIdx = newLocs.findIndex(l=>l.code===moveTo);
      if(existIdx>=0) newLocs[existIdx].qty += newQty; else newLocs.push({code:moveTo, qty:newQty, mfgDate:newMfg||null});
      const remIdx = newLocs.findIndex(l=>l.code===locCode);
      if(remIdx>=0) newLocs.splice(remIdx,1);
    }
    await db.collection("items").doc(itemId).update({locations:newLocs});
    closeModal();
  });
}

function openEditItemModal(itemId){
  const item = itemsCache.find(i=>i.id===itemId);
  if(!item) return;
  const html = `
    <div class="sheet-head"><h2>編輯品項</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>品牌</label>
      <input type="text" id="editBrand" list="brandList" value="${escapeHtml(item.brand||"")}">
      <datalist id="brandList">${DEFAULT_BRANDS.map(b=>`<option value="${b}">`).join("")}</datalist>
    </div>
    <div class="form-row"><label>型號</label><input type="text" id="editModel" value="${escapeHtml(item.model||"")}"</div>
    <div class="form-row"><label>規格</label><input type="text" id="editSpec" value="${escapeHtml(item.spec||"")}"</div>
    <div class="form-row"><label>20% 折扣價</label><input type="number" id="editDiscount" value="${item.discountPrice!=null?item.discountPrice:""}"></div>
    <div class="form-row"><label>售價</label><input type="number" id="editPrice" value="${item.price!=null?item.price:""}"></div>
    <div class="form-row"><label>備註</label><input type="text" id="editRemark" value="${escapeHtml(item.remark||"")}"</div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="editItemSaveBtn">儲存</button>
    </div>`;
  openModal(html);
  document.getElementById("editItemSaveBtn").addEventListener("click", async ()=>{
    const brand  = document.getElementById("editBrand").value.trim();
    const model  = document.getElementById("editModel").value.trim();
    const spec   = document.getElementById("editSpec").value.trim();
    const dp     = document.getElementById("editDiscount").value;
    const pr     = document.getElementById("editPrice").value;
    const remark = document.getElementById("editRemark").value.trim();
    await db.collection("items").doc(itemId).update({
      brand, model, spec,
      discountPrice: dp===""?null:Number(dp),
      price: pr===""?null:Number(pr),
      remark
    });
    closeModal();
  });
}

function deleteItem(itemId){
  const item = itemsCache.find(i=>i.id===itemId);
  if(!item) return;
  if(totalQty(item)>0){ alert("這個品項還有庫存，請先把庫存歸零再刪除。"); return; }
  if(!confirm(`確定要刪除「${itemLabel(item)}」嗎？`)) return;
  db.collection("items").doc(itemId).delete();
}

// ============================================================
// 輪胎：匯出 Excel
// ============================================================
function buildExcelRows(list){
  return list.map(item=>{
    const locMap = qtyByLoc(item);
    const total  = totalQty(item);
    const locStr = Object.entries(locMap).map(([c,q])=>`${c}:${q}`).join(", ");
    return {
      "品牌": item.brand||"",
      "型號": item.model||"",
      "規格": item.spec||"",
      "總量": total,
      "儲位分布": locStr,
      "20%折扣價": item.discountPrice!=null?item.discountPrice:"",
      "售價": item.price!=null?item.price:"",
      "備註": item.remark||""
    };
  });
}
function exportFilteredExcel(){
  const q = norm(document.getElementById("masterBox").value);
  let list = q ? itemsCache.filter(item=>norm(itemLabel(item)).includes(q)) : itemsCache.slice();
  list.sort((a,b)=>norm(itemLabel(a)).localeCompare(norm(itemLabel(b)),"zh-Hant"));
  const ws = XLSX.utils.json_to_sheet(buildExcelRows(list));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "庫存");
  XLSX.writeFile(wb, `庫存查詢結果_${todayStr()}.xlsx`);
}
function exportAllExcel(){
  if(!confirm("要匯出完整交接備份（含所有品項、儲位、20%／售價、交易紀錄）嗎？")) return;
  const itemRows = itemsCache.slice().sort((a,b)=>norm(itemLabel(a)).localeCompare(norm(itemLabel(b)),"zh-Hant")).map(item=>{
    const locMap = qtyByLoc(item);
    const total  = totalQty(item);
    const locStr = Object.entries(locMap).map(([c,q])=>`${c}:${q}`).join(", ");
    const locDetailStr = (item.locations||[]).map(l=>`${l.code}:${l.qty}:${l.mfgDate||""}`).join(" | ");
    return {
      "品牌": item.brand||"", "型號": item.model||"", "規格": item.spec||"",
      "總量": total, "儲位分布": locStr, "儲位詳情(code:qty:mfgDate)": locDetailStr,
      "20%折扣價": item.discountPrice!=null?item.discountPrice:"",
      "售價": item.price!=null?item.price:"", "備註": item.remark||""
    };
  });
  const txnRows = txnCache.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||"")).map(t=>{
    const item = itemsCache.find(i=>i.id===t.itemId);
    return {
      "日期": t.date||"", "類型": txnTypeLabel(t),
      "品項": item ? itemLabel(item) : "(已刪除)",
      "數量": t.qty, "儲位": t.loc||"",
      "業務": t.salesperson||"", "客戶": t.customerName||"", "操作人員": t.operator||""
    };
  });
  const locRows = locationsCache.map(l=>({"儲位代碼": l.code}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemRows), "庫存總表");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txnRows), "交易紀錄");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(locRows), "儲位列表");
  XLSX.writeFile(wb, `完整備份_${todayStr()}.xlsx`);
}

// ============================================================
// 使用者管理
// ============================================================
function renderUsers(usersSnap){
  const body = document.getElementById("userBody");
  body.innerHTML = usersSnap.docs.map(d=>{
    const u = d.data();
    return `<tr>
      <td>${escapeHtml(u.name)}</td>
      <td>${escapeHtml(u.username)}</td>
      <td>${u.role==="admin"?"管理者":"員工"}</td>
      <td>${u.active===false?"已停用":"啟用中"}</td>
      <td>${escapeHtml(u.passwordNote||"")}</td>
      <td><button data-edit-user="${d.id}">編輯</button> <button data-toggle-user="${d.id}" data-active="${u.active!==false}">${u.active===false?"啟用":"停用"}</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="6" class="empty">尚無使用者</td></tr>`;
  body.querySelectorAll("[data-edit-user]").forEach(b=>b.addEventListener("click",()=>openEditUserModal(b.dataset.editUser, usersSnap)));
  body.querySelectorAll("[data-toggle-user]").forEach(b=>b.addEventListener("click",()=>{
    const active = b.dataset.active==="true";
    db.collection("users").doc(b.dataset.toggleUser).update({active:!active});
  }));
}
db.collection("users").onSnapshot(renderUsers);

document.getElementById("newUserBtn").addEventListener("click", ()=>{
  const html = `
    <div class="sheet-head"><h2>新增使用者</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>姓名</label><input type="text" id="newUserName"></div>
    <div class="form-row"><label>帳號</label><input type="text" id="newUserUsername"></div>
    <div class="form-row"><label>密碼</label><input type="text" id="newUserPassword"></div>
    <div class="form-row"><label>密碼備註</label><input type="text" id="newUserPwNote" placeholder="（選填，例如姓名縮寫）"></div>
    <div class="form-row"><label>角色</label>
      <select id="newUserRole"><option value="staff">員工</option><option value="admin">管理者</option></select>
    </div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="newUserSubmit">建立使用者</button>
    </div>`;
  openModal(html);
  document.getElementById("newUserSubmit").addEventListener("click", async ()=>{
    const name = document.getElementById("newUserName").value.trim();
    const username = document.getElementById("newUserUsername").value.trim();
    const password = document.getElementById("newUserPassword").value;
    const pwNote   = document.getElementById("newUserPwNote").value.trim();
    const role     = document.getElementById("newUserRole").value;
    if(!name||!username||!password){ alert("請填寫姓名、帳號和密碼"); return; }
    const dup = await db.collection("users").where("username","==",username).get();
    if(!dup.empty){ alert("這個帳號已經存在"); return; }
    await db.collection("users").add({name, username, password, passwordNote:pwNote, role, active:true});
    closeModal();
  });
});

function openEditUserModal(userId, usersSnap){
  const doc = usersSnap.docs.find(d=>d.id===userId);
  if(!doc) return;
  const u = doc.data();
  const html = `
    <div class="sheet-head"><h2>編輯使用者</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>姓名</label><input type="text" id="editUserName" value="${escapeHtml(u.name)}"></div>
    <div class="form-row"><label>帳號</label><input type="text" id="editUserUsername" value="${escapeHtml(u.username)}"></div>
    <div class="form-row"><label>新密碼（留空=不改）</label><input type="text" id="editUserPassword"></div>
    <div class="form-row"><label>密碼備註</label><input type="text" id="editUserPwNote" value="${escapeHtml(u.passwordNote||"")}" placeholder="（選填）"></div>
    <div class="form-row"><label>角色</label>
      <select id="editUserRole"><option value="staff" ${u.role==="staff"?"selected":""}>員工</option><option value="admin" ${u.role==="admin"?"selected":""}>管理者</option></select>
    </div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="editUserSaveBtn">儲存</button>
    </div>`;
  openModal(html);
  document.getElementById("editUserSaveBtn").addEventListener("click", async ()=>{
    const name = document.getElementById("editUserName").value.trim();
    const username = document.getElementById("editUserUsername").value.trim();
    const password = document.getElementById("editUserPassword").value;
    const pwNote   = document.getElementById("editUserPwNote").value.trim();
    const role     = document.getElementById("editUserRole").value;
    if(!name||!username){ alert("請填寫姓名和帳號"); return; }
    const update = {name, username, role, passwordNote:pwNote};
    if(password) update.password = password;
    await db.collection("users").doc(userId).update(update);
    closeModal();
  });
}

// ============================================================
// 輪胎：週五備份 banner
// ============================================================
// (已由 enterCategory 觸發，此處不重複)

// ============================================================
// 輪胎日期工具
// ============================================================
function weekOfYear(date){
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}
function tireCodeMfgDate(code){
  // DOT code: last 4 digits = WWWW (week 2-digit + year 2-digit)
  if(!code||code.length<4) return null;
  const last4 = code.slice(-4);
  const week = parseInt(last4.slice(0,2),10);
  const yr   = parseInt(last4.slice(2,4),10);
  if(isNaN(week)||isNaN(yr)||week<1||week>53) return null;
  const year = yr < 50 ? 2000+yr : 1900+yr;
  // First day of that week
  const jan1 = new Date(year,0,1);
  const target = new Date(jan1.getTime() + (week - 1) * 7 * 86400000);
  return target;
}
