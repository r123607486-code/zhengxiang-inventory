// ============================================================
// KYB：庫存查詢 / 庫存總表 / 儲位與價格編輯 / 匯出
// ============================================================
document.getElementById("kybQueryBox").addEventListener("input", ()=>{ kybQueryVisibleCount = 200; renderKybQuery(); });

const KYB_BUCKET_ORDER = { "白桶": 0, "藍桶": 1, "深藍桶": 2 };
function kybBucketRank(it){
  const r = KYB_BUCKET_ORDER[it.bucketType];
  return r === undefined ? 99 : r;
}
function kybCompareItems(a, b){
  const bucketDiff = kybBucketRank(a) - kybBucketRank(b);
  if(bucketDiff !== 0) return bucketDiff;
  const makeDiff = norm(a.carMake||"").localeCompare(norm(b.carMake||""));
  if(makeDiff !== 0) return makeDiff;
  return norm(a.carModel||"").localeCompare(norm(b.carModel||""));
}
function kybItemLabel(it){
  const tag = [it.bucketType, it.carMake].filter(Boolean).join(' ');
  return tag ? `${it.carModel}\u3000${tag}` : it.carModel;
}

function renderKybQuery(){
  const box = document.getElementById("kybQueryResults");
  const countEl = document.getElementById("kybQueryCount");
  const q = norm(document.getElementById("kybQueryBox").value);

  let list = kybItemsCache.slice();
  if(q) list = list.filter(it=> norm(it.carModel).includes(q) || norm(it.carMake).includes(q) || norm(it.partNo||"").includes(q));
  const kybQuerySortRank = (it)=> kybHasPendingStock(it) ? 0 : (kybTotalQty(it)>0 ? 1 : 2);
  list.sort((a,b)=> (kybQuerySortRank(a) - kybQuerySortRank(b)) || kybCompareItems(a,b));

  const inStockCount = list.filter(it=>kybTotalQty(it)>0).length;
  countEl.textContent = q ? `\u627e\u5230 ${list.length} \u7b46\uff08\u6709\u5eab\u5b58 ${inStockCount} \u7b46\uff09` : `\u5171 ${list.length} \u7b46\u8eca\u578b\uff08\u6709\u5eab\u5b58 ${inStockCount} \u7b46\uff09`;

  box.innerHTML = list.slice(0,kybQueryVisibleCount).map(it=>{
    const qty = kybTotalQty(it);
    const noStock = qty <= 0;
    const pending = kybHasPendingStock(it);
    const subParts = ["KYB"];
    if(it.bucketType) subParts.push(it.bucketType);
    if(it.carMake) subParts.push(it.carMake);
    return `<div class="card${noStock?' card-nostock':''}${pending?' card-pending':''}">
      <div class="code-row">
        <div class="code">${escapeHtml(it.carModel)}${pending?'<span class="pending-tag">\u5c1a\u672a\u5165\u5eab</span>':''}</div>
        ${noStock ? '' : `<button class="order-btn" data-id="${it.id}">${ICONS.cart}\u53eb\u8ca8</button>`}
      </div>
      <div class="sub">${escapeHtml(subParts.join('\u3000'))}${it.partNo ? `\u3000\u6599\u865f\uff1a${escapeHtml(it.partNo)}` : ''}</div>
      <div class="qty">\u5eab\u5b58 ${qty}${it.warrantyPrice!=null?`\u3000\u3000\u4fdd\u4fee\u5ee0\u50f9 ${it.warrantyPrice}`:""}${it.catalogPrice!=null?`\u3000\u3000\u4e00\u7dda\u6d88\u8cbb\u8005\u552e\u50f9 ${it.catalogPrice}`:""}</div>
      <div class="sub">\u5132\u4f4d\uff1a${escapeHtml(kybLocSummary(it))}</div>
    </div>`;
  }).join("") || `<div class="empty">\u67e5\u7121\u7b26\u5408\u7684\u8eca\u578b</div>`;

  if(list.length > kybQueryVisibleCount){
    box.innerHTML += `<button id="kybQueryLoadMoreBtn" class="load-more-btn">\u986f\u793a\u66f4\u591a\uff08\u9084\u6709 ${list.length - kybQueryVisibleCount} \u7b46\uff0c\u76ee\u524d\u986f\u793a ${kybQueryVisibleCount} \u7b46\uff09</button>`;
  }

  box.querySelectorAll(".order-btn").forEach(b=>{
    b.addEventListener("click", ()=> openKybOrderModal(b.dataset.id));
  });
  const kybQueryLoadMoreBtn = document.getElementById("kybQueryLoadMoreBtn");
  if(kybQueryLoadMoreBtn) kybQueryLoadMoreBtn.addEventListener("click", ()=>{ kybQueryVisibleCount += 200; renderKybQuery(); });
}

function openKybOrderModal(itemId){
  const item = kybItemsCache.find(i=>i.id===itemId);
  if(!item) return;
  const options = kybLocList(item);
  const totalAvail = kybTotalQty(item);
  const html = `
    <div class="sheet-head"><h2>\u53eb\u8ca8\uff1a${escapeHtml(item.carModel)}</h2><button class="sheet-close" onclick="closeModal()">\u2715</button></div>
    <div class="form-row"><label>\u8eca\u578b\uff0f\u54c1\u724c</label><input type="text" value="${escapeHtml(item.carModel)}\uff08KYB\uff09" disabled></div>
    <div class="form-row"><label>\u76ee\u524d\u7e3d\u5eab\u5b58</label><input type="text" value="${totalAvail}" disabled></div>
    <div class="form-row"><label>\u9078\u64c7\u5132\u4f4d</label>
      <select id="kybOrderLoc">${options.length ? options.map((o,i)=>`<option value="${i}">${escapeHtml(o.code)}\uff08\u76ee\u524d${o.qty}\uff09</option>`).join("") : `<option value="">\u76ee\u524d\u7121\u5eab\u5b58</option>`}</select>
    </div>
    <div class="form-row"><label>\u6578\u91cf</label><select id="kybOrderQty"></select></div>
    <div class="form-row"><label>\u5ba2\u6236\u59d3\u540d</label><input type="text" id="kybOrderCustomerName"></div>
    <div class="form-row"><label>\u806f\u7d61\u65b9\u5f0f</label><input type="text" id="kybOrderCustomerContact"></div>
    <div class="form-row"><label>\u5099\u8a3b</label><input type="text" id="kybOrderCustomerNote"></div>
    <div class="form-actions">
      <button onclick="closeModal()">\u53d6\u6d88</button>
      <button class="primary" id="kybOrderSubmitBtn">\u9001\u51fa\u53eb\u8ca8</button>
    </div>`;
  openModal(html);

  function refreshQtyOptions(){
    const idx = Number(document.getElementById("kybOrderLoc").value);
    const opt = options[idx];
    const qtySelect = document.getElementById("kybOrderQty");
    if(!opt){ qtySelect.innerHTML = `<option value="0">\u76ee\u524d\u7121\u5eab\u5b58</option>`; return; }
    qtySelect.innerHTML = Array.from({length:opt.qty},(_,i)=>i+1).map(n=>`<option value="${n}">${n}</option>`).join("");
  }
  if(options.length) document.getElementById("kybOrderLoc").addEventListener("change", refreshQtyOptions);
  refreshQtyOptions();

  document.getElementById("kybOrderSubmitBtn").addEventListener("click", async ()=>{
    const idx = Number(document.getElementById("kybOrderLoc").value);
    const opt = options[idx];
    const qty = Number(document.getElementById("kybOrderQty").value);
    const customerName = document.getElementById("kybOrderCustomerName").value.trim();
    const customerContact = document.getElementById("kybOrderCustomerContact").value.trim();
    const customerNote = document.getElementById("kybOrderCustomerNote").value.trim();
    if(!opt){ alert("\u9019\u500b\u8eca\u578b\u76ee\u524d\u6c92\u6709\u5eab\u5b58\u53ef\u4ee5\u53eb\u8ca8"); return; }
    if(!qty || qty<=0){ alert("\u8acb\u8f38\u5165\u6b63\u78ba\u7684\u6578\u91cf"); return; }
    if(qty > opt.qty){ alert(`\u9019\u500b\u5132\u4f4d\u76ee\u524d\u53ea\u6709 ${opt.qty}\uff0c\u4e0d\u80fd\u53eb\u8d85\u904e\u9019\u500b\u6578\u91cf`); return; }
    if(!customerName){ alert("\u8acb\u8f38\u5165\u5ba2\u6236\u59d3\u540d"); return; }
    try{
      await db.collection("kybOrders").add({
        itemId: item.id, itemLabel: `${item.carModel}\uff08KYB\uff09`,
        qty, loc: opt.code,
        customerName, customerContact, customerNote,
        requestedByUid: currentUser.uid, requestedByName: currentUser.name,
        status: "pending", requestedAt: new Date().toISOString()
      });
      closeModal();
      alert("\u5df2\u9001\u51fa\uff0c\u7b49\u5f85\u7ba1\u7406\u8005\u78ba\u8a8d\u51fa\u8ca8\u3002");
    }catch(e){
      alert("\u9001\u51fa\u5931\u6557\uff1a"+e.message);
    }
  });
}

document.getElementById("kybMasterBox").addEventListener("input", renderKybMaster);

function renderKybMaster(){
  const q = norm(document.getElementById("kybMasterBox").value);
  let list = kybItemsCache.slice();
  if(q) list = list.filter(it=> norm(it.carModel).includes(q) || norm(it.carMake).includes(q));
  const kybMasterSortRank = (it)=> kybHasPendingStock(it) ? 0 : (kybTotalQty(it)>0 ? 1 : 2);
  list.sort((a,b)=> (kybMasterSortRank(a) - kybMasterSortRank(b)) || kybCompareItems(a,b));

  document.getElementById("kybMasterCount").textContent = `\u5171 ${list.length} \u7b46`;

  const body = document.getElementById("kybMasterBody");
  body.innerHTML = list.map(it=>{
    const options = kybLocList(it);
    const pending = kybHasPendingStock(it);
    const locHtml = options.length
      ? options.map(o=>`<div class="loc-line${o.code===PENDING_STOCK_CODE?' loc-pending':''}" data-id="${it.id}" data-code="${escapeHtml(o.code)}">${escapeHtml(o.code)}\uff1a${o.qty}</div>`).join("")
      : `<span class="empty-inline">\u7121\u5eab\u5b58</span>`;
    return `<tr class="${pending?'row-pending':''}">
      <td>${escapeHtml(it.carModel)}${pending?'<span class="pending-tag">\u5c1a\u672a\u5165\u5eab</span>':''}</td>
      <td>${escapeHtml(it.carMake||"")}</td>
      <td>${escapeHtml(it.bucketType||"")}</td>
      <td>${kybTotalQty(it)}</td>
      <td class="loc-detail-cell">${locHtml}</td>
      <td>${escapeHtml(it.yearCode||"")}</td>
      <td>${escapeHtml(it.partNo||"")}</td>
      <td class="editable-cell kyb-warranty-cell" data-id="${it.id}">${it.warrantyPrice!=null?it.warrantyPrice:"\u672a\u586b"}</td>
      <td class="editable-cell kyb-catalog-cell" data-id="${it.id}">${it.catalogPrice!=null?it.catalogPrice:"\u672a\u586b"}</td>
      <td>${escapeHtml(it.remark||"")}</td>
      <td>${currentUser.role==='admin' ? `<button data-del="${it.id}" data-model="${escapeHtml(it.carModel)}">\u522a\u9664</button>` : ""}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="11" class="empty">\u5c1a\u7121\u8cc7\u6599</td></tr>`;

  body.querySelectorAll(".loc-line").forEach(el=>{
    el.addEventListener("click", ()=> openKybLocationModal(el.dataset.id, el.dataset.code));
  });
  if(currentUser.role === "admin"){
    body.querySelectorAll(".kyb-catalog-cell").forEach(td=> td.addEventListener("click", ()=> editKybPrice(td.dataset.id, "catalogPrice", "\u4e00\u7dda\u6d88\u8cbb\u8005\u552e\u50f9")));
    body.querySelectorAll(".kyb-warranty-cell").forEach(td=> td.addEventListener("click", ()=> editKybPrice(td.dataset.id, "warrantyPrice", "\u4fdd\u4fee\u5ee0\u50f9")));
    body.querySelectorAll("[data-del]").forEach(b=> b.addEventListener("click", ()=> deleteKybItem(b.dataset.del, b.dataset.model)));
  } else {
    body.querySelectorAll(".kyb-catalog-cell,.kyb-warranty-cell").forEach(td=> td.classList.remove("editable-cell"));
  }
  window._kybMasterFilteredList = list;
}

function deleteKybItem(itemId, carModel){
  if(currentUser.role !== "admin") return;
  const item = kybItemsCache.find(i=>i.id===itemId);
  if(!item) return;
  const qty = kybTotalQty(item);
  if(qty > 0){
    alert(`\u300c${carModel}\u300d\u76ee\u524d\u9084\u6709\u5eab\u5b58\uff08\u5171 ${qty}\uff09\uff0c\u8acb\u5148\u5230\u5132\u4f4d\u7ba1\u7406\u628a\u5eab\u5b58\u642c\u7a7a\u6216\u6b78\u96f6\uff0c\u518d\u522a\u9664\u9019\u500b\u8eca\u578b\u3002`);
    return;
  }
  if(!confirm(`\u78ba\u5b9a\u8981\u522a\u9664\u8eca\u578b\u300c${carModel}\u300d\u55ce\uff1f\u6b64\u52d5\u4f5c\u7121\u6cd5\u5fa9\u539f\u3002`)) return;
  db.collection("kybItems").doc(itemId).delete()
    .catch(e=>alert("\u522a\u9664\u5931\u6557\uff1a"+e.message));
}

function openKybLocationModal(itemId, code){
  const item = kybItemsCache.find(i=>i.id===itemId);
  if(!item) return;
  const allLocs = item.locations || {};
  const qty = kybLocQty(allLocs[code]);
  const allCodes = kybLocationsCache.map(l=>l.code);

  const html = `
    <div class="sheet-head"><h2>\u5132\u4f4d\u7ba1\u7406\uff1a${escapeHtml(code)}</h2><button class="sheet-close" onclick="closeModal()">\u2715</button></div>
    <div class="form-row"><label>\u76ee\u524d\u5132\u4f4d</label><input type="text" value="${escapeHtml(code)}" disabled></div>
    <div class="form-row"><label>\u76ee\u524d\u5eab\u5b58</label><input type="text" value="${qty}" disabled></div>
    <div class="form-row"><label>\u642c\u51fa\u6578\u91cf\uff08\u4e0d\u642c\u5c31\u7559\u7a7a\uff09</label><input type="number" id="kybMoveQty" min="1" max="${qty}"></div>
    <div class="form-row"><label>\u642c\u5230\u54ea\u500b\u5132\u4f4d\uff08\u53ea\u80fd\u9078\u73fe\u6709\u5132\u4f4d\uff09</label>
      <select id="kybMoveTarget"><option value="">\u8acb\u9078\u64c7</option>${allCodes.filter(c=>c!==code).map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}</select>
    </div>
    <div class="form-actions">
      <button onclick="closeModal()">\u53d6\u6d88</button>
      <button class="primary" id="kybLocSaveBtn">\u5132\u5b58</button>
    </div>`;
  openModal(html);

  document.getElementById("kybLocSaveBtn").addEventListener("click", ()=>{
    const moveQtyRaw = document.getElementById("kybMoveQty").value;
    const moveTarget = document.getElementById("kybMoveTarget").value;
    const moveQty = moveQtyRaw ? Number(moveQtyRaw) : 0;
    if(moveQty <= 0){ closeModal(); return; }
    if(!moveTarget){ alert("\u8acb\u9078\u64c7\u8981\u642c\u5230\u54ea\u500b\u5132\u4f4d"); return; }
    if(moveQty > qty){ alert("\u642c\u51fa\u6578\u91cf\u4e0d\u80fd\u8d85\u904e\u76ee\u524d\u5eab\u5b58"); return; }

    const newLocs = {...allLocs};
    newLocs[code] = qty - moveQty;
    newLocs[moveTarget] = kybLocQty(newLocs[moveTarget]) + moveQty;
    if(newLocs[code] <= 0) delete newLocs[code];

    db.collection("kybItems").doc(itemId).update({ locations: newLocs })
      .then(()=>closeModal())
      .catch(e=>alert("\u66f4\u65b0\u5931\u6557\uff1a"+e.message));
  });
}

function editKybPrice(itemId, field, label){
  if(currentUser.role !== "admin") return;
  const item = kybItemsCache.find(i=>i.id===itemId);
  if(!item) return;
  const cur = item[field]!=null ? String(item[field]) : "";
  const input = prompt(`\u8f38\u5165${label}\u91d1\u984d\uff08\u7d14\u6578\u5b57\uff09`, cur);
  if(input === null) return;
  const val = input.trim();
  const update = {};
  if(val === ""){ update[field] = null; }
  else{
    const num = Number(val);
    if(isNaN(num)){ alert("\u8acb\u8f38\u5165\u6578\u5b57"); return; }
    update[field] = num;
  }
  db.collection("kybItems").doc(itemId).update(update).catch(e=>alert("\u66f4\u65b0\u5931\u6557\uff1a"+e.message));
}

document.getElementById("kybExportBtn").addEventListener("click", ()=>{
  const list = window._kybMasterFilteredList || [];
  const rows = list.map(it=>({
    "\u8eca\u578b": it.carModel, "\u5ee0\u724c": it.carMake||"", "\u907f\u9707\u6b3e\u5f0f": it.bucketType||"", "\u7e3d\u91cf": kybTotalQty(it), "\u5132\u4f4d\u5206\u5e03": kybLocSummary(it),
    "\u5e74\u4efd\u4ee3\u78bc": it.yearCode||"", "\u6599\u865f": it.partNo||"",
    "\u4fdd\u4fee\u5ee0\u50f9": it.warrantyPrice!=null?it.warrantyPrice:"", "\u4e00\u7dda\u6d88\u8cbb\u8005\u552e\u50f9": it.catalogPrice!=null?it.catalogPrice:"", "\u5099\u8a3b": it.remark||""
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "\u8cc7\u6599");
  XLSX.writeFile(wb, `KYB\u5eab\u5b58\u7e3d\u8868_\u7be9\u9078\u7d50\u679c_${todayStr()}.xlsx`);
});
