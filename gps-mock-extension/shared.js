// popup、content script、background 共用的設定
const GpsMock = {
  KEY: 'settings',

  // 剛安裝時預設是關閉的，打開小視窗按開關才會開始模擬
  DEFAULTS: { enabled: false, latitude: 25.033964, longitude: 121.564468, accuracy: 10, error: 0 },

  withDefaults(saved) {
    return GpsMock.sanitize(GpsMock.DEFAULTS, saved || {});
  },

  // 只接受合法的值，其他忽略
  sanitize(state, changes) {
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

    return next;
  },
};
