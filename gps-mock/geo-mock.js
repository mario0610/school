/*
 * geo-mock.js — 網頁 GPS 定位模擬
 *
 * 把這個檔案放在網頁「所有其他 script 之前」載入：
 *
 *   <script src="geo-mock.js"></script>
 *
 * 它會覆寫 navigator.geolocation，讓這個網頁裡的
 * getCurrentPosition / watchPosition 回傳你設定的假位置。
 * 只影響有載入這個檔案的網頁，不會改變手機或電腦真正的 GPS。
 *
 * 設定存在 localStorage，同一個網站（同源）的其他分頁會讀到同樣的位置；
 * 在控制面板改位置時，其他分頁正在 watchPosition 的程式也會即時收到更新。
 *
 * 也可以直接在程式或 Console 裡操作：
 *   GeoMock.set({ latitude: 25.0339, longitude: 121.5645 })
 *   GeoMock.disable()   // 改回使用真實定位
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'geoMock';
  const ERROR_MESSAGES = {
    1: 'User denied Geolocation（模擬錯誤）',
    2: 'Position unavailable（模擬錯誤）',
    3: 'Timeout expired（模擬錯誤）',
  };

  const realGeo = navigator.geolocation || null;
  const real = realGeo && {
    getCurrentPosition: realGeo.getCurrentPosition.bind(realGeo),
    watchPosition: realGeo.watchPosition.bind(realGeo),
    clearWatch: realGeo.clearWatch.bind(realGeo),
  };

  const watchers = new Map();
  const listeners = [];
  let nextWatchId = 1;
  let state = defaults();
  applyChanges(readStorage());

  function defaults() {
    // 預設位置：台北 101
    return { enabled: true, latitude: 25.033964, longitude: 121.564468, accuracy: 10, error: 0 };
  }

  function readStorage(raw) {
    try {
      const saved = JSON.parse(raw === undefined ? localStorage.getItem(STORAGE_KEY) : raw);
      return saved && typeof saved === 'object' ? saved : {};
    } catch (e) {
      return {};
    }
  }

  function writeStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // 無痕模式或被封鎖時存不了，模擬功能照樣可以用
    }
  }

  // 只接受合法的值，其他忽略；回傳是否有任何欄位改變
  function applyChanges(changes) {
    const next = Object.assign({}, state);
    const num = (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v);

    if (typeof changes.enabled === 'boolean') next.enabled = changes.enabled;

    const lat = num(changes.latitude);
    if (Number.isFinite(lat)) next.latitude = Math.max(-90, Math.min(90, lat));

    const lng = num(changes.longitude);
    if (Number.isFinite(lng)) {
      next.longitude = lng >= -180 && lng <= 180 ? lng : ((((lng + 180) % 360) + 360) % 360) - 180;
    }

    const acc = num(changes.accuracy);
    if (Number.isFinite(acc) && acc > 0) next.accuracy = acc;

    const err = num(changes.error);
    if ([0, 1, 2, 3].includes(err)) next.error = err;

    const changed = Object.keys(next).some((k) => next[k] !== state[k]);
    state = next;
    return changed;
  }

  function makePosition() {
    return {
      coords: {
        latitude: state.latitude,
        longitude: state.longitude,
        accuracy: state.accuracy,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    };
  }

  function makeError(code, message) {
    return {
      code,
      message: message || ERROR_MESSAGES[code],
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };
  }

  // 真的定位 API 一定是非同步回傳，這裡也一樣
  function respond(success, error) {
    setTimeout(() => {
      if (state.error) {
        if (typeof error === 'function') error(makeError(state.error));
      } else {
        success(makePosition());
      }
    }, 0);
  }

  function unsupported(error) {
    setTimeout(() => {
      if (typeof error === 'function') error(makeError(2, '這個瀏覽器不支援定位'));
    }, 0);
  }

  function startWatcher(w) {
    if (state.enabled) {
      respond((pos) => watchers.has(w.id) && w.success(pos), (err) => watchers.has(w.id) && w.error && w.error(err));
    } else if (real) {
      w.realId = real.watchPosition(w.success, w.error, w.options);
    } else {
      unsupported(w.error);
    }
  }

  function stopWatcher(w) {
    if (w.realId != null) real.clearWatch(w.realId);
    w.realId = null;
  }

  function requireCallback(fn) {
    if (typeof fn !== 'function') throw new TypeError('第一個參數必須是 function');
  }

  const fakeGeolocation = {
    getCurrentPosition(success, error, options) {
      requireCallback(success);
      if (state.enabled) respond(success, error);
      else if (real) real.getCurrentPosition(success, error, options);
      else unsupported(error);
    },
    watchPosition(success, error, options) {
      requireCallback(success);
      const w = { id: nextWatchId++, success, error, options, realId: null };
      watchers.set(w.id, w);
      startWatcher(w);
      return w.id;
    },
    clearWatch(id) {
      const w = watchers.get(id);
      if (!w) return;
      stopWatcher(w);
      watchers.delete(id);
    },
  };

  function update(changes, fromOtherTab) {
    const wasEnabled = state.enabled;
    if (!applyChanges(changes || {})) return;
    if (!fromOtherTab) writeStorage();

    if (wasEnabled !== state.enabled) {
      // 在「模擬」和「真實定位」之間切換，正在追蹤的 watcher 也跟著換來源
      watchers.forEach((w) => {
        stopWatcher(w);
        startWatcher(w);
      });
    } else if (state.enabled) {
      watchers.forEach(startWatcher);
    }

    const snapshot = Object.assign({}, state);
    listeners.forEach((fn) => fn(snapshot));
  }

  try {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      get: () => fakeGeolocation,
    });
  } catch (e) {
    // 少數瀏覽器不讓重新定義 navigator.geolocation，就直接換掉它的方法
    if (realGeo) Object.assign(realGeo, fakeGeolocation);
  }

  // 其他分頁改了設定 → 這一頁也同步
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    update(e.newValue === null ? defaults() : readStorage(e.newValue), true);
  });

  window.GeoMock = {
    get: () => Object.assign({}, state),
    set: (changes) => update(changes),
    enable: () => update({ enabled: true }),
    disable: () => update({ enabled: false }),
    reset: () => update(defaults()),
    onChange(fn) {
      listeners.push(fn);
    },
    hasRealGeolocation: !!real,
    // 不管有沒有開模擬，都取得裝置的真實位置
    getRealPosition(options) {
      return new Promise((resolve, reject) => {
        if (!real) reject(makeError(2, '這個瀏覽器不支援定位'));
        else real.getCurrentPosition(resolve, reject, options);
      });
    },
  };
})();
