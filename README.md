# 正享庫存管理系統

> 本文件是「現狀參考」：記錄系統目前實際長什麼樣子、各檔案負責什麼、資料庫結構是什麼。
> 專案的**工作規則**（怎麼改、改之前要做什麼）請看 [`CLAUDE.md`](./CLAUDE.md)，兩份文件分工不同，請都要看。

正式 repo：`r123607486-code/zhengxiang-inventory`（分支 `main`）
線上網址：https://r123607486-code.github.io/zhengxiang-inventory/
Firebase 專案：`zhengxiang-inventory-453e7`（Firestore, Spark 免費方案）

---

## 一、唯一標準來源

**GitHub `main` 分支 + Firebase 專案 `zhengxiang-inventory-453e7` 上的實際內容，才是系統現狀的唯一依據。**

- 本機／任何對話視窗裡暫存的舊版檔案、記憶中的舊印象，一律不算數。
- 開始修改任何功能前，一律從 GitHub 重新讀取該檔案的最新內容，不可憑之前對話的記憶直接改。
- 改完一律推回 GitHub 並重新讀回驗證內容正確，詳細流程見 `CLAUDE.md` 第四節。

---

## 二、只需要讀「相關」檔案，不用全部讀一遍

系統採「一個功能一個檔案」分工（見下表）。**要改某個功能時，只需要讀該功能對應的 1～2 個檔案
＋ `core.js`（共用核心，多數功能都會用到其中的工具函式／快取機制），不需要讀整個 repo。**

四個品項分類（輪胎／KYB／YangPo來令片／TEIN）的程式架構彼此對稱、互相獨立，改其中一個分類
不會動到其他分類的檔案。

---

## 三、檔案與功能對照表

| 檔案 | 負責範圍 | 所屬分類 |
|---|---|---|
| `firebase-config.js` | Firebase 連線設定（交接新客戶時唯一要換的檔案） | 共用 |
| `core.js` | 全域狀態、共用工具函式、登入／登出、分類切換、分頁建立、Firestore 監聽器啟動、四個分類的 IDB 快取與差異同步邏輯 | 共用 |
| `modal-shared.js` | 共用彈窗開關邏輯 | 共用 |
| `locations-users.js` | 儲位管理、使用者管理（四個分類共用同一組使用者） | 共用 |
| `data-import.js` | 輪胎資料匯入（舊資料整併、賽輪總表、完整備份還原） | 輪胎 |
| `backup-restore.js` | 備份還原（輪胎） | 輪胎 |
| `handover-backup.js` | 交接用完整備份匯出（輪胎） | 輪胎 |
| `tire-inventory.js` | 輪胎：庫存查詢、庫存總表、儲位／價格編輯、叫貨、匯出 | 輪胎 |
| `tire-transactions-orders.js` | 輪胎：進銷貨管理、庫存校正、訂單管理、我的訂單 | 輪胎 |
| `kyb-inventory.js` | KYB：庫存查詢、庫存總表、儲位編輯、叫貨、匯出 | KYB |
| `kyb-transactions-orders.js` | KYB：進銷貨管理、庫存校正、訂單管理、我的訂單；KYB 的資料匯入也寫在這個檔案裡 | KYB |
| `pad-inventory.js` | YangPo來令片：庫存查詢、庫存總表（前/後分開追蹤庫存）、儲位編輯、叫貨、匯出 | 來令片 |
| `pad-transactions-orders.js` | YangPo來令片：進銷貨管理、庫存校正、訂單管理、我的訂單 | 來令片 |
| `pad-data-import.js` | YangPo來令片：新增品項匯入、舊格式遷移、圖片連結批次貼上、庫存數量批次匯入 | 來令片 |
| `tein-inventory.js` | TEIN：庫存查詢、庫存總表、儲位編輯、叫貨、匯出 | TEIN |
| `tein-transactions-orders.js` | TEIN：進銷貨管理、庫存校正、訂單管理、我的訂單 | TEIN |
| `tein-data-import.js` | TEIN：報價單匯入、庫存數量批次匯入 | TEIN |
| `index.html` | 所有頁面結構、表格欄位標題、按鈕、script 載入順序與版本號 | 共用 |
| `style.css` | 全站樣式 | 共用 |
| `manifest.json` / `sw.js` / `icon-*.png` | 手機 App（PWA）設定，與業務邏輯無關 | 共用 |

> ⚠️ 過去 `CLAUDE.md` 的對照表漏列了 YangPo來令片與 TEIN 的檔案，已在本文件補齊。

---

## 四、Firestore Collections 對照（依分類）

| 分類 | 品項 | 儲位 | 進銷貨交易 | 訂單 | 變更紀錄（供差異同步用） | 快取版本標記 |
|---|---|---|---|---|---|---|
| 輪胎 | `items` | `locations` | `transactions` | `orders` | `tireItemChanges` | `settings/tireCache` |
| KYB避震器 | `kybItems` | `kybLocations` | `kybTransactions` | `kybOrders` | `kybItemChanges` | `settings/kybCache` |
| YangPo來令片 | `padItems` | `padLocations` | `padTransactions` | `padOrders` | `padItemChanges` | `settings/padCache` |
| TEIN避震器 | `teinItems` | `teinLocations` | `teinTransactions` | `teinOrders` | `teinItemChanges` | `settings/teinCache` |

共用 collections：`users`（使用者）、`brands`（輪胎品牌清單）、`editLogs`（編輯紀錄）、`settings`（各分類快取標記文件的集合）。

### 常見欄位（跨分類共用命名）
- 品項：`locations`（輪胎/KYB/TEIN 為「儲位代碼→數量」物件；來令片改用 `locationsFront`／`locationsRear` 前後分開）
- 交易記錄：`itemId`、`qty`、`date`、`type`（`in`/`out`/`adjust`）、`adjustSign`（`+`/`-`，僅 `type==="adjust"` 時有）、`salesperson`、`batchDate`
- 訂單：`requestedByUid`、`requestedByName`、`status`（`pending`/`confirmed`/`cancelled`）

欄位名稱**不可隨意更名**，改名會讓既有資料讀不到（等同資料遺失），詳見 `CLAUDE.md` 第五節。

---

## 五、共用架構：IDB 快取 + changeSequence 差異同步

四個分類的「品項」資料都不是直接 `onSnapshot` 監聽整個 collection，而是：

1. 登入/切換分類時，`core.js` 的 `init<Prefix>Items()` 先讀本機 IndexedDB 快取
2. 比對本機與 `settings/<prefix>Cache` 文件裡的 `changeSequence`：
   - 相同 → 不讀 Firestore，直接用本機快取（略過讀取）
   - 不同且本機為空 → `fullRead<Prefix>Items()` 全量讀取
   - 不同但本機有資料 → `deltaSync<Prefix>Items()` 只拉 `<prefix>ItemChanges` 裡有變更紀錄的品項
3. 任何會改動品項的操作，都必須在同一個 `runTransaction` 內：更新品項 + 寫一筆 `<prefix>ItemChanges` + `settings/<prefix>Cache` 的 `changeSequence` +1（否則差異同步會漏掉這筆變更，品項變成「孤兒資料」）

**⚠️ 重要教訓（2026-10 修復過的 bug）**：品項快取載入完成後（不管走上面三條路徑的哪一條），
一定要呼叫對應的 `render<Prefix>Txns()` 重新渲染交易列表。因為交易列表的即時監聽器
（`<prefix>Transactions` collection 的 `onSnapshot`）在分類切換時會立刻啟動，不會等品項快取載入完成，
如果快取讀完後沒有重新呼叫 `render<Prefix>Txns()`，交易列表裡所有筆數都會顯示「(規格已刪除)」，
因為渲染當下找不到對應的品項資料。輪胎的交易監聽器是「進到該頁籤才啟動」（`startLazyTireTxnListener`），
所以不會踩到這個問題；KYB／PAD／TEIN 是登入就啟動，所以容易踩到，改的時候要注意這三個分類是否也要同步處理。

---

## 六、目前版本號（`index.html` 內的 `?v=` 快取破版號）

| 檔案 | 版本 |
|---|---|
| `firebase-config.js` | `?v=20260807b` |
| `core.js` | `?v=20261004` |
| `modal-shared.js` | 無版號 |
| `tire-inventory.js` | `?v=20260825` |
| `tire-transactions-orders.js` | `?v=20260922` |
| `locations-users.js` | 無版號 |
| `data-import.js` | 無版號 |
| `backup-restore.js` | 無版號 |
| `handover-backup.js` | 無版號 |
| `kyb-inventory.js` | `?v=20260803` |
| `kyb-transactions-orders.js` | `?v=20260922` |
| `pad-inventory.js` | `?v=20260818` |
| `pad-transactions-orders.js` | `?v=20260930` |
| `pad-data-import.js` | `?v=20260820` |
| `tein-inventory.js` | `?v=20260909` |
| `tein-transactions-orders.js` | `?v=20260922` |
| `tein-data-import.js` | `?v=20260909b` |

> 改了任何 `.js` / `.css` 檔案，一定要同步把 `index.html` 裡對應的版號改成新日期，否則使用者端會繼續讀舊的快取版本。此表格也要跟著更新，保持跟 `index.html` 一致。

---

## 七、近期修復紀錄

- **2026-09-30**：YangPo來令片新建的零庫存規格，在「進貨」模式搜尋不到。原因是 `pad-transactions-orders.js` 的 `buildPadItemSearch()` 的 `filterInStockOnly` 參數在「新增進貨/銷貨」與「庫存校正」兩個彈窗被寫死成 `true`，導致不管進貨或銷貨模式都會濾掉零庫存品項（TEIN／KYB／輪胎原本就是動態判斷，沒有這個問題）。已修正為依目前選擇的進貨/銷貨或調升/調降動態判斷。
- **2026-10-04**：YangPo來令片「進銷貨管理」頁面所有交易列都顯示「(規格已刪除)」。原因見上方第五節的競爭條件說明。已在 `core.js` 的 `init/fullRead/deltaSync` 三組函式（Pad、KYB、TEIN 共 9 個函式）都補上對應的 `render<Prefix>Txns()` 呼叫。

---

## 八、給下一個對話／下一個人看這份文件的使用方式

1. 要改某個功能前，先看本文件第三節找到對應檔案，只讀那個檔案 + `core.js`。
2. 不確定某段邏輯在幹嘛，或懷疑本文件已經過時 → 直接去 GitHub 重新讀該檔案最新內容確認，不要憑本文件的描述猜測細節（本文件可能沒有即時更新）。
3. 改完功能、確認使用者驗收沒問題後，請在本文件第七節補上一行修復紀錄，並視情況更新第六節版本號表格。
4. 工作規則（改之前要列計畫、不可順手重構、同時開多視窗的風險等）一律遵守 `CLAUDE.md`，本文件不重複列。
