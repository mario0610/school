// 跑在擴充功能的隔離環境（ISOLATED world）：從 chrome.storage 讀設定，
// 再用事件交給 inject.js。設定一改，所有分頁都會即時收到。
(() => {
  'use strict';

  const STATE_EVENT = 'gps-mock-ext:state';
  const HELLO_EVENT = 'gps-mock-ext:hello';
  let current = null;

  function send() {
    if (current) window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: JSON.stringify(current) }));
  }

  chrome.storage.local.get(GpsMock.KEY).then((result) => {
    current = GpsMock.withDefaults(result[GpsMock.KEY]);
    send();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[GpsMock.KEY]) return;
    current = GpsMock.withDefaults(changes[GpsMock.KEY].newValue);
    send();
  });

  window.addEventListener(HELLO_EVENT, send);
})();
