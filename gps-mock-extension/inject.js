// 這支程式跑在網頁本身的環境（MAIN world），負責把 navigator.geolocation 換成假的。
// 這裡讀不到 chrome.storage，設定是 content.js 讀出來之後用事件傳進來的。
(() => {
  'use strict';

  const STATE_EVENT = 'gps-mock-ext:state';
  const HELLO_EVENT = 'gps-mock-ext:hello';
  // 一直等不到設定（例如擴充功能剛被停用）就改用真實定位，免得網頁卡住
  const WAIT_LIMIT_MS = 1000;
  const ERROR_MESSAGES = {
    1: 'User denied Geolocation',
    2: 'Position unavailable',
    3: 'Timeout expired',
  };

  const realGeo = navigator.geolocation || null;
  const real = realGeo && {
    getCurrentPosition: realGeo.getCurrentPosition.bind(realGeo),
    watchPosition: realGeo.watchPosition.bind(realGeo),
    clearWatch: realGeo.clearWatch.bind(realGeo),
  };

  let state = null; // 還沒收到設定之前是 null
  const queue = []; // 收到設定之前的 getCurrentPosition 先排隊
  const watchers = new Map();
  let nextWatchId = 1;

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
      if (typeof error === 'function') error(makeError(2, 'Geolocation is not supported'));
    }, 0);
  }

  function getCurrentPosition(success, error, options) {
    if (!state) queue.push(() => getCurrentPosition(success, error, options));
    else if (state.enabled) respond(success, error);
    else if (real) real.getCurrentPosition(success, error, options);
    else unsupported(error);
  }

  function startWatcher(w) {
    if (!state) return; // 收到設定時會再啟動
    if (state.enabled) {
      respond(
        (pos) => watchers.has(w.id) && w.success(pos),
        (err) => watchers.has(w.id) && typeof w.error === 'function' && w.error(err)
      );
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
    if (typeof fn !== 'function') throw new TypeError('The first argument must be a function');
  }

  const fakeGeolocation = {
    getCurrentPosition(success, error, options) {
      requireCallback(success);
      getCurrentPosition(success, error, options);
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

  function setState(next) {
    const first = state === null;
    const wasEnabled = !first && state.enabled;
    state = next;

    if (first) {
      queue.splice(0).forEach((fn) => fn());
      watchers.forEach(startWatcher);
    } else if (wasEnabled !== state.enabled) {
      // 在「模擬」和「真實定位」之間切換，正在追蹤的 watcher 也跟著換來源
      watchers.forEach((w) => {
        stopWatcher(w);
        startWatcher(w);
      });
    } else if (state.enabled) {
      watchers.forEach(startWatcher);
    }
  }

  window.addEventListener(STATE_EVENT, (e) => {
    try {
      setState(JSON.parse(e.detail));
    } catch (err) {
      // 格式不對就忽略
    }
  });
  setTimeout(() => {
    if (!state) setState({ enabled: false });
  }, WAIT_LIMIT_MS);
  // content.js 可能比這支程式先跑，打聲招呼請它再送一次設定
  window.dispatchEvent(new CustomEvent(HELLO_EVENT));

  try {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      get: () => fakeGeolocation,
    });
  } catch (e) {
    if (realGeo) Object.assign(realGeo, fakeGeolocation);
  }
})();
