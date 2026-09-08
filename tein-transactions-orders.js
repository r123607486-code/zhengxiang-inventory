// ============================================================
// TEIN：進銷貨管理 / 庫存校正 / 訂單管理 / 我的訂單 / 儲位管理
// ============================================================
document.getElementById("teinNewTxnBtn").addEventListener("click", openTeinTxnModal);
document.getElementById("teinNewAdjustBtn").addEventListener("click", openTeinAdjustTxnModal);
document.getElementById("teinNewItemBtn").addEventListener("click", openNewTeinItemModal);
document.getElementById("teinTxnFilterFrom").addEventListener("change", renderTeinTxns);
document.getElementById("teinTxnFilterTo").addEventListener("change", renderTeinTxns);
document.getElementById("teinTxnFilterSalesperson").addEventListener("input", renderTeinTxns);
document.getElementById("teinTxnFilterCustomer").addEventListener("input", renderTeinTxns);
document.getElementById("teinTxnFilterClearBtn").addEventListener("click", ()=>{
  document.getElementById("teinTxnFilterFrom").value = "";
  document.getElementById("teinTxnFilterTo").value = "";
  document.getElementById("teinTxnFilterSalesperson").value = "";
  document.getElementById("teinTxnFilterCustomer").value = "";
  renderTeinTxns();
});

function renderTeinTxns(){
  const body = document.getElementById("teinTxnBody");
  const from = document.getElementById("teinTxnFilterFrom").value;
  const to = document.getElementById("teinTxnFilterTo").value;
  const salesQ = norm(document.getElementById("teinTxnFilterSalesperson").value);
  const custQ = norm(document.getElementById("teinTxnFilterCustomer").value);

  let list = teinTxnCache.slice();
  if(from) list = list.filter(t=> t.date >= from);
  if(to) list = list.filter(t=> t.date <= to);
  if(salesQ) list = list.filter(t=> norm(t.salesperson || t.operator || "").includes(salesQ));
  if(custQ) list = list.filter(t=> norm(t.customerName || "").includes(custQ));
  list.sort((a,b)=> (b.createdAt||b.date||"").localeCompare(a.createdAt||a.date||""));

  document.getElementById("teinTxnCount").textContent = `共 ${list.length} 筆`;
  body.innerHTML = list.map(t=>{
    const item = teinItemsCache.find(i=>i.id===t.itemId);
    const label = item ? teinItemLabel(item) : "(車型已刪除)";
    return `<tr>
      <td>${escapeHtml(t.date)}</td>
      <td>${txnTypeLabel(t)}</td>
      <td>${escapeHtml(label)}</td>
      <td>${t.qty}</td>
      <td>${escapeHtml(t.salesperson||"")}</td>
      <td>${escapeHtml(t.customerName||"")}</td>
      <td>${escapeHtml(t.operator||"")}</td>
      <td><button data-edit="${t.id}">編輯</button> <button data-del="${t.id}">刪除</button></td>
    </tr>`;
  }).join("") || `<tr><td colspan="8" class="empty">尚無紀錄</td></tr>`;

  body.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click", ()=>openEditTeinTxnModal(b.dataset.edit)));
  body.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click", ()=>deleteTeinTxn(b.dataset.del)));
}

function openTeinTxnModal(){
  const html = `
    <div class="sheet-head"><h2>新增進貨／銷貨</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>類型</label>
      <select id="teinTxnType"><option value="in">進貨</option><option value="out">銷貨</option></select>
    </div>
    <div class="form-row">
      <label>搜尋車型（可輸入車型名稱、廠牌或款式）</label>
      <input type="text" id="teinTxnItemSearch" placeholder="例如 FIT 或 END+">
      <div class="autocomplete-list hidden" id="teinTxnItemList"></div>
    </div>
    <div class="form-row"><label>已選車型</label><input type="text" id="teinTxnItemLabel" disabled></div>
    <div class="form-row"><label>數量</label><input type="number" id="teinTxnQty" min="1"></div>
    ${salespersonFieldHtml("teinTxnSalesperson", "")}
    <div class="form-row"><label>儲位</label>
      <select id="teinTxnLoc"><option value="">請先選擇車型</option></select>
    </div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="teinTxnSubmitBtn">確認送出</button>
    </div>`;
  openModal(html);
  let selectedItemId = null;

  function refreshLocOptions(){
    const type = document.getElementById("teinTxnType").value;
    const locSelect = document.getElementById("teinTxnLoc");
    const it = teinItemsCache.find(i=>i.id===selectedItemId);
    if(!it){ locSelect.innerHTML = `<option value="">請先選擇車型</option>`; return; }
    if(type === "out"){
      const options = teinLocList(it);
      window._teinTxnOutOptions = options;
      locSelect.innerHTML = options.length
        ? options.map((o,i)=>`<option value="${i}">${escapeHtml(o.code)}（目前${o.qty}）</option>`).join("")
        : `<option value="">這個車型目前沒有庫存可以出貨</option>`;
    } else {
      window._teinTxnOutOptions = [];
      locSelect.innerHTML = teinLocationsCache.map(l=>`<option value="${escapeHtml(l.code)}">${escapeHtml(l.code)}</option>`).join("");
    }
  }
  document.getElementById("teinTxnType").addEventListener("change", refreshLocOptions);

  const searchInput = document.getElementById("teinTxnItemSearch");
  searchInput.addEventListener("input", ()=>{
    const q = norm(searchInput.value);
    const listEl = document.getElementById("teinTxnItemList");
    if(!q){ listEl.classList.add("hidden"); return; }
    const matches = teinItemsCache.filter(it=> norm(it.carModel).includes(q) || norm(it.carMake||"").includes(q) || norm(it.style||"").includes(q)).slice(0,15);
    listEl.innerHTML = matches.map(it=>`<div data-id="${it.id}">${escapeHtml(teinItemLabel(it))}</div>`).join("");
    listEl.classList.toggle("hidden", matches.length===0);
    listEl.querySelectorAll("div").forEach(d=>d.addEventListener("click", ()=>{
      selectedItemId = d.dataset.id;
      const it = teinItemsCache.find(i=>i.id===selectedItemId);
      document.getElementById("teinTxnItemLabel").value = teinItemLabel(it);
      listEl.classList.add("hidden");
      searchInput.value = "";
      refreshLocOptions();
    }));
  });

  document.getElementById("teinTxnSubmitBtn").addEventListener("click", ()=>{
    if(!selectedItemId){ alert("請先搜尋並選擇一個車型"); return; }
    const type = document.getElementById("teinTxnType").value;
    const qty = Number(document.getElementById("teinTxnQty").value);
    if(!qty || qty<=0){ alert("請輸入正確的數量"); return; }
    const salespersonEl = document.getElementById("teinTxnSalesperson");
    const salesperson = salespersonEl ? salespersonEl.value.trim() : "";
    let loc;
    if(type === "out"){
      const idx = Number(document.getElementById("teinTxnLoc").value);
      const opt = (window._teinTxnOutOptions||[])[idx];
      if(!opt){ alert("請選擇要出貨的儲位"); return; }
      loc = opt.code;
      if(qty > opt.qty){ alert(`這個儲位目前只有 ${opt.qty}，不能出貨 ${qty}`); return; }
    } else {
      loc = document.getElementById("teinTxnLoc").value;
      if(!loc){ alert("請選擇儲位"); return; }
    }
    submitTeinTxn(selectedItemId, type, qty, loc, salesperson);
  });
}

async function submitTeinTxn(itemId, type, qty, loc, salesperson){
  const itemRef = db.collection("teinItems").doc(itemId);
  const itemSnap = await itemRef.get();
  const item = itemSnap.data();
  const allLocs = {...(item.locations||{})};
  const cur = teinLocQty(allLocs[loc]);
  const next = type === "in" ? cur + qty : cur - qty;
  if(next < 0) throw new Error("庫存不足，無法出貨");
  if(next <= 0) delete allLocs[loc]; else allLocs[loc] = next;
  await itemRef.update({locations: allLocs});
  await db.collection("teinTransactions").add({
    itemId, type, qty, loc, date: todayStr(), operator: currentUser.name,
    salesperson: salesperson || "", editLog: [],
    createdAt: new Date().toISOString()
  });
  closeModal();
}

function openTeinAdjustTxnModal(){
  const html = `
    <div class="sheet-head"><h2>庫存校正</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>方向</label>
      <select id="teinAdjustSign"><option value="+">調正（增加庫存）</option><option value="-">調負（減少庫存）</option></select>
    </div>
    <div class="form-row">
      <label>搜尋車型</label>
      <input type="text" id="teinAdjustItemSearch" placeholder="例如 FIT 或 END+">
      <div class="autocomplete-list hidden" id="teinAdjustItemList"></div>
    </div>
    <div class="form-row"><label>已選車型</label><input type="text" id="teinAdjustItemLabel" disabled></div>
    <div class="form-row"><label>數量</label><input type="number" id="teinAdjustQty" min="1"></div>
    <div class="form-row"><label>儲位</label>
      <select id="teinAdjustLoc"><option value="">請先選擇車型</option></select>
    </div>
    <div class="form-row"><label>校正原因</label>
      <select id="teinAdjustReason">
        <option value="盤點差異">盤點差異</option>
        <option value="破損報廢">破損報廢</option>
        <option value="輸入錯誤">輸入錯誤</option>
        <option value="其他">其他</option>
      </select>
    </div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="teinAdjustSubmitBtn">確認送出</button>
    </div>`;
  openModal(html);
  let selectedItemId = null;

  function refreshLocOptions(){
    const sign = document.getElementById("teinAdjustSign").value;
    const locSelect = document.getElementById("teinAdjustLoc");
    const it = teinItemsCache.find(i=>i.id===selectedItemId);
    if(!it){ locSelect.innerHTML = `<option value="">請先選擇車型</option>`; window._teinAdjustOutOptions = []; return; }
    if(sign === "-"){
      const options = teinLocList(it);
      window._teinAdjustOutOptions = options;
      locSelect.innerHTML = options.length
        ? options.map((o,i)=>`<option value="${i}">${escapeHtml(o.code)}（目前${o.qty}）</option>`).join("")
        : `<option value="">這個車型目前沒有庫存可以調負</option>`;
    } else {
      window._teinAdjustOutOptions = [];
      locSelect.innerHTML = teinLocationsCache.map(l=>`<option value="${escapeHtml(l.code)}">${escapeHtml(l.code)}</option>`).join("");
    }
  }
  document.getElementById("teinAdjustSign").addEventListener("change", refreshLocOptions);

  const searchInput = document.getElementById("teinAdjustItemSearch");
  searchInput.addEventListener("input", ()=>{
    const q = norm(searchInput.value);
    const listEl = document.getElementById("teinAdjustItemList");
    if(!q){ listEl.classList.add("hidden"); return; }
    const matches = teinItemsCache.filter(it=> norm(it.carModel).includes(q) || norm(it.carMake||"").includes(q)).slice(0,15);
    listEl.innerHTML = matches.map(it=>`<div data-id="${it.id}">${escapeHtml(teinItemLabel(it))}</div>`).join("");
    listEl.classList.toggle("hidden", matches.length===0);
    listEl.querySelectorAll("div").forEach(d=>d.addEventListener("click", ()=>{
      selectedItemId = d.dataset.id;
      const it = teinItemsCache.find(i=>i.id===selectedItemId);
      document.getElementById("teinAdjustItemLabel").value = teinItemLabel(it);
      listEl.classList.add("hidden");
      searchInput.value = "";
      refreshLocOptions();
    }));
  });

  document.getElementById("teinAdjustSubmitBtn").addEventListener("click", async ()=>{
    if(!selectedItemId){ alert("請先搜尋並選擇一個車型"); return; }
    const sign = document.getElementById("teinAdjustSign").value;
    const qty = Number(document.getElementById("teinAdjustQty").value);
    if(!qty || qty<=0){ alert("請輸入正確的數量"); return; }
    const reason = document.getElementById("teinAdjustReason").value;
    let loc;
    if(sign === "-"){
      const idx = Number(document.getElementById("teinAdjustLoc").value);
      const opt = (window._teinAdjustOutOptions||[])[idx];
      if(!opt){ alert("請選擇要調負的儲位"); return; }
      loc = opt.code;
      if(qty > opt.qty){ alert(`這個儲位目前只有 ${opt.qty}，不能調負 ${qty}`); return; }
    } else {
      loc = document.getElementById("teinAdjustLoc").value;
      if(!loc){ alert("請選擇儲位"); return; }
    }
    try{
      await submitTeinAdjustTxn(selectedItemId, sign, qty, loc, reason);
    }catch(e){
      alert("送出失敗：" + (e.message || "請聯絡管理者確認 Firebase 權限。"));
    }
  });
}

async function submitTeinAdjustTxn(itemId, adjustSign, qty, loc, reason){
  const itemRef = db.collection("teinItems").doc(itemId);
  const itemSnap = await itemRef.get();
  const item = itemSnap.data();
  const allLocs = {...(item.locations||{})};
  const cur = teinLocQty(allLocs[loc]);
  const next = adjustSign === "+" ? cur + qty : cur - qty;
  if(next < 0) throw new Error("庫存不足，無法調負這個數量");
  if(next <= 0) delete allLocs[loc]; else allLocs[loc] = next;
  await itemRef.update({locations: allLocs});
  await db.collection("teinTransactions").add({
    itemId, type: "adjust", adjustSign, qty, loc, date: todayStr(),
    operator: currentUser.name, reason, editLog: [],
    createdAt: new Date().toISOString()
  });
  closeModal();
}

function openEditTeinTxnModal(txnId){
  const t = teinTxnCache.find(x=>x.id===txnId);
  if(!t) return;
  const item = teinItemsCache.find(i=>i.id===t.itemId);
  const itemLabel = item ? teinItemLabel(item) : "(車型已刪除，仍可編輯其他資訊)";
  const html = `
    <div class="sheet-head"><h2>編輯進銷貨紀錄</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>車型</label><input type="text" value="${escapeHtml(itemLabel)}" disabled></div>
    <div class="form-row"><label>類型</label><input type="text" value="${txnTypeLabel(t)}" disabled></div>
    <div class="form-row"><label>日期</label><input type="date" id="editTeinTxnDate" value="${escapeHtml(t.date||todayStr())}"></div>
    <div class="form-row"><label>數量</label><input type="number" id="editTeinTxnQty" min="1" value="${t.qty}"></div>
    <div class="form-row"><label>儲位</label>
      <select id="editTeinTxnLoc">${teinLocationsCache.map(l=>`<option value="${escapeHtml(l.code)}" ${l.code===t.loc?'selected':''}>${escapeHtml(l.code)}</option>`).join("")}</select>
    </div>
    ${salespersonFieldHtml("editTeinTxnSalesperson", t.salesperson||"")}
    <div class="form-row"><label>客戶姓名</label><input type="text" id="editTeinTxnCustomerName" value="${escapeHtml(t.customerName||"")}"></div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="editTeinTxnSaveBtn">儲存</button>
    </div>`;
  openModal(html);

  document.getElementById("editTeinTxnSaveBtn").addEventListener("click", async ()=>{
    const newDate = document.getElementById("editTeinTxnDate").value || todayStr();
    const newQty = Number(document.getElementById("editTeinTxnQty").value);
    const newLoc = document.getElementById("editTeinTxnLoc").value;
    const newSalesperson = document.getElementById("editTeinTxnSalesperson").value.trim();
    const newCustomerName = document.getElementById("editTeinTxnCustomerName").value.trim();
    if(!newQty || newQty<=0){ alert("請輸入正確的數量"); return; }
    if(!newLoc){ alert("請選擇儲位"); return; }
    try{
      await saveEditTeinTxn(t, { date:newDate, qty:newQty, loc:newLoc, salesperson:newSalesperson, customerName:newCustomerName });
      closeModal();
    }catch(e){
      alert("儲存失敗："+e.message);
    }
  });
}

async function saveEditTeinTxn(t, next){
  const itemRef = db.collection("teinItems").doc(t.itemId);
  const itemSnap = await itemRef.get();
  if(itemSnap.exists){
    const item = itemSnap.data();
    const allLocs = {...(item.locations||{})};
    const oldSign = -txnSign(t);
    const revertedOldQty = teinLocQty(allLocs[t.loc]) + t.qty*oldSign;
    if(revertedOldQty <= 0) delete allLocs[t.loc]; else allLocs[t.loc] = revertedOldQty;
    const newSign = txnSign(t);
    const curAtNewLoc = teinLocQty(allLocs[next.loc]);
    const resultQty = curAtNewLoc + next.qty*newSign;
    if(newSign < 0 && resultQty < 0) throw new Error(`這個儲位目前只有 ${curAtNewLoc}，不夠改成 ${next.qty}`);
    if(resultQty <= 0) delete allLocs[next.loc]; else allLocs[next.loc] = resultQty;
    await itemRef.update({ locations: allLocs });
  }
  await db.collection("teinTransactions").doc(t.id).update({
    date: next.date, qty: next.qty, loc: next.loc,
    salesperson: next.salesperson, customerName: next.customerName,
    editLog: firebase.firestore.FieldValue.arrayUnion({
      before: { date:t.date||null, qty:t.qty, loc:t.loc, salesperson:t.salesperson||"", customerName:t.customerName||"" },
      after: { date:next.date, qty:next.qty, loc:next.loc, salesperson:next.salesperson, customerName:next.customerName },
      time: new Date().toISOString(), by: currentUser.name
    })
  });
}

async function deleteTeinTxn(txnId){
  const t = teinTxnCache.find(x=>x.id===txnId);
  if(!t) return;
  if(!confirm("確定要刪除這筆紀錄嗎？（會自動把庫存改回去）")) return;
  const itemRef = db.collection("teinItems").doc(t.itemId);
  const itemSnap = await itemRef.get();
  if(itemSnap.exists){
    const item = itemSnap.data();
    const allLocs = {...(item.locations||{})};
    const sign = -txnSign(t);
    const next = teinLocQty(allLocs[t.loc]) + t.qty*sign;
    if(next <= 0) delete allLocs[t.loc]; else allLocs[t.loc] = next;
    await itemRef.update({locations: allLocs});
  }
  await db.collection("editLogs").add({
    txnId, source:"tein", action:"delete", before:t, time:new Date().toISOString(), by:currentUser.name
  });
  await db.collection("teinTransactions").doc(txnId).delete();
}

function openNewTeinItemModal(){
  const html = `
    <div class="sheet-head"><h2>新增車型</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>車型</label><input type="text" id="newTeinModel" placeholder="例如 FIT"></div>
    <div class="form-row"><label>廠牌</label><input type="text" id="newTeinMake" placeholder="例如 HONDA"></div>
    <div class="form-row"><label>規格（代次代號 / 年份 / 引擎）</label><input type="text" id="newTeinSpec" placeholder='例如 GE8 / 07"~14" / 1.5 FF'></div>
    <div class="form-row"><label>款式</label>
      <select id="newTeinStyle"><option value="END+">END+</option><option value="END">END</option></select>
    </div>
    <div class="form-row"><label>批發價</label><input type="number" id="newTeinWarrantyPrice"></div>
    <div class="form-row"><label>一線消費者售價</label><input type="number" id="newTeinCatalogPrice"></div>
    <div class="form-row"><label>備註</label><input type="text" id="newTeinRemark"></div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="newTeinSubmitBtn">建立車型</button>
    </div>`;
  openModal(html);
  document.getElementById("newTeinSubmitBtn").addEventListener("click", async ()=>{
    const carModel = document.getElementById("newTeinModel").value.trim();
    if(!carModel){ alert("請輸入車型"); return; }
    const toNum = (id)=>{ const v = document.getElementById(id).value; return v===""?null:Number(v); };
    await db.collection("teinItems").add({
      carModel, brand:"TEIN",
      carMake: document.getElementById("newTeinMake").value.trim(),
      spec: document.getElementById("newTeinSpec").value.trim(),
      style: document.getElementById("newTeinStyle").value,
      remark: document.getElementById("newTeinRemark").value.trim(),
      locations:{},
      warrantyPrice: toNum("newTeinWarrantyPrice"),
      catalogPrice: toNum("newTeinCatalogPrice")
    });
    closeModal();
  });
}

const TEIN_ORDER_STATUS_LABELS = { pending:"待確認", confirmed:"已出貨", cancelled:"已取消" };

const teinOrdersStatusFilterEl = document.getElementById("teinOrdersStatusFilter");
if(teinOrdersStatusFilterEl) teinOrdersStatusFilterEl.addEventListener("change", renderTeinOrders);

function renderTeinOrders(){
  const body = document.getElementById("teinOrdersBody");
  if(!body) return;
  const filterEl = document.getElementById("teinOrdersStatusFilter");
  const filter = filterEl ? filterEl.value : "pending";
  let list = teinOrdersCache.slice();
  if(filter !== "all") list = list.filter(o=> o.status === filter);
  const isPendingView = filter === "pending";
  document.getElementById("teinOrdersCount").textContent = isPendingView ? `共 ${list.length} 筆待確認` : `共 ${list.length} 筆`;
  const sorted = list.sort((a,b)=> isPendingView
    ? (a.requestedAt||"").localeCompare(b.requestedAt||"")
    : (b.requestedAt||"").localeCompare(a.requestedAt||""));
  body.innerHTML = sorted.map(o=>{
    const historyNote = [
      o.confirmedAt ? `出貨於 ${escapeHtml(toTaipeiTimeStr(o.confirmedAt))}${o.confirmedBy?`（${escapeHtml(o.confirmedBy)}）`:""}` : "",
      o.cancelledAt ? `取消於 ${escapeHtml(toTaipeiTimeStr(o.cancelledAt))}${o.cancelledBy?`（${escapeHtml(o.cancelledBy)}）`:""}` : ""
    ].filter(Boolean).join("　");
    return `<tr>
    <td>${escapeHtml(toTaipeiTimeStr(o.requestedAt))}</td>
    <td>${escapeHtml(o.requestedByName||"")}</td>
    <td>${escapeHtml(o.itemLabel||"")}</td>
    <td>${o.qty}</td>
    <td>${o.loc?escapeHtml(o.loc):'<span class="empty-inline">未選</span>'}</td>
    <td>${escapeHtml(o.customerName||"")}</td>
    <td>${escapeHtml(o.customerContact||"")}</td>
    <td>${escapeHtml(o.customerNote||"")}</td>
    <td>${TEIN_ORDER_STATUS_LABELS[o.status] || o.status || "-"}</td>
    <td>${o.status === "pending" ? `
      <button data-confirm="${o.id}">確認</button>
      <button data-edit="${o.id}">修改</button>
      <button data-cancel="${o.id}">取消</button>
    ` : `<span class="empty-inline">${historyNote}</span>`}</td>
  </tr>`;
  }).join("") || `<tr><td colspan="10" class="empty">目前沒有符合條件的訂單</td></tr>`;

  body.querySelectorAll("[data-confirm]").forEach(b=>b.addEventListener("click", ()=> openConfirmTeinOrderModal(b.dataset.confirm)));
  body.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click", ()=> openEditTeinOrderModal(b.dataset.edit)));
  body.querySelectorAll("[data-cancel]").forEach(b=>b.addEventListener("click", ()=> cancelTeinOrder(b.dataset.cancel)));
}

function openConfirmTeinOrderModal(orderId){
  const order = teinOrdersCache.find(o=>o.id===orderId);
  if(!order) return;
  const item = teinItemsCache.find(i=>i.id===order.itemId);
  if(!item){ alert("找不到這個車型，可能已被刪除。請改用「修改」換一個車型，或直接取消這筆訂單。"); return; }
  const options = teinLocList(item);
  if(options.length === 0){ alert("這個車型目前沒有庫存可以出貨，請先確認庫存，或取消這筆訂單。"); return; }
  let defaultIdx = options.findIndex(o=> o.code === order.loc);
  if(defaultIdx < 0) defaultIdx = 0;
  const employeePickNote = order.loc
    ? `<div class="note" style="background:#eef4ff;color:#2451a3;">員工原本選擇：${escapeHtml(order.loc)}，如需要可在下方改選其他儲位。</div>`
    : "";
  const html = `
    <div class="sheet-head"><h2>確認出貨：${escapeHtml(order.itemLabel||"")}</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>客戶</label><input type="text" value="${escapeHtml(order.customerName||'')}（${escapeHtml(order.customerContact||'')}）" disabled></div>
    <div class="form-row"><label>數量</label><input type="text" value="${order.qty}" disabled></div>
    ${employeePickNote}
    <div class="form-row"><label>選擇要出貨的儲位</label>
      <select id="teinConfirmLoc">${options.map((o,i)=>`<option value="${i}" ${i===defaultIdx?'selected':''}>${escapeHtml(o.code)}（目前${o.qty}）</option>`).join("")}</select>
    </div>
    <div class="count" id="teinConfirmStockWarn" style="color:#a31e22;"></div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="teinConfirmOrderSubmitBtn">確認出貨</button>
    </div>`;
  openModal(html);

  function refreshWarn(){
    const idx = Number(document.getElementById("teinConfirmLoc").value);
    const opt = options[idx];
    document.getElementById("teinConfirmStockWarn").textContent =
      (opt && order.qty > opt.qty) ? `⚠ 這個儲位目前只有 ${opt.qty}，不夠出 ${order.qty}` : "";
  }
  document.getElementById("teinConfirmLoc").addEventListener("change", refreshWarn);
  refreshWarn();

  document.getElementById("teinConfirmOrderSubmitBtn").addEventListener("click", async ()=>{
    const idx = Number(document.getElementById("teinConfirmLoc").value);
    const opt = options[idx];
    if(!opt){ alert("請選擇儲位"); return; }
    if(order.qty > opt.qty){ alert(`這個儲位目前只有 ${opt.qty}，不夠出 ${order.qty}`); return; }
    try{
      const txnRef = await submitTeinOrderTxn(order, opt.code);
      await db.collection("teinOrders").doc(order.id).update({
        status: "confirmed", confirmedAt: new Date().toISOString(), confirmedBy: currentUser.name, linkedTxnId: txnRef.id
      });
      closeModal();
    }catch(e){
      alert("確認失敗："+e.message);
    }
  });
}

async function submitTeinOrderTxn(order, loc){
  const itemRef = db.collection("teinItems").doc(order.itemId);
  const itemSnap = await itemRef.get();
  const item = itemSnap.data();
  const allLocs = {...(item.locations||{})};
  const cur = teinLocQty(allLocs[loc]);
  if(cur < order.qty) throw new Error("這個儲位庫存不足，請重新選擇");
  const next = cur - order.qty;
  if(next <= 0) delete allLocs[loc]; else allLocs[loc] = next;
  await itemRef.update({locations: allLocs});
  return await db.collection("teinTransactions").add({
    itemId: order.itemId, type: "out", qty: order.qty, loc,
    date: todayStr(), operator: currentUser.name,
    salesperson: order.requestedByName || "", customerName: order.customerName || "",
    customerContact: order.customerContact || "", customerNote: order.customerNote || "",
    orderId: order.id, editLog: [],
    createdAt: new Date().toISOString()
  });
}

function openEditTeinOrderModal(orderId){
  const order = teinOrdersCache.find(o=>o.id===orderId);
  if(!order) return;
  let selectedItemId = order.itemId;
  const html = `
    <div class="sheet-head"><h2>修改訂單</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row">
      <label>搜尋車型（要換車型才需要）</label>
      <input type="text" id="editTeinOrderItemSearch" placeholder="例如 FIT">
      <div class="autocomplete-list hidden" id="editTeinOrderItemList"></div>
    </div>
    <div class="form-row"><label>目前車型</label><input type="text" id="editTeinOrderItemLabel" value="${escapeHtml(order.itemLabel||'')}" disabled></div>
    <div class="form-row"><label>選擇儲位</label><select id="editTeinOrderLoc"></select></div>
    <div class="form-row"><label>數量</label><input type="number" id="editTeinOrderQty" min="1" value="${order.qty}"></div>
    <div class="form-row"><label>客戶姓名</label><input type="text" id="editTeinOrderCustomerName" value="${escapeHtml(order.customerName||'')}"></div>
    <div class="form-row"><label>聯絡方式</label><input type="text" id="editTeinOrderCustomerContact" value="${escapeHtml(order.customerContact||'')}"></div>
    <div class="form-row"><label>備註</label><input type="text" id="editTeinOrderCustomerNote" value="${escapeHtml(order.customerNote||'')}"></div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="editTeinOrderSaveBtn">儲存</button>
    </div>`;
  openModal(html);

  let locOptions = [];
  function refreshEditLocOptions(){
    const it = teinItemsCache.find(i=>i.id===selectedItemId);
    locOptions = it ? teinLocList(it) : [];
    const locSelect = document.getElementById("editTeinOrderLoc");
    if(locOptions.length === 0){ locSelect.innerHTML = `<option value="">目前無庫存</option>`; return; }
    let defaultIdx = locOptions.findIndex(o=> o.code === order.loc);
    if(defaultIdx < 0) defaultIdx = 0;
    locSelect.innerHTML = locOptions.map((o,i)=>`<option value="${i}" ${i===defaultIdx?'selected':''}>${escapeHtml(o.code)}（目前${o.qty}）</option>`).join("");
  }
  refreshEditLocOptions();

  const searchInput = document.getElementById("editTeinOrderItemSearch");
  searchInput.addEventListener("input", ()=>{
    const q = norm(searchInput.value);
    const listEl = document.getElementById("editTeinOrderItemList");
    if(!q){ listEl.classList.add("hidden"); return; }
    const matches = teinItemsCache.filter(it=> norm(it.carModel).includes(q)).slice(0,15);
    listEl.innerHTML = matches.map(it=>`<div data-id="${it.id}">${escapeHtml(teinItemLabel(it))}</div>`).join("");
    listEl.classList.toggle("hidden", matches.length===0);
    listEl.querySelectorAll("div").forEach(d=>d.addEventListener("click", ()=>{
      selectedItemId = d.dataset.id;
      const it = teinItemsCache.find(i=>i.id===selectedItemId);
      document.getElementById("editTeinOrderItemLabel").value = teinItemLabel(it);
      listEl.classList.add("hidden");
      searchInput.value = "";
      refreshEditLocOptions();
    }));
  });

  document.getElementById("editTeinOrderSaveBtn").addEventListener("click", async ()=>{
    const qty = Number(document.getElementById("editTeinOrderQty").value);
    const customerName = document.getElementById("editTeinOrderCustomerName").value.trim();
    const customerContact = document.getElementById("editTeinOrderCustomerContact").value.trim();
    const customerNote = document.getElementById("editTeinOrderCustomerNote").value.trim();
    if(!qty || qty<=0){ alert("請輸入正確的數量"); return; }
    const it = teinItemsCache.find(i=>i.id===selectedItemId);
    const itemLabel = it ? teinItemLabel(it) : order.itemLabel;
    const locIdx = Number(document.getElementById("editTeinOrderLoc").value);
    const locOpt = locOptions[locIdx];
    try{
      await db.collection("teinOrders").doc(orderId).update({
        itemId: selectedItemId, itemLabel, qty, customerName, customerContact, customerNote,
        loc: locOpt ? locOpt.code : null
      });
      closeModal();
    }catch(e){
      alert("儲存失敗："+e.message);
    }
  });
}

function cancelTeinOrder(orderId){
  if(!confirm("確定要取消這筆訂單嗎？")) return;
  db.collection("teinOrders").doc(orderId).update({
    status: "cancelled", cancelledAt: new Date().toISOString(), cancelledBy: currentUser.name
  }).catch(e=>alert("取消失敗："+e.message));
}

function renderTeinMyOrders(){
  const body = document.getElementById("teinMyOrdersBody");
  if(!body) return;
  const sorted = teinMyOrdersCache.slice().sort((a,b)=> (b.requestedAt||"").localeCompare(a.requestedAt||""));
  document.getElementById("teinMyOrdersCount").textContent = `共 ${sorted.length} 筆`;
  const statusLabel = { pending:"待確認", confirmed:"已出貨", cancelled:"已取消" };
  body.innerHTML = sorted.map(o=>`<tr>
    <td>${escapeHtml(toTaipeiTimeStr(o.requestedAt))}</td>
    <td>${escapeHtml(o.itemLabel||"")}</td>
    <td>${o.qty}</td>
    <td>${escapeHtml(o.customerName||"")}</td>
    <td>${statusLabel[o.status]||o.status}</td>
  </tr>`).join("") || `<tr><td colspan="5" class="empty">尚無訂單紀錄</td></tr>`;
}

document.getElementById("teinAddLocBtn").addEventListener("click", async ()=>{
  const code = document.getElementById("teinNewLocInput").value.trim();
  if(!code){ alert("請輸入儲位代碼"); return; }
  if(teinLocationsCache.some(l=>l.code===code)){ alert("這個儲位代碼已經存在"); return; }
  await db.collection("teinLocations").add({code});
  document.getElementById("teinNewLocInput").value = "";
});

function renderTeinLocations(){
  const body = document.getElementById("teinLocBody");
  body.innerHTML = teinLocationsCache.map(l=>
    `<tr><td>${escapeHtml(l.code)}</td><td><button data-del="${l.id}" data-code="${escapeHtml(l.code)}">刪除</button></td></tr>`
  ).join("") || `<tr><td colspan="2" class="empty">尚無儲位</td></tr>`;
  body.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click", ()=>deleteTeinLocation(b.dataset.del, b.dataset.code)));
}

function deleteTeinLocation(locId, code){
  const blocking = teinItemsCache.filter(it=> teinLocQty((it.locations||{})[code]) > 0);
  if(blocking.length){
    const detail = blocking.map(it=>`${it.carModel}：${teinLocQty(it.locations[code])}`).join("\n");
    alert(`這個儲位還有庫存，無法直接刪除。請先把以下車型搬到其他儲位：\n\n${detail}`);
    return;
  }
  if(confirm(`確定要刪除儲位「${code}」嗎？`)){
    db.collection("teinLocations").doc(locId).delete();
  }
}
