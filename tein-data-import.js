// ============================================================
// TEIN 資料匯入
// 1. 報價單匯入：含「廠牌」「車型」「規格」「款式」「批發價」「一線消費者售價」
// 2. 庫存數量匯入：含「車型」「款式」「總量」，可附「儲位分布」
// ============================================================

document.getElementById("teinClearDataBtn").addEventListener("click", async ()=>{
  if(!confirm("確定要清除所有「TEIN車型」與「TEIN儲位」資料嗎？（不會動到輪胎/KYB/來令片資料，也不會動到TEIN的進出貨紀錄）確定要繼續嗎？")) return;
  const statusEl = document.getElementById("teinImportStatus");
  statusEl.textContent = "清除中...";
  try {
    const itemsSnap = await db.collection("teinItems").get();
    const locSnap = await db.collection("teinLocations").get();
    const allDocs = [...itemsSnap.docs, ...locSnap.docs];
    let done = 0;
    while(done < allDocs.length){
      const batch = db.batch();
      allDocs.slice(done, done+200).forEach(d=>batch.delete(d.ref));
      await batch.commit();
      done += 200;
    }
    statusEl.textContent = `已清除 ${itemsSnap.size} 筆TEIN車型與 ${locSnap.size} 筆儲位資料，可以重新選檔匯入了。`;
  } catch(e) {
    statusEl.textContent = "清除失敗：" + e.message;
  }
});

document.getElementById("teinImportBtn").addEventListener("click", async ()=>{
  const fileInput = document.getElementById("teinImportFile");
  const statusEl = document.getElementById("teinImportStatus");
  if(!fileInput.files.length){ alert("請先選擇檔案"); return; }
  statusEl.textContent = "讀取檔案中...";
  const file = fileInput.files[0];
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, {type:"array"});

  let detected = null;
  for(const sheetName of wb.SheetNames){
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null, blankrows:true});
    for(let r=0; r<Math.min(rows.length, 10); r++){
      const row = rows[r] || [];
      if(row.includes("車型") && row.includes("款式") && (row.includes("批發價") || row.includes("一線消費者售價"))){
        detected = { rows, headerRowIndex: r };
        break;
      }
    }
    if(detected) break;
  }

  if(!detected){
    statusEl.textContent = '找不到可匯入的TEIN報價單格式。請確認上傳的 Excel 含「車型」「款式」「批發價」「一線消費者售價」欄位。';
    return;
  }

  const header = detected.rows[detected.headerRowIndex];
  const modelIdx    = header.indexOf("車型");
  const makeIdx     = header.indexOf("廠牌");
  const specIdx     = header.indexOf("規格");
  const styleIdx    = header.indexOf("款式");
  const warrantyIdx = header.indexOf("批發價");
  const catalogIdx  = header.indexOf("一線消費者售價");
  const remarkIdx   = header.indexOf("備註");

  const dataRows = detected.rows.slice(detected.headerRowIndex + 1);
  const merged = new Map();
  let skippedCount = 0;
  const toNum = (v)=> (v===null||v===undefined||v==="") ? null : Number(v);

  dataRows.forEach(row=>{
    if(!row) return;
    const modelRaw = row[modelIdx];
    const modelStr = (modelRaw==null?"":modelRaw).toString().trim();
    if(!modelStr) return;
    if(modelStr.length > 60){ skippedCount++; return; }
    const styleRaw = styleIdx>=0 ? row[styleIdx] : null;
    const styleStr = (styleRaw==null?"":styleRaw).toString().trim();
    const key = modelStr + "|" + styleStr;
    merged.set(key, {
      carModel: modelStr,
      carMake: makeIdx>=0 ? (row[makeIdx]||"").toString().trim() : "",
      spec: specIdx>=0 ? (row[specIdx]==null?"":row[specIdx].toString().trim()) : "",
      style: styleStr,
      warrantyPrice: warrantyIdx>=0 ? toNum(row[warrantyIdx]) : null,
      catalogPrice: catalogIdx>=0 ? toNum(row[catalogIdx]) : null,
      remark: remarkIdx>=0 ? (row[remarkIdx]||"").toString().trim() : ""
    });
  });

  const rowsToApply = Array.from(merged.values());
  const total = rowsToApply.length;
  statusEl.textContent = `偵測到TEIN報價單，共 ${total} 筆${skippedCount?`（已跳過疑似備註文字的 ${skippedCount} 列）`:""}，匯入中...`;

  let created = 0, updated = 0;
  try {
    const BATCH_SIZE = 200;
    for(let i = 0; i < rowsToApply.length; i += BATCH_SIZE){
      const chunk = rowsToApply.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for(const r of chunk){
        const existing = teinItemsCache.find(it=>
          norm(it.carModel)===norm(r.carModel) &&
          (it.style||"") === r.style
        );
        const payload = { carMake: r.carMake, spec: r.spec, style: r.style, warrantyPrice: r.warrantyPrice, catalogPrice: r.catalogPrice };
        if(r.remark) payload.remark = r.remark;
        if(existing){
          batch.update(db.collection("teinItems").doc(existing.id), payload);
          updated++;
        } else {
          batch.set(db.collection("teinItems").doc(), { carModel: r.carModel, brand: "TEIN", remark: r.remark || "", locations: {}, ...payload });
          created++;
        }
      }
      await batch.commit();
      statusEl.textContent = `匯入中... 已完成 ${Math.min(i + BATCH_SIZE, total)}/${total} 筆`;
    }
    statusEl.textContent = `TEIN報價單匯入完成！新增 ${created} 筆車型、更新 ${updated} 筆${skippedCount?`（已跳過疑似備註的 ${skippedCount} 列）`:""}。`;
  } catch(e) {
    statusEl.textContent = `匯入失敗（已完成 ${created + updated} 筆）：${e.message}`;
  }
});

// ============================================================
// TEIN 批次匯入庫存數量
// 格式：使用「匯出目前結果」的 Excel，欄位含「車型」「款式」「總量」（可選「儲位分布」）
// 儲位分布格式：「A區x3、B區x2」；空白或「-」則寫入現有第一個儲位
// ============================================================

// 解析儲位分布字串，回傳 { 儲位代碼: 數量 } 物件
function parseTeinLocStr(str){
  const locs = {};
  if(!str || str === "-") return locs;
  str.toString().split("、").forEach(pair=>{
    const m = /^(.+)[x×](\d+)/.exec(pair.trim());
    if(m) locs[m[1].trim()] = Number(m[2]);
  });
  return locs;
}

document.getElementById("teinStockImportBtn").addEventListener("click", async ()=>{
  const fileInput = document.getElementById("teinStockImportFile");
  const statusEl = document.getElementById("teinStockImportStatus");
  if(!fileInput.files.length){ alert("請先選擇檔案"); return; }
  statusEl.textContent = "讀取檔案中...";
  const file = fileInput.files[0];
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, {type:"array"});

  // 偵測含「車型」「款式」「總量」的工作表
  let detected = null;
  for(const sheetName of wb.SheetNames){
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null, blankrows:true});
    for(let r=0; r<Math.min(rows.length, 10); r++){
      const row = rows[r] || [];
      if(row.includes("車型") && row.includes("款式") && row.includes("總量")){
        detected = { rows, headerRowIndex: r };
        break;
      }
    }
    if(detected) break;
  }

  if(!detected){
    statusEl.textContent = '找不到可辨識的格式。請上傳含「車型」「款式」「總量」欄位的 Excel（即庫存總表匯出的檔案）。';
    return;
  }

  const header = detected.rows[detected.headerRowIndex];
  const modelIdx = header.indexOf("車型");
  const styleIdx = header.indexOf("款式");
  const qtyIdx   = header.indexOf("總量");
  const locIdx   = header.findIndex(h=> h && h.toString().includes("儲位分布"));

  const dataRows = detected.rows.slice(detected.headerRowIndex + 1);
  const toUpdate = [];

  dataRows.forEach(row=>{
    if(!row) return;
    const modelStr = (row[modelIdx]==null?"":row[modelIdx]).toString().trim();
    const styleStr = (row[styleIdx]==null?"":row[styleIdx]).toString().trim();
    const qtyRaw   = row[qtyIdx];
    if(!modelStr || qtyRaw===null || qtyRaw===undefined || qtyRaw==="") return;
    const qty = Number(qtyRaw);
    if(isNaN(qty)) return;
    const locStr = locIdx>=0 ? (row[locIdx]||"").toString().trim() : "";
    toUpdate.push({ carModel: modelStr, style: styleStr, qty, locStr });
  });

  if(!toUpdate.length){
    statusEl.textContent = "找不到有效的資料列，請確認「總量」欄有填數字。";
    return;
  }

  statusEl.textContent = `偵測到 ${toUpdate.length} 筆，更新庫存中...`;
  let ok = 0, skip = 0;

  try {
    const BATCH_SIZE = 200;
    for(let i = 0; i < toUpdate.length; i += BATCH_SIZE){
      const chunk = toUpdate.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for(const r of chunk){
        const item = teinItemsCache.find(it=>
          norm(it.carModel)===norm(r.carModel) &&
          (it.style||"") === r.style
        );
        if(!item){ skip++; continue; }

        let newLocs = {};

        if(r.locStr && r.locStr !== "-"){
          // 儲位分布有填 → 照填
          newLocs = parseTeinLocStr(r.locStr);
        } else {
          // 儲位分布空白 → 找現有第一個儲位，沒有就跳過
          const existing = item.locations || {};
          const firstCode = Object.keys(existing).find(k=> Number(existing[k]) > 0);
          if(!firstCode){ skip++; continue; }
          newLocs[firstCode] = r.qty;
        }

        batch.update(db.collection("teinItems").doc(item.id), { locations: newLocs });
        ok++;
      }
      await batch.commit();
      statusEl.textContent = `更新中... 已完成 ${Math.min(i + BATCH_SIZE, toUpdate.length)}/${toUpdate.length} 筆`;
    }
    statusEl.textContent = `庫存更新完成！成功 ${ok} 筆${skip?`，跳過 ${skip} 筆（找不到對應車型或無儲位）`:""}。`;
  } catch(e) {
    statusEl.textContent = `更新失敗：${e.message}`;
  }
});
