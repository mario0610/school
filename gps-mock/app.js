// 控制面板：把畫面上的操作接到 GeoMock，並用 navigator.geolocation 測試結果
(function () {
  'use strict';

  const PRESETS = [
    { name: '台北 101', latitude: 25.033964, longitude: 121.564468 },
    { name: '東京鐵塔', latitude: 35.658581, longitude: 139.745433 },
    { name: '艾菲爾鐵塔', latitude: 48.85837, longitude: 2.294481 },
    { name: '紐約時代廣場', latitude: 40.758, longitude: -73.9855 },
    { name: '雪梨歌劇院', latitude: -33.856784, longitude: 151.215297 },
  ];

  const $ = (id) => document.getElementById(id);
  const els = {
    enabled: $('enabled'),
    status: $('status'),
    form: $('coords-form'),
    lat: $('lat'),
    lng: $('lng'),
    accuracy: $('accuracy'),
    useReal: $('use-real'),
    presets: $('presets'),
    error: $('error'),
    testGet: $('test-get'),
    testWatch: $('test-watch'),
    clearLog: $('clear-log'),
    log: $('log'),
  };

  // ---------- 地圖 ----------
  let map = null;
  let marker = null;
  let circle = null;
  let dragging = false;

  function initMap() {
    const mapEl = $('map');
    if (!window.L) {
      mapEl.textContent = '地圖載入失敗（可能沒有網路），還是可以直接輸入經緯度。';
      return;
    }
    mapEl.textContent = '';
    const s = GeoMock.get();
    const here = [s.latitude, s.longitude];

    map = L.map(mapEl).setView(here, 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    circle = L.circle(here, { radius: s.accuracy, weight: 1 }).addTo(map);
    marker = L.marker(here, { draggable: true }).addTo(map);

    // 拖曳時就持續更新，正在 watchPosition 的程式會一路收到新位置
    marker.on('dragstart', () => (dragging = true));
    marker.on('dragend', () => (dragging = false));
    marker.on('drag', () => {
      const p = marker.getLatLng().wrap();
      GeoMock.set({ latitude: round(p.lat), longitude: round(p.lng) });
    });
    map.on('click', (e) => {
      const p = e.latlng.wrap();
      GeoMock.set({ latitude: round(p.lat), longitude: round(p.lng) });
    });
  }

  function round(n) {
    return Math.round(n * 1e6) / 1e6;
  }

  // ---------- 把狀態畫到畫面上 ----------
  function render(s, opts) {
    els.enabled.checked = s.enabled;
    els.status.textContent = s.enabled
      ? '模擬中：這個網頁的定位會回傳下面的位置'
      : '已關閉：使用裝置的真實定位';
    els.status.className = 'status ' + (s.enabled ? 'on' : 'off');

    // 正在輸入的欄位不要被覆蓋
    if (document.activeElement !== els.lat) els.lat.value = s.latitude;
    if (document.activeElement !== els.lng) els.lng.value = s.longitude;
    if (document.activeElement !== els.accuracy) els.accuracy.value = s.accuracy;
    els.error.value = String(s.error);

    if (map) {
      const here = [s.latitude, s.longitude];
      if (!(opts && opts.fromDrag)) marker.setLatLng(here);
      circle.setLatLng(here).setRadius(s.accuracy);
      if (opts && opts.pan) map.panTo(here);
    }
  }

  // ---------- 操作 ----------
  els.enabled.addEventListener('change', () => {
    GeoMock.set({ enabled: els.enabled.checked });
  });

  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    GeoMock.set({ latitude: els.lat.value, longitude: els.lng.value, accuracy: els.accuracy.value });
    render(GeoMock.get(), { pan: true });
  });

  els.error.addEventListener('change', () => {
    GeoMock.set({ error: Number(els.error.value) });
  });

  PRESETS.forEach((p) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = p.name;
    btn.addEventListener('click', () => {
      GeoMock.set({ latitude: p.latitude, longitude: p.longitude });
      render(GeoMock.get(), { pan: true });
    });
    els.presets.appendChild(btn);
  });

  els.useReal.disabled = !GeoMock.hasRealGeolocation;
  els.useReal.addEventListener('click', () => {
    els.useReal.disabled = true;
    log('正在取得真實位置…');
    GeoMock.getRealPosition({ enableHighAccuracy: true, timeout: 15000 })
      .then((pos) => {
        GeoMock.set({
          latitude: round(pos.coords.latitude),
          longitude: round(pos.coords.longitude),
          accuracy: Math.round(pos.coords.accuracy) || 10,
        });
        render(GeoMock.get(), { pan: true });
        log('已改用真實位置當起點');
      })
      .catch((err) => log('取得真實位置失敗：' + err.message, true))
      .finally(() => {
        els.useReal.disabled = false;
      });
  });

  // ---------- 測試區（用的就是被換掉的 navigator.geolocation） ----------
  let watchId = null;

  function describe(pos) {
    const c = pos.coords;
    return c.latitude + ', ' + c.longitude + '（±' + c.accuracy + ' 公尺）';
  }

  function onError(prefix) {
    return (err) => log(prefix + ' 錯誤 ' + err.code + '：' + err.message, true);
  }

  els.testGet.addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => log('getCurrentPosition → ' + describe(pos)),
      onError('getCurrentPosition'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });

  els.testWatch.addEventListener('click', () => {
    if (watchId === null) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => log('watchPosition → ' + describe(pos)),
        onError('watchPosition')
      );
      els.testWatch.textContent = '停止 watchPosition';
      log('開始追蹤（id ' + watchId + '），試著拖曳地圖上的標記');
    } else {
      navigator.geolocation.clearWatch(watchId);
      log('停止追蹤（id ' + watchId + '）');
      watchId = null;
      els.testWatch.textContent = '開始 watchPosition';
    }
  });

  els.clearLog.addEventListener('click', () => {
    els.log.textContent = '';
  });

  function log(text, isError) {
    const line = document.createElement('div');
    const time = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    line.textContent = '[' + time + '] ' + text;
    if (isError) line.className = 'err';
    els.log.appendChild(line);
    els.log.scrollTop = els.log.scrollHeight;
  }

  // ---------- 啟動 ----------
  initMap();
  // 自己改的、或其他分頁改的，都會通知到這裡
  GeoMock.onChange((s) => render(s, { fromDrag: dragging }));
  render(GeoMock.get());
})();
