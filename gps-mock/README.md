# GPS 定位模擬器

在網頁裡模擬 GPS 位置，用來測試自己寫的定位功能。
只會影響有載入 `geo-mock.js` 的網頁，不會改到手機或電腦真正的 GPS。

## 檔案

| 檔案 | 用途 |
| --- | --- |
| `index.html` / `app.js` | 控制面板：點地圖、拖曳標記、輸入經緯度、模擬錯誤、測試結果 |
| `geo-mock.js` | 核心程式，覆寫 `navigator.geolocation` |
| `example.html` | 範例：一個普通的定位網頁，只多載入了 `geo-mock.js` |

## 用在自己的網頁

在 `<head>` 最前面、其他 script 之前加上：

```html
<script src="geo-mock.js"></script>
```

之後 `navigator.geolocation.getCurrentPosition` / `watchPosition` 就會回傳控制面板設定的位置，原本的程式碼不用改。

同一個網站（同源）同時開著控制面板和你的網頁時，在控制面板改位置，你的網頁會即時收到更新。

## 在 Console 直接操作

```js
GeoMock.set({ latitude: 25.033964, longitude: 121.564468, accuracy: 10 })
GeoMock.set({ error: 1 })   // 模擬錯誤：1 拒絕權限、2 無法取得位置、3 逾時、0 不模擬
GeoMock.disable()           // 改回真實定位
GeoMock.enable()
GeoMock.reset()             // 回到預設（台北 101）
```

地圖使用 [Leaflet](https://leafletjs.com/) 和 OpenStreetMap，需要網路；沒網路時還是可以直接輸入經緯度。

## Chrome 擴充功能版

不想在每個網頁加 script 的話，可以改用 [`gps-mock-extension`](../gps-mock-extension/)，裝好之後所有分頁都有效。
