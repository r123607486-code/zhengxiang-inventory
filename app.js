// ============================================================
// 正享有限公司庫存管理系統 — 主程式
// Phase 1：登入分權 / 庫存查詢 / 進銷貨管理(手動輸入) / 儲位管理 / 庫存總表 / 使用者管理
// ============================================================

// 效期反紅：改為由使用者在「庫存總表」頁面點擊選擇門檸年限（1-9年）才會反紅，不再自動顯示。
const DEFAULT_BRANDS = [
  "賣輪Sailun","韓泰Hankook","阿基里斯Achilles","安馳ANCHEE","薩馳輪胎ARDUZZA",
  "黑獄輪胎Blacklion","庫斯通KUSTONE","牛頓輪胎NEUTON","尼克森NEXEN",
  "路德斯通ROAD.STONE","萬峰馳輪胎WINDFORCE","薩提諾ZESTINO"
];

// 小圖示（inline SVG，不需要額外的圖示字體或CDN）
const ICONS = {
  query: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  master:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="10" x2="9" y2="20"/></svg>',
  txn:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h13l-2-3M21 17H8l2 3"/></svg>',
  loc:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  users: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
};

let currentUser = null; // {uid, name, username, role}
let itemsCache = [];
let locationsCache = [];
let usersCache = [];
let txnCache = [];
let brandsCache = [];

// ---------- 工具函式 ----------
function norm(s){ return (s || "").toString().toUpperCase().replace(/\s+/g, ""); }
function todayStr(){ return new Date().toISOString().slice(0,10); }
// 舊版依標準日期(YYYY-MM-DD)算月份，仍保留給「進貨時填的生產日期」使用（如果之後有人改用標準格式填寫）。
function monthsBetween(dateStr){
  if(!dateStr) return null;
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(String(dateStr).trim());
  if(!m) return null;
  const year = Number(m[1]);
  if(year < 2015 || year > 2035) return null; // 年份不合理，視為無效日期
  const d = new Date(year, Number(m[2])-1, Number(m[3]));
  if(isNaN(d)) return null;
  const now = new Date();
  return (now.getFullYear()-d.getFullYear())*12 + (now.getMonth()-d.getMonth());
}

// 輪胎業界標準的 DOT 製造代碼：4碼數字，前2碼＝第幾週，後2碼＝西元年後兩碼。
// 例如、2523」＝2023年第25週（約2023/6/19-6/25）。
// 回傳「距今幾個月」，無法辨識則回傳 null（例如舊資料裡的、826」、4024/125」這類非標準代碼）。
function isoWeekToDate(year, week){
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7; // 週一=0
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day);
  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return target;
}
function tireCodeMonthsAgo(code){
  if(!code) return null;
  const m = /^(\d{2})(\d{2})$/.exec(String(code).trim());
  if(!m) return null;
  const week = Number(m[1]);
  const yy = Number(m[2]);
  if(week < 1 || week > 53) return null;
  const year = 2000 + yy; // 假設都是西儃2000年後生產
  if(year < 2015 || year > 2035) return null; // 年份不合理，視為無效代碼
  const d = isoWeekToDate(year, week);
  if(isNaN(d)) return null;
  const now = new Date();
  return (now.getFullYear() - d.getUTCFullYear()) * 12 + (now.getMonth() - d.getUTCMonth());
}
function totalQty(item){
  const locs = item.locations || {};
  return Object.values(locs).reduce((a,b)=>a+(Number(b)||0), 0);
}
function locSummary(item){
  const locs = item.locations || {};
  return Object.entries(locs).filter(([k,v])=>v>0).map(([k,v])=>`${k}×${v}`).join("、") || "-";
}
function escapeHtml(s){
  return (s==null?"":s.toString()).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- 登入 ----------
document.getElementById("loginBtn").addEventListener("click", doLogin);
document.getElementById("loginPassword").addEventListener("keydown", e=>{ if(e.key==="Enter") doLogin(); });

function doLogin(){
  const uname = document.getElementById("loginUsername").value.trim();
  const pw = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginErr");
  errEl.textContent = "";
  if(!uname || !pw){ errEl.textContent = "請輸入帳號與密碼"; return; }
  const email = uname + "@" + INTERNAL_EMAIL_DOMAIN;
  auth.signInWithEmailAndPassword(email, pw)
    .catch(()=>{ errEl.textContent = "帳號或密碼錯誤"; });
}

document.getElementById("logoutBtn").addEventListener("click", ()=> auth.signOut());

auth.onAuthStateChanged(async (user)=>{
  if(!user){
    document.getElementById("splash").classList.remove("hidden");
    document.getElementById("app").classList.add("hidden");
    currentUser = null;
    return;
  }
  const doc = await db.collection("users").doc(user.uid).get();
  if(!doc.exists || doc.data().active === false){
    document.getElementById("loginErr").textContent = "此帳號已被停用，請聯絡管理者";
    auth.signOut();
    return;
  }
  const data = doc.data();
  currentUser = { uid: user.uid, name: data.name, username: data.username, role: data.role };
  document.getElementById("splash").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("whoLabel").textContent = `${currentUser.name}（${currentUser.role==='admin'?'管理者':'員工'}）`;
  buildTabs();
  checkFridayBanner();
  startListeners();
});

// ---------- 分頁(Tabs) ----------
const TAB_DEFS = [
  {id:"query",  label:"庫存查詢", icon:ICONS.query,  roles:["admin","member"]},
  {id:"master", label:"庫存總表", icon:ICONS.master, roles:["admin"]},
  {id:"txn",    label:"進銷貨管理", icon:ICONS.txn,  roles:["admin"]},
  {id:"loc",    label:"儲位管理", icon:ICONS.loc,    roles:["admin"]},
  {id:"import", label:"資料匯入", icon:ICONS.txn,    roles:["admin"]},
  {id:"users",  label:"使用者管理", icon:ICONS.users,roles:["admin"]},
];

function buildTabs(){
  const nav = document.getElementById("tabs");
  const visible = TAB_DEFS.filter(t=>t.roles.includes(currentUser.role));
  nav.innerHTML = visible.map((t,i)=>
    `<button data-tab="${t.id}" class="${i===0?'active':''}">${t.icon}${t.label}</button>`
  ).join("");
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById("page-"+visible[0].id).classList.add("active");
  nav.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      nav.querySelectorAll("button").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
      document.getElementById("page-"+btn.dataset.tab).classList.add("active");
      updateStickyOffsets();
    });
  });
  updateStickyOffsets();
}

// ---------- 讓「搜尋/篩選區塊」固定在頂部 ----------
// header跟nav分頁的實際高度會因為手機螢幕寬度、文字長度而變動（例如標題太長換行），
// 所以用JS量測實際高度，動態設定CSS變數，而不是寫死一個固定數字。
function updateStickyOffsets(){
  const headerEl = document.querySelector("header.topbar");
  const navEl = document.getElementById("tabs");
  if(!headerEl || !navEl) return;
  document.documentElement.style.setProperty("--header-h", headerEl.offsetHeight + "px");
  document.documentElement.style.setProperty("--nav-h", navEl.offsetHeight + "px");
}
window.addEventListener("resize", updateStickyOffsets);
window.addEventListener("load", ()=> setTimeout(updateStickyOffsets, 100));

// ---------- 週五備份提醒 ----------
function checkFridayBanner(){
  if(currentUser.role !== "admin") return;
  const isFriday = new Date().getDay() === 5;
  const dismissedKey = "backupBannerDismissed_" + todayStr();
  if(isFriday && !sessionStorage.getItem(dismissedKey)){
    document.getElementById("backupBanner").classList.remove("hidden");
  }
}
document.getElementById("dismissBanner").addEventListener("click", ()=>{
  document.getElementById("backupBanner").classList.add("hidden");
  sessionStorage.setItem("backupBannerDismissed_" + todayStr(), "1");
});

// ---------- 即時資料監聴 ----------
function startListeners(){
  db.collection("items").onSnapshot(snap=>{
    itemsCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderQuery(); renderMaster();
  });
  db.collection("locations").onSnapshot(snap=>{
    locationsCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderLocations();
  });
  if(currentUser.role === "admin"){
    db.collection("users").onSnapshot(snap=>{
      usersCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
      renderUsers();
    });
    db.collection("transactions").orderBy("date","desc").limit(200).onSnapshot(snap=>{
      txnCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
      renderTxns();
    });
  }
  db.collection("brands").onSnapshot(snap=>{
    brandsCache = snap.docs.map(d=>d.data().name);
    if(brandsCache.length === 0) brandsCache = DEFAULT_BRANDS.slice();
  }, ()=>{ brandsCache = DEFAULT_BRANDS.slice(); });
}

// ============================================================
// 庫存查詢
// ============================================================
let queryBrandFilter = null;
document.getElementById("queryBox").addEventListener("input", renderQuery);

function renderQuery(){
  const box = document.getElementById("queryResults");
  const countEl = document.getElementById("queryCount");
  const q = norm(document.getElementById("queryBox").value);
  const brands = [...new Set(itemsCache.map(i=>i.brand))].filter(Boolean);
  const chipBox = document.getElementById("queryBrandChips");
  chipBox.innerHTML = brands.map(b=>
    `<div class="chip ${queryBrandFilter===b?'selected':''}" data-b="${escapeHtml(b)}">${escapeHtml(b)}</div>`
  ).join("");
  chipBox.querySelectorAll(".chip").forEach(c=>c.addEventListener("click", ()=>{
    queryBrandFilter = queryBrandFilter === c.dataset.b ? null : c.dataset.b;
    renderQuery();
  }));

  let list = itemsCache.filter(it=> totalQty(it) > 0);
  if(queryBrandFilter) list = list.filter(it=>it.brand===queryBrandFilter);
  if(q) list = list.filter(it=> norm(it.spec).includes(q) || norm(it.model).includes(q) || norm(it.brand).includes(q));

  countEl.textContent = q || queryBrandFilter ? `找到 ${list.length} 筆` : `共 ${list.length} 筆可售品項`;

  box.innerHTML = list.slice(0,200).map(it=>{
    return `<div class="card">
      <div class="code">${escapeHtml(it.spec)}</div>
      <div class="sub">${escapeHtml(it.brand)}　${escapeHtml(it.model||"")}</div>
      <div class="qty">庫存 ${totalQty(it)}${it.cost!=null?`　　成本 ${it.cost}`:""}</div>
      <div class="sub">儲位：${escapeHtml(locSummary(it))}</div>
    </div>`;
  }).join("") || `<div class="empty">查無符合的可售品項</div>`;
}

// ============================================================
// 庫存總表
// ============================================================
let masterBrandFilter = null;
let masterExpireYears = null; // null=未套用反紅；1-9=套用中的門檸年限
document.getElementById("masterBox").addEventListener("input", renderMaster);
document.getElementById("applyExpireBtn").addEventListener("click", ()=>{
  masterExpireYears = Number(document.getElementById("expireYearsSelect").value);
  renderMaster();
});
document.getElementById("clearExpireBtn").addEventListener("click", ()=>{
  masterExpireYears = null;
  renderMaster();
});

function renderMaster(){
  const q = norm(document.getElementById("masterBox").value);
  const brands = [...new Set(itemsCache.map(i=>i.brand))].filter(Boolean);
  const chipBox = document.getElementById("masterBrandChips");
  chipBox.innerHTML = brands.map(b=>
    `<div class="chip ${masterBrandFilter===b?'selected':''}" data-b="${escapeHtml(b)}">${escapeHtml(b)}</div>`
  ).join("");
  chipBox.querySelectorAll(".chip").forEach(c=>c.addEventListener("click", ()=>{
    masterBrandFilter = masterBrandFilter === c.dataset.b ? null : c.dataset.b;
    renderMaster();
  }));

  let list = itemsCache.slice(); // 總表：全部品項，含0庫存
  if(masterBrandFilter) list = list.filter(it=>it.brand===masterBrandFilter);
  if(q) list = list.filter(it=> norm(it.spec).includes(q) || norm(it.model).includes(q) || norm(it.brand).includes(q));

  document.getElementById("masterCount").textContent = `共 ${list.length} 筆`
    + (masterExpireYears ? `　（反紅門檸：超過 ${masterExpireYears} 年）` : "");

  const body = document.getElementById("masterBody");
  body.innerHTML = list.map(it=>{
    // 反紅邏輯：只要 productionDate 能被解析成合法的4碼DOT代碼（週+年），就直接拿來判斷；
    // 無法解析（像、926」這目3碼、或格式不對的舊年分代碼）一律當作「無法判定」，不會反紅、不會用猜的。
    let expired = false;
    if(masterExpireYears){
      const m = tireCodeMonthsAgo(it.productionDate);
      expired = m !== null && m > masterExpireYears * 12;
    }
    return `<tr class="${expired?'expire':''}">
      <td>${escapeHtml(it.brand)}</td>
      <td>${escapeHtml(it.model||"")}</td>
      <td>${escapeHtml(it.spec)}</td>
      <td>${totalQty(it)}</td>
      <td class="loc-cell" data-id="${it.id}">${escapeHtml(locSummary(it))}</td>
      <td class="cost-cell" data-id="${it.id}">${it.cost!=null?it.cost:"未填"}</td>
      <td class="date-cell" data-id="${it.id}">${escapeHtml(it.productionDate||"未填")}</td>
      <td>${escapeHtml(it.remark||"")}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="8" class="empty">尚無資料</td></tr>`;

  body.querySelectorAll(".loc-cell").forEach(td=>{
    td.addEventListener("click", ()=> openMoveLocation(td.dataset.id));
  });
  body.querySelectorAll(".date-cell").forEach(td=>{
    td.addEventListener("click", ()=> editProductionDate(td.dataset.id));
  });
  body.querySelectorAll(".cost-cell").forEach(td=>{
    td.addEventListener("click", ()=> editCost(td.dataset.id));
  });

  window._masterFilteredList = list;
}

function editProductionDate(itemId){
  const item = itemsCache.find(i=>i.id===itemId);
  if(!item) return;
  const cur = item.productionDate || "";
  const input = prompt("輸入輪胎製造代碼（胎壁上4碼DOT代碼，前2碼＝第幾週、後2碼＝西元年後兩碼，例如、2523」＝2023年第25週）。\n只要是正確的4碼格式，「庫存總表」的反紅功能就會自動判斷；格式不對（例如3碼、或有斜線）系統會直接視為無法判定，不會反紅、也不會用猜的。", cur);
  if(input === null) return; // 取消
  const val = input.trim();
  db.collection("items").doc(itemId).update({ productionDate: val || null })
    .catch(e=>alert("更新失敗："+e.message));
}

function editCost(itemId){
  const item = itemsCache.find(i=>i.id===itemId);
  if(!item) return;
  const cur = item.cost!=null ? String(item.cost) : "";
  const input = prompt("輸入成本金額（純數字）", cur);
  if(input === null) return; // 取消
  const val = input.trim();
  if(val === ""){
    db.collection("items").doc(itemId).update({ cost: null }).catch(e=>alert("更新失敗："+e.message));
    return;
  }
  const num = Number(val);
  if(isNaN(num)){ alert("請輸入數字"); return; }
  db.collection("items").doc(itemId).update({ cost: num }).catch(e=>alert("更新失敗："+e.message));
}

function openMoveLocation(itemId){
  const item = itemsCache.find(i=>i.id===itemId);
  if(!item) return;
  const locs = item.locations || {};
  const from = prompt(`目前儲位分布：${locSummary(item)}\n請輸入要搬出的儲位代碼：`);
  if(from === null) return;
  if(!(from in locs) || !locs[from]){ alert("這個儲位目前沒有庫存"); return; }
  const maxQty = locs[from];
  const qty = Number(prompt(`要從「${from}」搬出多少數量？(最多 ${maxQty})`));
  if(!qty || qty<=0 || qty>maxQty){ alert("數量不正確"); return; }
  const to = prompt("要搬到哪一個儲位代碼？");
  if(!to) return;
  const newLocs = {...locs};
  newLocs[from] = maxQty - qty;
  newLocs[to] = (newLocs[to]||0) + qty;
  db.collection("items").doc(itemId).update({locations:newLocs});
}

document.getElementById("exportFilteredBtn").addEventListener("click", ()=>{
  exportItemsToExcel(window._masterFilteredList || [], "庫存總表_篩選結果");
});
document.getElementById("exportAllBtn").addEventListener("click", ()=>{
  exportFullBackup();
});

function exportItemsToExcel(list, filename){
  const rows = list.map(it=>({
    品牌: it.brand, 型號: it.model, 規格: it.spec, 總量: totalQty(it),
    儲位分布: locSummary(it), 成本: it.cost!=null?it.cost:"", 生產日期: it.productionDate||"", 備註: it.remark||""
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "資料");
  XLSX.writeFile(wb, `${filename}_${todayStr()}.xlsx`);
}

async function exportFullBackup(){
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsCache.map(it=>({
    id:it.id, 品牌:it.brand, 型號:it.model, 規格:it.spec, 總量:totalQty(it),
    儲位分布:locSummary(it), 成本:it.cost!=null?it.cost:"", 生產日期:it.productionDate||"", 備註:it.remark||""
  }))), "品項主檔");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(locationsCache.map(l=>({儲位代碼:l.code}))), "儲位主檔");
  const txnSnap = await db.collection("transactions").get();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txnSnap.docs.map(d=>d.data())), "進出貨紀錄");
  XLSX.writeFile(wb, `完整備份_${todayStr()}.xlsx`);
}

// ============================================================
// 進銷貨管理
// ============================================================
document.getElementById("newTxnBtn").addEventListener("click", openTxnModal);
document.getElementById("newItemBtn").addEventListener("click", openNewItemModal);

function renderTxns(){
  const body = document.getElementById("txnBody");
  document.getElementById("txnCount").textContent = `共 ${txnCache.length} 筆`;
  body.innerHTML = txnCache.map(t=>{
    const item = itemsCache.find(i=>i.id===t.itemId);
    const label = item ? `${item.brand} ${item.spec}` : "(品項已刪除)";
    return `<tr>
      <td>${escapeHtml(t.date)}</td>
      <td>${t.type==='in'?'進貨':'銷貨'}</td>
      <td>${escapeHtml(label)}</td>
      <td>${t.qty}</td>
      <td>${escapeHtml(t.operator||"")}</td>
      <td><button data-edit="${t.id}">編輯</button> <button data-del="${t.id}">刪除</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="6" class="empty">尚無紀錄</td></tr>`;

  body.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click", ()=>editTxn(b.dataset.edit)));
  body.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click", ()=>deleteTxn(b.dataset.del)));
}

function openTxnModal(){
  const html = `
    <div class="sheet-head"><h2>新增進貨／銷貨</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row">
      <label>搜尋品項（輸入規格或型號）</label>
      <input type="text" id="txnItemSearch" placeholder="例如 205/60">
      <div class="autocomplete-list hidden" id="txnItemList"></div>
    </div>
    <div class="form-row"><label>已選品項</label><input type="text" id="txnItemLabel" disabled></div>
    <div class="form-row"><label>類型</label>
      <select id="txnType"><option value="in">進貨</option><option value="out">銷貨</option></select>
    </div>
    <div class="form-row"><label>數量</label><input type="number" id="txnQty" min="1"></div>
    <div class="form-row"><label>儲位</label>
      <select id="txnLoc"><option value="">請先選擇品項</option></select>
    </div>
    <div class="form-row"><label>生產日期（選填，新進貨可填）</label><input type="date" id="txnProdDate"></div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="txnSubmitBtn">確認送出</button>
    </div>`;
  openModal(html);
  let selectedItemId = null;

  function refreshLocOptions(){
    const type = document.getElementById("txnType").value;
    const locSelect = document.getElementById("txnLoc");
    const it = itemsCache.find(i=>i.id===selectedItemId);
    if(!it){ locSelect.innerHTML = `<option value="">請先選擇品項</option>`; return; }
    if(type === "out"){
      // 銷貨：只能選這個品項「目前實際有庫存」的儲位
      const stockedLocs = Object.entries(it.locations||{}).filter(([k,v])=>v>0);
      if(stockedLocs.length === 0){
        locSelect.innerHTML = `<option value="">這個品項目前沒有庫存可以出貨</option>`;
      } else {
        locSelect.innerHTML = stockedLocs.map(([k,v])=>`<option value="${escapeHtml(k)}">${escapeHtml(k)}（目前${v}）</option>`).join("");
      }
    } else {
      // 進貨：可以選任何儲位（含新品項可能要放的新儲位）
      locSelect.innerHTML = locationsCache.map(l=>`<option value="${escapeHtml(l.code)}">${escapeHtml(l.code)}</option>`).join("");
    }
  }

  document.getElementById("txnType").addEventListener("change", refreshLocOptions);

  const searchInput = document.getElementById("txnItemSearch");
  searchInput.addEventListener("input", ()=>{
    const q = norm(searchInput.value);
    const listEl = document.getElementById("txnItemList");
    if(!q){ listEl.classList.add("hidden"); return; }
    const matches = itemsCache.filter(it=> norm(it.spec).includes(q) || norm(it.model).includes(q)).slice(0,15);
    listEl.innerHTML = matches.map(it=>`<div data-id="${it.id}">${escapeHtml(it.brand)}　${escapeHtml(it.spec)}（${escapeHtml(it.model||"")}）</div>`).join("");
    listEl.classList.toggle("hidden", matches.length===0);
    listEl.querySelectorAll("div").forEach(d=>d.addEventListener("click", ()=>{
      selectedItemId = d.dataset.id;
      const it = itemsCache.find(i=>i.id===selectedItemId);
      document.getElementById("txnItemLabel").value = `${it.brand} ${it.spec}（${it.model||""}）`;
      listEl.classList.add("hidden");
      searchInput.value = "";
      refreshLocOptions();
    }));
  });
  document.getElementById("txnSubmitBtn").addEventListener("click", ()=>{
    if(!selectedItemId){ alert("請先搜尋並選擇一個品項"); return; }
    const type = document.getElementById("txnType").value;
    const qty = Number(document.getElementById("txnQty").value);
    const loc = document.getElementById("txnLoc").value;
    const prodDate = document.getElementById("txnProdDate").value;
    if(!qty || qty<=0){ alert("請輸入正確的數量"); return; }
    if(!loc){ alert("請選擇儲位"); return; }
    if(type === "out"){
      const it = itemsCache.find(i=>i.id===selectedItemId);
      const avail = (it.locations||{})[loc] || 0;
      if(qty > avail){ alert(`這個儲位目前只有 ${avail} 條，不能出貨 ${qty} 條`); return; }
    }
    submitTxn(selectedItemId, type, qty, loc, prodDate);
  });
}

async function submitTxn(itemId, type, qty, loc, prodDate){
  const itemRef = db.collection("items").doc(itemId);
  const itemSnap = await itemRef.get();
  const item = itemSnap.data();
  const locs = {...(item.locations||{})};
  const delta = type === "in" ? qty : -qty;
  locs[loc] = (locs[loc]||0) + delta;
  const update = {locations: locs};
  if(type === "in" && prodDate) update.productionDate = prodDate;
  await itemRef.update(update);
  await db.collection("transactions").add({
    itemId, type, qty, loc, date: todayStr(), operator: currentUser.name, editLog: []
  });
  closeModal();
}

async function editTxn(txnId){
  const t = txnCache.find(x=>x.id===txnId);
  if(!t) return;
  const newQty = Number(prompt(`目前數量為 ${t.qty}，請輸入修正後的數量：`, t.qty));
  if(!newQty || newQty<=0) return;
  const diff = newQty - t.qty;
  const itemRef = db.collection("items").doc(t.itemId);
  const itemSnap = await itemRef.get();
  const item = itemSnap.data();
  const locs = {...(item.locations||{})};
  const sign = t.type === "in" ? 1 : -1;
  locs[t.loc] = (locs[t.loc]||0) + diff*sign;
  await itemRef.update({locations: locs});
  await db.collection("transactions").doc(txnId).update({
    qty: newQty,
    editLog: firebase.firestore.FieldValue.arrayUnion({
      before: t.qty, after: newQty, time: new Date().toISOString(), by: currentUser.name
    })
  });
}

async function deleteTxn(txnId){
  const t = txnCache.find(x=>x.id===txnId);
  if(!t) return;
  if(!confirm("確定要刪除這筆紀錄嗎？（會自動把庫存改回去，並保留異動歷程）")) return;
  const itemRef = db.collection("items").doc(t.itemId);
  const itemSnap = await itemRef.get();
  const item = itemSnap.data();
  const locs = {...(item.locations||{})};
  const sign = t.type === "in" ? -1 : 1; // 刪除等於反向沖銷
  locs[t.loc] = (locs[t.loc]||0) + t.qty*sign;
  await itemRef.update({locations: locs});
  await db.collection("editLogs").add({
    txnId, action:"delete", before:t, time:new Date().toISOString(), by:currentUser.name
  });
  await db.collection("transactions").doc(txnId).delete();
}

function openNewItemModal(){
  const brandOptions = brandsCache.length ? brandsCache : DEFAULT_BRANDS;
  const html = `
    <div class="sheet-head"><h2>新增品項</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>品牌</label>
      <select id="newItemBrand">${brandOptions.map(b=>`<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("")}<option value="__new__">+ 新增品牌...</option></select>
    </div>
    <div class="form-row"><label>型號／花紋</label><input type="text" id="newItemModel" placeholder="例如 K-ECO"></div>
    <div class="form-row"><label>規格</label><input type="text" id="newItemSpec" placeholder="例如 205/60R16"></div>
    <div class="form-row"><label>備註</label><input type="text" id="newItemRemark"></div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="newItemSubmitBtn">建立品項</button>
    </div>`;
  openModal(html);
  document.getElementById("newItemBrand").addEventListener("change", (e)=>{
    if(e.target.value === "__new__"){
      const nb = prompt("請輸入新品牌名稱（建議格式：中文English，例如 米其林Michelin）");
      if(nb){
        db.collection("brands").add({name:nb});
        const opt = document.createElement("option");
        opt.value = nb; opt.textContent = nb; opt.selected = true;
        e.target.insertBefore(opt, e.target.lastElementChild);
      } else {
        e.target.value = brandOptions[0];
      }
    }
  });
  document.getElementById("newItemSubmitBtn").addEventListener("click", async ()=>{
    const brand = document.getElementById("newItemBrand").value;
    const model = document.getElementById("newItemModel").value.trim();
    const spec = document.getElementById("newItemSpec").value.trim();
    const remark = document.getElementById("newItemRemark").value.trim();
    if(!spec){ alert("請輸入規格"); return; }
    await db.collection("items").add({brand, model, spec, remark, locations:{}, productionDate:null, dotVerified:false, cost:null});
    closeModal();
  });
}

// ============================================================
// 儲位管理
// ============================================================
document.getElementById("addLocBtn").addEventListener("click", async ()=>{
  const code = document.getElementById("newLocInput").value.trim();
  if(!code){ alert("請輸入儲位代碼"); return; }
  if(locationsCache.some(l=>l.code===code)){ alert("這個儲位代碼已經存在"); return; }
  await db.collection("locations").add({code});
  document.getElementById("newLocInput").value = "";
});

function renderLocations(){
  const body = document.getElementById("locBody");
  body.innerHTML = locationsCache.map(l=>
    `<tr><td>${escapeHtml(l.code)}</td><td><button data-del="${l.id}" data-code="${escapeHtml(l.code)}">刪除</button></td></tr>`
  ).join("") || `<tr><td colspan="2" class="empty">尚無儲位</td></tr>`;
  body.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click", ()=>deleteLocation(b.dataset.del, b.dataset.code)));
}

function deleteLocation(locId, code){
  const blocking = itemsCache.filter(it=> (it.locations||{})[code] > 0);
  if(blocking.length){
    const detail = blocking.map(it=>`${it.brand} ${it.spec}：${it.locations[code]}`).join("\n");
    alert(`這個儲位還有庫存，無法直接刪除。請先把以下品項搬到其他儲位：\n\n${detail}`);
    return;
  }
  if(confirm(`確定要刪除儲位「${code}」嗎？`)){
    db.collection("locations").doc(locId).delete();
  }
}

// ============================================================
// 使用者管理
// ============================================================
document.getElementById("newUserBtn").addEventListener("click", openNewUserModal);

function renderUsers(){
  const body = document.getElementById("userBody");
  body.innerHTML = usersCache.map(u=>`<tr>
    <td>${escapeHtml(u.name)}</td>
    <td>${escapeHtml(u.username)}</td>
    <td>${u.role==='admin'?'管理者':'員工'}</td>
    <td><span class="badge ${u.active!==false?'on':'off'}">${u.active!==false?'啟用':'停用'}</span></td>
    <td class="pw-cell" data-id="${u.id}" style="cursor:pointer;text-decoration:underline dotted;">${escapeHtml(u.pwNote||"未填")}</td>
    <td>
      <button data-toggle="${u.id}" data-active="${u.active!==false}">${u.active!==false?'停用':'啟用'}</button>
      <button data-edit="${u.id}">編輯</button>
      <button data-del="${u.id}" data-name="${escapeHtml(u.name)}">刪除</button>
    </td>
  </tr>`).join("") || `<tr><td colspan="6" class="empty">尚無使用者</td></tr>`;
  body.querySelectorAll("[data-toggle]").forEach(b=>b.addEventListener("click", ()=>{
    const newActive = b.dataset.active !== "true";
    db.collection("users").doc(b.dataset.toggle).update({active:newActive});
  }));
  body.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click", ()=> editUser(b.dataset.edit)));
  body.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click", ()=> deleteUser(b.dataset.del, b.dataset.name)));
  body.querySelectorAll(".pw-cell").forEach(td=>td.addEventListener("click", ()=> editPwNote(td.dataset.id)));
}

function editPwNote(uid){
  const u = usersCache.find(x=>x.id===uid);
  if(!u) return;
  const input = prompt("密碼備註（僅供你自己回頭查看用，不是即時同步的真正密碼，員工自行改密碼後這裡不會自動更新）：", u.pwNote||"");
  if(input === null) return;
  db.collection("users").doc(uid).update({ pwNote: input.trim() || null })
    .catch(e=>alert("更新失敗："+e.message));
}

function editUser(uid){
  const u = usersCache.find(x=>x.id===uid);
  if(!u) return;
  const newName = prompt("修改姓名：", u.name);
  if(newName === null) return; // 取消
  const roleInput = prompt("修改角色：輸入「管理者」或「員工」", u.role==='admin'?'管理者':'員工');
  if(roleInput === null) return; // 取消
  const role = roleInput.trim()==='管理者' ? 'admin' : 'member';
  db.collection("users").doc(uid).update({ name: newName.trim() || u.name, role })
    .catch(e=>alert("更新失敗："+e.message));
}

function deleteUser(uid, name){
  if(uid === currentUser.uid){ alert("不能刪除自己目前登入中的帳號"); return; }
  if(!confirm(`確定要刪除使用者「${name}」嗎？\n刪除後此帳號會完全無法登入系統（無法復原，需要重新建立帳號）。`)) return;
  db.collection("users").doc(uid).delete()
    .then(()=>alert("已刪除，此帳號已無法登入系統。"))
    .catch(e=>alert("刪除失敗："+e.message));
}

// ---------- 自己改自己的密碼（免費、不需要Admin SDK，任何角色登入後都能用）----------
document.getElementById("changePwBtn").addEventListener("click", async ()=>{
  if(!currentUser) return;
  const oldPw = prompt("請先輸入目前的密碼（用來確認身分）：");
  if(oldPw === null) return;
  const newPw = prompt("請輸入新密碼（至少6碼）：");
  if(newPw === null) return;
  if(!newPw || newPw.length < 6){ alert("新密碼至少要16碼"); return; }
  try{
    const email = currentUser.username + "@" + INTERNAL_EMAIL_DOMAIN;
    const cred = firebase.auth.EmailAuthProvider.credential(email, oldPw);
    await auth.currentUser.reauthenticateWithCredential(cred);
    await auth.currentUser.updatePassword(newPw);
    await db.collection("users").doc(currentUser.uid).update({ pwNote: newPw }).catch(()=>{});
    alert("密碼修改成功，下次登入請用新密碼。");
  }catch(e){
    alert("修改失敗：" + (e.code==='auth/wrong-password' ? "目前密碼輸入錯誤" : e.message));
  }
});

function openNewUserModal(){
  const html = `
    <div class="sheet-head"><h2>新增使用者</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>姓名</label><input type="text" id="newUserName"></div>
    <div class="form-row"><label>帳號（不用email格式，簡單英數即可）</label><input type="text" id="newUserUsername"></div>
    <div class="form-row"><label>初始密碼</label><input type="text" id="newUserPassword" value="123456"></div>
    <div class="form-row"><label>角色</label>
      <select id="newUserRole"><option value="member">員工</option><option value="admin">管理者</option></select>
    </div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="newUserSubmitBtn">建立帳號</button>
    </div>`;
  openModal(html);
  document.getElementById("newUserSubmitBtn").addEventListener("click", async ()=>{
    const name = document.getElementById("newUserName").value.trim();
    const uname = document.getElementById("newUserUsername").value.trim();
    const pw = document.getElementById("newUserPassword").value;
    const role = document.getElementById("newUserRole").value;
    if(!name || !uname || !pw){ alert("請填寫完整資料"); return; }
    const email = uname + "@" + INTERNAL_EMAIL_DOMAIN;
    try{
      const cred = await secondaryAuth.createUserWithEmailAndPassword(email, pw);
      await db.collection("users").doc(cred.user.uid).set({name, username:uname, role, active:true, pwNote: pw});
      await secondaryAuth.signOut();
      closeModal();
    }catch(e){
      alert("建立失敗：" + e.message);
    }
  });
}

// ============================================================
// 資料匯入（一次性工具，可重複使用）
// ============================================================
document.getElementById("clearDataBtn").addEventListener("click", async ()=>{
  if(!confirm("確定要清除所有「品項」與「儲位」資料嗎？（不會動到使用者帳號跟進出貨紀錄）這通常是為了重新匯入正確的資料才做，確定要繼續嗎？")) return;
  const statusEl = document.getElementById("importStatus");
  statusEl.textContent = "清除中...";
  const itemsSnap = await db.collection("items").get();
  const locSnap = await db.collection("locations").get();
  const allDocs = [...itemsSnap.docs, ...locSnap.docs];
  let done = 0;
  while(done < allDocs.length){
    const batch = db.batch();
    allDocs.slice(done, done+400).forEach(d=>batch.delete(d.ref));
    await batch.commit();
    done += 400;
  }
  statusEl.textContent = `已清除 ${itemsSnap.size} 筆品項與 ${locSnap.size} 筆儲位資料，可以重新選檔匯入了。`;
});

document.getElementById("importBtn").addEventListener("click", async ()=>{
  const fileInput = document.getElementById("importFile");
  const statusEl = document.getElementById("importStatus");
  if(!fileInput.files.length){ alert("請先選擇檔案"); return; }
  statusEl.textContent = "讀取檔案中...";
  const file = fileInput.files[0];
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, {type:"array"});

  const knownLocationCodes = new Set(locationsCache.map(l=>l.code));
  const newItems = [];

  const sheet1 = wb.Sheets["已比對成功(總倉屏東分開)"];
  if(sheet1){
    const rows = XLSX.utils.sheet_to_json(sheet1);
    rows.forEach(r=>{
      const zongCode = (r["總倉儲位代碼"] || "總倉(未指定儲位)").toString().trim();
      const zongQty = Number(r["總倉數量"]) || 0;
      const pingQty = Number(r["屏東數量"]) || 0;
      const locs = {};
      if(zongQty > 0){ locs[zongCode] = zongQty; knownLocationCodes.add(zongCode); }
      if(pingQty > 0){ locs["屏東"] = pingQty; knownLocationCodes.add("屏東"); }
      const costVal = r["成本(已妗1.25)"];
      const yearRaw = (r["年分"] || "").toString().trim();
      newItems.push({
        brand: r["品牌"] || "", model: r["型號"] || "", spec: r["規格"] || "",
        locations: locs, productionDate: yearRaw || null, dotVerified: false, remark: r["備註"] || "",
        cost: (costVal === undefined || costVal === null || costVal === "") ? null : Number(costVal)
      });
    });
  }

  const sheet2 = wb.Sheets["其他品牌(此檔未涵蓋位區成本)"];
  if(sheet2){
    const rows = XLSX.utils.sheet_to_json(sheet2);
    rows.forEach(r=>{
      const zongQty = Number(r["總倉數量"]) || 0;
      const pingQty = Number(r["屏東數量"]) || 0;
      const locs = {};
      if(zongQty > 0){ locs["總倉(未指定儲位)"] = zongQty; knownLocationCodes.add("總倉(未指定儲位)"); }
      if(pingQty > 0){ locs["屏東"] = pingQty; knownLocationCodes.add("屏東"); }
      newItems.push({
        brand: r["品牌"] || "", model: r["型號"] || "", spec: r["規格"] || "",
        locations: locs, productionDate: null, dotVerified: false, remark: r["備註"] || "", cost: null
      });
    });
  }

  if(newItems.length === 0){ statusEl.textContent = "找不到可匯入的分頁，請確認上傳的是「庫存資料整併結果.xlsx」"; return; }

  statusEl.textContent = `匯入中...共 ${newItems.length} 筆品項，${knownLocationCodes.size} 個儲位`;

  // 先建立儲位（略過已存在的）
  for(const code of knownLocationCodes){
    if(!locationsCache.some(l=>l.code===code)){
      await db.collection("locations").add({code});
    }
  }

  // 分批寫入品項（Firestore batch 上限500筆）
  let count = 0;
  while(count < newItems.length){
    const batch = db.batch();
    const chunk = newItems.slice(count, count+400);
    chunk.forEach(it=>{
      const ref = db.collection("items").doc();
      batch.set(ref, it);
    });
    await batch.commit();
    count += chunk.length;
    statusEl.textContent = `匯入中...已完成 ${count}/${newItems.length}`;
  }

  statusEl.textContent = `匯入完成！共新增 ${newItems.length} 筆品項。可以到「庫存查詢」或「庫存總表」查看。`;
});

// ============================================================
// 共用 Modal
// ============================================================
function openModal(html){
  document.getElementById("modalSheet").innerHTML = html;
  document.getElementById("modalOverlay").classList.remove("hidden");
}
function closeModal(){
  document.getElementById("modalOverlay").classList.add("hidden");
  document.getElementById("modalSheet").innerHTML = "";
}
document.getElementById("modalOverlay").addEventListener("click", (e)=>{
  if(e.target.id === "modalOverlay") closeModal();
});
