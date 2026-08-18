// ============================================================
// YangPo來令片：進銷貨管理 / 庫存校正 / 訂單管理 / 我的訂單 / 儲位管理
// ============================================================
document.getElementById("padNewTxnBtn").addEventListener("click", openPadTxnModal);
document.getElementById("padNewAdjustBtn").addEventListener("click", openPadAdjustTxnModal);
document.getElementById("padNewItemBtn").addEventListener("click", openNewPadItemModal);
document.getElementById("padTxnFilterFrom").addEventListener("change", renderPadTxns);
document.getElementById("padTxnFilterTo").addEventListener("change", renderPadTxns);
document.getElementById("padTxnFilterSalesperson").addEventListener("input", renderPadTxns);
document.getElementById("padTxnFilterCustomer").addEventListener("input", renderPadTxns);
document.getElementById("padTxnFilterClearBtn").addEventListener("click", ()=>{
  document.getElementById("padTxnFilterFrom").value = "";
  document.getElementById("padTxnFilterTo").value = "";
  document.getElementById("padTxnFilterSalesperson").value = "";
  document.getElementById("padTxnFilterCustomer").value = "";
  renderPadTxns();
});

// 前/後 標籤輔助
function padSideLabel(side){ return side === "rear" ? "後(R)" : "前(F)"; }
// 取對應的 Firestore 欄位名稱（寫入用）
function padLocField(side){ return side === "rear" ? "locationsRear" : "locationsFront"; }
// 讀取：優先取新格式，降級相容舊格式 locations（已遷移前的舊資料）
function padReadLocs(item, side){
  const field = padLocField(side);
  if(item[field] !== undefined) return {...(item[field]||{})};
  // 舊格式：side 未知，統一歸前
  if(side !== "rear" && item.locations !== undefined) return {...(item.locations||{})};
  return {};
}

function renderPadTxns(){
  const body = document.getElementById("padTxnBody");
  const from = document.getElementById("padTxnFilterFrom").value;
  const to   = document.getElementById("padTxnFilterTo").value;
  const salesQ = norm(document.getElementById("padTxnFilterSalesperson").value);
  const custQ  = norm(document.getElementById("padTxnFilterCustomer").value);

  let list = padTxnCache.slice();
  if(from) list = list.filter(t=> t.date >= from);
  if(to)   list = list.filter(t=> t.date <= to);
  if(salesQ) list = list.filter(t=> norm(t.salesperson || t.operator || "").includes(salesQ));
  if(custQ)  list = list.filter(t=> norm(t.customerName || "").includes(custQ));
  list.sort((a,b)=> (b.createdAt||b.date||"").localeCompare(a.createdAt||a.date||""));

  document.getElementById("padTxnCount").textContent = `共 ${list.length} 筆`;
  body.innerHTML = list.map(t=>{
    const item = padItemsCache.find(i=>i.id===t.itemId);
    const label = item ? padItemLabel(item) : "(規格已刪除)";
    const side = t.side ? `（${padSideLabel(t.side)}）` : "";
    return `<tr>
      <td>${escapeHtml(t.date)}</td>
      <td>${txnTypeLabel(t)}</td>
      <td>${escapeHtml(label)}${side}</td>
      <td>${t.qty}</td>
      <td>${escapeHtml(t.salesperson||"")}</td>
      <td>${escapeHtml(t.customerName||"")}</td>
      <td>${escapeHtml(t.operator||"")}</td>
      <td><button data-edit="${t.id}">編輯</button> <button data-del="${t.id}">刪除</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="8" class="empty">尚無紀錄</td></tr>`;

  body.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click", ()=>openEditPadTxnModal(b.dataset.edit)));
  body.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click", ()=>deletePadTxn(b.dataset.del)));
}

// ---- 搜尋列共用：依車款/規格/品號搜尋，自動補全列表顯示品號 ----
function buildPadItemSearch(searchId, listId, labelId, onSelect){
  const searchInput = document.getElementById(searchId);
  searchInput.addEventListener("input", ()=>{
    const q = norm(searchInput.value);
    const listEl = document.getElementById(listId);
    if(!q){ listEl.classList.add("hidden"); return; }
    const matches = padItemsCache.filter(it=>
      norm(it.carModel).includes(q) || norm(it.spec).includes(q) ||
      norm(it.partNoFront).includes(q) || norm(it.partNoRear).includes(q)
    ).slice(0,15);
    listEl.innerHTML = matches.map(it=>{
      const pn = [it.partNoFront, it.partNoRear].filter(Boolean).join(" / ");
      return `<div data-id="${it.id}">${escapeHtml(padItemLabel(it))}${pn?` <span style="color:var(--muted);font-size:12px;">[${escapeHtml(pn)}]</span>`:"" }</div>`;
    }).join("");
    listEl.classList.toggle("hidden", matches.length===0);
    listEl.querySelectorAll("div").forEach(d=>d.addEventListener("click", ()=>{
      const it = padItemsCache.find(i=>i.id===d.dataset.id);
      const pn = [it.partNoFront, it.partNoRear].filter(Boolean).join(" / ");
      document.getElementById(labelId).value = padItemLabel(it) + (pn?`  [${pn}]`:"");
      listEl.classList.add("hidden");
      searchInput.value = "";
      onSelect(d.dataset.id, it);
    }));
  });
}

// ---- 前/後 選擇列共用 ----
function buildPadSideRow(item, sideSelectId, sideRowId, onSideChange){
  const sideRow = document.getElementById(sideRowId);
  const sideSelect = document.getElementById(sideSelectId);
  const opts = [];
  if(item.partNoFront) opts.push(`<option value="front">前(F) ${escapeHtml(item.partNoFront)}</option>`);
  if(item.partNoRear)  opts.push(`<option value="rear">後(R) ${escapeHtml(item.partNoRear)}</option>`);
  sideSelect.innerHTML = opts.join("");
  sideRow.style.display = opts.length > 1 ? "" : "none";
  sideSelect.addEventListener("change", onSideChange);
}

function openPadTxnModal(){
  const html = `
    <div class="sheet-head"><h2>新增進貨／銷貨</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>類型</label>
      <select id="padTxnType"><option value="in">進貨</option><option value="out">銷貨</option></select>
    </div>
    <div class="form-row">
      <label>搜尋規格（車款／品號）</label>
      <input type="text" id="padTxnItemSearch" placeholder="例如 Altis 或 YBP-2045">
      <div class="autocomplete-list hidden" id="padTxnItemList"></div>
    </div>
    <div class="form-row"><label>已選規格</label><input type="text" id="padTxnItemLabel" disabled></div>
    <div class="form-row" id="padTxnSideRow" style="display:none"><label>前/後</label>
      <select id="padTxnSide"></select>
    </div>
    <div class="form-row"><label>數量</label><input type="number" id="padTxnQty" min="1"></div>
    ${salespersonFieldHtml("padTxnSalesperson", "")}
    <div class="form-row"><label>儲位</label>
      <select id="padTxnLoc"><option value="">請先選擇規格</option></select>
    </div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="padTxnSubmitBtn">確認送出</button>
    </div>`;
  openModal(html);
  let selectedItemId = null;

  function getSide(){ return document.getElementById("padTxnSide").value; }

  function refreshLocOptions(){
    const type = document.getElementById("padTxnType").value;
    const locSelect = document.getElementById("padTxnLoc");
    const it = padItemsCache.find(i=>i.id===selectedItemId);
    if(!it){ locSelect.innerHTML = `<option value="">請先選擇規格</option>`; return; }
    const side = getSide() || "front";
    if(type === "out"){
      const options = padLocList(it, side);
      window._padTxnOutOptions = options;
      locSelect.innerHTML = options.length
        ? options.map((o,i)=>`<option value="${i}">${escapeHtml(o.code)}（目前${o.qty}）</option>`).join("")
        : `<option value="">這個規格目前沒有庫存可以出貨</option>`;
    } else {
      window._padTxnOutOptions = [];
      locSelect.innerHTML = padLocationsCache.map(l=>`<option value="${escapeHtml(l.code)}">${escapeHtml(l.code)}</option>`).join("");
    }
  }
  document.getElementById("padTxnType").addEventListener("change", refreshLocOptions);

  buildPadItemSearch("padTxnItemSearch","padTxnItemList","padTxnItemLabel",(id,it)=>{
    selectedItemId = id;
    buildPadSideRow(it, "padTxnSide", "padTxnSideRow", refreshLocOptions);
    refreshLocOptions();
  });

  document.getElementById("padTxnSubmitBtn").addEventListener("click", ()=>{
    if(!selectedItemId){ alert("請先搜尋並選擇一個規格"); return; }
    const type = document.getElementById("padTxnType").value;
    const side = getSide();
    if(!side){ alert("請選擇前/後"); return; }
    const qty = Number(document.getElementById("padTxnQty").value);
    if(!qty || qty<=0){ alert("請輸入正確的數量"); return; }
    const salespersonEl = document.getElementById("padTxnSalesperson");
    const salesperson = salespersonEl ? salespersonEl.value.trim() : "";
    let loc;
    if(type === "out"){
      const idx = Number(document.getElementById("padTxnLoc").value);
      const opt = (window._padTxnOutOptions||[])[idx];
      if(!opt){ alert("請選擇要出貨的儲位"); return; }
      loc = opt.code;
      if(qty > opt.qty){ alert(`這個儲位目前只有 ${opt.qty}，不能出貨 ${qty}`); return; }
    } else {
      loc = document.getElementById("padTxnLoc").value;
      if(!loc){ alert("請選擇儲位"); return; }
    }
    submitPadTxn(selectedItemId, type, qty, loc, salesperson, side);
  });
}

async function submitPadTxn(itemId, type, qty, loc, salesperson, side){
  const locField = padLocField(side);
  const itemRef = db.collection("padItems").doc(itemId);
  const itemSnap = await itemRef.get();
  const item = itemSnap.data();
  const allLocs = padReadLocs(item, side);
  const cur = padLocQty(allLocs[loc]);
  const next = type === "in" ? cur + qty : cur - qty;
  if(next < 0) throw new Error("庫存不足，無法出貨");
  if(next <= 0) delete allLocs[loc]; else allLocs[loc] = next;
  await itemRef.update({[locField]: allLocs});
  await db.collection("padTransactions").add({
    itemId, type, qty, loc, side, date: todayStr(), operator: currentUser.name,
    salesperson: salesperson || "", editLog: [],
    createdAt: new Date().toISOString()
  });
  closeModal();
}

// 庫存校正
function openPadAdjustTxnModal(){
  const html = `
    <div class="sheet-head"><h2>庫存校正</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>方向</label>
      <select id="padAdjustSign"><option value="+">調正（增加庫存）</option><option value="-">調負（減少庫存）</option></select>
    </div>
    <div class="form-row">
      <label>搜尋規格（車款／品號）</label>
      <input type="text" id="padAdjustItemSearch" placeholder="例如 Altis 或 YBP-2045">
      <div class="autocomplete-list hidden" id="padAdjustItemList"></div>
    </div>
    <div class="form-row"><label>已選規格</label><input type="text" id="padAdjustItemLabel" disabled></div>
    <div class="form-row" id="padAdjustSideRow" style="display:none"><label>前/後</label>
      <select id="padAdjustSide"></select>
    </div>
    <div class="form-row"><label>數量</label><input type="number" id="padAdjustQty" min="1"></div>
    <div class="form-row"><label>儲位</label>
      <select id="padAdjustLoc"><option value="">請先選擇規格</option></select>
    </div>
    <div class="form-row"><label>校正原因</label>
      <select id="padAdjustReason">
        <option value="盤點差異">盤點差異</option>
        <option value="破損報廢">破損報廢</option>
        <option value="輸入錯誤">輸入錯誤</option>
        <option value="其他">其他</option>
      </select>
    </div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="padAdjustSubmitBtn">確認送出</button>
    </div>`;
  openModal(html);
  let selectedItemId = null;

  function getSide(){ return document.getElementById("padAdjustSide").value; }

  function refreshLocOptions(){
    const sign = document.getElementById("padAdjustSign").value;
    const locSelect = document.getElementById("padAdjustLoc");
    const it = padItemsCache.find(i=>i.id===selectedItemId);
    if(!it){ locSelect.innerHTML = `<option value="">請先選擇規格</option>`; window._padAdjustOutOptions = []; return; }
    const side = getSide() || "front";
    if(sign === "-"){
      const options = padLocList(it, side);
      window._padAdjustOutOptions = options;
      locSelect.innerHTML = options.length
        ? options.map((o,i)=>`<option value="${i}">${escapeHtml(o.code)}（目前${o.qty}）</option>`).join("")
        : `<option value="">這個規格目前沒有庫存可以調負</option>`;
    } else {
      window._padAdjustOutOptions = [];
      locSelect.innerHTML = padLocationsCache.map(l=>`<option value="${escapeHtml(l.code)}">${escapeHtml(l.code)}</option>`).join("");
    }
  }
  document.getElementById("padAdjustSign").addEventListener("change", refreshLocOptions);

  buildPadItemSearch("padAdjustItemSearch","padAdjustItemList","padAdjustItemLabel",(id,it)=>{
    selectedItemId = id;
    buildPadSideRow(it, "padAdjustSide", "padAdjustSideRow", refreshLocOptions);
    refreshLocOptions();
  });

  document.getElementById("padAdjustSubmitBtn").addEventListener("click", async ()=>{
    if(!selectedItemId){ alert("請先搜尋並選擇一個規格"); return; }
    const sign = document.getElementById("padAdjustSign").value;
    const side = getSide();
    if(!side){ alert("請選擇前/後"); return; }
    const qty = Number(document.getElementById("padAdjustQty").value);
    if(!qty || qty<=0){ alert("請輸入正確的數量"); return; }
    const reason = document.getElementById("padAdjustReason").value;
    let loc;
    if(sign === "-"){
      const idx = Number(document.getElementById("padAdjustLoc").value);
      const opt = (window._padAdjustOutOptions||[])[idx];
      if(!opt){ alert("請選擇要調負的儲位"); return; }
      loc = opt.code;
      if(qty > opt.qty){ alert(`這個儲位目前只有 ${opt.qty}，不能調負 ${qty}`); return; }
    } else {
      loc = document.getElementById("padAdjustLoc").value;
      if(!loc){ alert("請選擇儲位"); return; }
    }
    try{
      await submitPadAdjustTxn(selectedItemId, sign, qty, loc, reason, side);
    }catch(e){
      console.error("來令片庫存校正送出失敗：", e);
      alert("送出失敗：" + (e.message || "資料庫拒絕寫入。請聯絡管理者確認 Firebase 權限。"));
    }
  });
}

async function submitPadAdjustTxn(itemId, adjustSign, qty, loc, reason, side){
  const locField = padLocField(side);
  const itemRef = db.collection("padItems").doc(itemId);
  const itemSnap = await itemRef.get();
  const item = itemSnap.data();
  const allLocs = padReadLocs(item, side);
  const cur = padLocQty(allLocs[loc]);
  const next = adjustSign === "+" ? cur + qty : cur - qty;
  if(next < 0) throw new Error("庫存不足，無法調負這個數量");
  if(next <= 0) delete allLocs[loc]; else allLocs[loc] = next;
  await itemRef.update({[locField]: allLocs});
  await db.collection("padTransactions").add({
    itemId, type: "adjust", adjustSign, qty, loc, side, date: todayStr(),
    operator: currentUser.name, reason, editLog: [],
    createdAt: new Date().toISOString()
  });
  closeModal();
}

// 編輯進銷貨紀錄（side 唯讀，不允許更改前後）
function openEditPadTxnModal(txnId){
  const t = padTxnCache.find(x=>x.id===txnId);
  if(!t) return;
  const item = padItemsCache.find(i=>i.id===t.itemId);
  const itemLabel = item ? padItemLabel(item) : "(規格已刪除，仍可編輯其他資訊，但無法改儲位)";
  const sideLabel = t.side ? `（${padSideLabel(t.side)}）` : "";
  const html = `
    <div class="sheet-head"><h2>編輯進銷貨紀錄</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>規格</label><input type="text" value="${escapeHtml(itemLabel)}" disabled></div>
    <div class="form-row"><label>類型</label><input type="text" value="${txnTypeLabel(t)}${sideLabel}" disabled></div>
    <div class="form-row"><label>日期</label><input type="date" id="editPadTxnDate" value="${escapeHtml(t.date||todayStr())}"></div>
    <div class="form-row"><label>數量</label><input type="number" id="editPadTxnQty" min="1" value="${t.qty}"></div>
    <div class="form-row"><label>儲位</label>
      <select id="editPadTxnLoc">${padLocationsCache.map(l=>`<option value="${escapeHtml(l.code)}" ${l.code===t.loc?'selected':''}>${escapeHtml(l.code)}</option>`).join("")}</select>
    </div>
    ${salespersonFieldHtml("editPadTxnSalesperson", t.salesperson||"")}
    <div class="form-row"><label>客戶姓名</label><input type="text" id="editPadTxnCustomerName" value="${escapeHtml(t.customerName||"")}"></div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="editPadTxnSaveBtn">儲存</button>
    </div>`;
  openModal(html);

  document.getElementById("editPadTxnSaveBtn").addEventListener("click", async ()=>{
    const newDate = document.getElementById("editPadTxnDate").value || todayStr();
    const newQty = Number(document.getElementById("editPadTxnQty").value);
    const newLoc = document.getElementById("editPadTxnLoc").value;
    const newSalesperson = document.getElementById("editPadTxnSalesperson").value.trim();
    const newCustomerName = document.getElementById("editPadTxnCustomerName").value.trim();
    if(!newQty || newQty<=0){ alert("請輸入正確的數量"); return; }
    if(!newLoc){ alert("請選擇儲位"); return; }
    try{
      await saveEditPadTxn(t, { date:newDate, qty:newQty, loc:newLoc, salesperson:newSalesperson, customerName:newCustomerName });
      closeModal();
    }catch(e){
      alert("儲存失敗："+e.message);
    }
  });
}

async function saveEditPadTxn(t, next){
  const side = t.side || "front";
  const locField = padLocField(side);
  const itemRef = db.collection("padItems").doc(t.itemId);
  const itemSnap = await itemRef.get();
  if(itemSnap.exists){
    const item = itemSnap.data();
    const allLocs = padReadLocs(item, side);

    // 還原舊紀錄的庫存影響
    const oldSign = -txnSign(t);
    const revertedOldQty = padLocQty(allLocs[t.loc]) + t.qty*oldSign;
    if(revertedOldQty <= 0) delete allLocs[t.loc]; else allLocs[t.loc] = revertedOldQty;

    // 套用新紀錄
    const newSign = txnSign(t);
    const curAtNewLoc = padLocQty(allLocs[next.loc]);
    const resultQty = curAtNewLoc + next.qty*newSign;
    if(newSign < 0 && resultQty < 0){
      throw new Error(`這個儲位目前只有 ${curAtNewLoc}，不夠改成 ${next.qty}`);
    }
    if(resultQty <= 0) delete allLocs[next.loc]; else allLocs[next.loc] = resultQty;

    await itemRef.update({ [locField]: allLocs });
  }

  await db.collection("padTransactions").doc(t.id).update({
    date: next.date, qty: next.qty, loc: next.loc,
    salesperson: next.salesperson, customerName: next.customerName,
    editLog: firebase.firestore.FieldValue.arrayUnion({
      before: { date:t.date||null, qty:t.qty, loc:t.loc, salesperson:t.salesperson||"", customerName:t.customerName||"" },
      after:  { date:next.date, qty:next.qty, loc:next.loc, salesperson:next.salesperson, customerName:next.customerName },
      time: new Date().toISOString(), by: currentUser.name
    })
  });
}

async function deletePadTxn(txnId){
  const t = padTxnCache.find(x=>x.id===txnId);
  if(!t) return;
  if(!confirm("確定要刪除這筆紀錄嗎？（會自動把庫存改回去，並保留異動歷程）")) return;
  const side = t.side || "front";
  const locField = padLocField(side);
  const itemRef = db.collection("padItems").doc(t.itemId);
  const itemSnap = await itemRef.get();
  if(itemSnap.exists){
    const item = itemSnap.data();
    const allLocs = padReadLocs(item, side);
    const sign = -txnSign(t);
    const next = padLocQty(allLocs[t.loc]) + t.qty*sign;
    if(next <= 0) delete allLocs[t.loc]; else allLocs[t.loc] = next;
    await itemRef.update({[locField]: allLocs});
  }
  await db.collection("editLogs").add({
    txnId, source:"pad", action:"delete", before:t, time:new Date().toISOString(), by:currentUser.name
  });
  await db.collection("padTransactions").doc(txnId).delete();
}

function openNewPadItemModal(){
  const html = `
    <div class="sheet-head"><h2>新增規格</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>車款</label><input type="text" id="newPadModel" placeholder="例如 Altis '19~"></div>
    <div class="form-row"><label>年份</label><input type="text" id="newPadYear" placeholder="例如 2019~"></div>
    <div class="form-row"><label>規格</label><input type="text" id="newPadSpec" placeholder="例如 154.9x67.6x16.5mm"></div>
    <div class="form-row"><label>品號/前(F)</label><input type="text" id="newPadPartFront" placeholder="例如 YBP-0125"></div>
    <div class="form-row"><label>FMSI NO./前(F)</label><input type="text" id="newPadFmsiFront"></div>
    <div class="form-row"><label>品號/後(R)</label><input type="text" id="newPadPartRear"></div>
    <div class="form-row"><label>FMSI NO./後(R)</label><input type="text" id="newPadFmsiRear"></div>
    <div class="form-row"><label>價格（選填）</label><input type="number" id="newPadPrice"></div>
    <div class="form-row"><label>備註</label><input type="text" id="newPadRemark"></div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="newPadSubmitBtn">建立規格</button>
    </div>`;
  openModal(html);
  document.getElementById("newPadSubmitBtn").addEventListener("click", async ()=>{
    const carModel = document.getElementById("newPadModel").value.trim();
    if(!carModel){ alert("請輸入車款"); return; }
    const toNum = (id)=>{ const v = document.getElementById(id).value; return v===""?null:Number(v); };
    await db.collection("padItems").add({
      carModel, brand:"YangPo",
      year: document.getElementById("newPadYear").value.trim(),
      spec: document.getElementById("newPadSpec").value.trim(),
      partNoFront: document.getElementById("newPadPartFront").value.trim(),
      fmsiFront: document.getElementById("newPadFmsiFront").value.trim(),
      partNoRear: document.getElementById("newPadPartRear").value.trim(),
      fmsiRear: document.getElementById("newPadFmsiRear").value.trim(),
      remark: document.getElementById("newPadRemark").value.trim(),
      locationsFront:{}, locationsRear:{},
      price: toNum("newPadPrice"),
      imageLinkFront: null, imageLinkRear: null
    });
    closeModal();
  });
}

// ============================================================
// 訂單管理
// ============================================================
const PAD_ORDER_STATUS_LABELS = { pending:"待確認", confirmed:"已出貨", cancelled:"已取消" };

const padOrdersStatusFilterEl = document.getElementById("padOrdersStatusFilter");
if(padOrdersStatusFilterEl) padOrdersStatusFilterEl.addEventListener("change", renderPadOrders);

function renderPadOrders(){
  const body = document.getElementById("padOrdersBody");
  if(!body) return;
  const filterEl = document.getElementById("padOrdersStatusFilter");
  const filter = filterEl ? filterEl.value : "pending";
  let list = padOrdersCache.slice();
  if(filter !== "all") list = list.filter(o=> o.status === filter);
  const isPendingView = filter === "pending";
  document.getElementById("padOrdersCount").textContent = isPendingView ? `共 ${list.length} 筆待確認` : `共 ${list.length} 筆`;
  const sorted = list.sort((a,b)=> isPendingView
    ? (a.requestedAt||"").localeCompare(b.requestedAt||"")
    : (b.requestedAt||"").localeCompare(a.requestedAt||""));
  body.innerHTML = sorted.map(o=>{
    const sideLabel = o.side ? `（${padSideLabel(o.side)}）` : "";
    const historyNote = [
      o.confirmedAt ? `出貨於 ${escapeHtml(toTaipeiTimeStr(o.confirmedAt))}${o.confirmedBy?`（${escapeHtml(o.confirmedBy)}）`:""}` : "",
      o.cancelledAt ? `取消於 ${escapeHtml(toTaipeiTimeStr(o.cancelledAt))}${o.cancelledBy?`（${escapeHtml(o.cancelledBy)}）`:""}` : ""
    ].filter(Boolean).join("　");
    return `<tr>
    <td>${escapeHtml(toTaipeiTimeStr(o.requestedAt))}</td>
    <td>${escapeHtml(o.requestedByName||"")}</td>
    <td>${escapeHtml(o.itemLabel||"")}${sideLabel}</td>
    <td>${o.qty}</td>
    <td>${o.loc?escapeHtml(o.loc):'<span class="empty-inline">未選</span>'}</td>
    <td>${escapeHtml(o.customerName||"")}</td>
    <td>${escapeHtml(o.customerContact||"")}</td>
    <td>${escapeHtml(o.customerNote||"")}</td>
    <td>${PAD_ORDER_STATUS_LABELS[o.status] || o.status || "-"}</td>
    <td>${o.status === "pending" ? `
      <button data-confirm="${o.id}">確認</button>
      <button data-edit="${o.id}">修改</button>
      <button data-cancel="${o.id}">取消</button>
    ` : `<span class="empty-inline">${historyNote}</span>`}</td>
  </tr>`;
  }).join("") || `<tr><td colspan="10" class="empty">目前沒有符合條件的訂單</td></tr>`;

  body.querySelectorAll("[data-confirm]").forEach(b=>b.addEventListener("click", ()=> openConfirmPadOrderModal(b.dataset.confirm)));
  body.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click", ()=> openEditPadOrderModal(b.dataset.edit)));
  body.querySelectorAll("[data-cancel]").forEach(b=>b.addEventListener("click", ()=> cancelPadOrder(b.dataset.cancel)));
}

function openConfirmPadOrderModal(orderId){
  const order = padOrdersCache.find(o=>o.id===orderId);
  if(!order) return;
  const item = padItemsCache.find(i=>i.id===order.itemId);
  if(!item){ alert("找不到這個規格，可能已被刪除。請改用「修改」換一個規格，或直接取消這筆訂單。"); return; }
  const side = order.side || "front";
  const options = padLocList(item, side);
  if(options.length === 0){ alert("這個規格目前沒有庫存可以出貨，請先確認庫存，或取消這筆訂單。"); return; }

  let defaultIdx = options.findIndex(o=> o.code === order.loc);
  if(defaultIdx < 0) defaultIdx = 0;
  const employeePickNote = order.loc
    ? `<div class="note" style="background:#eef4ff;color:#2451a3;">員工原本選擇：${escapeHtml(order.loc)}，如需要可在下方改選其他儲位。</div>`
    : "";
  const html = `
    <div class="sheet-head"><h2>確認出貨：${escapeHtml(order.itemLabel||"")}（${padSideLabel(side)}）</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>客戶</label><input type="text" value="${escapeHtml(order.customerName||'')}（${escapeHtml(order.customerContact||'')}）" disabled></div>
    <div class="form-row"><label>數量</label><input type="text" value="${order.qty}" disabled></div>
    ${employeePickNote}
    <div class="form-row"><label>選擇要出貨的儲位</label>
      <select id="padConfirmLoc">${options.map((o,i)=>`<option value="${i}" ${i===defaultIdx?'selected':''}>${escapeHtml(o.code)}（目前${o.qty}）</option>`).join("")}</select>
    </div>
    <div class="count" id="padConfirmStockWarn" style="color:#a31e22;"></div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="padConfirmOrderSubmitBtn">確認出貨</button>
    </div>`;
  openModal(html);

  function refreshWarn(){
    const idx = Number(document.getElementById("padConfirmLoc").value);
    const opt = options[idx];
    document.getElementById("padConfirmStockWarn").textContent =
      (opt && order.qty > opt.qty) ? `⚠ 這個儲位目前只有 ${opt.qty}，不夠出 ${order.qty}，請選別的儲位或先用「修改」調整數量` : "";
  }
  document.getElementById("padConfirmLoc").addEventListener("change", refreshWarn);
  refreshWarn();

  document.getElementById("padConfirmOrderSubmitBtn").addEventListener("click", async ()=>{
    const idx = Number(document.getElementById("padConfirmLoc").value);
    const opt = options[idx];
    if(!opt){ alert("請選擇儲位"); return; }
    if(order.qty > opt.qty){ alert(`這個儲位目前只有 ${opt.qty}，不夠出 ${order.qty}，請選別的儲位，或先用「修改」調整這筆訂單的數量`); return; }
    try{
      const txnRef = await submitPadOrderTxn(order, opt.code);
      await db.collection("padOrders").doc(order.id).update({
        status: "confirmed", confirmedAt: new Date().toISOString(), confirmedBy: currentUser.name, linkedTxnId: txnRef.id
      });
      closeModal();
    }catch(e){
      alert("確認失敗："+e.message);
    }
  });
}

async function submitPadOrderTxn(order, loc){
  const side = order.side || "front";
  const locField = padLocField(side);
  const itemRef = db.collection("padItems").doc(order.itemId);
  const itemSnap = await itemRef.get();
  const item = itemSnap.data();
  const allLocs = padReadLocs(item, side);
  const cur = padLocQty(allLocs[loc]);
  if(cur < order.qty) throw new Error("這個儲位庫存不足，請重新選擇");
  const next = cur - order.qty;
  if(next <= 0) delete allLocs[loc]; else allLocs[loc] = next;
  await itemRef.update({[locField]: allLocs});
  return await db.collection("padTransactions").add({
    itemId: order.itemId, type: "out", qty: order.qty, loc, side,
    date: todayStr(), operator: currentUser.name,
    salesperson: order.requestedByName || "", customerName: order.customerName || "",
    customerContact: order.customerContact || "", customerNote: order.customerNote || "",
    orderId: order.id, editLog: [],
    createdAt: new Date().toISOString()
  });
}

function openEditPadOrderModal(orderId){
  const order = padOrdersCache.find(o=>o.id===orderId);
  if(!order) return;
  let selectedItemId = order.itemId;
  const side = order.side || "front";
  const html = `
    <div class="sheet-head"><h2>修改訂單</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row">
      <label>搜尋規格（要換規格才需要，不換不用理它）</label>
      <input type="text" id="editPadOrderItemSearch" placeholder="例如 Altis 或 YBP-2045">
      <div class="autocomplete-list hidden" id="editPadOrderItemList"></div>
    </div>
    <div class="form-row"><label>目前規格（${padSideLabel(side)}）</label><input type="text" id="editPadOrderItemLabel" value="${escapeHtml(order.itemLabel||'')}" disabled></div>
    <div class="form-row"><label>選擇儲位</label><select id="editPadOrderLoc"></select></div>
    <div class="form-row"><label>數量</label><input type="number" id="editPadOrderQty" min="1" value="${order.qty}"></div>
    <div class="form-row"><label>客戶姓名</label><input type="text" id="editPadOrderCustomerName" value="${escapeHtml(order.customerName||'')}"></div>
    <div class="form-row"><label>聯絡方式</label><input type="text" id="editPadOrderCustomerContact" value="${escapeHtml(order.customerContact||'')}"></div>
    <div class="form-row"><label>備註</label><input type="text" id="editPadOrderCustomerNote" value="${escapeHtml(order.customerNote||'')}"></div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="editPadOrderSaveBtn">儲存</button>
    </div>`;
  openModal(html);

  let locOptions = [];
  function refreshEditLocOptions(){
    const it = padItemsCache.find(i=>i.id===selectedItemId);
    locOptions = it ? padLocList(it, side) : [];
    const locSelect = document.getElementById("editPadOrderLoc");
    if(locOptions.length === 0){ locSelect.innerHTML = `<option value="">目前無庫存</option>`; return; }
    let defaultIdx = locOptions.findIndex(o=> o.code === order.loc);
    if(defaultIdx < 0) defaultIdx = 0;
    locSelect.innerHTML = locOptions.map((o,i)=>`<option value="${i}" ${i===defaultIdx?'selected':''}>${escapeHtml(o.code)}（目前${o.qty}）</option>`).join("");
  }
  refreshEditLocOptions();

  buildPadItemSearch("editPadOrderItemSearch","editPadOrderItemList","editPadOrderItemLabel",(id)=>{
    selectedItemId = id;
    refreshEditLocOptions();
  });

  document.getElementById("editPadOrderSaveBtn").addEventListener("click", async ()=>{
    const qty = Number(document.getElementById("editPadOrderQty").value);
    const customerName = document.getElementById("editPadOrderCustomerName").value.trim();
    const customerContact = document.getElementById("editPadOrderCustomerContact").value.trim();
    const customerNote = document.getElementById("editPadOrderCustomerNote").value.trim();
    if(!qty || qty<=0){ alert("請輸入正確的數量"); return; }
    const it = padItemsCache.find(i=>i.id===selectedItemId);
    const itemLabel = it ? `${padItemLabel(it)}（YangPo來令片）` : order.itemLabel;
    const locIdx = Number(document.getElementById("editPadOrderLoc").value);
    const locOpt = locOptions[locIdx];
    try{
      await db.collection("padOrders").doc(orderId).update({
        itemId: selectedItemId, itemLabel, qty, customerName, customerContact, customerNote,
        loc: locOpt ? locOpt.code : null
      });
      closeModal();
    }catch(e){
      alert("儲存失敗："+e.message);
    }
  });
}

function cancelPadOrder(orderId){
  if(!confirm("確定要取消這筆訂單嗎？")) return;
  db.collection("padOrders").doc(orderId).update({
    status: "cancelled", cancelledAt: new Date().toISOString(), cancelledBy: currentUser.name
  }).catch(e=>alert("取消失敗："+e.message));
}

function renderPadMyOrders(){
  const body = document.getElementById("padMyOrdersBody");
  if(!body) return;
  const sorted = padMyOrdersCache.slice().sort((a,b)=> (b.requestedAt||"").localeCompare(a.requestedAt||""));
  document.getElementById("padMyOrdersCount").textContent = `共 ${sorted.length} 筆`;
  const statusLabel = { pending:"待確認", confirmed:"已出貨", cancelled:"已取消" };
  body.innerHTML = sorted.map(o=>{
    const sideLabel = o.side ? `（${padSideLabel(o.side)}）` : "";
    return `<tr>
    <td>${escapeHtml(toTaipeiTimeStr(o.requestedAt))}</td>
    <td>${escapeHtml(o.itemLabel||"")}${sideLabel}</td>
    <td>${o.qty}</td>
    <td>${escapeHtml(o.customerName||"")}</td>
    <td>${statusLabel[o.status]||o.status}</td>
  </tr>`;
  }).join("") || `<tr><td colspan="5" class="empty">尚無訂單紀錄</td></tr>`;
}

document.getElementById("padAddLocBtn").addEventListener("click", async ()=>{
  const code = document.getElementById("padNewLocInput").value.trim();
  if(!code){ alert("請輸入儲位代碼"); return; }
  if(padLocationsCache.some(l=>l.code===code)){ alert("這個儲位代碼已經存在"); return; }
  await db.collection("padLocations").add({code});
  document.getElementById("padNewLocInput").value = "";
});

function renderPadLocations(){
  const body = document.getElementById("padLocBody");
  body.innerHTML = padLocationsCache.map(l=>
    `<tr><td>${escapeHtml(l.code)}</td><td><button data-del="${l.id}" data-code="${escapeHtml(l.code)}">刪除</button></td></tr>`
  ).join("") || `<tr><td colspan="2" class="empty">尚無儲位</td></tr>`;
  body.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click", ()=>deletePadLocation(b.dataset.del, b.dataset.code)));
}

function deletePadLocation(locId, code){
  const blocking = padItemsCache.filter(it=>
    padLocQty((it.locationsFront||{})[code]) > 0 || padLocQty((it.locationsRear||{})[code]) > 0
  );
  if(blocking.length){
    const detail = blocking.map(it=>{
      const fq = padLocQty((it.locationsFront||{})[code]);
      const rq = padLocQty((it.locationsRear||{})[code]);
      const parts = [];
      if(fq>0) parts.push(`前${fq}`);
      if(rq>0) parts.push(`後${rq}`);
      return `${padItemLabel(it)}：${parts.join("/")}`;
    }).join("\n");
    alert(`這個儲位還有庫存，無法直接刪除。請先把以下規格搬到其他儲位：\n\n${detail}`);
    return;
  }
  if(confirm(`確定要刪除儲位「${code}」嗎？`)){
    db.collection("padLocations").doc(locId).delete();
  }
}
