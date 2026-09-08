// ============================================================
// TEIN 資料匯入
// 匯入格式：Excel 含「廠牌」「車型」「規格」「款式」「批發價」「一線消費者售價」欄位
// 比對key：車型 + 款式（END / END+），相同就更新，不同就新增
// 每批上限 200 筆（Firebase batch 上限 500，保守設定避免靜默失敗）
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

  // 偵測 TEIN 報價單格式：任何工作表含「車型」「款式」「批發價」或「一線消費者售價」
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
    // 每批最多 200 筆，避免超過 Firebase batch 上限
    const BATCH_SIZE = 200;
    for(let i = 0; i < rowsToApply.length; i += BATCH_SIZE){
      const chunk = rowsToApply.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for(const r of chunk){
        const existing = teinItemsCache.find(it=>
          norm(it.carModel)===norm(r.carModel) &&
          (it.style||"") === r.style
        );
        const payload = {
          carMake: r.carMake,
          spec: r.spec,
          style: r.style,
          warrantyPrice: r.warrantyPrice,
          catalogPrice: r.catalogPrice
        };
        if(r.remark) payload.remark = r.remark;

        if(existing){
          batch.update(db.collection("teinItems").doc(existing.id), payload);
          updated++;
        } else {
          batch.set(db.collection("teinItems").doc(), {
            carModel: r.carModel, brand: "TEIN",
            remark: r.remark || "", locations: {},
            ...payload
          });
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
