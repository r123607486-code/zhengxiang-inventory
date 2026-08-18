// ============================================================
// 來令片 資料匯入（獨立於輪胎／KYB，只會動到 padItems / padLocations）
// ============================================================

function detectPadSheet(wb){
  for(const sheetName of wb.SheetNames){
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null, blankrows:true});
    for(let r=0; r<Math.min(rows.length, 10); r++){
      const row = rows[r] || [];
      if(row.includes("車款") && row.includes("品號/前(F)")){
        return { rows, headerRowIndex: r };
      }
    }
  }
  return null;
}

async function tryImportPadSheet(wb, statusEl){
  const detected = detectPadSheet(wb);
  if(!detected) return false;

  const header = detected.rows[detected.headerRowIndex];
  const modelIdx = header.indexOf("車款");
  const yearIdx  = header.indexOf("年份");
  const specIdx  = header.indexOf("規格");
  const partFIdx = header.indexOf("品號/前(F)");
  const fmsiFIdx = header.indexOf("FMSI/前(F)");
  const partRIdx = header.indexOf("品號/後(R)");
  const fmsiRIdx = header.indexOf("FMSI/後(R)");
  const priceIdx = header.indexOf("價格");
  const remarkIdx= header.indexOf("備註");

  const dataRows = detected.rows.slice(detected.headerRowIndex + 1);
  const toNum = v => (v===null||v===undefined||v==="") ? null : Number(v);
  const toStr = v => (v===null||v===undefined) ? "" : v.toString().trim();

  const newItems = [];
  let skipped = 0;
  dataRows.forEach(row=>{
    if(!row) return;
    const carModel = toStr(row[modelIdx]);
    if(!carModel){ skipped++; return; }
    newItems.push({
      carModel,
      year: toStr(row[yearIdx]),
      spec: toStr(row[specIdx]),
      partNoFront: toStr(row[partFIdx]),
      fmsiFront:   toStr(row[fmsiFIdx]),
      partNoRear:  toStr(row[partRIdx]),
      fmsiRear:    toStr(row[fmsiRIdx]),
      price: priceIdx>=0 ? toNum(row[priceIdx]) : null,
      remark: remarkIdx>=0 ? toStr(row[remarkIdx]) : "",
      locationsFront: {},
      locationsRear: {},
      imageLinkFront: null,
      imageLinkRear:  null,
      brand: "YangPo"
    });
  });

  if(newItems.length === 0){ statusEl.textContent = "找不到可匯入的資料列，請確認檔案內容。"; return true; }

  statusEl.textContent = `偵測到來令片資料表，共 ${newItems.length} 筆，匯入中...`;

  function withTimeout(promise, ms, label){
    return Promise.race([
      promise,
      new Promise((_, reject)=> setTimeout(()=> reject(new Error(`${label} 逾時（超過 ${ms/1000} 秒沒有回應，可能是網路問題或 Firestore 權限設定擋住了寫入）`)), ms))
    ]);
  }

  let count = 0;
  let batchNum = 0;
  const totalBatches = Math.ceil(newItems.length / 400);
  while(count < newItems.length){
    batchNum++;
    const batch = db.batch();
    const chunk = newItems.slice(count, count+400);
    chunk.forEach(it=>{
      const ref = db.collection("padItems").doc();
      batch.set(ref, it);
    });
    statusEl.textContent = `匯入中...正在寫入第 ${batchNum}/${totalBatches} 批（共 ${newItems.length} 筆）`;
    try{
      await withTimeout(batch.commit(), 15000, `第 ${batchNum}/${totalBatches} 批`);
    } catch(err){
      console.error("[來令片匯入] 批次寫入失敗：", err);
      statusEl.textContent = `匯入中斷：第 ${batchNum}/${totalBatches} 批寫入失敗（已成功寫入 ${count} 筆）。錯誤訊息：${err && err.message ? err.message : err}`;
      return true;
    }
    count += chunk.length;
    statusEl.textContent = `匯入中...已完成 ${count}/${newItems.length}`;
  }

  statusEl.textContent = `匯入完成！共新增 ${newItems.length} 筆來令片品項${skipped?`（另跳過 ${skipped} 筆沒有車款的空列）`:""}。可以到「庫存查詢」或「庫存總表」查看。`;
  return true;
}

document.getElementById("padClearDataBtn").addEventListener("click", async ()=>{
  if(!confirm("確定要清除所有「來令片品項」與「來令片儲位」資料嗎？（不會動到輪胎／KYB資料，也不會動到來令片的進出貨紀錄）這通常是為了重新匯入正確的資料才做，確定要繼續嗎？")) return;
  const statusEl = document.getElementById("padImportStatus");
  statusEl.textContent = "清除中...";
  try{
    const itemsSnap = await db.collection("padItems").get();
    const locSnap   = await db.collection("padLocations").get();
    const allDocs = [...itemsSnap.docs, ...locSnap.docs];
    let done = 0;
    while(done < allDocs.length){
      const batch = db.batch();
      allDocs.slice(done, done+400).forEach(d=>batch.delete(d.ref));
      await batch.commit();
      done += 400;
    }
    statusEl.textContent = `已清除 ${itemsSnap.size} 筆來令片品項與 ${locSnap.size} 筆儲位資料，可以重新選檔匯入了。`;
  } catch(err){
    console.error("[來令片清除] 失敗：", err);
    statusEl.textContent = `清除失敗，錯誤訊息：${err && err.message ? err.message : err}`;
  }
});

document.getElementById("padImportBtn").addEventListener("click", async ()=>{
  const fileInput = document.getElementById("padImportFile");
  const statusEl  = document.getElementById("padImportStatus");
  if(!fileInput.files.length){ alert("請先選擇檔案"); return; }
  statusEl.textContent = "讀取檔案中...";
  try{
    const file = fileInput.files[0];
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, {type:"array"});
    if(await tryImportPadSheet(wb, statusEl)) return;
    statusEl.textContent = "找不到可匯入的來令片資料表格式，請確認上傳的檔案含「車款」「品號/前(F)」欄位。";
  } catch(err){
    console.error("[來令片匯入] 失敗：", err);
    statusEl.textContent = `匯入失敗，錯誤訊息：${err && err.message ? err.message : err}`;
  }
});

// ============================================================
// 舊格式遷移工具：locations → locationsFront + locationsRear
// 適用對象：上線新版本前已存入 Firestore 的 padItems（用舊的 locations 欄位）
// 執行後：locationsFront = 原 locations，locationsRear = {}，locations 欄位刪除
// ============================================================
const padMigrateLocBtn = document.getElementById("padMigrateLocBtn");
if(padMigrateLocBtn){
  padMigrateLocBtn.addEventListener("click", async ()=>{
    const statusEl = document.getElementById("padImportStatus");
    if(!confirm("這是一次性遷移工具：會把所有舊格式（locations）的來令片品項轉換成新格式（locationsFront + locationsRear），轉換後無法還原。確定要繼續嗎？")) return;

    statusEl.textContent = "讀取舊格式品項中...";
    let snap;
    try{
      snap = await db.collection("padItems").get();
    } catch(err){
      statusEl.textContent = "讀取失敗：" + (err.message || err);
      return;
    }

    const toMigrate = snap.docs.filter(d=>{
      const data = d.data();
      return data.locations !== undefined && data.locationsFront === undefined;
    });

    if(toMigrate.length === 0){
      statusEl.textContent = "沒有需要遷移的品項（所有品項都已是新格式，或沒有任何品項）。";
      return;
    }

    statusEl.textContent = `找到 ${toMigrate.length} 筆需要遷移，寫入中...`;
    const deleteField = firebase.firestore.FieldValue.delete();
    let done = 0;
    while(done < toMigrate.length){
      const chunk = toMigrate.slice(done, done+400);
      const batch = db.batch();
      chunk.forEach(doc=>{
        const locs = doc.data().locations || {};
        batch.update(doc.ref, {
          locationsFront: locs,
          locationsRear: {},
          locations: deleteField
        });
      });
      try{
        await batch.commit();
      } catch(err){
        statusEl.textContent = `第 ${done+1}～${done+chunk.length} 筆寫入失敗：${err.message || err}（已成功遷移 ${done} 筆）`;
        return;
      }
      done += chunk.length;
      statusEl.textContent = `遷移中...已完成 ${done}/${toMigrate.length}`;
    }
    statusEl.textContent = `遷移完成！共遷移 ${toMigrate.length} 筆品項。請重新整理頁面讓畫面更新。`;
  });
}

// ============================================================
// 批次貼上圖片連結：上傳「品號」「連結」兩欄的表，依 partNoFront／partNoRear
// 比對現有 padItems，比對到才更新對應的 imageLinkFront／imageLinkRear，
// 比對不到的品項完全不動（不新增、不刪除任何品項）。
// ============================================================
function detectPadImageLinkSheet(wb){
  for(const sheetName of wb.SheetNames){
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null, blankrows:true});
    for(let r=0; r<Math.min(rows.length, 10); r++){
      const row = rows[r] || [];
      if(row.includes("品號") && row.includes("連結")){
        return { rows, headerRowIndex: r };
      }
    }
  }
  return null;
}

document.getElementById("padImageLinkBtn").addEventListener("click", async ()=>{
  const fileInput = document.getElementById("padImageLinkFile");
  const statusEl  = document.getElementById("padImageLinkStatus");
  if(!fileInput.files.length){ alert("請先選擇檔案"); return; }
  statusEl.textContent = "讀取檔案中...";
  try{
    const file = fileInput.files[0];
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, {type:"array"});
    const detected = detectPadImageLinkSheet(wb);
    if(!detected){
      statusEl.textContent = "找不到可用的資料表，請確認上傳的檔案含「品號」「連結」欄位。";
      return;
    }
    const header = detected.rows[detected.headerRowIndex];
    const codeIdx = header.indexOf("品號");
    const linkIdx = header.indexOf("連結");
    const dataRows = detected.rows.slice(detected.headerRowIndex + 1);
    const toStr = v => (v===null||v===undefined) ? "" : v.toString().trim();

    const linkMap = new Map();
    dataRows.forEach(row=>{
      if(!row) return;
      const code = toStr(row[codeIdx]);
      const link = toStr(row[linkIdx]);
      if(code && link) linkMap.set(code, link);
    });

    if(linkMap.size === 0){ statusEl.textContent = "找不到可用的品號/連結資料列，請確認檔案內容。"; return; }

    statusEl.textContent = `讀取到 ${linkMap.size} 筆品號連結，比對現有品項中...`;

    const toUpdate = [];
    padItemsCache.forEach(it=>{
      const payload = {};
      if(it.partNoFront && linkMap.has(it.partNoFront)) payload.imageLinkFront = linkMap.get(it.partNoFront);
      if(it.partNoRear  && linkMap.has(it.partNoRear))  payload.imageLinkRear  = linkMap.get(it.partNoRear);
      if(Object.keys(payload).length > 0) toUpdate.push({ id: it.id, payload });
    });

    if(toUpdate.length === 0){
      statusEl.textContent = `比對完成，沒有任何品項的品號對得到（共檢查 ${padItemsCache.length} 筆現有品項），沒有更動任何資料。`;
      return;
    }

    statusEl.textContent = `比對到 ${toUpdate.length} 筆品項，更新中...`;
    let count = 0;
    while(count < toUpdate.length){
      const batch = db.batch();
      const chunk = toUpdate.slice(count, count+400);
      chunk.forEach(u=> batch.update(db.collection("padItems").doc(u.id), u.payload));
      await batch.commit();
      count += chunk.length;
      statusEl.textContent = `更新中...已完成 ${count}/${toUpdate.length}`;
    }
    statusEl.textContent = `完成！共更新 ${toUpdate.length} 筆品項的圖片連結（共 ${linkMap.size} 筆品號連結中，比對到 ${toUpdate.length} 筆，其餘沒有對到的品項未被更動）。`;
  } catch(err){
    console.error("[來令片圖片連結匯入] 失敗：", err);
    statusEl.textContent = `更新失敗，錯誤訊息：${err && err.message ? err.message : err}`;
  }
});
