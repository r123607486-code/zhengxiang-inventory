// ============================================================
// TEIN：庫存查詢 / 庫存總表 / 儲位與價格編輯 / 匯出
// ============================================================
document.getElementById("teinQueryBox").addEventListener("input", ()=>{ teinQueryVisibleCount = 200; renderTeinQuery(); });

function teinCompareItems(a, b){
  const makeDiff = norm(a.carMake||"").localeCompare(norm(b.carMake||""));
  if(makeDiff !== 0) return makeDiff;
  const modelDiff = norm(a.carModel||"").localeCompare(norm(b.carModel||""));
  if(modelDiff !== 0) return modelDiff;
  // END+ 排在 END 前面
  const styleA = (a.style||"") === "END+" ? 0 : 1;
  const styleB = (b.style||"") === "END+" ? 0 : 1;
  return styleA - styleB;
}

function teinItemLabel(it){
  const tag = [it.style, it.carMake].filter(Boolean).join(' ');
  return tag ? `${it.carModel}　${tag}` : it.carModel;
}

function renderTeinQuery(){
  const box = document.getElementById("teinQueryResults");
  const countEl = document.getElementById("teinQueryCount");
  const q = norm(document.getElementById("teinQueryBox").value);

  let list = teinItemsCache.slice();
  if(q) list = list.filter(it=> norm(it.carModel).includes(q) || norm(it.carMake).includes(q) || norm(it.spec||"").includes(q));
  const teinQuerySortRank = (it)=> teinHasPendingStock(it) ? 0 : (teinTotalQty(it)>0 ? 1 : 2);
  list.sort((a,b)=> (teinQuerySortRank(a) - teinQuerySortRank(b)) || teinCompareItems(a,b));

  const inStockCount = list.filter(it=>teinTotalQty(it)>0).length;
  countEl.textContent = q ? `找到 ${list.length} 筆（有庫存 ${inStockCount} 筆）` : `共 ${list.length} 筆車型（有庫存 ${inStockCount} 筆）`;

  box.innerHTML = list.slice(0,teinQueryVisibleCount).map(it=>{
    const qty = teinTotalQty(it);
    const noStock = qty <= 0;
    const pending = teinHasPendingStock(it);
    const subParts = ["TEIN"];
    if(it.style) subParts.push(it.style);
    if(it.carMake) subParts.push(it.carMake);
    if(it.spec) subParts.push(it.spec);
    return `<div class="card${noStock?' card-nostock':''}${pending?' card-pending':''}">
      <div class="code-row">
        <div class="code">${escapeHtml(it.carModel)}${pending?'<span class="pending-tag">尚未入庫</span>':''}</div>
        ${noStock ? '' : `<button class="order-btn" data-id="${it.id}">${ICONS.cart}叫貨</button>`}
      </div>
      <div class="sub">${escapeHtml(subParts.join('　'))}</div>
      <div class="qty">庫存 ${qty}${it.warrantyPrice!=null?`　　批發價 ${it.warrantyPrice}`:""}${it.catalogPrice!=null?`　　一線消費者售價 ${it.catalogPrice}`:""}</div>
      <div class="sub">儲位：${escapeHtml(teinLocSummary(it))}</div>
    </div>`;
  }).join("") || `<div class="empty">查無符合的車型</div>`;

  if(list.length > teinQueryVisibleCount){
    box.innerHTML += `<button id="teinQueryLoadMoreBtn" class="load-more-btn">顯示更多（還有 ${list.length - teinQueryVisibleCount} 筆，目前顯示 ${teinQueryVisibleCount} 筆）</button>`;
  }

  box.querySelectorAll(".order-btn").forEach(b=>{
    b.addEventListener("click", ()=> openTeinOrderModal(b.dataset.id));
  });
  const teinQueryLoadMoreBtn = document.getElementById("teinQueryLoadMoreBtn");
  if(teinQueryLoadMoreBtn) teinQueryLoadMoreBtn.addEventListener("click", ()=>{ teinQueryVisibleCount += 200; renderTeinQuery(); });
}

function openTeinOrderModal(itemId){
  const item = teinItemsCache.find(i=>i.id===itemId);
  if(!item) return;
  const options = teinLocList(item);
  const totalAvail = teinTotalQty(item);
  const html = `
    <div class="sheet-head"><h2>叫貨：${escapeHtml(item.carModel)}</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>車型／品牌</label><input type="text" value="${escapeHtml(item.carModel)}（TEIN ${escapeHtml(item.style||'')}）" disabled></div>
    <div class="form-row"><label>目前總庫存</label><input type="text" value="${totalAvail}" disabled></div>
    <div class="form-row"><label>選擇儲位</label>
      <select id="teinOrderLoc">${options.length ? options.map((o,i)=>`<option value="${i}">${escapeHtml(o.code)}（目前${o.qty}）</option>`).join("") : `<option value="">目前無庫存</option>`}</select>
    </div>
    <div class="form-row"><label>數量</label><select id="teinOrderQty"></select></div>
    <div class="form-row"><label>客戶姓名</label><input type="text" id="teinOrderCustomerName"></div>
    <div class="form-row"><label>聯絡方式</label><input type="text" id="teinOrderCustomerContact"></div>
    <div class="form-row"><label>備註</label><input type="text" id="teinOrderCustomerNote"></div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="teinOrderSubmitBtn">送出叫貨</button>
    </div>`;
  openModal(html);

  function refreshQtyOptions(){
    const idx = Number(document.getElementById("teinOrderLoc").value);
    const opt = options[idx];
    const qtySelect = document.getElementById("teinOrderQty");
    if(!opt){ qtySelect.innerHTML = `<option value="0">目前無庫存</option>`; return; }
    qtySelect.innerHTML = Array.from({length:opt.qty},(_,i)=>i+1).map(n=>`<option value="${n}">${n}</option>`).join("");
  }
  if(options.length) document.getElementById("teinOrderLoc").addEventListener("change", refreshQtyOptions);
  refreshQtyOptions();

  document.getElementById("teinOrderSubmitBtn").addEventListener("click", async ()=>{
    const idx = Number(document.getElementById("teinOrderLoc").value);
    const opt = options[idx];
    const qty = Number(document.getElementById("teinOrderQty").value);
    const customerName = document.getElementById("teinOrderCustomerName").value.trim();
    const customerContact = document.getElementById("teinOrderCustomerContact").value.trim();
    const customerNote = document.getElementById("teinOrderCustomerNote").value.trim();
    if(!opt){ alert("這個車型目前沒有庫存可以叫貨"); return; }
    if(!qty || qty<=0){ alert("請輸入正確的數量"); return; }
    if(qty > opt.qty){ alert(`這個儲位目前只有 ${opt.qty}，不能叫超過這個數量`); return; }
    if(!customerName){ alert("請輸入客戶姓名"); return; }
    try{
      await db.collection("teinOrders").add({
        itemId: item.id, itemLabel: `${item.carModel}（TEIN ${item.style||''}）`,
        qty, loc: opt.code,
        customerName, customerContact, customerNote,
        requestedByUid: currentUser.uid, requestedByName: currentUser.name,
        status: "pending", requestedAt: new Date().toISOString()
      });
      closeModal();
      alert("已送出，等待管理者確認出貨。");
    }catch(e){
      alert("送出失敗："+e.message);
    }
  });
}

document.getElementById("teinMasterBox").addEventListener("input", renderTeinMaster);

function renderTeinMaster(){
  const q = norm(document.getElementById("teinMasterBox").value);
  let list = teinItemsCache.slice();
  if(q) list = list.filter(it=> norm(it.carModel).includes(q) || norm(it.carMake).includes(q) || norm(it.spec||"").includes(q));
  const teinMasterSortRank = (it)=> teinHasPendingStock(it) ? 0 : (teinTotalQty(it)>0 ? 1 : 2);
  list.sort((a,b)=> (teinMasterSortRank(a) - teinMasterSortRank(b)) || teinCompareItems(a,b));

  document.getElementById("teinMasterCount").textContent = `共 ${list.length} 筆`;

  const body = document.getElementById("teinMasterBody");
  body.innerHTML = list.map(it=>{
    const options = teinLocList(it);
    const pending = teinHasPendingStock(it);
    const locHtml = options.length
      ? options.map(o=>`<div class="loc-line${o.code===PENDING_STOCK_CODE?' loc-pending':''}" data-id="${it.id}" data-code="${escapeHtml(o.code)}">${escapeHtml(o.code)}：${o.qty}</div>`).join("")
      : `<span class="empty-inline">無庫存</span>`;
    return `<tr class="${pending?'row-pending':''}">
      <td>${escapeHtml(it.carModel)}${pending?'<span class="pending-tag">尚未入庫</span>':''}</td>
      <td>${escapeHtml(it.carMake||"")}</td>
      <td>${escapeHtml(it.spec||"")}</td>
      <td>${escapeHtml(it.style||"")}</td>
      <td class="editable-cell tein-warranty-cell" data-id="${it.id}">${it.warrantyPrice!=null?it.warrantyPrice:"未填"}</td>
      <td class="editable-cell tein-catalog-cell" data-id="${it.id}">${it.catalogPrice!=null?it.catalogPrice:"未填"}</td>
      <td>${teinTotalQty(it)}</td>
      <td class="loc-detail-cell">${locHtml}</td>
      <td>${escapeHtml(it.remark||"")}</td>
      <td>${currentUser.role==='admin' ? `<button data-del="${it.id}" data-model="${escapeHtml(it.carModel)}">刪除</button>` : ""}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="10" class="empty">尚無資料</td></tr>`;

  body.querySelectorAll(".loc-line").forEach(el=>{
    el.addEventListener("click", ()=> openTeinLocationModal(el.dataset.id, el.dataset.code));
  });
  if(currentUser.role === "admin"){
    body.querySelectorAll(".tein-catalog-cell").forEach(td=> td.addEventListener("click", ()=> editTeinPrice(td.dataset.id, "catalogPrice", "一線消費者售價")));
    body.querySelectorAll(".tein-warranty-cell").forEach(td=> td.addEventListener("click", ()=> editTeinPrice(td.dataset.id, "warrantyPrice", "批發價")));
    body.querySelectorAll("[data-del]").forEach(b=> b.addEventListener("click", ()=> deleteTeinItem(b.dataset.del, b.dataset.model)));
  } else {
    body.querySelectorAll(".tein-catalog-cell,.tein-warranty-cell").forEach(td=> td.classList.remove("editable-cell"));
  }
  window._teinMasterFilteredList = list;
}

// ============================================================
// deleteTeinItem（改用 runTransaction + change log）
// ============================================================
async function deleteTeinItem(itemId, carModel){
  if(currentUser.role !== "admin") return;
  const item = teinItemsCache.find(i=>i.id===itemId);
  if(!item) return;
  const qty = teinTotalQty(item);
  if(qty > 0){
    alert(`「${carModel}」目前還有庫存（共 ${qty}），請先到儲位管理把庫存搬空或歸零，再刪除這個車型。`);
    return;
  }
  if(!confirm(`確定要刪除車型「${carModel}」嗎？此動作無法復原。`)) return;

  const itemRef     = db.collection("teinItems").doc(itemId);
  const settingsRef = db.collection("settings").doc("teinCache");
  try {
    await db.runTransaction(async (firestoreTxn)=>{
      const settingsSnap = await firestoreTxn.get(settingsRef);
      const newSeq = (settingsSnap.exists ? (settingsSnap.data().changeSequence||0) : 0) + 1;

      firestoreTxn.delete(itemRef);

      firestoreTxn.set(db.collection("teinItemChanges").doc(), {
        itemId, action:"delete", changeSequence:newSeq,
        changedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      firestoreTxn.set(settingsRef, { changeSequence:newSeq }, { merge:true });
    });
  } catch(e){
    alert("刪除失敗："+e.message);
  }
}

// ============================================================
// openTeinLocationModal（改用 runTransaction + change log）
// ============================================================
function openTeinLocationModal(itemId, code){
  const item = teinItemsCache.find(i=>i.id===itemId);
  if(!item) return;
  const allLocs = item.locations || {};
  const qty = teinLocQty(allLocs[code]);
  const allCodes = teinLocationsCache.map(l=>l.code);

  const html = `
    <div class="sheet-head"><h2>儲位管理：${escapeHtml(code)}</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>目前儲位</label><input type="text" value="${escapeHtml(code)}" disabled></div>
    <div class="form-row"><label>目前庫存</label><input type="text" value="${qty}" disabled></div>
    <div class="form-row"><label>搬出數量（不搬就留空）</label><input type="number" id="teinMoveQty" min="1" max="${qty}"></div>
    <div class="form-row"><label>搬到哪個儲位（只能選現有儲位）</label>
      <select id="teinMoveTarget"><option value="">請選擇</option>${allCodes.filter(c=>c!==code).map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}</select>
    </div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="teinLocSaveBtn">儲存</button>
    </div>`;
  openModal(html);

  document.getElementById("teinLocSaveBtn").addEventListener("click", ()=>{
    const moveQtyRaw = document.getElementById("teinMoveQty").value;
    const moveTarget = document.getElementById("teinMoveTarget").value;
    const moveQty = moveQtyRaw ? Number(moveQtyRaw) : 0;
    if(moveQty <= 0){ closeModal(); return; }
    if(!moveTarget){ alert("請選擇要搬到哪個儲位"); return; }
    if(moveQty > qty){ alert("搬出數量不能超過目前庫存"); return; }

    const newLocs = {...allLocs};
    newLocs[code] = qty - moveQty;
    newLocs[moveTarget] = teinLocQty(newLocs[moveTarget]) + moveQty;
    if(newLocs[code] <= 0) delete newLocs[code];

    const settingsRef = db.collection("settings").doc("teinCache");
    db.runTransaction(async (firestoreTxn)=>{
      const settingsSnap = await firestoreTxn.get(settingsRef);
      const newSeq = (settingsSnap.exists ? (settingsSnap.data().changeSequence||0) : 0) + 1;

      firestoreTxn.update(db.collection("teinItems").doc(itemId), { locations: newLocs });

      firestoreTxn.set(db.collection("teinItemChanges").doc(), {
        itemId, action:"update", changeSequence:newSeq,
        changedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      firestoreTxn.set(settingsRef, { changeSequence:newSeq }, { merge:true });
    })
    .then(()=>closeModal())
    .catch(e=>alert("更新失敗："+e.message));
  });
}

// ============================================================
// editTeinPrice（改用 runTransaction + change log）
// ============================================================
function editTeinPrice(itemId, field, label){
  if(currentUser.role !== "admin") return;
  const item = teinItemsCache.find(i=>i.id===itemId);;
  if(!item) return;
  const cur = item[field]!=null ? String(item[field]) : "";
  const input = prompt(`輸入${label}金額（純數字）`, cur);
  if(input === null) return;
  const val = input.trim();
  const update = {};
  if(val === ""){ update[field] = null; }
  else{
    const num = Number(val);
    if(isNaN(num)){ alert("請輸入數字"); return; }
    update[field] = num;
  }

  const settingsRef = db.collection("settings").doc("teinCache");
  db.runTransaction(async (firestoreTxn)=>{
    const settingsSnap = await firestoreTxn.get(settingsRef);
    const newSeq = (settingsSnap.exists ? (settingsSnap.data().changeSequence||0) : 0) + 1;

    firestoreTxn.update(db.collection("teinItems").doc(itemId), update);

    firestoreTxn.set(db.collection("teinItemChanges").doc(), {
      itemId, action:"update", changeSequence:newSeq,
      changedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    firestoreTxn.set(settingsRef, { changeSequence:newSeq }, { merge:true });
  }).catch(e=>alert("更新失敗："+e.message));
}

document.getElementById("teinExportBtn").addEventListener("click", ()=>{
  const list = window._teinMasterFilteredList || [];
  const rows = list.map(it=>({
    車型: it.carModel, 廠牌: it.carMake||"", 規格: it.spec||"", 款式: it.style||"",
    批發價: it.warrantyPrice!=null?it.warrantyPrice:"",
    一線消費者售價: it.catalogPrice!=null?it.catalogPrice:"",
    總量: teinTotalQty(it), 儲位分布: teinLocSummary(it), 備註: it.remark||""
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "資料");
  XLSX.writeFile(wb, `TEIN庫存總表_篩選結果_${todayStr()}.xlsx`);
});
