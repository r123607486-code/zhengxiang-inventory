// ============================================================
// 正享有限公司庫存管理系統 — 共用核心（常數／狀態／工具函式／登入／分類切換／分頁／監聽器啟動）
// ============================================================

// 效期反紅：改為由使用者在「庫存總表」頁面點擊選擇門檻年限（1-9年）才會反紅，不再自動顯示。
const DEFAULT_BRANDS = [
  "賽輪Sailun","韓泰Hankook","阿基里斯Achilles","安馳ANCHEE","薩馳輪胎ARDUZZA",
  "黑獅輪胎Blacklion","庫斯通KUSTONE","牛頓輪胎NEUTON","尼克森NEXEN",
  "路德斯通ROAD.STONE","萬峰馳輪胎WINDFORCE","薩提諾ZESTINO"
];

const ICONS = {
  query: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  master:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="10" x2="9" y2="20"/></svg>',
  txn:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h13l-2-3M21 17H8l2 3"/></svg>',
  loc:   '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  users: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  orders:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/><path d="M9 12h6M9 16h6M9 8h2"/></svg>',
  myorders:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  cart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
};

const CATEGORY_ICONS = {
  tire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4"/><line x1="12" y1="3" x2="12" y2="6.2"/><line x1="12" y1="17.8" x2="12" y2="21"/><line x1="3" y1="12" x2="6.2" y2="12"/><line x1="17.8" y1="12" x2="21" y2="12"/></svg>',
  kyb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="2" x2="12" y2="8"/><rect x="8.5" y="8" width="7" height="10" rx="1.5"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="9" y1="10.5" x2="15" y2="10.5"/><line x1="9" y1="13.5" x2="15" y2="13.5"/></svg>',
  pad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 14c0-4.5 2-8 8-8s8 3.5 8 8v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4z"/><circle cx="8.5" cy="15" r="1"/><circle cx="15.5" cy="15" r="1"/></svg>'
};

let currentUser = null;
let currentCategory = null;
let itemsCache = [];
let locationsCache = [];
let usersCache = [];
let txnCache = [];
let brandsCache = [];
let ordersCache = [];
let myOrdersCache = [];

let kybItemsCache = [];
let kybLocationsCache = [];
let kybOrdersCache = [];
let kybMyOrdersCache = [];
let kybTxnCache = [];
let usersListenerStarted = false;
let tireListenersStarted = false;
let kybListenersStarted = false;
let queryVisibleCount = 200;
let kybQueryVisibleCount = 200;

let padItemsCache = [];
let padLocationsCache = [];
let padOrdersCache = [];
let padMyOrdersCache = [];
let padTxnCache = [];
let padListenersStarted = false;
let padQueryVisibleCount = 200;

let activeUnsubs = [];

// ============================================================
// 輪胎 READ 最佳化狀態（IndexedDB + 序號差異同步）
// ============================================================
let _tireIdb = null;                  // IndexedDB 連線實例
let _stopTireTxnListener = null;      // 進銷貨 lazy listener 的停止函式
let _stopTireOrdersListener = null;   // 訂單 lazy listener 的停止函式（管理員）
let tirePendingOrdersCount = 0;       // 待確認訂單數（來自輕量監聽器）

// ============================================================
// KYB READ 最佳化狀態（IndexedDB + 序號差異同步）
// ============================================================
let _kybIdb = null;                   // KYB IndexedDB 連線實例

// ============================================================
// 來令片 READ 最佳化狀態（IndexedDB + 序號差異同步）
// ============================================================
let _padIdb = null;                   // 來令片 IndexedDB 連線實例

// ============================================================
// IndexedDB 工具函式
// DB: "zhx-inv" v1
// Store "tireItems": keyPath "id"  → 輪胎品項物件
// Store "tireMeta":  keyPath "key" → { key:"sync", changeSequence:number }
// ============================================================
const _IDB_NAME = "zhx-inv";
const _IDB_VERSION = 1;

function openTireIDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(_IDB_NAME, _IDB_VERSION);
    req.onupgradeneeded = (e)=>{
      const idb = e.target.result;
      if(!idb.objectStoreNames.contains("tireItems"))
        idb.createObjectStore("tireItems", { keyPath:"id" });
      if(!idb.objectStoreNames.contains("tireMeta"))
        idb.createObjectStore("tireMeta", { keyPath:"key" });
    };
    req.onsuccess = (e)=>resolve(e.target.result);
    req.onerror  = (e)=>reject(e.target.error);
  });
}

function idbGetAll(idb, storeName){
  return new Promise((resolve, reject)=>{
    const tx  = idb.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = ()=>resolve(req.result);
    req.onerror   = ()=>reject(req.error);
  });
}

function idbGet(idb, storeName, key){
  return new Promise((resolve, reject)=>{
    const tx  = idb.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = ()=>resolve(req.result);
    req.onerror   = ()=>reject(req.error);
  });
}

function idbPutAll(idb, storeName, items){
  return new Promise((resolve, reject)=>{
    const tx    = idb.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    items.forEach(item=>store.put(item));
    tx.oncomplete = ()=>resolve();
    tx.onerror    = ()=>reject(tx.error);
  });
}

function idbDelete(idb, storeName, key){
  return new Promise((resolve, reject)=>{
    const tx = idb.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = ()=>resolve();
    tx.onerror    = ()=>reject(tx.error);
  });
}

function idbClearAll(idb, storeName){
  return new Promise((resolve, reject)=>{
    const tx = idb.transaction(storeName, "readwrite");
    tx.objectStore(storeName).clear();
    tx.oncomplete = ()=>resolve();
    tx.onerror    = ()=>reject(tx.error);
  });
}

// ============================================================
// 輪胎品項初始化（IndexedDB 快取 + sequence 差異同步）
// ============================================================

/** 登入後呼叫：從 IDB 讀本地快取，再比對遠端 sequence，決定全讀或差異同步 */
async function initTireItems(){
  try {
    _tireIdb = await openTireIDB();
    const [localItems, localMeta] = await Promise.all([
      idbGetAll(_tireIdb, "tireItems"),
      idbGet(_tireIdb, "tireMeta", "sync")
    ]);
    const localSeq = localMeta ? (localMeta.changeSequence || 0) : 0;

    // 立刻用本地快取渲染，使用者幾乎感覺不到延遲
    if(localItems.length > 0){
      itemsCache = localItems;
      renderQuery(); renderMaster();
    }

    // 讀遠端序號（單一輕量文件）
    const markerSnap = await db.collection("settings").doc("tireCache").get();
    const remoteSeq  = markerSnap.exists ? (markerSnap.data().changeSequence || 0) : 0;

    if(remoteSeq === localSeq && localItems.length > 0){
      console.log("[輪胎] IDB 快取已是最新（seq=" + localSeq + "），略過讀取");
    } else if(localItems.length === 0 || localSeq === 0){
      await fullReadTireItems(remoteSeq);
    } else {
      await deltaSyncTireItems(localSeq, remoteSeq);
    }
  } catch(e){
    console.error("[輪胎] IDB 初始化失敗，改用全讀取：", e);
    _tireIdb = null;
    try {
      const snap = await db.collection("items").get();
      itemsCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
      renderQuery(); renderMaster();
    } catch(e2){
      console.error("[輪胎] 全讀取也失敗：", e2);
    }
  }
}

/** 全量讀取所有品項，並寫入 IDB */
async function fullReadTireItems(remoteSeq){
  const snap = await db.collection("items").get();
  itemsCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
  renderQuery(); renderMaster();
  if(_tireIdb){
    await idbClearAll(_tireIdb, "tireItems");
    await idbPutAll(_tireIdb, "tireItems", itemsCache);
    await idbPutAll(_tireIdb, "tireMeta", [{ key:"sync", changeSequence:remoteSeq }]);
  }
}

/**
 * 差異同步：只讀 localSeq 之後有異動的品項
 * 每個 itemId 只 getDoc 一次，不重讀整個 items collection
 */
async function deltaSyncTireItems(localSeq, remoteSeq){
  const changesSnap = await db.collection("tireItemChanges")
    .where("changeSequence", ">", localSeq)
    .orderBy("changeSequence", "asc")
    .get();

  if(changesSnap.empty){
    // 差異日誌為空（理論上不應發生，但安全處理）
    if(_tireIdb){
      await idbPutAll(_tireIdb, "tireMeta", [{ key:"sync", changeSequence:remoteSeq }]);
    }
    return;
  }

  // 每個 itemId 取最後一筆動作（後面的覆蓋前面的）
  const itemActions = new Map(); // itemId → "update" | "delete"
  changesSnap.docs.forEach(d=>{
    const { itemId, action } = d.data();
    itemActions.set(itemId, action);
  });

  const idsToFetch  = [];
  const idsToDelete = [];
  itemActions.forEach((action, itemId)=>{
    if(action === "delete") idsToDelete.push(itemId);
    else idsToFetch.push(itemId);
  });

  // 批次 getDoc（每批 ≤ 10，Firestore 限制）
  const fetchedItems = [];
  for(let i = 0; i < idsToFetch.length; i += 10){
    const batch = idsToFetch.slice(i, i + 10);
    const snaps = await Promise.all(batch.map(id=>db.collection("items").doc(id).get()));
    snaps.forEach(s=>{ if(s.exists) fetchedItems.push({ id:s.id, ...s.data() }); });
  }

  // 套用到 itemsCache
  idsToDelete.forEach(id=>{ itemsCache = itemsCache.filter(it=>it.id !== id); });
  fetchedItems.forEach(item=>{
    const idx = itemsCache.findIndex(it=>it.id === item.id);
    if(idx >= 0) itemsCache[idx] = item;
    else itemsCache.push(item);
  });

  renderQuery(); renderMaster();

  // 更新 IDB
  if(_tireIdb){
    if(idsToDelete.length > 0){
      await Promise.all(idsToDelete.map(id=>idbDelete(_tireIdb, "tireItems", id)));
    }
    if(fetchedItems.length > 0){
      await idbPutAll(_tireIdb, "tireItems", fetchedItems);
    }
    await idbPutAll(_tireIdb, "tireMeta", [{ key:"sync", changeSequence:remoteSeq }]);
  }
}

// ============================================================
// KYB IndexedDB 工具函式
// DB: "zhx-kyb" v1
// Store "kybItems": keyPath "id"  → KYB 品項物件
// Store "kybMeta":  keyPath "key" → { key:"sync", changeSequence:number }
// ============================================================
const _KYB_IDB_NAME = "zhx-kyb";
const _KYB_IDB_VERSION = 1;

function openKybIDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(_KYB_IDB_NAME, _KYB_IDB_VERSION);
    req.onupgradeneeded = (e)=>{
      const idb = e.target.result;
      if(!idb.objectStoreNames.contains("kybItems"))
        idb.createObjectStore("kybItems", { keyPath:"id" });
      if(!idb.objectStoreNames.contains("kybMeta"))
        idb.createObjectStore("kybMeta", { keyPath:"key" });
    };
    req.onsuccess = (e)=>resolve(e.target.result);
    req.onerror  = (e)=>reject(e.target.error);
  });
}

// ============================================================
// KYB 品項初始化（IndexedDB 快取 + sequence 差異同步）
// ============================================================
async function initKybItems(){
  try {
    _kybIdb = await openKybIDB();
    const [localItems, localMeta] = await Promise.all([
      idbGetAll(_kybIdb, "kybItems"),
      idbGet(_kybIdb, "kybMeta", "sync")
    ]);
    const localSeq = localMeta ? (localMeta.changeSequence || 0) : 0;

    if(localItems.length > 0){
      kybItemsCache = localItems;
      renderKybQuery(); renderKybMaster();
    }

    const markerSnap = await db.collection("settings").doc("kybCache").get();
    const remoteSeq  = markerSnap.exists ? (markerSnap.data().changeSequence || 0) : 0;

    if(remoteSeq === localSeq && localItems.length > 0){
      console.log("[KYB] IDB 快取已是最新（seq=" + localSeq + "），略過讀取");
    } else if(localItems.length === 0 || localSeq === 0){
      await fullReadKybItems(remoteSeq);
    } else {
      await deltaSyncKybItems(localSeq, remoteSeq);
    }
  } catch(e){
    console.error("[KYB] IDB 初始化失敗，改用全讀取：", e);
    _kybIdb = null;
    try {
      const snap = await db.collection("kybItems").get();
      kybItemsCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
      renderKybQuery(); renderKybMaster();
    } catch(e2){
      console.error("[KYB] 全讀取也失敗：", e2);
    }
  }
}

async function fullReadKybItems(remoteSeq){
  const snap = await db.collection("kybItems").get();
  kybItemsCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
  renderKybQuery(); renderKybMaster();
  if(_kybIdb){
    await idbClearAll(_kybIdb, "kybItems");
    await idbPutAll(_kybIdb, "kybItems", kybItemsCache);
    await idbPutAll(_kybIdb, "kybMeta", [{ key:"sync", changeSequence:remoteSeq }]);
  }
}

async function deltaSyncKybItems(localSeq, remoteSeq){
  const changesSnap = await db.collection("kybItemChanges")
    .where("changeSequence", ">", localSeq)
    .orderBy("changeSequence", "asc")
    .get();

  if(changesSnap.empty){
    if(_kybIdb){
      await idbPutAll(_kybIdb, "kybMeta", [{ key:"sync", changeSequence:remoteSeq }]);
    }
    return;
  }

  const itemActions = new Map();
  changesSnap.docs.forEach(d=>{
    const { itemId, action } = d.data();
    itemActions.set(itemId, action);
  });

  const idsToFetch  = [];
  const idsToDelete = [];
  itemActions.forEach((action, itemId)=>{
    if(action === "delete") idsToDelete.push(itemId);
    else idsToFetch.push(itemId);
  });

  const fetchedItems = [];
  for(let i = 0; i < idsToFetch.length; i += 10){
    const batch = idsToFetch.slice(i, i + 10);
    const snaps = await Promise.all(batch.map(id=>db.collection("kybItems").doc(id).get()));
    snaps.forEach(s=>{ if(s.exists) fetchedItems.push({ id:s.id, ...s.data() }); });
  }

  idsToDelete.forEach(id=>{ kybItemsCache = kybItemsCache.filter(it=>it.id !== id); });
  fetchedItems.forEach(item=>{
    const idx = kybItemsCache.findIndex(it=>it.id === item.id);
    if(idx >= 0) kybItemsCache[idx] = item;
    else kybItemsCache.push(item);
  });

  renderKybQuery(); renderKybMaster();

  if(_kybIdb){
    if(idsToDelete.length > 0){
      await Promise.all(idsToDelete.map(id=>idbDelete(_kybIdb, "kybItems", id)));
    }
    if(fetchedItems.length > 0){
      await idbPutAll(_kybIdb, "kybItems", fetchedItems);
    }
    await idbPutAll(_kybIdb, "kybMeta", [{ key:"sync", changeSequence:remoteSeq }]);
  }
}

// ============================================================
// KYB marker 監聽器
// ============================================================
function startKybMarkerListener(){
  startRealtimeListener(
    ()=>db.collection("settings").doc("kybCache"),
    async (snap)=>{
      if(!snap.exists) return;
      const remoteSeq = snap.data().changeSequence || 0;
      let localSeq = 0;
      if(_kybIdb){
        const meta = await idbGet(_kybIdb, "kybMeta", "sync");
        localSeq = meta ? (meta.changeSequence || 0) : 0;
      }
      if(remoteSeq > localSeq){
        try {
          await deltaSyncKybItems(localSeq, remoteSeq);
        } catch(e){
          console.error("[KYB] marker 差異同步失敗：", e);
        }
      }
    },
    "KYB快取標記"
  );
}

// ============================================================
// 來令片 IndexedDB 工具函式
// DB: "zhx-pad" v1
// Store "padItems": keyPath "id"  → 來令片品項物件
// Store "padMeta":  keyPath "key" → { key:"sync", changeSequence:number }
// ============================================================
const _PAD_IDB_NAME = "zhx-pad";
const _PAD_IDB_VERSION = 1;

function openPadIDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(_PAD_IDB_NAME, _PAD_IDB_VERSION);
    req.onupgradeneeded = (e)=>{
      const idb = e.target.result;
      if(!idb.objectStoreNames.contains("padItems"))
        idb.createObjectStore("padItems", { keyPath:"id" });
      if(!idb.objectStoreNames.contains("padMeta"))
        idb.createObjectStore("padMeta", { keyPath:"key" });
    };
    req.onsuccess = (e)=>resolve(e.target.result);
    req.onerror  = (e)=>reject(e.target.error);
  });
}

// ============================================================
// 來令片品項初始化（IndexedDB 快取 + sequence 差異同步）
// ============================================================
async function initPadItems(){
  try {
    _padIdb = await openPadIDB();
    const [localItems, localMeta] = await Promise.all([
      idbGetAll(_padIdb, "padItems"),
      idbGet(_padIdb, "padMeta", "sync")
    ]);
    const localSeq = localMeta ? (localMeta.changeSequence || 0) : 0;

    if(localItems.length > 0){
      padItemsCache = localItems;
      renderPadQuery(); renderPadMaster();
    }

    const markerSnap = await db.collection("settings").doc("padCache").get();
    const remoteSeq  = markerSnap.exists ? (markerSnap.data().changeSequence || 0) : 0;

    if(remoteSeq === localSeq && localItems.length > 0){
      console.log("[來令片] IDB 快取已是最新（seq=" + localSeq + "），略過讀取");
    } else if(localItems.length === 0 || localSeq === 0){
      await fullReadPadItems(remoteSeq);
    } else {
      await deltaSyncPadItems(localSeq, remoteSeq);
    }
  } catch(e){
    console.error("[來令片] IDB 初始化失敗，改用全讀取：", e);
    _padIdb = null;
    try {
      const snap = await db.collection("padItems").get();
      padItemsCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
      renderPadQuery(); renderPadMaster();
    } catch(e2){
      console.error("[來令片] 全讀取也失敗：", e2);
    }
  }
}

async function fullReadPadItems(remoteSeq){
  const snap = await db.collection("padItems").get();
  padItemsCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
  renderPadQuery(); renderPadMaster();
  if(_padIdb){
    await idbClearAll(_padIdb, "padItems");
    await idbPutAll(_padIdb, "padItems", padItemsCache);
    await idbPutAll(_padIdb, "padMeta", [{ key:"sync", changeSequence:remoteSeq }]);
  }
}

async function deltaSyncPadItems(localSeq, remoteSeq){
  const changesSnap = await db.collection("padItemChanges")
    .where("changeSequence", ">", localSeq)
    .orderBy("changeSequence", "asc")
    .get();

  if(changesSnap.empty){
    if(_padIdb){
      await idbPutAll(_padIdb, "padMeta", [{ key:"sync", changeSequence:remoteSeq }]);
    }
    return;
  }

  const itemActions = new Map();
  changesSnap.docs.forEach(d=>{
    const { itemId, action } = d.data();
    itemActions.set(itemId, action);
  });

  const idsToFetch  = [];
  const idsToDelete = [];
  itemActions.forEach((action, itemId)=>{
    if(action === "delete") idsToDelete.push(itemId);
    else idsToFetch.push(itemId);
  });

  const fetchedItems = [];
  for(let i = 0; i < idsToFetch.length; i += 10){
    const batch = idsToFetch.slice(i, i + 10);
    const snaps = await Promise.all(batch.map(id=>db.collection("padItems").doc(id).get()));
    snaps.forEach(s=>{ if(s.exists) fetchedItems.push({ id:s.id, ...s.data() }); });
  }

  idsToDelete.forEach(id=>{ padItemsCache = padItemsCache.filter(it=>it.id !== id); });
  fetchedItems.forEach(item=>{
    const idx = padItemsCache.findIndex(it=>it.id === item.id);
    if(idx >= 0) padItemsCache[idx] = item;
    else padItemsCache.push(item);
  });

  renderPadQuery(); renderPadMaster();

  if(_padIdb){
    if(idsToDelete.length > 0){
      await Promise.all(idsToDelete.map(id=>idbDelete(_padIdb, "padItems", id)));
    }
    if(fetchedItems.length > 0){
      await idbPutAll(_padIdb, "padItems", fetchedItems);
    }
    await idbPutAll(_padIdb, "padMeta", [{ key:"sync", changeSequence:remoteSeq }]);
  }
}

// ============================================================
// 來令片 marker 監聽器
// ============================================================
function startPadMarkerListener(){
  startRealtimeListener(
    ()=>db.collection("settings").doc("padCache"),
    async (snap)=>{
      if(!snap.exists) return;
      const remoteSeq = snap.data().changeSequence || 0;
      let localSeq = 0;
      if(_padIdb){
        const meta = await idbGet(_padIdb, "padMeta", "sync");
        localSeq = meta ? (meta.changeSequence || 0) : 0;
      }
      if(remoteSeq > localSeq){
        try {
          await deltaSyncPadItems(localSeq, remoteSeq);
        } catch(e){
          console.error("[來令片] marker 差異同步失敗：", e);
        }
      }
    },
    "來令片快取標記"
  );
}

// ============================================================
// 輪胎 marker 監聽器：監聽 settings/tireCache sequence 異動
// ============================================================
function startTireMarkerListener(){
  startRealtimeListener(
    ()=>db.collection("settings").doc("tireCache"),
    async (snap)=>{
      if(!snap.exists) return;
      const remoteSeq = snap.data().changeSequence || 0;
      let localSeq = 0;
      if(_tireIdb){
        const meta = await idbGet(_tireIdb, "tireMeta", "sync");
        localSeq = meta ? (meta.changeSequence || 0) : 0;
      }
      if(remoteSeq > localSeq){
        try {
          await deltaSyncTireItems(localSeq, remoteSeq);
        } catch(e){
          console.error("[輪胎] marker 差異同步失敗：", e);
        }
      }
    },
    "輪胎快取標記"
  );
}

// ============================================================
// 輪胎待確認訂單數（admin 用，輕量監聽器，登入時啟動）
// ============================================================
function startTirePendingOrdersBadgeListener(){
  startRealtimeListener(
    ()=>db.collection("orders").where("status","==","pending"),
    (snap)=>{
      tirePendingOrdersCount = snap.size;
      updateOrdersBadge();
      updateOrdersBannerCombined();
    },
    "輪胎待確認訂單"
  );
}

// ============================================================
// 進銷貨 lazy 監聽器（進入進銷貨 tab 才啟動，離開時停止）
// ============================================================
function startLazyTireTxnListener(){
  if(_stopTireTxnListener) return; // 已在執行
  _stopTireTxnListener = startRealtimeListener(
    ()=>db.collection("transactions").orderBy("date","desc").limit(200),
    (snap)=>{
      txnCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
      renderTxns();
    },
    "輪胎進銷貨"
  );
}

function stopLazyTireTxnListener(){
  if(_stopTireTxnListener){
    _stopTireTxnListener();
    _stopTireTxnListener = null;
    txnCache = [];
  }
}

// ============================================================
// 訂單管理 lazy 監聽器（admin 進入訂單 tab 才啟動，離開時停止）
// ============================================================
function startLazyTireOrdersListener(){
  if(_stopTireOrdersListener) return; // 已在執行
  _stopTireOrdersListener = startRealtimeListener(
    ()=>db.collection("orders").orderBy("requestedAt","desc").limit(300),
    (snap)=>{
      ordersCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
      renderOrders();
      // badge 不依賴 ordersCache，使用 tirePendingOrdersCount（獨立監聽器）
    },
    "輪胎訂單列表"
  );
}

function stopLazyTireOrdersListener(){
  if(_stopTireOrdersListener){
    _stopTireOrdersListener();
    _stopTireOrdersListener = null;
    ordersCache = [];
  }
}

// ============================================================
// 工具函式
// ============================================================
function norm(s){ return (s || "").toString().toUpperCase().replace(/\s+/g, ""); }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function toTaipeiTimeStr(isoStr){
  if(!isoStr) return "";
  const d = new Date(isoStr);
  if(isNaN(d)) return "";
  const taipei = new Date(d.getTime() + 8*60*60*1000);
  return taipei.toISOString().slice(0,16).replace("T"," ");
}
function monthsBetween(dateStr){
  if(!dateStr) return null;
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(String(dateStr).trim());
  if(!m) return null;
  const year = Number(m[1]);
  if(year < 2015 || year > 2035) return null;
  const d = new Date(year, Number(m[2])-1, Number(m[3]));
  if(isNaN(d)) return null;
  const now = new Date();
  return (now.getFullYear()-d.getFullYear())*12 + (now.getMonth()-d.getMonth());
}
function isoWeekToDate(year, week){
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
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
  const year = 2000 + yy;
  if(year < 2015 || year > 2035) return null;
  const d = isoWeekToDate(year, week);
  if(isNaN(d)) return null;
  const now = new Date();
  return (now.getFullYear() - d.getUTCFullYear()) * 12 + (now.getMonth() - d.getUTCMonth());
}
function normalizeBatches(raw, item){
  if(raw == null) return [];
  if(Array.isArray(raw)) return raw.map(b=>({ qty: Number(b&&b.qty)||0, productionDate: (b&&b.productionDate) || null }));
  if(typeof raw === "object") return [{ qty: Number(raw.qty)||0, productionDate: raw.productionDate || (item && item.productionDate) || null }];
  return [{ qty: Number(raw)||0, productionDate: (item && item.productionDate) || null }];
}
function locQty(loc){
  if(loc == null) return 0;
  if(Array.isArray(loc)) return loc.reduce((a,b)=>a+(Number(b&&b.qty)||0), 0);
  if(typeof loc === "object") return Number(loc.qty)||0;
  return Number(loc)||0;
}
function totalQty(item){
  const locs = item.locations || {};
  return Object.values(locs).reduce((a,b)=>a+locQty(b), 0);
}
const PENDING_STOCK_CODE = "尚未入庫";
function hasPendingStock(item){
  return locQty((item.locations||{})[PENDING_STOCK_CODE]) > 0;
}
function locDetailList(item){
  const locs = item.locations || {};
  const rows = [];
  Object.keys(locs).forEach(code=>{
    normalizeBatches(locs[code], item).forEach((b, idx)=>{
      if(b.qty > 0) rows.push({ code, idx, qty: b.qty, date: b.productionDate });
    });
  });
  rows.sort((a,b)=> a.code.localeCompare(b.code, "zh-Hant") || (a.date||"").localeCompare(b.date||""));
  return rows;
}
function locSummary(item){
  const list = locDetailList(item);
  return list.map(l=> `${l.code}x${l.qty}${l.date?`(${l.date})`:""}`).join("、") || "-";
}
function escapeHtml(s){
  return (s==null?"":s.toString()).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function kybLocQty(loc){ return Number(loc)||0; }
function kybTotalQty(item){
  const locs = item.locations || {};
  return Object.values(locs).reduce((a,b)=>a+kybLocQty(b), 0);
}
function kybLocList(item){
  const locs = item.locations || {};
  const rows = Object.keys(locs).map(code=>({code, qty:kybLocQty(locs[code])})).filter(r=>r.qty>0);
  rows.sort((a,b)=> a.code.localeCompare(b.code, "zh-Hant"));
  return rows;
}
function kybLocSummary(item){
  const list = kybLocList(item);
  return list.map(l=>`${l.code}x${l.qty}`).join("、") || "-";
}
function kybHasPendingStock(item){
  return kybLocQty((item.locations||{})[PENDING_STOCK_CODE]) > 0;
}

// ============================================================
// YangPo 來令片：前(Front) / 後(Rear) 分開追蹤庫存
// 資料欄位：locationsFront / locationsRear（皆為 {儲位代碼: 數量} 物件）
// 舊版（遷移前）資料使用單一 locations 欄位；讀取時以 || item.locations 相容舊格式。
// ============================================================
function padLocQty(loc){ return Number(loc)||0; }

// 前(F) 庫存
function padFrontQty(item){
  const locs = item.locationsFront || {};
  return Object.values(locs).reduce((a,b)=>a+padLocQty(b), 0);
}
function padFrontLocList(item){
  const locs = item.locationsFront || {};
  const rows = Object.keys(locs).map(code=>({code, qty:padLocQty(locs[code])})).filter(r=>r.qty>0);
  rows.sort((a,b)=> a.code.localeCompare(b.code, "zh-Hant"));
  return rows;
}
function padFrontLocSummary(item){
  return padFrontLocList(item).map(l=>`${l.code}x${l.qty}`).join("、") || "-";
}

// 後(R) 庫存
function padRearQty(item){
  const locs = item.locationsRear || {};
  return Object.values(locs).reduce((a,b)=>a+padLocQty(b), 0);
}
function padRearLocList(item){
  const locs = item.locationsRear || {};
  const rows = Object.keys(locs).map(code=>({code, qty:padLocQty(locs[code])})).filter(r=>r.qty>0);
  rows.sort((a,b)=> a.code.localeCompare(b.code, "zh-Hant"));
  return rows;
}
function padRearLocSummary(item){
  return padRearLocList(item).map(l=>`${l.code}x${l.qty}`).join("、") || "-";
}

// 前 + 後 合計
function padTotalQty(item){
  return padFrontQty(item) + padRearQty(item);
}

// 依 side ("front"/"rear") 取儲位清單（用於出貨/叫貨選儲位）
function padLocList(item, side){
  return side === "rear" ? padRearLocList(item) : padFrontLocList(item);
}

// 查詢卡片儲位摘要行（前後分開標示）
function padLocSummary(item){
  const f = item.partNoFront ? `前:${padFrontLocSummary(item)}` : null;
  const r = item.partNoRear  ? `後:${padRearLocSummary(item)}`  : null;
  return [f, r].filter(Boolean).join("　") || "-";
}

function padHasPendingStock(item){
  return padLocQty((item.locationsFront||{})[PENDING_STOCK_CODE]) > 0
      || padLocQty((item.locationsRear ||{})[PENDING_STOCK_CODE]) > 0;
}

// ---- 進銷貨／庫存校正 共用邏輯 ----
function txnSign(t){
  if(t.type === "adjust") return t.adjustSign === "-" ? -1 : 1;
  return t.type === "in" ? 1 : -1;
}
function txnTypeLabel(t){
  if(t.type === "adjust") return t.adjustSign === "-" ? "庫存校正（調降）" : "庫存校正（調升）";
  return t.type === "in" ? "進貨" : "銷貨";
}

function salespersonFieldHtml(fieldId, currentValue){
  if(!currentUser || currentUser.role !== "admin"){
    return `<div class="form-row"><label>業務</label><input type="text" id="${fieldId}" value="${escapeHtml(currentUser?currentUser.name:"")}" disabled></div>`;
  }
  const cur = (currentValue||"").toString().trim();
  const activeNames = Array.from(new Set(
    usersCache.filter(u=>u.active!==false && u.name).map(u=>u.name)
  ));
  let optionsHtml = `<option value="">（未指定）</option>` +
    activeNames.map(n=>`<option value="${escapeHtml(n)}" ${n===cur?'selected':''}>${escapeHtml(n)}</option>`).join("");
  if(cur && !activeNames.includes(cur)){
    optionsHtml += `<option value="${escapeHtml(cur)}" selected>${escapeHtml(cur)}（現有值，不在使用者清單中）</option>`;
  }
  return `<div class="form-row"><label>業務</label><select id="${fieldId}">${optionsHtml}</select></div>`;
}

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

function resetSessionState(){
  activeUnsubs.forEach(unsub=>{ try{ unsub(); }catch(e){} });
  activeUnsubs = [];
  usersListenerStarted = false;
  tireListenersStarted = false;
  kybListenersStarted = false;
  padListenersStarted = false;
  currentCategory = null;
  itemsCache = []; locationsCache = []; usersCache = []; txnCache = [];
  brandsCache = []; ordersCache = []; myOrdersCache = [];
  kybItemsCache = []; kybLocationsCache = []; kybOrdersCache = [];
  kybMyOrdersCache = []; kybTxnCache = [];
  padItemsCache = []; padLocationsCache = []; padOrdersCache = [];
  padMyOrdersCache = []; padTxnCache = [];
  queryVisibleCount = 200; kybQueryVisibleCount = 200; padQueryVisibleCount = 200;
  // 輪胎最佳化狀態清除
  _tireIdb = null;
  _stopTireTxnListener = null;
  _stopTireOrdersListener = null;
  tirePendingOrdersCount = 0;
  // KYB / 來令片最佳化狀態清除
  _kybIdb = null;
  _padIdb = null;
  const backupBanner = document.getElementById("backupBanner");
  if(backupBanner) backupBanner.classList.add("hidden");
  const ordersBanner = document.getElementById("ordersBanner");
  if(ordersBanner) ordersBanner.classList.add("hidden");
  if("clearAppBadge" in navigator){ navigator.clearAppBadge().catch(()=>{}); }
}

function requestNotificationPermissionForAdmin(){
  if(!currentUser || currentUser.role !== "admin") return;
  if(!("Notification" in window)) return;
  if(Notification.permission === "default"){ Notification.requestPermission().catch(()=>{}); }
}

auth.onAuthStateChanged(async (user)=>{
  if(!user){
    resetSessionState();
    document.getElementById("splash").classList.remove("hidden");
    document.getElementById("app").classList.add("hidden");
    document.getElementById("categoryScreen").classList.add("hidden");
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
  if(currentUser && currentUser.uid !== user.uid){ resetSessionState(); }
  currentUser = { uid: user.uid, name: data.name, username: data.username, role: data.role };
  document.getElementById("splash").classList.add("hidden");
  document.getElementById("whoLabel").textContent = `${currentUser.name}（${currentUser.role==='admin'?'管理者':'員工'}）`;
  requestNotificationPermissionForAdmin();
  showCategoryScreen();
});

document.getElementById("categoryIconTire").innerHTML = CATEGORY_ICONS.tire;
document.getElementById("categoryIconKyb").innerHTML = CATEGORY_ICONS.kyb;
document.getElementById("categoryIconPad").innerHTML = CATEGORY_ICONS.pad;

function showCategoryScreen(){
  document.getElementById("app").classList.add("hidden");
  document.getElementById("categoryScreen").classList.remove("hidden");
}

function switchToCategory(cat){
  currentCategory = cat;
  document.getElementById("categoryScreen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("appTitle").textContent =
    "正享庫存管理系統｜" + (currentCategory === "kyb" ? "KYB避震器" : currentCategory === "pad" ? "YangPo來令片" : "輪胎");
  buildTabs();
  checkFridayBanner();
  startListeners();
}

document.querySelectorAll(".category-card").forEach(btn=>{
  btn.addEventListener("click", ()=> switchToCategory(btn.dataset.category));
});
document.getElementById("switchCategoryBtn").addEventListener("click", ()=>{ showCategoryScreen(); });

const TIRE_TAB_DEFS = [
  {id:"query",    label:"庫存查詢",   icon:ICONS.query,    roles:["admin","member"]},
  {id:"myorders", label:"我的訂單",   icon:ICONS.myorders, roles:["member"]},
  {id:"master",   label:"庫存總表",   icon:ICONS.master,   roles:["admin","member"]},
  {id:"txn",      label:"進銷貨管理", icon:ICONS.txn,      roles:["admin","member"]},
  {id:"orders",   label:"訂單管理",   icon:ICONS.orders,   roles:["admin"]},
  {id:"loc",      label:"儲位管理",   icon:ICONS.loc,      roles:["admin"]},
  {id:"import",   label:"資料匯入",   icon:ICONS.txn,      roles:["admin"]},
  {id:"users",    label:"使用者管理", icon:ICONS.users,    roles:["admin"]},
];
const KYB_TAB_DEFS = [
  {id:"kyb-query",    label:"庫存查詢",   icon:ICONS.query,    roles:["admin","member"]},
  {id:"kyb-myorders", label:"我的訂單",   icon:ICONS.myorders, roles:["member"]},
  {id:"kyb-master",   label:"庫存總表",   icon:ICONS.master,   roles:["admin","member"]},
  {id:"kyb-txn",      label:"進銷貨管理", icon:ICONS.txn,      roles:["admin","member"]},
  {id:"kyb-orders",   label:"訂單管理",   icon:ICONS.orders,   roles:["admin"]},
  {id:"kyb-loc",      label:"儲位管理",   icon:ICONS.loc,      roles:["admin"]},
  {id:"kyb-import",   label:"資料匯入",   icon:ICONS.txn,      roles:["admin"]},
  {id:"users",        label:"使用者管理", icon:ICONS.users,    roles:["admin"]},
];
const PAD_TAB_DEFS = [
  {id:"pad-query",    label:"庫存查詢",   icon:ICONS.query,    roles:["admin","member"]},
  {id:"pad-myorders", label:"我的訂單",   icon:ICONS.myorders, roles:["member"]},
  {id:"pad-master",   label:"庫存總表",   icon:ICONS.master,   roles:["admin","member"]},
  {id:"pad-txn",      label:"進銷貨管理", icon:ICONS.txn,      roles:["admin","member"]},
  {id:"pad-orders",   label:"訂單管理",   icon:ICONS.orders,   roles:["admin"]},
  {id:"pad-loc",      label:"儲位管理",   icon:ICONS.loc,      roles:["admin"]},
  {id:"pad-import",   label:"資料匯入",   icon:ICONS.txn,      roles:["admin"]},
  {id:"users",        label:"使用者管理", icon:ICONS.users,    roles:["admin"]},
];
function currentTabDefs(){ return currentCategory==="kyb"?KYB_TAB_DEFS:currentCategory==="pad"?PAD_TAB_DEFS:TIRE_TAB_DEFS; }

function buildTabs(){
  // 切離輪胎分類時，停止輪胎 lazy 監聽器
  if(currentCategory !== "tire"){
    stopLazyTireTxnListener();
    stopLazyTireOrdersListener();
  }

  const nav = document.getElementById("tabs");
  const visible = currentTabDefs().filter(t=>t.roles.includes(currentUser.role));
  nav.innerHTML = visible.map((t,i)=>
    `<button data-tab="${t.id}" class="${i===0?'active':'''}">${t.icon}${t.label}${t.id==='orders'?'<span class="badge-dot hidden" id="ordersTabBadge">0</span>':''}${t.id==='kyb-orders'?'<span class="badge-dot hidden" id="kybOrdersTabBadge">0</span>':''}${t.id==='pad-orders'?'<span class="badge-dot hidden" id="padOrdersTabBadge">0</span>':''}</button>`
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

      // 輪胎 lazy 監聽器管理
      if(currentCategory === "tire"){
        if(btn.dataset.tab === "txn"){
          startLazyTireTxnListener();
        } else {
          stopLazyTireTxnListener();
        }
        if(btn.dataset.tab === "orders" && currentUser.role === "admin"){
          startLazyTireOrdersListener();
        } else {
          stopLazyTireOrdersListener();
        }
      }
    });
  });

  // 若初始 tab 是 txn 或 orders，補啟動 lazy 監聽器
  if(currentCategory === "tire" && visible.length > 0){
    const firstTab = visible[0].id;
    if(firstTab === "txn") startLazyTireTxnListener();
    if(firstTab === "orders" && currentUser.role === "admin") startLazyTireOrdersListener();
  }

  // 立刻更新 badge（重繪後 DOM 元素才存在）
  if(currentCategory === "tire") updateOrdersBadge();

  updateStickyOffsets();
}

function updateStickyOffsets(){
  const headerEl = document.querySelector("header.topbar");
  const navEl = document.getElementById("tabs");
  if(!headerEl || !navEl) return;
  document.documentElement.style.setProperty("--header-h", headerEl.offsetHeight + "px");
  document.documentElement.style.setProperty("--nav-h", navEl.offsetHeight + "px");
}
window.addEventListener("resize", updateStickyOffsets);
window.addEventListener("load", ()=> setTimeout(updateStickyOffsets, 100));

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

/**
 * 即時監聽器包裝函式。
 * 修改：現在回傳 stopFn，方便 lazy 監聽器在 tab 切換時手動停止。
 * stopFn 同時會被推入 activeUnsubs，確保登出時自動清理。
 */
function startRealtimeListener(makeQuery, onData, label){
  let unsub = null;
  let retryTimer = null;
  let stopped = false;
  const subscribe = ()=>{
    if(stopped) return;
    unsub = makeQuery().onSnapshot(onData, error=>{
      console.error("[" + label + "] 即時同步中斷，3 秒後自動重試：", error);
      retryTimer = window.setTimeout(subscribe, 3000);
    });
  };
  subscribe();
  const stopFn = ()=>{
    stopped = true;
    if(retryTimer){ window.clearTimeout(retryTimer); retryTimer = null; }
    if(unsub){ try{ unsub(); }catch(e){} }
  };
  activeUnsubs.push(stopFn);
  return stopFn; // 回傳讓 lazy 監聽器可手動停止
}

function startListeners(){
  if(!usersListenerStarted && currentUser.role === "admin"){
    usersListenerStarted = true;
    startRealtimeListener(()=>db.collection("users"), snap=>{
      usersCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
      renderUsers();
    }, "使用者");
  }
  if(currentUser.role === "admin"){
    if(!tireListenersStarted){ tireListenersStarted = true; startTireListeners(); }
    if(!kybListenersStarted){ kybListenersStarted = true; startKybListeners(); }
    if(!padListenersStarted){ padListenersStarted = true; startPadListeners(); }
  } else if(currentCategory === "kyb"){
    if(!kybListenersStarted){ kybListenersStarted = true; startKybListeners(); }
  } else if(currentCategory === "pad"){
    if(!padListenersStarted){ padListenersStarted = true; startPadListeners(); }
  } else {
    if(!tireListenersStarted){ tireListenersStarted = true; startTireListeners(); }
  }
}

// ============================================================
// 輪胎監聽器啟動（重寫：items 改用 IDB + marker，txn/orders 改為 lazy）
// ============================================================
function startTireListeners(){
  // 品項：IndexedDB 快取 + sequence marker 監聽器（取代原本全量 items onSnapshot）
  initTireItems();
  startTireMarkerListener();

  // 儲位：仍然 eager 啟動（進銷貨表單需要，文件數量少）
  startRealtimeListener(()=>db.collection("locations"), snap=>{
    locationsCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderLocations();
  }, "輪胎儲位");

  // 品牌：仍然 eager 啟動（新增品項表單需要，文件數量極少）
  activeUnsubs.push(db.collection("brands").onSnapshot(snap=>{
    brandsCache = snap.docs.map(d=>d.data().name);
    if(brandsCache.length === 0) brandsCache = DEFAULT_BRANDS.slice();
  }, ()=>{ brandsCache = DEFAULT_BRANDS.slice(); }));

  // 進銷貨：lazy（進入進銷貨 tab 才啟動）

  // 訂單：
  if(currentUser.role === "admin"){
    // 管理員：badge 用輕量監聽器（登入時啟動）；全量訂單列表改為 lazy
    startTirePendingOrdersBadgeListener();
  } else {
    // 員工：只看自己的訂單（數量少，仍 eager）
    let myOrdersByUid = [], myOrdersByName = [];
    const refreshMyOrders = ()=>{
      const merged = new Map([...myOrdersByName, ...myOrdersByUid].map(o=>[o.id, o]));
      myOrdersCache = [...merged.values()];
      renderMyOrders();
    };
    startRealtimeListener(()=>db.collection("orders").where("requestedByUid","==",currentUser.uid), snap=>{
      myOrdersByUid = snap.docs.map(d=>({id:d.id, ...d.data()})); refreshMyOrders();
    }, "我的輪胎訂單（帳號）");
    startRealtimeListener(()=>db.collection("orders").where("requestedByName","==",currentUser.name), snap=>{
      myOrdersByName = snap.docs.map(d=>({id:d.id, ...d.data()})); refreshMyOrders();
    }, "我的輪胎訂單（姓名）");
  }
}

function startKybListeners(){
  // 品項：IndexedDB 快取 + sequence marker 監聽器（取代原本全量 kybItems onSnapshot）
  initKybItems();
  startKybMarkerListener();

  startRealtimeListener(()=>db.collection("kybLocations"), snap=>{
    kybLocationsCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderKybLocations();
  }, "KYB儲位");
  startRealtimeListener(()=>db.collection("kybTransactions").orderBy("date","desc").limit(200), snap=>{
    kybTxnCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderKybTxns();
  }, "KYB進銷貨");
  if(currentUser.role === "admin"){
    startRealtimeListener(()=>db.collection("kybOrders").orderBy("requestedAt","desc").limit(300), snap=>{
      kybOrdersCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
      renderKybOrders();
      updateKybOrdersBadge();
    }, "KYB訂單");
  } else {
    let myKybOrdersByUid = [], myKybOrdersByName = [];
    const refreshMyKybOrders = ()=>{
      const merged = new Map([...myKybOrdersByName, ...myKybOrdersByUid].map(o=>[o.id, o]));
      kybMyOrdersCache = [...merged.values()];
      renderKybMyOrders();
    };
    startRealtimeListener(()=>db.collection("kybOrders").where("requestedByUid","==",currentUser.uid), snap=>{
      myKybOrdersByUid = snap.docs.map(d=>({id:d.id, ...d.data()})); refreshMyKybOrders();
    }, "我的KYB訂單（帳號）");
    startRealtimeListener(()=>db.collection("kybOrders").where("requestedByName","==",currentUser.name), snap=>{
      myKybOrdersByName = snap.docs.map(d=>({id:d.id, ...d.data()})); refreshMyKybOrders();
    }, "我的KYB訂單（姓名）");
  }
}

function startPadListeners(){
  // 品項：IndexedDB 快取 + sequence marker 監聽器（取代原本全量 padItems onSnapshot）
  initPadItems();
  startPadMarkerListener();

  startRealtimeListener(()=>db.collection("padLocations"), snap=>{
    padLocationsCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderPadLocations();
  }, "來令片儲位");
  startRealtimeListener(()=>db.collection("padTransactions").orderBy("date","desc").limit(200), snap=>{
    padTxnCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderPadTxns();
  }, "來令片進銷貨");
  if(currentUser.role === "admin"){
    startRealtimeListener(()=>db.collection("padOrders").orderBy("requestedAt","desc").limit(300), snap=>{
      padOrdersCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
      renderPadOrders();
      updatePadOrdersBadge();
    }, "來令片訂單");
  } else {
    let myPadOrdersByUid = [], myPadOrdersByName = [];
    const refreshMyPadOrders = ()=>{
      const merged = new Map([...myPadOrdersByName, ...myPadOrdersByUid].map(o=>[o.id, o]));
      padMyOrdersCache = [...merged.values()];
      renderPadMyOrders();
    };
    startRealtimeListener(()=>db.collection("padOrders").where("requestedByUid","==",currentUser.uid), snap=>{
      myPadOrdersByUid = snap.docs.map(d=>({id:d.id, ...d.data()})); refreshMyPadOrders();
    }, "我的來令片訂單（帳號）");
    startRealtimeListener(()=>db.collection("padOrders").where("requestedByName","==",currentUser.name), snap=>{
      myPadOrdersByName = snap.docs.map(d=>({id:d.id, ...d.data()})); refreshMyPadOrders();
    }, "我的來令片訂單（姓名）");
  }
}

// ============================================================
// Badge / Banner 更新
// 輪胎 badge 改用 tirePendingOrdersCount（輕量監聽器），不依賴 ordersCache
// ============================================================
function updateOrdersBadge(){
  const badge = document.getElementById("ordersTabBadge");
  const n = tirePendingOrdersCount; // ← 改用輕量監聽器的計數，不再掃 ordersCache
  if(badge){ badge.textContent = n; badge.classList.toggle("hidden", n===0); }
  updateOrdersBannerCombined();
}
document.getElementById("dismissOrdersBanner").addEventListener("click", ()=>{
  const banner = document.getElementById("ordersBanner");
  const target = (banner && banner.dataset.targetCategory) || currentCategory;
  if(target && target !== currentCategory) switchToCategory(target);
  const tabId = target === "kyb" ? "kyb-orders" : target === "pad" ? "pad-orders" : "orders";
  const btn = document.querySelector(`nav.tabs button[data-tab="${tabId}"]`);
  if(btn) btn.click();
});

function updateKybOrdersBadge(){
  const badge = document.getElementById("kybOrdersTabBadge");
  const n = kybOrdersCache.filter(o=>o.status==="pending").length;
  if(badge){ badge.textContent = n; badge.classList.toggle("hidden", n===0); }
  updateOrdersBannerCombined();
}

function updatePadOrdersBadge(){
  const badge = document.getElementById("padOrdersTabBadge");
  const n = padOrdersCache.filter(o=>o.status==="pending").length;
  if(badge){ badge.textContent = n; badge.classList.toggle("hidden", n===0); }
  updateOrdersBannerCombined();
}

function updateAppBadgeForAdmin(tireN, kybN, padN){
  if(!currentUser || currentUser.role !== "admin") return;
  if(!("setAppBadge" in navigator)) return;
  const total = tireN + kybN + padN;
  if(total > 0){ navigator.setAppBadge(total).catch(()=>{}); }
  else if("clearAppBadge" in navigator){ navigator.clearAppBadge().catch(()=>{}); }
}

function updateOrdersBannerCombined(){
  const banner = document.getElementById("ordersBanner");
  const bannerText = document.getElementById("ordersBannerText");
  const tireN = tirePendingOrdersCount; // ← 改用輕量監聽器的計數
  const kybN = kybOrdersCache.filter(o=>o.status==="pending").length;
  const padN = padOrdersCache.filter(o=>o.status==="pending").length;
  updateAppBadgeForAdmin(tireN, kybN, padN);
  if(!banner || !bannerText) return;
  if(tireN === 0 && kybN === 0 && padN === 0){ banner.classList.add("hidden"); return; }
  const parts = [];
  if(tireN > 0) parts.push(`輪胎 ${tireN} 筆`);
  if(kybN > 0) parts.push(`KYB ${kybN} 筆`);
  if(padN > 0) parts.push(`來令片 ${padN} 筆`);
  bannerText.textContent = `有新訂單待確認：${parts.join("、")}`;
  const pendingByCategory = { tire: tireN, kyb: kybN, pad: padN };
  const otherWithPending = Object.keys(pendingByCategory).find(cat=> cat !== currentCategory && pendingByCategory[cat] > 0);
  banner.dataset.targetCategory = otherWithPending || currentCategory;
  banner.classList.remove("hidden");
}
