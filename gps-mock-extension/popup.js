// 工具列小視窗：改設定 → 存進 chrome.storage → 每個分頁的 content.js 會即時收到
(() => {
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
    presets: $('presets'),
    error: $('error'),
  };

  let state = GpsMock.withDefaults();

  function save(changes, opts) {
    state = GpsMock.sanitize(state, changes);
    chrome.storage.local.set({ [GpsMock.KEY]: state });
    render(opts);
  }

  function round(n) {
    return Math.round(n * 1e6) / 1e6;
  }

  // ---------- 地圖 ----------
  let map = null;
  let marker = null;
  let circle = null;
  let dragging = false;

  function initMap() {
    const mapEl = $('map');
    mapEl.textContent = '';
    const here = [state.latitude, state.longitude];

    map = L.map(mapEl).setView(here, 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    }).addTo(map);

    circle = L.circle(here, { radius: state.accuracy, weight: 1 }).addTo(map);
    marker = L.marker(here, { draggable: true }).addTo(map);

    // 拖曳時持續更新，網頁上的 watchPosition 會一路收到新位置
    marker.on('dragstart', () => (dragging = true));
    marker.on('dragend', () => (dragging = false));
    marker.on('drag', () => {
      const p = marker.getLatLng().wrap();
      save({ latitude: round(p.lat), longitude: round(p.lng) });
    });
    map.on('click', (e) => {
      const p = e.latlng.wrap();
      save({ latitude: round(p.lat), longitude: round(p.lng) });
    });

    // 小視窗打開時尺寸還在變，等一下再讓地圖重新量一次大小
    setTimeout(() => map.invalidateSize(), 100);
  }

  // ---------- 畫面 ----------
  function render(opts) {
    els.enabled.checked = state.enabled;
    els.status.textContent = state.enabled ? '模擬中：網頁會拿到下面的位置' : '已關閉：網頁使用真實定位';
    els.status.className = 'status ' + (state.enabled ? 'on' : 'off');

    if (document.activeElement !== els.lat) els.lat.value = state.latitude;
    if (document.activeElement !== els.lng) els.lng.value = state.longitude;
    if (document.activeElement !== els.accuracy) els.accuracy.value = state.accuracy;
    els.error.value = String(state.error);

    if (map) {
      const here = [state.latitude, state.longitude];
      if (!dragging) marker.setLatLng(here);
      circle.setLatLng(here).setRadius(state.accuracy);
      if (opts && opts.pan) map.panTo(here);
    }
  }

  // ---------- 操作 ----------
  els.enabled.addEventListener('change', () => save({ enabled: els.enabled.checked }));

  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    save({ latitude: els.lat.value, longitude: els.lng.value, accuracy: els.accuracy.value }, { pan: true });
  });

  els.error.addEventListener('change', () => save({ error: Number(els.error.value) }));

  PRESETS.forEach((p) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = p.name;
    btn.addEventListener('click', () => save({ latitude: p.latitude, longitude: p.longitude }, { pan: true }));
    els.presets.appendChild(btn);
  });

  chrome.storage.local.get(GpsMock.KEY).then((result) => {
    state = GpsMock.withDefaults(result[GpsMock.KEY]);
    initMap();
    render();
  });
})();
