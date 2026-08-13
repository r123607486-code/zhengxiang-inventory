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
  const yearIdx = header.indexOf("年份");
  const specIdx = header.indexOf("規格");
  const partFIdx = header.indexOf("品號/前(F)");
  const fmsiFIdx = header.indexOf("FMSI/前(F)");
  const partRIdx = header.indexOf("品號/後(R)");
  const fmsiRIdx = header.indexOf("FMSI/後(R)");
  const priceIdx = header.indexOf("價格");
  const remarkIdx = header.indexOf("備註");

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
      fmsiFront: toStr(row[fmsiFIdx]),
      partNoRear: toStr(row[partRIdx]),
      fmsiRear: toStr(row[fmsiRIdx]),
      price: priceIdx>=0 ? toNum(row[priceIdx]) : null,
      remark: remarkIdx>=0 ? toStr(row[remarkIdx]) : "",
      locations: {},
      imageLinkFront: null,
      imageLinkRear: null,
      brand: "YangPo"
    });
  });

  if(newItems.length === 0){ statusEl.textContent = "找不到可匯入的資料列，請確認檔案內容。"; return true; }

  statusEl.textContent = `偵測到來令片資料表，共 ${newItems.length} 筆，匯入中...`;

  let count = 0;
  while(count < newItems.length){
    const batch = db.batch();
    const chunk = newItems.slice(count, count+400);
    chunk.forEach(it=>{
      const ref = db.collection("padItems").doc();
      batch.set(ref, it);
    });
    await batch.commit();
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
  const itemsSnap = await db.collection("padItems").get();
  const locSnap = await db.collection("padLocations").get();
  const allDocs = [...itemsSnap.docs, ...locSnap.docs];
  let done = 0;
  while(done < allDocs.length){
    const batch = db.batch();
    allDocs.slice(done, done+400).forEach(d=>batch.delete(d.ref));
    await batch.commit();
    done += 400;
  }
  statusEl.textContent = `已清除 ${itemsSnap.size} 筆來令片品項與 ${locSnap.size} 筆儲位資料，可以重新選檔匯入了。`;
});

document.getElementById("padImportBtn").addEventListener("click", async ()=>{
  const fileInput = document.getElementById("padImportFile");
  const statusEl = document.getElementById("padImportStatus");
  if(!fileInput.files.length){ alert("請先選擇檔案"); return; }
  statusEl.textContent = "讀取檔案中...";
  const file = fileInput.files[0];
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, {type:"array"});
  if(await tryImportPadSheet(wb, statusEl)) return;
  statusEl.textContent = "找不到可匯入的來令片資料表格式，請確認上傳的檔案含「車款」「品號/前(F)」欄位。";
});
