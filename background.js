/*
 * Chrome extension background worker.
 * Watches network requests of each tab and records tracking hits
 * (Meta Pixel, GA4, TikTok, GTM…). Nothing is sent anywhere – the popup reads it.
 */
importScripts("js/data.js", "js/scan.js");

var tabs = {};
var saveTimers = {};

// The worker can be stopped by Chrome at any time; keep tab data in session storage.
var restored = chrome.storage.session.get(null).then(function (all) {
  Object.keys(all).forEach(function (k) {
    if (k.indexOf("tab_") === 0 && !tabs[k.slice(4)]) tabs[k.slice(4)] = all[k];
  });
});

function persist(tabId) {
  clearTimeout(saveTimers[tabId]);
  saveTimers[tabId] = setTimeout(function () {
    var o = {};
    o["tab_" + tabId] = tabs[tabId];
    chrome.storage.session.set(o);
  }, 300);
}

function updateBadge(tabId) {
  var t = tabs[tabId];
  var tools = {};
  (t ? t.hits : []).forEach(function (h) { tools[h.tool] = true; });
  var n = Object.keys(tools).length;
  chrome.action.setBadgeText({ tabId: +tabId, text: n ? String(n) : "" }).catch(function () {});
  chrome.action.setBadgeBackgroundColor({ tabId: +tabId, color: "#1f6feb" }).catch(function () {});
}

function bodyText(rb) {
  if (!rb) return "";
  try {
    if (rb.raw && rb.raw.length) {
      var dec = new TextDecoder();
      return rb.raw.map(function (part) { return part.bytes ? dec.decode(part.bytes) : ""; }).join("");
    }
    if (rb.formData) {
      return Object.keys(rb.formData).map(function (k) {
        return encodeURIComponent(k) + "=" + encodeURIComponent(rb.formData[k][0]);
      }).join("&");
    }
  } catch (e) { /* ignore unreadable bodies */ }
  return "";
}

function handle(d) {
  if (d.tabId < 0) return;
  var id = String(d.tabId);
  if (d.type === "main_frame") {
    tabs[id] = { url: d.url, started: Date.now(), hits: [] };
    persist(id);
    updateBadge(id);
    return;
  }
  var hits = self.TT_SCAN.detect(d.url, bodyText(d.requestBody));
  if (!hits.length) return;
  var t = tabs[id] = tabs[id] || { url: d.initiator || "", started: Date.now(), hits: [] };
  hits.forEach(function (h) {
    h.time = Date.now();
    if (t.hits.length < 800) t.hits.push(h);
  });
  persist(id);
  updateBadge(id);
}

chrome.webRequest.onBeforeRequest.addListener(
  function (d) { restored.then(function () { handle(d); }); },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

chrome.tabs.onRemoved.addListener(function (tabId) {
  delete tabs[tabId];
  chrome.storage.session.remove("tab_" + tabId);
});

chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
  restored.then(function () {
    var id = String(msg.tabId);
    if (msg.type === "getTab") reply(tabs[id] || null);
    if (msg.type === "clearTab") {
      tabs[id] = { url: msg.url || "", started: Date.now(), hits: [] };
      persist(id);
      updateBadge(id);
      reply(true);
    }
  });
  return true; // async reply
});
