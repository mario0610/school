// 在工具列圖示上顯示「ON」，一眼就知道模擬有沒有開
importScripts('shared.js');

function updateBadge(saved) {
  const { enabled } = GpsMock.withDefaults(saved);
  chrome.action.setBadgeText({ text: enabled ? 'ON' : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
}

function refreshBadge() {
  chrome.storage.local.get(GpsMock.KEY).then((result) => updateBadge(result[GpsMock.KEY]));
}

chrome.runtime.onInstalled.addListener(refreshBadge);
chrome.runtime.onStartup.addListener(refreshBadge);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[GpsMock.KEY]) updateBadge(changes[GpsMock.KEY].newValue);
});
