// ============================================================
// YangPo來令片：庫存查詢 / 庫存總表 / 儲位與價格編輯 / 圖片連結 / 匯出
// ============================================================
document.getElementById("padQueryBox").addEventListener("input", ()=>{ padQueryVisibleCount = 200; renderPadQuery(); });

function padCompareItems(a, b){
  const modelDiff = norm(a.carModel||"").localeCompare(norm(b.carModel||""));
  if(modelDiff !== 0) return modelDiff;
  const yearDiff = norm(a.year||"").localeCompare(norm(b.year||""));
  if(yearDiff !== 0) return yearDiff;
  return norm(a.spec||"").localeCompare(norm(b.spec||""));
}
function padItemLabel(it){
  const parts = [it.carModel, it.year, it.spec].filter(Boolean);
  return parts.join("　");
}

// 圖片連結列：連結文字顯示品號（如「前(YBP-2045)」），沒有連結時顯示「品號：目前無圖」
function padQueryImgLine(it){
  const parts = [];
  if(it.partNoFront) parts.push(it.imageLinkFront
    ? `<a class="img-view-btn" href="${escapeHtml(it.imageLinkFront)}" target="_blank" rel="noopener">前(${escapeHtml(it.partNoFront)})</a>`
    : `<span class="empty-inline">${escapeHtml(it.partNoFront)}：目前無圖</span>`);
  if(it.partNoRear) parts.push(it.imageLinkRear
    ? `<a class="img-view-btn" href="${escapeHtml(it.imageLinkRear)}" target="_blank" rel="noopener">後(${escapeHtml(it.partNoRear)})</a>`
    : `<span class="empty-inline">${escapeHtml(it.partNoRear)}：目前無圖</span>`);
  return parts.join("　");
}

// 庫存行：前後分開顯示
function padQueryStockLine(it){
  const parts = [];
  if(it.partNoFront) parts.push(`前庫存 ${padFrontQty(it)}`);
  if(it.partNoRear)  parts.push(`後庫存 ${padRearQty(it)}`);
  if(!it.partNoFront && !it.partNoRear) parts.push(`庫存 ${padTotalQty(it)}`);
  return parts.join("　　");
}

function renderPadQuery(){
  const box = document.getElementById("padQueryResults");
  const countEl = document.getElementById("padQueryCount");
  const q = norm(document.getElementById("padQueryBox").value);

  let list = padItemsCache.slice();
  if(q){ const qNoH=q.replace(/-/g,""); list=list.filter(it=>{ const cm=norm(it.carModel),yr=norm(it.year||"" ),sp=norm(it.spec||""),pf=norm(it.partNoFront||""),pr=norm(it.partNoRear||""); return cm.includes(q)||yr.includes(q)||sp.includes(q)||pf.includes(q)||pr.includes(q)||pf.replace(/-/g,"").includes(qNoH)||pr.replace(/-/g,"").includes(qNoH); }); }
  const padQuerySortRank = (it)=> padHasPendingStock(it) ? 0 : (padTotalQty(it)>0 ? 1 : 2);
  list.sort((a,b)=> (padQuerySortRank(a) - padQuerySortRank(b)) || padCompareItems(a,b));

  const inStockCount = list.filter(it=>padTotalQty(it)>0).length;
  countEl.textContent = q ? `找到 ${list.length} 筆（有庫存 ${inStockCount} 筆）` : `共 ${list.length} 筆規格（有庫存 ${inStockCount} 筆）`;

  box.innerHTML = list.slice(0,padQueryVisibleCount).map(it=>{
    const qty = padTotalQty(it);
    const noStock = qty <= 0;
    const pending = padHasPendingStock(it);
    const subParts = ["YangPo"];
    if(it.year) subParts.push(it.year);
    if(it.spec) subParts.push(it.spec);
    const imgLine = padQueryImgLine(it);
    const stockLine = padQueryStockLine(it);
    return `<div class="card${noStock?' card-nostock':''}${pending?' card-pending':''}">
      <div class="code-row">
        <div class="code">${escapeHtml(it.carModel)}${pending?'<span class="pending-tag">尚未入庫</span>':''}</div>
        ${noStock ? '' : `<button class="order-btn" data-id="${it.id}">${ICONS.cart}叫貨</button>`}
      </div>
      <div class="sub">${escapeHtml(subParts.join('　'))}</div>
      <div class="qty">${escapeHtml(stockLine)}${it.price!=null?`　　價格 ${it.price}`:""}</div>
      <div class="sub">儲位：${escapeHtml(padLocSummary(it))}</div>
      ${imgLine ? `<div class="sub">${imgLine}</div>` : ''}
    </div>`;
  }).join("") || `<div class="empty">查無符合的規格</div>`;

  if(list.length > padQueryVisibleCount){
    box.innerHTML += `<button id="padQueryLoadMoreBtn" class="load-more-btn">顯示更多（還有 ${list.length - padQueryVisibleCount} 筆，目前顯示 ${padQueryVisibleCount} 筆）</button>`;
  }

  box.querySelectorAll(".order-btn").forEach(b=>{
    b.addEventListener("click", ()=> openPadOrderModal(b.dataset.id));
  });
  const padQueryLoadMoreBtn = document.getElementById("padQueryLoadMoreBtn");
  if(padQueryLoadMoreBtn) padQueryLoadMoreBtn.addEventListener("click", ()=>{ padQueryVisibleCount += 200; renderPadQuery(); });
}

// 叫貨 Modal：若品項有前後兩種品號，讓使用者先選前或後，再顯示該側的儲位和庫存
function openPadOrderModal(itemId){
  const item = padItemsCache.find(i=>i.id===itemId);
  if(!item) return;
  const hasFront = !!item.partNoFront;
  const hasRear  = !!item.partNoRear;

  const sideOpts = [];
  if(hasFront) sideOpts.push(`<option value="front">前(F) ${escapeHtml(item.partNoFront)}</option>`);
  if(hasRear)  sideOpts.push(`<option value="rear">後(R) ${escapeHtml(item.partNoRear)}</option>`);
  const sideRow = sideOpts.length > 1
    ? `<div class="form-row"><label>前/後</label><select id="padOrderSide">${sideOpts.join("")}</select></div>`
    : `<input type="hidden" id="padOrderSide" value="${hasFront?'front':'rear'}">`;

  const html = `
    <div class="sheet-head"><h2>叫貨：${escapeHtml(padItemLabel(item))}</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>規格</label><input type="text" value="${escapeHtml(padItemLabel(item))}（YangPo來令片）" disabled></div>
    ${sideRow}
    <div class="form-row"><label>選擇儲位</label><select id="padOrderLoc"></select></div>
    <div class="form-row"><label>數量</label><select id="padOrderQty"></select></div>
    <div class="form-row"><label>客戶姓名</label><input type="text" id="padOrderCustomerName"></div>
    <div class="form-row"><label>聯絡方式</label><input type="text" id="padOrderCustomerContact"></div>
    <div class="form-row"><label>備註</label><input type="text" id="padOrderCustomerNote"></div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="padOrderSubmitBtn">送出叫貨</button>
    </div>`;
  openModal(html);

  function getCurrentSide(){ return document.getElementById("padOrderSide").value; }

  function refreshLocOptions(){
    const side = getCurrentSide();
    const options = padLocList(item, side);
    window._padOrderLocOptions = options;
    const locSelect = document.getElementById("padOrderLoc");
    locSelect.innerHTML = options.length
      ? options.map((o,i)=>`<option value="${i}">${escapeHtml(o.code)}（目前${o.qty}）</option>`).join("")
      : `<option value="">目前無庫存</option>`;
    refreshQtyOptions();
  }

  function refreshQtyOptions(){
    const options = window._padOrderLocOptions || [];
    const idx = Number(document.getElementById("padOrderLoc").value);
    const opt = options[idx];
    const qtySelect = document.getElementById("padOrderQty");
    if(!opt){ qtySelect.innerHTML = `<option value="0">目前無庫存</option>`; return; }
    qtySelect.innerHTML = Array.from({length:opt.qty},(_,i)=>i+1).map(n=>`<option value="${n}">${n}</option>`).join("");
  }

  if(sideOpts.length > 1) document.getElementById("padOrderSide").addEventListener("change", refreshLocOptions);
  document.getElementById("padOrderLoc").addEventListener("change", refreshQtyOptions);
  refreshLocOptions();

  document.getElementById("padOrderSubmitBtn").addEventListener("click", async ()=>{
    const side = getCurrentSide();
    const options = window._padOrderLocOptions || [];
    const idx = Number(document.getElementById("padOrderLoc").value);
    const opt = options[idx];
    const qty = Number(document.getElementById("padOrderQty").value);
    const customerName = document.getElementById("padOrderCustomerName").value.trim();
    const customerContact = document.getElementById("padOrderCustomerContact").value.trim();
    const customerNote = document.getElementById("padOrderCustomerNote").value.trim();
    if(!opt){ alert("這個規格目前沒有庫存可以叫貨"); return; }
    if(!qty || qty<=0){ alert("請輸入正確的數量"); return; }
    if(qty > opt.qty){ alert(`這個儲位目前只有 ${opt.qty}，不能叫超過這個數量`); return; }
    if(!customerName){ alert("請輸入客戶姓名"); return; }
    const partNo = side === "rear" ? item.partNoRear : item.partNoFront;
    try{
      await db.collection("padOrders").add({
        itemId: item.id,
        itemLabel: `${padItemLabel(item)}（YangPo來令片）`,
        side, partNo,
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

document.getElementById("padMasterBox").addEventListener("input", renderPadMaster);

function renderPadMaster(){
  const q = norm(document.getElementById("padMasterBox").value);
  let list = padItemsCache.slice();
  if(q){ const qNoH=q.replace(/-/g,""); list=list.filter(it=>{ const cm=norm(it.carModel),yr=norm(it.year||""),sp=norm(it.spec||""),pf=norm(it.partNoFront||""),pr=norm(it.partNoRear||""); return cm.includes(q)||yr.includes(q)||sp.includes(q)||pf.includes(q)||pr.includes(q)||pf.replace(/-/g,"").includes(qNoH)||pr.replace(/-/g,"").includes(qNoH); }); }
  const padMasterSortRank = (it)=> padHasPendingStock(it) ? 0 : (padTotalQty(it)>0 ? 1 : 2);
  list.sort((a,b)=> (padMasterSortRank(a) - padMasterSortRank(b)) || padCompareItems(a,b));

  document.getElementById("padMasterCount").textContent = `共 ${list.length} 筆`;

  const body = document.getElementById("padMasterBody");
  body.innerHTML = list.map(it=>{
    const pending = padHasPendingStock(it);

    const frontLocs = padFrontLocList(it);
    const frontLocHtml = it.partNoFront
      ? (frontLocs.length
          ? frontLocs.map(o=>`<div class="loc-line${o.code===PENDING_STOCK_CODE?' loc-pending':''}" data-id="${it.id}" data-code="${escapeHtml(o.code)}" data-side="front">${escapeHtml(o.code)}：${o.qty}</div>`).join("")
          : `<span class="empty-inline">無庫存</span>`)
      : `<span class="empty-inline">-</span>`;

    const rearLocs = padRearLocList(it);
    const rearLocHtml = it.partNoRear
      ? (rearLocs.length
          ? rearLocs.map(o=>`<div class="loc-line${o.code===PENDING_STOCK_CODE?' loc-pending':''}" data-id="${it.id}" data-code="${escapeHtml(o.code)}" data-side="rear">${escapeHtml(o.code)}：${o.qty}</div>`).join("")
          : `<span class="empty-inline">無庫存</span>`)
      : `<span class="empty-inline">-</span>`;

    const imgBtn = (link,label)=> link
      ? `<button class="img-view-btn" data-link="${escapeHtml(link)}">${label}</button>`
      : `<span class="empty-inline">${label}無圖</span>`;

    return `<tr class="${pending?'row-pending':''}">
      <td>${escapeHtml(it.carModel)}${pending?'<span class="pending-tag">尚未入庫</span>':''}</td>
      <td>${escapeHtml(it.year||"")}</td>
      <td>${escapeHtml(it.spec||"")}</td>
      <td>${it.partNoFront ? padFrontQty(it) : '-'}</td>
      <td class="loc-detail-cell">${frontLocHtml}</td>
      <td>${it.partNoRear ? padRearQty(it) : '-'}</td>
      <td class="loc-detail-cell">${rearLocHtml}</td>
      <td>${escapeHtml(it.partNoFront||"")}</td>
      <td>${escapeHtml(it.fmsiFront||"")}</td>
      <td>${escapeHtml(it.partNoRear||"")}</td>
      <td>${escapeHtml(it.fmsiRear||"")}</td>
      <td>${imgBtn(it.imageLinkFront,'前')} ${imgBtn(it.imageLinkRear,'後')}${currentUser.role==='admin'?` <button class="img-edit-btn" data-id="${it.id}">編輯連結</button>`:""}</td>
      <td class="editable-cell pad-price-cell" data-id="${it.id}">${it.price!=null?it.price:"未填"}</td>
      <td>${escapeHtml(it.remark||"")}</td>
      <td>${currentUser.role==='admin' ? `<button data-del="${it.id}" data-model="${escapeHtml(padItemLabel(it))}">刪除</button>` : ""}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="15" class="empty">尚無資料</td></tr>`;

  body.querySelectorAll(".loc-line").forEach(el=>{
    el.addEventListener("click", ()=> openPadLocationModal(el.dataset.id, el.dataset.code, el.dataset.side));
  });
  body.querySelectorAll(".img-view-btn").forEach(b=>{
    b.addEventListener("click", ()=> window.open(b.dataset.link, "_blank"));
  });
  if(currentUser.role === "admin"){
    body.querySelectorAll(".pad-price-cell").forEach(td=> td.addEventListener("click", ()=> editPadPrice(td.dataset.id)));
    body.querySelectorAll("[data-del]").forEach(b=> b.addEventListener("click", ()=> deletePadItem(b.dataset.del, b.dataset.model)));
    body.querySelectorAll(".img-edit-btn").forEach(b=> b.addEventListener("click", ()=> editPadImageLinks(b.dataset.id)));
  } else {
    body.querySelectorAll(".pad-price-cell").forEach(td=> td.classList.remove("editable-cell"));
  }
  window._padMasterFilteredList = list;
}

function deletePadItem(itemId, label){
  if(currentUser.role !== "admin") return;
  const item = padItemsCache.find(i=>i.id===itemId);
  if(!item) return;
  const qty = padTotalQty(item);
  if(qty > 0){
    alert(`「${label}」目前還有庫存（共 ${qty}），請先到儲位管理把庫存搬空或歸零，再刪除這個規格。`);
    return;
  }
  if(!confirm(`確定要刪除規格「${label}」嗎？此動作無法復原。`)) return;
  db.collection("padItems").doc(itemId).delete()
    .catch(e=>alert("刪除失敗："+e.message));
}

// 儲位搬倉 Modal：移動庫存時同步所有共用同品號的車款卡
function openPadLocationModal(itemId, code, side){
  const item = padItemsCache.find(i=>i.id===itemId);
  if(!item) return;
  const locField = side === "rear" ? "locationsRear" : "locationsFront";
  const allLocs = item[locField] || {};
  const qty = padLocQty(allLocs[code]);
  const allCodes = padLocationsCache.map(l=>l.code);
  const sideLabel = side === "rear" ? "後(R)" : "前(F)";

  // 取得品號（用於找出所有共用的車款卡）
  const partNo = side === "rear" ? item.partNoRear : item.partNoFront;

  const html = `
    <div class="sheet-head"><h2>儲位管理：${escapeHtml(code)}（${sideLabel}）</h2><button class="sheet-close" onclick="closeModal()">✕</button></div>
    <div class="form-row"><label>目前儲位</label><input type="text" value="${escapeHtml(code)}" disabled></div>
    <div class="form-row"><label>目前庫存（${sideLabel}）</label><input type="text" value="${qty}" disabled></div>
    <div class="form-row"><label>搬出數量（不搬就留空）</label><input type="number" id="padMoveQty" min="1" max="${qty}"></div>
    <div class="form-row"><label>搬到哪個儲位（只能選現有儲位）</label>
      <select id="padMoveTarget"><option value="">請選擇</option>${allCodes.filter(c=>c!==code).map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}</select>
    </div>
    <div class="form-actions">
      <button onclick="closeModal()">取消</button>
      <button class="primary" id="padLocSaveBtn">儲存</button>
    </div>`;
  openModal(html);

  document.getElementById("padLocSaveBtn").addEventListener("click", async ()=>{
    const moveQtyRaw = document.getElementById("padMoveQty").value;
    const moveTarget = document.getElementById("padMoveTarget").value;
    const moveQty = moveQtyRaw ? Number(moveQtyRaw) : 0;
    if(moveQty <= 0){ closeModal(); return; }
    if(!moveTarget){ alert("請選擇要搬到哪個儲位"); return; }
    if(moveQty > qty){ alert("搬出數量不能超過目前庫存"); return; }

    const newLocs = {...allLocs};
    newLocs[code] = qty - moveQty;
    newLocs[moveTarget] = padLocQty(newLocs[moveTarget]) + moveQty;
    if(newLocs[code] <= 0) delete newLocs[code];

    // 同步所有共用同品號的車款卡
    const matching = partNo
      ? padItemsCache.filter(i=> side === "rear" ? i.partNoRear === partNo : i.partNoFront === partNo)
      : [item];

    const batch = db.batch();
    matching.forEach(mi=>{
      batch.update(db.collection("padItems").doc(mi.id), {[locField]: newLocs});
    });
    try{
      await batch.commit();
      closeModal();
    }catch(e){
      alert("更新失敗："+e.message);
    }
  });
}

function editPadPrice(itemId){
  if(currentUser.role !== "admin") return;
  const item = padItemsCache.find(i=>i.id===itemId);
  if(!item) return;
  const cur = item.price!=null ? String(item.price) : "";
  const input = prompt(`輸入價格（純數字）`, cur);
  if(input === null) return;
  const val = input.trim();
  const update = {};
  if(val === ""){ update.price = null; }
  else{
    const num = Number(val);
    if(isNaN(num)){ alert("請輸入數字"); return; }
    update.price = num;
  }
  db.collection("padItems").doc(itemId).update(update).catch(e=>alert("更新失敗："+e.message));
}

function editPadImageLinks(itemId){
  if(currentUser.role !== "admin") return;
  const item = padItemsCache.find(i=>i.id===itemId);
  if(!item) return;
  const curFront = item.imageLinkFront || "";
  const inputFront = prompt("貼上「前」圖片連結（不需要就留空）", curFront);
  if(inputFront === null) return;
  const curRear = item.imageLinkRear || "";
  const inputRear = prompt("貼上「後」圖片連結（不需要就留空）", curRear);
  if(inputRear === null) return;
  db.collection("padItems").doc(itemId).update({
    imageLinkFront: inputFront.trim() || null,
    imageLinkRear: inputRear.trim() || null
  }).catch(e=>alert("更新失敗："+e.message));
}

document.getElementById("padExportBtn").addEventListener("click", ()=>{
  const list = window._padMasterFilteredList || [];
  const rows = list.map(it=>({
    車款: it.carModel, 年份: it.year||"", 規格: it.spec||"",
    "前量(F)": it.partNoFront ? padFrontQty(it) : "",
    "前儲位(F)": it.partNoFront ? padFrontLocSummary(it) : "",
    "後量(R)": it.partNoRear ? padRearQty(it) : "",
    "後儲位(R)": it.partNoRear ? padRearLocSummary(it) : "",
    "品號/前(F)": it.partNoFront||"", "FMSI NO./前(F)": it.fmsiFront||"",
    "品號/後(R)": it.partNoRear||"",  "FMSI NO./後(R)": it.fmsiRear||"",
    價格: it.price!=null?it.price:"", 備註: it.remark||""
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "資料");
  XLSX.writeFile(wb, `YangPo來令片庫存總表_篩選結果_${todayStr()}.xlsx`);
});
