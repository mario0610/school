# GPS 定位模擬（Chrome 擴充功能）

讓網頁的 `navigator.geolocation` 回傳你指定的位置，用來測試定位功能。
不用改網頁程式碼，也不用在每個網頁加 script，所有分頁都有效。

## 安裝

1. 下載這個 repo（或 `git clone`）。
2. Chrome 網址列輸入 `chrome://extensions`。
3. 打開右上角的「開發人員模式」。
4. 按「載入未封裝項目」，選 `gps-mock-extension` 這個資料夾。
5. 點工具列的拼圖圖示，把「GPS 定位模擬」釘選出來比較好用。

Edge 也可以用，網址改成 `edge://extensions`。需要 Chrome 111 以上。

## 使用

點工具列圖示打開小視窗：

- 右上角開關：開啟／關閉模擬。開啟時圖示上會顯示 **ON**。
- 點地圖或拖曳標記改位置，也可以直接輸入經緯度、精確度，或點預設地點。
- 「模擬錯誤」可以讓網頁收到拒絕權限、無法取得位置、逾時的錯誤。

改設定後，已開啟的分頁會即時收到新位置，正在 `watchPosition` 的程式也會跟著更新，不用重新整理。

注意：

- 剛安裝或更新擴充功能後，之前就開著的分頁要重新整理一次。
- 想在 `file://` 開的本機檔案上使用，要在擴充功能的「詳細資料」裡打開「允許存取檔案網址」。
- 只會改變網頁 JavaScript 拿到的位置，不會改到裝置真正的 GPS，也不會影響用 IP 判斷位置的網站。

## 檔案

| 檔案 | 用途 |
| --- | --- |
| `manifest.json` | 擴充功能設定 |
| `popup.html` / `popup.js` | 工具列小視窗 |
| `inject.js` | 在網頁裡把 `navigator.geolocation` 換成假的 |
| `content.js` | 從 `chrome.storage` 讀設定，傳給 `inject.js` |
| `background.js` | 更新工具列圖示上的 ON 標記 |
| `shared.js` | 共用的預設值和檢查 |
| `lib/leaflet/` | 地圖套件 [Leaflet](https://leafletjs.com/) 1.9.4（BSD-2 授權），擴充功能不能從 CDN 載入程式，所以放一份在這裡 |
