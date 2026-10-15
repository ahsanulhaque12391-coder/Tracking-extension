/*
 * Extension popup: shows what tracking fired on the current tab, compares it
 * with the store saved in the hub, and can save the scan to the hub.
 */
(function () {
  "use strict";

  var S = window.TT_STORE;
  var SCAN = window.TT_SCAN;
  var out = document.getElementById("pop");
  var tab = null;
  var tabData = null;
  var chosenId = null;

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function bareHost(u) { return SCAN.hostOf(u).replace(/^www\./, ""); }

  function matchProject() {
    var st = S.state;
    if (chosenId) return st.projects.find(function (p) { return p.id === chosenId; }) || null;
    var h = bareHost(tab.url);
    return st.projects.find(function (p) { return p.url && bareHost(p.url) === h; }) || null;
  }

  function load(cb) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabsList) {
      tab = tabsList[0];
      document.getElementById("pageHost").textContent = tab && tab.url ? SCAN.hostOf(tab.url) : "";
      chrome.runtime.sendMessage({ type: "getTab", tabId: tab.id }, function (data) {
        tabData = data;
        if (cb) cb();
      });
    });
  }

  function render() {
    if (!tab || !/^https?:/.test(tab.url || "")) {
      out.innerHTML = '<p class="empty">Open your online store in this tab, then click the icon again.</p>';
      return;
    }
    var hits = tabData && tabData.hits ? tabData.hits : [];
    var p = matchProject();
    var st = S.state;
    var html = "";

    html += '<div class="field"><label for="storeSel">Compare with store</label><select id="storeSel"><option value="">– none (just show what fires) –</option>' +
      st.projects.map(function (x) { return '<option value="' + esc(x.id) + '"' + (p && p.id === x.id ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") +
      "</select>" + (!p ? '<button class="link small" id="addStore">+ Add ' + esc(bareHost(tab.url)) + " as a new store</button>" : "") + "</div>";

    if (!hits.length) {
      html += '<div class="alert alert-info">Nothing detected yet. Tracking fires when the page loads – click <b>Reload & scan</b>.</div>';
    } else {
      var scan = { url: tab.url, hits: hits };
      if (p) {
        var res = SCAN.analyzeScan(scan, p, S.getTool);
        var bad = res.filter(function (r) { return r.level === "bad"; }).length;
        var warn = res.filter(function (r) { return r.level === "warn"; }).length;
        var lvl = bad ? "bad" : warn ? "warn" : "ok";
        html += '<div class="health health-' + lvl + '"><div class="health-light"></div><div><h2>' + (bad ? bad + " problem(s) on this page" : warn ? warn + " warning(s)" : "Looks good") + "</h2>" +
          '<p class="small">Compared with your saved IDs for ' + esc(p.name) + ".</p></div></div>";
        html += '<ul class="issues">' + res.map(function (r) {
          var fix = r.fix && window.TT_DATA.FIXES[r.fix];
          return '<li class="issue issue-' + r.level + '"><span class="issue-icon">' + ({ bad: "✖", warn: "!", info: "i", ok: "✓" }[r.level]) + '</span><div class="grow">' + esc(r.text) +
            (fix ? '<details class="small"><summary>How to fix</summary><ol>' + fix.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol></details>" : "") + "</div></li>";
        }).join("") + "</ul>";
      }
      var groups = {};
      SCAN.summarize(hits).forEach(function (h) {
        var k = h.label + "|" + (h.id || "");
        (groups[k] = groups[k] || { label: h.label, id: h.id, evs: [] }).evs.push(h);
      });
      html += "<h3>What fired on this page</h3>" + Object.keys(groups).map(function (k) {
        var g = groups[k];
        return '<div class="hit-group"><b>' + esc(g.label) + '</b><span class="mono small">' + esc(g.id || "no ID") + "</span>" +
          g.evs.map(function (e) {
            return '<div class="hit-ev"><span class="mono">' + esc(e.event) + "</span><span>" + (e.count > 1 ? '<span class="chip chip-warn">×' + e.count + "</span>" : "×1") + (e.eids.length ? ' <span class="chip chip-ok" title="event_id present (dedup)">id</span>' : "") + "</span></div>";
          }).join("") + "</div>";
      }).join("");
    }

    html += '<div class="pop-actions"><button class="btn" id="rescan">Reload & scan</button>' +
      (hits.length && p ? '<button class="btn btn-primary" id="saveScan">Save scan to hub</button>' : "") + "</div>" +
      '<p class="muted small">Tip: also scan a product page and the thank-you page after a test order.</p>';
    out.innerHTML = html;
    bind();
  }

  function bind() {
    var sel = document.getElementById("storeSel");
    if (sel) sel.addEventListener("change", function () { chosenId = sel.value || "__none"; render(); });
    var add = document.getElementById("addStore");
    if (add) add.addEventListener("click", function () {
      var origin = new URL(tab.url).origin;
      var p = S.newProject(bareHost(tab.url), origin);
      S.addLog(p, "Store created from the extension");
      S.state.projects.push(p);
      if (!S.state.activeProjectId) S.state.activeProjectId = p.id;
      S.save();
      chosenId = p.id;
      render();
    });
    var rescan = document.getElementById("rescan");
    if (rescan) rescan.addEventListener("click", function () {
      chrome.runtime.sendMessage({ type: "clearTab", tabId: tab.id, url: tab.url }, function () {
        chrome.tabs.reload(tab.id);
        out.innerHTML = '<p class="empty">Reloading the page and listening… ⏳</p>';
        var n = 0;
        var timer = setInterval(function () {
          n++;
          load(function () { if (n >= 5) { clearInterval(timer); render(); } });
        }, 1000);
      });
    });
    var save = document.getElementById("saveScan");
    if (save) save.addEventListener("click", function () {
      var p = matchProject();
      var scan = {
        id: S.uid(), date: new Date().toISOString(), url: tab.url, title: tab.title || "",
        hits: tabData.hits.map(function (h) { return { tool: h.tool, label: h.label, id: h.id, event: h.event, eid: h.eid, host: h.host }; })
      };
      p.scans.unshift(scan);
      if (p.scans.length > 100) p.scans.length = 100;
      var bad = SCAN.analyzeScan(scan, p, S.getTool).filter(function (r) { return r.level === "bad"; }).length;
      S.addLog(p, "Live scan saved: " + SCAN.hostOf(tab.url) + new URL(tab.url).pathname.slice(0, 30) + (bad ? " – " + bad + " problem(s)" : " – OK"));
      S.save();
      save.textContent = "Saved ✓";
      save.disabled = true;
    });
  }

  document.getElementById("openHub").addEventListener("click", function () {
    chrome.tabs.create({ url: chrome.runtime.getURL("index.html#/scan") });
  });

  load(render);
})();
