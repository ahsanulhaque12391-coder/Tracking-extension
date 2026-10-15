/*
 * Tracking Health Hub – user interface.
 * Plain JavaScript, no build step. Views are rendered from the state in
 * TT_STORE and re-rendered after every change.
 */
(function () {
  "use strict";

  var D = window.TT_DATA;
  var S = window.TT_STORE;
  var SCAN = window.TT_SCAN;
  var view = document.getElementById("view");
  var IS_EXTENSION = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local && location.protocol === "chrome-extension:";

  /* ---------- small helpers ---------- */

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(v) {
    var n = parseFloat(String(v == null ? "" : v).replace(/,/g, ""));
    return isFinite(n) ? n : null;
  }
  function fmtNum(n, digits) {
    if (n == null || !isFinite(n)) return "–";
    return n.toLocaleString(undefined, { maximumFractionDigits: digits == null ? 0 : digits });
  }
  function fmtMoney(n, cur) {
    if (n == null || !isFinite(n)) return "–";
    try { return n.toLocaleString(undefined, { style: "currency", currency: cur || "USD", maximumFractionDigits: 0 }); }
    catch (e) { return fmtNum(n) + " " + (cur || ""); }
  }
  function pct(n) { return n == null || !isFinite(n) ? "–" : Math.round(n * 100) + "%"; }
  function fmtDate(iso) {
    if (!iso) return "–";
    var d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
    return isNaN(d) ? esc(iso) : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  function fmtDateTime(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "–" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  function daysSince(dateStr) {
    if (!dateStr) return Infinity;
    var d = new Date(dateStr.length === 10 ? dateStr + "T00:00:00" : dateStr);
    return (Date.now() - d.getTime()) / 86400000;
  }
  function statusLabel(k) {
    var s = D.STATUSES.find(function (x) { return x.key === k; });
    return s ? s.label : "Not set up";
  }
  function pill(status) {
    return '<span class="pill pill-' + esc(status || "none") + '">' + esc(statusLabel(status)) + "</span>";
  }
  function levelIcon(level) {
    return { bad: "✖", warn: "!", info: "i", ok: "✓" }[level] || "•";
  }
  function toolBadge(tool, size) {
    var t = tool || { short: "?", color: "#888" };
    var letters = (t.short || t.name || "?").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
    return '<span class="badge ' + (size || "") + '" style="background:' + esc(t.color || "#607d8b") + '">' + esc(letters) + "</span>";
  }
  function toast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.classList.remove("show"); }, 2200);
  }
  function flashSaved() {
    var el = document.getElementById("saved");
    el.classList.add("show");
    clearTimeout(flashSaved.t);
    flashSaved.t = setTimeout(function () { el.classList.remove("show"); }, 1200);
  }
  function commit(rerender) {
    S.save();
    flashSaved();
    if (rerender !== false) render();
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function slug(s) { return String(s || "export").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  /* ---------- project helpers ---------- */

  var CAT_ORDER = D.CATEGORIES;

  function projectTools(p) {
    var list = p.enabled.map(function (inst, idx) {
      return { inst: inst, tool: S.getTool(inst), rec: p.platforms[inst] || S.emptyPlatform(), idx: idx };
    }).filter(function (x) { return x.tool; });
    list.sort(function (a, b) {
      var ca = CAT_ORDER.indexOf(a.tool.category), cb = CAT_ORDER.indexOf(b.tool.category);
      if (ca < 0) ca = 99; if (cb < 0) cb = 99;
      return ca - cb || a.idx - b.idx;
    });
    return list;
  }
  function mainIdOf(tool, rec) {
    var key = SCAN.ID_FIELD[tool.key] || (tool.fields[0] && tool.fields[0].key);
    var f = tool.fields.find(function (x) { return x.key === key; });
    if (!f || f.sensitive) return "";
    return rec.fields[key] || "";
  }
  function fieldWarning(field, value) {
    if (!field.pattern || !value) return "";
    try {
      if (!new RegExp(field.pattern).test(String(value).trim())) return "This doesn't look like a normal " + field.label + ". Example: " + field.placeholder;
    } catch (e) { /* bad pattern in custom tool */ }
    return "";
  }
  function checklistStats(p, onlyInst) {
    var total = 0, done = 0;
    projectTools(p).forEach(function (x) {
      if (onlyInst && x.inst !== onlyInst) return;
      (x.tool.checklist || []).forEach(function (item) {
        total++;
        if (p.checklist[S.checkKey(x.inst, item.id)]) done++;
      });
    });
    return { total: total, done: done, pct: total ? done / total : 0 };
  }

  /* Tools that can appear in the "Numbers check" (they report purchases). */
  var NUMBER_TOOLS = ["ga4", "meta", "tiktok", "gads", "msads", "pinterest", "snapchat", "x", "reddit"];
  function numberTools(p) {
    var seen = {};
    var list = [];
    projectTools(p).forEach(function (x) {
      var base = S.baseKey(x.inst);
      if (seen[base]) return;
      if (NUMBER_TOOLS.indexOf(base) >= 0 || (x.tool.custom && x.tool.category === "Ads")) {
        seen[base] = true;
        list.push({ key: base, tool: x.tool });
      }
    });
    return list;
  }
  function captureLevel(base, rate) {
    if (rate == null) return "none";
    if (base === "ga4") {
      if (rate < 0.7 || rate > 1.1) return "bad";
      if (rate < 0.85 || rate > 1.05) return "warn";
      return "ok";
    }
    if (rate < 0.6 || rate > 1.3) return "bad";
    if (rate < 0.75 || rate > 1.15) return "warn";
    return "ok";
  }
  function sortedMetrics(p) {
    return p.metrics.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  /* Sum of the last n entries – used for "last 7 days" style summaries. */
  function metricTotals(p, n) {
    var rows = sortedMetrics(p).slice(-n);
    var t = { rows: rows.length, orders: 0, revenue: 0, sessions: 0, spend: 0, per: {} };
    rows.forEach(function (m) {
      t.orders += num(m.shopOrders) || 0;
      t.revenue += num(m.shopRevenue) || 0;
      t.sessions += num(m.sessions) || 0;
      Object.keys(m.platforms || {}).forEach(function (k) {
        var v = m.platforms[k] || {};
        var x = t.per[k] = t.per[k] || { received: 0, recRows: 0, ordersForRec: 0, adPurchases: 0, adRevenue: 0, spend: 0 };
        if (num(v.received) != null) { x.received += num(v.received); x.recRows++; x.ordersForRec += num(m.shopOrders) || 0; }
        x.adPurchases += num(v.adPurchases) || 0;
        x.adRevenue += num(v.adRevenue) || 0;
        x.spend += num(v.spend) || 0;
        t.spend += num(v.spend) || 0;
      });
    });
    Object.keys(t.per).forEach(function (k) {
      var x = t.per[k];
      x.capture = x.recRows && x.ordersForRec ? x.received / x.ordersForRec : null;
      x.roas = x.spend ? x.adRevenue / x.spend : null;
      x.cpa = x.adPurchases ? x.spend / x.adPurchases : null;
    });
    return t;
  }

  /* All problems in one list: setup, numbers and the latest live scan. */
  function collectIssues(p) {
    var issues = [];
    var notSetUp = [];
    projectTools(p).forEach(function (x) {
      var name = S.instanceLabel(p, x.inst);
      var rec = x.rec;
      if (rec.status === "problem") issues.push({ level: "bad", inst: x.inst, text: name + " is marked as a problem" + (rec.notes ? ": " + rec.notes.split("\n")[0] : "."), fix: "problemStatus", source: "Setup" });
      if (rec.status === "none") notSetUp.push(x.tool.short || x.tool.name);
      x.tool.fields.forEach(function (f) {
        var w = fieldWarning(f, rec.fields[f.key]);
        if (w) issues.push({ level: "warn", inst: x.inst, text: name + ": " + f.label + " '" + rec.fields[f.key] + "' looks wrong.", fix: "badFormat", source: "Setup" });
      });
      if (rec.fields.testCode && rec.status === "live") issues.push({ level: "warn", inst: x.inst, text: name + ": a test event code is still filled in.", fix: "testCode", source: "Setup" });
      if (rec.status === "live" && rec.lastChecked && daysSince(rec.lastChecked) > 30) issues.push({ level: "info", inst: x.inst, text: name + " was last checked " + Math.floor(daysSince(rec.lastChecked)) + " days ago.", fix: "staleCheck", source: "Setup" });
      if (S.baseKey(x.inst) === "shop") {
        var apps = String(rec.fields.trackingApps || "").split("\n").filter(function (l) { return l.trim(); });
        if (apps.length >= 3) issues.push({ level: "warn", inst: x.inst, text: apps.length + " tracking apps/plugins installed on the shop – risk of double counting.", fix: "multiApps", source: "Setup" });
      }
    });
    if (notSetUp.length) issues.push({ level: "info", inst: "", text: "Not set up yet: " + notSetUp.join(", ") + ".", fix: "", source: "Setup" });

    var purchaseEvent = p.events.find(function (e) { return /purchase/i.test(e.name); });
    if (!purchaseEvent) issues.push({ level: "warn", inst: "", text: "No Purchase event in your event plan yet – it's the most important one.", fix: "noPurchase", source: "Events", link: "#/events" });
    p.events.forEach(function (e) {
      if (e.status === "problem") issues.push({ level: "bad", inst: "", text: "Event '" + e.name + "' has a problem" + (e.notes ? ": " + e.notes : "."), fix: /purchase/i.test(e.name) ? "noPurchase" : "", source: "Events", link: "#/events" });
      if (e.server && e.dedup !== "Yes") issues.push({ level: "warn", inst: "", text: "Event '" + e.name + "' is sent from browser and server but deduplication is not confirmed.", fix: "noDedup", source: "Events", link: "#/events" });
    });

    // Numbers: last 3 entries.
    if (p.metrics.length) {
      var t = metricTotals(p, 3);
      numberTools(p).forEach(function (nt) {
        var x = t.per[nt.key];
        if (!x || x.capture == null) return;
        var lvl = captureLevel(nt.key, x.capture);
        if (lvl === "ok") return;
        var high = x.capture > 1;
        issues.push({
          level: lvl, inst: nt.key, source: "Numbers", link: "#/numbers",
          text: (nt.tool.short || nt.tool.name) + " received " + pct(x.capture) + " of your shop orders recently" + (high ? " – more than you actually sold." : "."),
          fix: high ? "highMatch" : "lowMatch"
        });
      });
      var last = sortedMetrics(p).slice(-1)[0];
      if (last && daysSince(last.date) > 8) issues.push({ level: "info", inst: "", text: "Numbers were last entered " + Math.floor(daysSince(last.date)) + " days ago.", fix: "", source: "Numbers", link: "#/numbers" });
    }

    // Latest live scan.
    var scan = p.scans[0];
    if (scan && daysSince(scan.date) <= 14) {
      SCAN.analyzeScan(scan, p, S.getTool).forEach(function (r) {
        if (r.level === "ok") return;
        issues.push({ level: r.level, inst: r.tool, text: r.text + " (scan of " + shortUrl(scan.url) + ")", fix: r.fix, source: "Live scan", link: "#/scan" });
      });
    }

    var order = { bad: 0, warn: 1, info: 2 };
    issues.sort(function (a, b) { return order[a.level] - order[b.level]; });
    return issues;
  }
  function shortUrl(u) {
    try { var x = new URL(u); return x.hostname + (x.pathname.length > 1 ? x.pathname.slice(0, 30) : ""); } catch (e) { return u || ""; }
  }
  function overallHealth(issues) {
    var bad = issues.filter(function (i) { return i.level === "bad"; }).length;
    var warn = issues.filter(function (i) { return i.level === "warn"; }).length;
    if (bad) return { level: "bad", title: "Something is broken", text: bad + " serious problem" + (bad > 1 ? "s" : "") + " and " + warn + " warning" + (warn === 1 ? "" : "s") + ". Fix the red items first." };
    if (warn) return { level: "warn", title: "Needs attention", text: warn + " warning" + (warn > 1 ? "s" : "") + ". Tracking works but could lose or double-count data." };
    return { level: "ok", title: "All good", text: "No problems found. Keep checking regularly – tracking can break after site changes." };
  }

  /* ---------- routing ---------- */

  function route() {
    var h = location.hash.replace(/^#\/?/, "");
    var parts = h.split("/");
    return { name: parts[0] || "dashboard", arg: parts[1] ? decodeURIComponent(parts[1]) : "" };
  }

  var NAV = [
    { key: "dashboard", label: "Health dashboard", icon: "◉" },
    { key: "tools", label: "Tools & IDs", icon: "▦" },
    { key: "events", label: "Events (funnel)", icon: "⇢" },
    { key: "numbers", label: "Numbers check", icon: "▤" },
    { key: "scan", label: "Live scan", icon: "⌖" },
    { key: "checklist", label: "Setup checklist", icon: "☑" },
    { key: "activity", label: "Activity log", icon: "☰" },
    { key: "learn", label: "Learn the basics", icon: "?" },
    { key: "stores", label: "My stores", icon: "⌂" },
    { key: "data", label: "Backup & settings", icon: "⚙" }
  ];

  function renderNav(active) {
    var nav = document.getElementById("nav");
    nav.innerHTML = NAV.map(function (n) {
      var on = n.key === active || (active === "tool" && n.key === "tools") || (active === "report" && n.key === "data") || (active === "store" && n.key === "stores");
      return '<a href="#/' + n.key + '" class="' + (on ? "active" : "") + '"><span class="nav-icon" aria-hidden="true">' + n.icon + "</span><span>" + n.label + "</span></a>";
    }).join("");
    var sel = document.getElementById("projectSelect");
    var st = S.state;
    sel.innerHTML = st.projects.map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === st.activeProjectId ? " selected" : "") + ">" + esc(p.name) + "</option>";
    }).join("") + '<option value="__new">+ Add a store…</option>';
    sel.parentElement.style.display = st.projects.length ? "" : "none";
  }

  function render() {
    applyTheme();
    var r = route();
    var p = S.activeProject();
    renderNav(r.name);
    var html;
    if (!p && ["learn", "data"].indexOf(r.name) < 0) {
      html = viewWelcome();
    } else {
      switch (r.name) {
        case "tools": html = viewTools(p); break;
        case "tool": html = viewTool(p, r.arg); break;
        case "events": html = viewEvents(p); break;
        case "numbers": html = viewNumbers(p); break;
        case "scan": html = viewScan(p); break;
        case "checklist": html = viewChecklist(p); break;
        case "activity": html = viewActivity(p); break;
        case "learn": html = viewLearn(); break;
        case "stores": html = viewStores(); break;
        case "store": html = viewStoreSettings(p); break;
        case "data": html = viewData(); break;
        case "report": html = viewReport(p); break;
        default: html = viewDashboard(p);
      }
    }
    view.innerHTML = html;
    if (!S.storageOk) {
      view.insertAdjacentHTML("afterbegin", '<div class="alert alert-bad">Your browser is blocking storage, so changes will NOT be kept after closing. Use "Backup & settings" to export your data.</div>');
    }
    document.body.classList.remove("nav-open");
  }

  /* ---------- views ---------- */

  function viewWelcome() {
    return '' +
      '<section class="hero">' +
      '<h1>Welcome to your Tracking Health Hub 👋</h1>' +
      '<p class="lead">One place to see if your store\'s tracking works: Facebook/Meta Pixel, Google Tag Manager, GA4, TikTok, Google Ads, server-side (Stape) and more. No technical knowledge needed – every field explains itself.</p>' +
      '<div class="steps">' +
      '<div class="step"><b>1</b><div><h3>Add your store</h3><p>Name and website address.</p></div></div>' +
      '<div class="step"><b>2</b><div><h3>Fill in your IDs</h3><p>Each tool shows where to find them.</p></div></div>' +
      '<div class="step"><b>3</b><div><h3>Check health</h3><p>Scan the site, compare numbers, get plain-English fixes.</p></div></div>' +
      '</div>' +
      '<form class="card form-inline" data-form="new-project">' +
      '<label>Store name<input name="name" required placeholder="e.g. My Fashion Shop"></label>' +
      '<label>Website<input name="url" placeholder="https://www.myshop.com"></label>' +
      '<button class="btn btn-primary" type="submit">Create my store</button>' +
      "</form>" +
      '<p class="muted">Just looking? <button class="link" data-action="load-demo">Load a demo store with example data</button></p>' +
      "</section>";
  }

  function viewDashboard(p) {
    var issues = collectIssues(p);
    var health = overallHealth(issues);
    var tools = projectTools(p);
    var live = tools.filter(function (x) { return x.rec.status === "live"; }).length;
    var problems = tools.filter(function (x) { return x.rec.status === "problem"; }).length;
    var cl = checklistStats(p);
    var t7 = metricTotals(p, 7);
    var scan = p.scans[0];
    var scanRes = scan ? SCAN.analyzeScan(scan, p, S.getTool) : [];

    var cards = tools.map(function (x) {
      var base = S.baseKey(x.inst);
      var per = t7.per[base];
      var scanFor = scanRes.filter(function (r) { return r.tool === x.inst || r.tool === base; });
      var scanState = !scan ? "" : scanFor.some(function (r) { return r.level === "bad"; }) ? "bad" : scanFor.some(function (r) { return r.level === "warn"; }) ? "warn" : scanFor.some(function (r) { return r.level === "ok"; }) ? "ok" : "";
      var id = mainIdOf(x.tool, x.rec);
      return '<a class="tool-card status-' + esc(x.rec.status) + '" href="#/tool/' + encodeURIComponent(x.inst) + '">' +
        '<div class="tool-card-head">' + toolBadge(x.tool) + '<div class="grow"><b>' + esc(S.instanceLabel(p, x.inst)) + "</b>" +
        '<div class="muted small mono">' + (id ? esc(id) : "No ID saved") + "</div></div></div>" +
        '<div class="tool-card-foot">' + pill(x.rec.status) +
        (per && per.capture != null ? '<span class="chip chip-' + captureLevel(base, per.capture) + '" title="Share of shop orders this tool received (last 7 entries)">' + pct(per.capture) + " captured</span>" : "") +
        (scanState ? '<span class="chip chip-' + scanState + '" title="Result of the last live scan">scan ' + levelIcon(scanState) + "</span>" : "") +
        "</div></a>";
    }).join("");

    var next = [];
    tools.forEach(function (x) {
      (x.tool.checklist || []).forEach(function (item) {
        if (next.length < 5 && !p.checklist[S.checkKey(x.inst, item.id)]) next.push({ x: x, item: item });
      });
    });

    return '' +
      '<div class="page-head"><div><h1>' + esc(p.name) + "</h1>" +
      (p.url ? '<a class="muted" href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.url) + " ↗</a>" : "") +
      '</div><div class="head-actions"><a class="btn" href="#/store">Store settings</a><a class="btn" href="#/report">Printable report</a></div></div>' +

      '<div class="health health-' + health.level + '"><div class="health-light" aria-hidden="true"></div><div><h2>' + esc(health.title) + "</h2><p>" + esc(health.text) + "</p></div></div>" +

      '<div class="kpis">' +
      kpi("Tools working", live + " / " + tools.length, problems ? problems + " marked as problem" : "Status you set per tool") +
      kpi("Setup progress", Math.round(cl.pct * 100) + "%", cl.done + " of " + cl.total + " checklist steps", cl.pct) +
      kpi("Revenue (last " + (t7.rows || 0) + " entries)", t7.rows ? fmtMoney(t7.revenue, p.currency) : "–", t7.rows ? fmtNum(t7.orders) + " orders · AOV " + fmtMoney(t7.orders ? t7.revenue / t7.orders : null, p.currency) : "Add numbers in 'Numbers check'") +
      kpi("Blended ROAS", t7.spend ? fmtNum(t7.revenue / t7.spend, 2) + "×" : "–", t7.spend ? "Revenue ÷ ad spend (" + fmtMoney(t7.spend, p.currency) + ")" : "Enter ad spend to see it") +
      "</div>" +

      '<div class="grid-2">' +
      '<section class="card"><div class="card-head"><h2>What needs attention</h2><span class="muted small">' + issues.length + " item" + (issues.length === 1 ? "" : "s") + "</span></div>" +
      (issues.length ? '<ul class="issues">' + issues.slice(0, 12).map(issueRow).join("") + "</ul>" + (issues.length > 12 ? '<p class="muted small">+ ' + (issues.length - 12) + " more…</p>" : "") : '<p class="empty">Nothing to fix right now 🎉</p>') +
      "</section>" +
      '<section class="card"><div class="card-head"><h2>Next steps</h2><a class="small" href="#/checklist">Full checklist →</a></div>' +
      (next.length ? '<ul class="checklist">' + next.map(function (n) { return checkItem(p, n.x.inst, n.item, n.x.tool); }).join("") + "</ul>" : '<p class="empty">All checklist steps done 🎉</p>') +
      '<div class="scan-mini">' + (scan ? "Last live scan: <b>" + fmtDateTime(scan.date) + "</b> on " + esc(shortUrl(scan.url)) + ' · <a href="#/scan">view</a>' : 'No live scan yet. <a href="#/scan">How to scan your store →</a>') + "</div>" +
      "</section></div>" +

      '<section><div class="section-head"><h2>All tools</h2><a class="btn btn-small" href="#/tools">Manage tools</a></div>' +
      '<div class="tool-grid">' + (cards || '<p class="empty">No tools yet. <a href="#/tools">Add tools</a></p>') + "</div></section>" +

      '<section class="card"><div class="card-head"><h2>Recent activity</h2><a class="small" href="#/activity">All →</a></div>' +
      (p.log.length ? '<ul class="log">' + p.log.slice(0, 5).map(logRow).join("") + "</ul>" : '<p class="empty">No activity yet.</p>') +
      "</section>";
  }

  function kpi(label, value, sub, progress) {
    return '<div class="kpi"><div class="kpi-label">' + esc(label) + '</div><div class="kpi-value">' + esc(value) + "</div>" +
      (progress != null ? '<div class="bar"><span style="width:' + Math.round(progress * 100) + '%"></span></div>' : "") +
      '<div class="kpi-sub">' + esc(sub) + "</div></div>";
  }

  function issueRow(i) {
    var fix = i.fix && D.FIXES[i.fix];
    return '<li class="issue issue-' + i.level + '"><span class="issue-icon" aria-hidden="true">' + levelIcon(i.level) + "</span><div class=\"grow\">" +
      '<div>' + esc(i.text) + "</div>" +
      '<div class="issue-meta"><span class="tag">' + esc(i.source) + "</span>" +
      (fix ? '<button class="link" data-action="show-fix" data-fix="' + esc(i.fix) + '">How to fix</button>' : "") +
      (i.inst && S.activeProject().platforms[i.inst] ? '<a href="#/tool/' + encodeURIComponent(i.inst) + '">Open tool</a>' : i.link ? '<a href="' + esc(i.link) + '">Open</a>' : "") +
      "</div></div></li>";
  }

  function checkItem(p, inst, item, tool) {
    var k = S.checkKey(inst, item.id);
    var on = !!p.checklist[k];
    return '<li class="' + (on ? "done" : "") + '"><label><input type="checkbox" data-action="toggle-check" data-key="' + esc(k) + '"' + (on ? " checked" : "") + ">" +
      '<span><span class="check-text">' + (tool ? '<span class="tag">' + esc(tool.short || tool.name) + "</span> " : "") + esc(item.text) + "</span>" +
      (item.help ? '<span class="muted small block">' + esc(item.help) + "</span>" : "") + "</span></label></li>";
  }

  function logRow(l) {
    var t = l.platform ? S.getTool(l.platform) : null;
    return '<li><span class="muted small">' + fmtDateTime(l.date) + "</span> " + (t ? '<span class="tag">' + esc(t.short || t.name) + "</span> " : "") + esc(l.text) + "</li>";
  }

  /* --- Tools list --- */
  function viewTools(p) {
    var tools = projectTools(p);
    var groups = {};
    tools.forEach(function (x) { (groups[x.tool.category] = groups[x.tool.category] || []).push(x); });
    var cats = Object.keys(groups).sort(function (a, b) { return (CAT_ORDER.indexOf(a) + 100) % 100 - (CAT_ORDER.indexOf(b) + 100) % 100; });
    return '' +
      '<div class="page-head"><div><h1>Tools & IDs</h1><p class="muted">Every tracking tool on <b>' + esc(p.name) + '</b>. Click one to fill in IDs, status and notes.</p></div>' +
      '<div class="head-actions"><button class="btn btn-primary" data-action="add-tool">+ Add a tool</button><button class="btn" data-action="custom-tool">Create your own tool</button></div></div>' +
      cats.map(function (c) {
        return '<section><h2 class="cat-title">' + esc(c) + "</h2><div class=\"tool-list\">" +
          groups[c].map(function (x) {
            var cs = checklistStats(p, x.inst);
            var id = mainIdOf(x.tool, x.rec);
            return '<a class="tool-row" href="#/tool/' + encodeURIComponent(x.inst) + '">' + toolBadge(x.tool) +
              '<div class="grow"><b>' + esc(S.instanceLabel(p, x.inst)) + '</b><div class="muted small">' + esc(x.tool.what.split(". ")[0]) + "</div></div>" +
              '<div class="tool-row-id mono small">' + (id ? esc(id) : '<span class="muted">no ID yet</span>') + "</div>" +
              '<div class="tool-row-progress"><div class="bar"><span style="width:' + Math.round(cs.pct * 100) + '%"></span></div><span class="small muted">' + cs.done + "/" + cs.total + "</span></div>" +
              pill(x.rec.status) + "</a>";
          }).join("") + "</div></section>";
      }).join("") +
      (tools.length ? "" : '<p class="empty">No tools yet. Click “Add a tool”.</p>');
  }

  /* --- Single tool --- */
  function viewTool(p, inst) {
    var tool = S.getTool(inst);
    var rec = p.platforms[inst];
    if (!tool || !rec) return '<p class="empty">This tool is not part of this store. <a href="#/tools">Back to tools</a></p>';
    var showAll = S.state.settings.showSecrets;
    var base = S.baseKey(inst);
    var evs = p.events.filter(function (e) { return e.map && e.map[base]; });
    var scan = p.scans[0];
    var scanRes = scan ? SCAN.analyzeScan(scan, p, S.getTool).filter(function (r) { return r.tool === inst || r.tool === base; }) : [];

    var fields = tool.fields.map(function (f) {
      var v = rec.fields[f.key] || "";
      var warn = fieldWarning(f, v);
      var attrs = ' data-bind="field" data-inst="' + esc(inst) + '" data-key="' + esc(f.key) + '" id="f-' + esc(f.key) + '"';
      var input;
      if (f.type === "select") {
        input = '<select' + attrs + ">" + f.options.map(function (o) { return '<option value="' + esc(o) + '"' + (o === v ? " selected" : "") + ">" + esc(o || "– choose –") + "</option>"; }).join("") + "</select>";
      } else if (f.type === "textarea") {
        input = '<textarea rows="3"' + attrs + ' placeholder="' + esc(f.placeholder || "") + '">' + esc(v) + "</textarea>";
      } else {
        input = '<div class="input-wrap"><input' + attrs + ' type="' + (f.sensitive && !showAll ? "password" : "text") + '" autocomplete="off" spellcheck="false" placeholder="' + esc(f.placeholder || "") + '" value="' + esc(v) + '">' +
          (f.sensitive ? '<button type="button" class="icon-btn" data-action="reveal" data-target="f-' + esc(f.key) + '" title="Show / hide">👁</button>' : "") +
          '<button type="button" class="icon-btn" data-action="copy" data-target="f-' + esc(f.key) + '" title="Copy">⧉</button></div>';
      }
      return '<div class="field"><label for="f-' + esc(f.key) + '">' + esc(f.label) + (f.sensitive ? ' <span class="tag tag-secret">secret</span>' : "") + "</label>" + input +
        '<div class="help">' + esc(f.help || "") + "</div>" + '<div class="warn-text" data-warn="' + esc(f.key) + '">' + esc(warn) + "</div></div>";
    }).join("");

    var extras = (rec.extras || []).map(function (e, i) {
      return '<div class="extra-row"><input placeholder="Name (e.g. Second pixel ID)" value="' + esc(e.label) + '" data-bind="extra" data-inst="' + esc(inst) + '" data-index="' + i + '" data-part="label">' +
        '<input placeholder="Value" value="' + esc(e.value) + '" data-bind="extra" data-inst="' + esc(inst) + '" data-index="' + i + '" data-part="value">' +
        '<button class="icon-btn" data-action="del-extra" data-inst="' + esc(inst) + '" data-index="' + i + '" title="Remove">✕</button></div>';
    }).join("");

    return '' +
      '<a class="back" href="#/tools">← All tools</a>' +
      '<div class="page-head"><div class="flex">' + toolBadge(tool, "badge-lg") + '<div><h1>' + esc(S.instanceLabel(p, inst)) + '</h1><span class="tag">' + esc(tool.category) + "</span>" + (tool.custom ? ' <span class="tag">your own tool</span>' : "") + "</div></div>" +
      '<div class="head-actions">' + (tool.links || []).map(function (l) { return '<a class="btn" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + " ↗</a>"; }).join("") + "</div></div>" +

      '<div class="status-picker" role="group" aria-label="Status">' + D.STATUSES.map(function (s) {
        return '<button class="status-btn status-' + s.key + (rec.status === s.key ? " on" : "") + '" data-action="set-status" data-inst="' + esc(inst) + '" data-status="' + s.key + '" title="' + esc(s.hint) + '">' + esc(s.label) + "</button>";
      }).join("") + "</div>" +

      '<div class="grid-2">' +
      '<section class="card explain"><h2>What is this?</h2><p>' + esc(tool.what || "–") + "</p><h3>Why do I need it?</h3><p>" + esc(tool.why || "–") + "</p>" +
      (scanRes.length ? "<h3>Last live scan</h3><ul class=\"issues\">" + scanRes.map(function (r) { return issueRow({ level: r.level, text: r.text, fix: r.fix, source: "Live scan", inst: "" }); }).join("") + "</ul>" : "") +
      "</section>" +
      '<section class="card"><h2>Who & when</h2>' +
      '<div class="field"><label>Nickname (optional)</label><input data-bind="rec" data-inst="' + esc(inst) + '" data-key="label" value="' + esc(rec.label) + '" placeholder="e.g. Main pixel, EU store, Old pixel"><div class="help">Useful when you have more than one of the same tool.</div></div>' +
      '<div class="field"><label>Who manages it</label><input data-bind="rec" data-inst="' + esc(inst) + '" data-key="owner" value="' + esc(rec.owner) + '" placeholder="Name, agency or email"></div>' +
      '<div class="field"><label>Last checked</label><div class="flex"><input type="date" data-bind="rec" data-inst="' + esc(inst) + '" data-key="lastChecked" value="' + esc(rec.lastChecked) + '"><button class="btn btn-small" data-action="checked-today" data-inst="' + esc(inst) + '">Checked today</button></div><div class="help">Update this every time you test it.</div></div>' +
      "</section></div>" +

      '<section class="card"><div class="card-head"><h2>IDs & settings</h2>' + (tool.fields.some(function (f) { return f.sensitive; }) ? '<span class="muted small">🔒 Secret fields are hidden. They stay in this browser only.</span>' : "") + "</div>" +
      '<div class="fields">' + (fields || '<p class="muted">This tool has no standard fields – use extra fields below.</p>') + "</div>" +
      '<h3>Extra fields</h3><p class="muted small">Anything else you want to remember: a second pixel ID, a login email, an API key name…</p>' +
      '<div class="extras">' + extras + '</div><button class="btn btn-small" data-action="add-extra" data-inst="' + esc(inst) + '">+ Add field</button>' +
      "</section>" +

      '<div class="grid-2">' +
      '<section class="card"><div class="card-head"><h2>Checklist</h2><span class="small muted">' + checklistStats(p, inst).done + "/" + checklistStats(p, inst).total + "</span></div>" +
      ((tool.checklist || []).length ? '<ul class="checklist">' + tool.checklist.map(function (item) { return checkItem(p, inst, item); }).join("") + "</ul>" : '<p class="muted">No checklist for this tool.</p>') + "</section>" +
      '<section class="card"><h2>Notes</h2><textarea rows="7" data-bind="rec" data-inst="' + esc(inst) + '" data-key="notes" placeholder="What was done, what is broken, passwords are NOT recommended here…">' + esc(rec.notes) + "</textarea>" +
      (evs.length ? '<h3>Events sent to this tool</h3><ul class="plain">' + evs.map(function (e) { return "<li>" + pill(e.status) + " <b>" + esc(e.name) + '</b> → <span class="mono">' + esc(e.map[base]) + "</span></li>"; }).join("") + "</ul>" : "") +
      "</section></div>" +

      '<div class="danger-zone"><button class="btn" data-action="add-copy" data-base="' + esc(base) + '">+ Add another ' + esc(tool.short || tool.name) + "</button>" +
      (tool.custom ? '<button class="btn" data-action="custom-tool" data-key="' + esc(tool.key) + '">Edit this tool type</button>' : "") +
      '<button class="btn btn-danger" data-action="remove-tool" data-inst="' + esc(inst) + '">Remove from this store</button></div>';
  }

  /* --- Events --- */
  function destinationsFor(p) {
    var bases = {};
    projectTools(p).forEach(function (x) { bases[S.baseKey(x.inst)] = x.tool; });
    var list = D.EVENT_DESTINATIONS.filter(function (d) { return bases[d.key]; }).map(function (d) { return { key: d.key, label: d.label }; });
    Object.keys(bases).forEach(function (k) {
      if (bases[k].custom && (bases[k].category === "Ads" || bases[k].category === "Analytics" || bases[k].category === "Server-side")) list.push({ key: k, label: bases[k].short || bases[k].name });
    });
    p.events.forEach(function (e) {
      Object.keys(e.map || {}).forEach(function (k) {
        if (e.map[k] && !list.some(function (d) { return d.key === k; })) {
          var t = S.getTool(k);
          list.push({ key: k, label: t ? t.short || t.name : k });
        }
      });
    });
    return list;
  }

  function viewEvents(p) {
    var dests = destinationsFor(p);
    var stats = { live: 0, problem: 0 };
    p.events.forEach(function (e) { if (stats[e.status] != null) stats[e.status]++; });
    var rows = p.events.map(function (e) {
      return "<tr>" +
        '<td><b>' + esc(e.name) + '</b><div class="muted small">' + esc(e.trigger || "") + "</div></td>" +
        dests.map(function (d) { return '<td class="mono small">' + (e.map[d.key] ? esc(e.map[d.key]) : '<span class="muted">–</span>') + "</td>"; }).join("") +
        "<td>" + (e.server ? "Yes" + (e.dedup === "Yes" ? ' <span class="chip chip-ok">dedup ✓</span>' : ' <span class="chip chip-warn">dedup?</span>') : '<span class="muted">No</span>') + "</td>" +
        "<td>" + pill(e.status) + "</td>" +
        '<td class="small">' + fmtDate(e.lastTested) + "</td>" +
        '<td class="row-actions"><button class="icon-btn" data-action="edit-event" data-id="' + esc(e.id) + '" title="Edit">✎</button><button class="icon-btn" data-action="del-event" data-id="' + esc(e.id) + '" title="Delete">✕</button></td>' +
        "</tr>";
    }).join("");
    return '' +
      '<div class="page-head"><div><h1>Events (shopping funnel)</h1><p class="muted">Which customer actions are tracked, and what each platform calls them. ' + stats.live + " working · " + stats.problem + " with problems.</p></div>" +
      '<div class="head-actions"><button class="btn btn-primary" data-action="event-library">+ Add standard events</button><button class="btn" data-action="edit-event">+ Custom event</button></div></div>' +
      '<div class="alert alert-info">💡 <b>Purchase</b> is the most important event. Make sure it works on every platform before worrying about the others.</div>' +
      (p.events.length ? '<div class="table-wrap"><table><thead><tr><th>Event</th>' + dests.map(function (d) { return "<th>" + esc(d.label) + "</th>"; }).join("") + "<th>Server-side</th><th>Status</th><th>Last tested</th><th></th></tr></thead><tbody>" + rows + "</tbody></table></div>"
        : '<p class="empty">No events yet. Click “Add standard events” – we pre-fill the right names for each platform.</p>') +
      funnelChart(p);
  }

  function funnelChart(p) {
    var steps = D.EVENT_LIBRARY.filter(function (e) { return e.step > 0; });
    return '<section class="card"><h2>The online shopping journey</h2><p class="muted small">Each step is an event. Green = tracked and working in your plan.</p><div class="funnel">' +
      steps.map(function (s) {
        var e = p.events.find(function (x) { return x.name === s.name; });
        var st = e ? e.status : "missing";
        return '<div class="funnel-step fs-' + esc(st) + '"><b>' + esc(s.name) + '</b><span class="small">' + esc(s.plain) + "</span></div>";
      }).join('<span class="funnel-arrow" aria-hidden="true">→</span>') + "</div></section>";
  }

  /* --- Numbers check --- */
  function viewNumbers(p) {
    var nts = numberTools(p);
    var rows = sortedMetrics(p).reverse();
    var t7 = metricTotals(p, 7);
    var cur = p.currency;

    var summary = nts.map(function (nt) {
      var x = t7.per[nt.key];
      var lvl = x ? captureLevel(nt.key, x.capture) : "none";
      return '<div class="num-card num-' + lvl + '">' + toolBadge(nt.tool) + '<div class="grow"><b>' + esc(nt.tool.short || nt.tool.name) + "</b>" +
        '<div class="num-big">' + (x && x.capture != null ? pct(x.capture) : "–") + '</div><div class="small muted">of shop orders received</div>' +
        (x && x.spend ? '<div class="small">Spend ' + fmtMoney(x.spend, cur) + " · ROAS " + fmtNum(x.roas, 2) + "× · CPA " + fmtMoney(x.cpa, cur) + "</div>" : "") +
        "</div></div>";
    }).join("");

    var table = rows.length ? '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Shop orders</th><th>Revenue</th><th>Conv. rate</th>' +
      nts.map(function (nt) { return "<th>" + esc(nt.tool.short || nt.tool.name) + "</th>"; }).join("") + "<th></th></tr></thead><tbody>" +
      rows.map(function (m) {
        var orders = num(m.shopOrders);
        return "<tr><td>" + fmtDate(m.date) + (m.notes ? '<div class="muted small">' + esc(m.notes) + "</div>" : "") + "</td><td>" + fmtNum(orders) + "</td><td>" + fmtMoney(num(m.shopRevenue), cur) + "</td>" +
          "<td>" + (num(m.sessions) && orders != null ? pct(orders / num(m.sessions)) : "–") + "</td>" +
          nts.map(function (nt) {
            var v = (m.platforms || {})[nt.key] || {};
            var rec = num(v.received);
            var rate = rec != null && orders ? rec / orders : null;
            var roas = num(v.spend) ? (num(v.adRevenue) || 0) / num(v.spend) : null;
            return "<td>" + (rate != null ? '<span class="chip chip-' + captureLevel(nt.key, rate) + '">' + pct(rate) + "</span>" : '<span class="muted">–</span>') +
              (roas != null ? '<div class="small muted">ROAS ' + fmtNum(roas, 2) + "×</div>" : "") + "</td>";
          }).join("") +
          '<td class="row-actions"><button class="icon-btn" data-action="edit-metric" data-id="' + esc(m.id) + '" title="Edit">✎</button><button class="icon-btn" data-action="del-metric" data-id="' + esc(m.id) + '" title="Delete">✕</button></td></tr>';
      }).join("") + "</tbody></table></div>" : '<p class="empty">No numbers yet. Click “Add today\'s numbers”.</p>';

    return '' +
      '<div class="page-head"><div><h1>Numbers check</h1><p class="muted">Compare your <b>real shop orders</b> with what each platform received. Big gaps = broken tracking.</p></div>' +
      '<div class="head-actions"><button class="btn btn-primary" data-action="edit-metric">+ Add today\'s numbers</button></div></div>' +
      '<details class="card explain"><summary><b>How does this work? (read me first)</b></summary>' +
      "<p>Every day or week, write down:</p><ol>" +
      "<li><b>Shop orders & revenue</b> – from Shopify / WooCommerce admin. This is the truth.</li>" +
      "<li><b>Purchases received</b> for each platform – how many Purchase events arrived: GA4 (Reports › Monetization › Ecommerce purchases: Transactions), Meta (Events Manager › Purchase › total events), TikTok (Events Manager › Purchase), Google Ads (Goals › Conversions › 'All conv.').</li>" +
      "<li><b>Ad results</b> (optional, for growth) – spend, purchases and conversion value shown in the Ads Manager.</li></ol>" +
      "<p><b>Captured %</b> = purchases received ÷ shop orders. GA4 should be 85–105%. Ad platforms usually 75–115%. Much lower = events are lost. Much higher = double counting.</p></details>" +
      (nts.length ? '<div class="num-grid">' + summary + "</div>" : '<div class="alert alert-info">Add GA4, Meta, TikTok or Google Ads in “Tools & IDs” to compare their numbers.</div>') +
      (rows.length > 1 ? captureChart(p, nts) : "") +
      (t7.rows ? '<div class="kpis">' +
        kpi("Orders", fmtNum(t7.orders), "last " + t7.rows + " entries") +
        kpi("Revenue", fmtMoney(t7.revenue, cur), "AOV " + fmtMoney(t7.orders ? t7.revenue / t7.orders : null, cur)) +
        kpi("Conversion rate", t7.sessions ? pct(t7.orders / t7.sessions) : "–", t7.sessions ? fmtNum(t7.sessions) + " sessions" : "Add sessions to see it") +
        kpi("Ad spend · MER", t7.spend ? fmtMoney(t7.spend, cur) : "–", t7.spend ? "Blended ROAS " + fmtNum(t7.revenue / t7.spend, 2) + "×" : "Enter spend per platform") +
        "</div>" : "") +
      '<section class="card"><h2>History</h2>' + table + "</section>";
  }

  function captureChart(p, nts) {
    var rows = sortedMetrics(p).slice(-30);
    var W = 720, H = 220, L = 40, R = 10, T = 10, B = 28;
    var maxY = 1.6;
    function x(i) { return L + (rows.length === 1 ? 0 : i * (W - L - R) / (rows.length - 1)); }
    function y(v) { return T + (1 - Math.min(v, maxY) / maxY) * (H - T - B); }
    var grid = [0, 0.5, 1, 1.5].map(function (v) {
      return '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="grid-line"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" class="axis" text-anchor="end">' + Math.round(v * 100) + "%</text>";
    }).join("");
    var band = '<rect x="' + L + '" y="' + y(1.15) + '" width="' + (W - L - R) + '" height="' + (y(0.75) - y(1.15)) + '" class="ok-band"/>';
    var lines = nts.map(function (nt) {
      var pts = [];
      rows.forEach(function (m, i) {
        var v = (m.platforms || {})[nt.key] || {};
        var rec = num(v.received), o = num(m.shopOrders);
        if (rec != null && o) pts.push([x(i), y(rec / o)]);
      });
      if (!pts.length) return "";
      return '<polyline fill="none" stroke="' + esc(nt.tool.color) + '" stroke-width="2.5" stroke-linejoin="round" points="' + pts.map(function (q) { return q[0].toFixed(1) + "," + q[1].toFixed(1); }).join(" ") + '"/>' +
        pts.map(function (q) { return '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="3" fill="' + esc(nt.tool.color) + '"/>'; }).join("");
    }).join("");
    var labels = rows.map(function (m, i) {
      if (rows.length > 10 && i % Math.ceil(rows.length / 8) !== 0 && i !== rows.length - 1) return "";
      return '<text x="' + x(i) + '" y="' + (H - 8) + '" class="axis" text-anchor="middle">' + esc(m.date.slice(5)) + "</text>";
    }).join("");
    return '<section class="card"><div class="card-head"><h2>Captured % over time</h2><span class="muted small">Green band = healthy range</span></div>' +
      '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Captured percentage per platform over time">' + band + grid + lines + labels + "</svg>" +
      '<div class="legend">' + nts.map(function (nt) { return '<span><i style="background:' + esc(nt.tool.color) + '"></i>' + esc(nt.tool.short || nt.tool.name) + "</span>"; }).join("") + "</div></section>";
  }

  /* --- Live scan --- */
  function viewScan(p) {
    var scans = p.scans;
    var latest = scans[0];
    var res = latest ? SCAN.analyzeScan(latest, p, S.getTool) : [];
    return '' +
      '<div class="page-head"><div><h1>Live scan</h1><p class="muted">See which pixels really fire on your store – and whether the IDs match what you saved.</p></div></div>' +
      (IS_EXTENSION ? '<div class="alert alert-ok">✓ The Chrome extension is installed. Open your store in a tab, click the extension icon, then “Save scan to hub”.</div>' :
        '<section class="card explain"><h2>How to scan (2 minutes, one time setup)</h2><ol>' +
        "<li>Download this project folder (the one containing <span class=\"mono\">manifest.json</span>).</li>" +
        "<li>In Chrome open <span class=\"mono\">chrome://extensions</span> and switch on <b>Developer mode</b> (top-right).</li>" +
        "<li>Click <b>Load unpacked</b> and choose the folder.</li>" +
        "<li>Pin the extension, open your store and click the icon. It shows every pixel that fires and any problems.</li>" +
        "<li>Click <b>Save scan to hub</b>. Then use <b>Open dashboard</b> in the extension – that copy of the hub receives your scans (it keeps its own data, so export/import a backup if you started here).</li></ol>" +
        '<p class="muted small">Tip: scan the homepage, a product page, and the thank-you page after a test order. That last one is where most problems hide.</p></section>') +
      (latest ? '<section class="card"><div class="card-head"><h2>Latest scan</h2><span class="muted small">' + fmtDateTime(latest.date) + "</span></div>" +
        '<p class="mono small">' + esc(latest.url) + "</p>" +
        '<ul class="issues">' + res.map(function (r) { return issueRow({ level: r.level, text: r.text, fix: r.fix, source: "Live scan", inst: p.platforms[r.tool] ? r.tool : "" }); }).join("") + "</ul>" +
        "<h3>Everything that fired</h3>" + hitsTable(latest) + "</section>" : '<p class="empty">No scans saved yet.</p>') +
      (scans.length > 1 ? '<section class="card"><h2>Earlier scans</h2><ul class="log">' + scans.slice(1, 30).map(function (s) {
        var r = SCAN.analyzeScan(s, p, S.getTool);
        var bad = r.filter(function (x) { return x.level === "bad"; }).length;
        return "<li><span class=\"muted small\">" + fmtDateTime(s.date) + "</span> " + esc(shortUrl(s.url)) + " – " + (bad ? '<span class="chip chip-bad">' + bad + " problem(s)</span>" : '<span class="chip chip-ok">OK</span>') +
          ' <button class="link" data-action="del-scan" data-id="' + esc(s.id) + '">delete</button></li>';
      }).join("") + "</ul></section>" : "");
  }

  function hitsTable(scan) {
    var hits = SCAN.summarize(scan.hits);
    if (!hits.length) return '<p class="muted">No tracking requests were detected.</p>';
    return '<div class="table-wrap"><table><thead><tr><th>Tool</th><th>ID</th><th>Event</th><th>Times</th><th>event_id</th></tr></thead><tbody>' +
      hits.map(function (h) {
        return "<tr><td>" + esc(h.label) + '</td><td class="mono small">' + esc(h.id || "–") + '</td><td class="mono small">' + esc(h.event) + "</td><td>" + h.count + '</td><td class="mono small">' + esc(h.eids.join(", ") || "–") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  /* --- Checklist --- */
  function viewChecklist(p) {
    var cl = checklistStats(p);
    return '' +
      '<div class="page-head"><div><h1>Setup checklist</h1><p class="muted">Tick each step when done. Steps are in a sensible order – start at the top.</p></div></div>' +
      '<div class="card"><div class="flex"><div class="grow"><div class="bar bar-lg"><span style="width:' + Math.round(cl.pct * 100) + '%"></span></div></div><b>' + Math.round(cl.pct * 100) + "%</b></div></div>" +
      projectTools(p).filter(function (x) { return (x.tool.checklist || []).length; }).map(function (x) {
        var cs = checklistStats(p, x.inst);
        return '<section class="card"><div class="card-head"><div class="flex">' + toolBadge(x.tool) + '<h2><a href="#/tool/' + encodeURIComponent(x.inst) + '">' + esc(S.instanceLabel(p, x.inst)) + "</a></h2></div><span class=\"small muted\">" + cs.done + "/" + cs.total + "</span></div>" +
          '<ul class="checklist">' + x.tool.checklist.map(function (item) { return checkItem(p, x.inst, item); }).join("") + "</ul></section>";
      }).join("");
  }

  /* --- Activity --- */
  function viewActivity(p) {
    var opts = projectTools(p).map(function (x) { return '<option value="' + esc(x.inst) + '">' + esc(S.instanceLabel(p, x.inst)) + "</option>"; }).join("");
    return '' +
      '<div class="page-head"><div><h1>Activity log</h1><p class="muted">A diary of changes. Status changes are added automatically. Write down anything else: new apps installed, theme updates, campaigns started…</p></div></div>' +
      '<form class="card form-inline" data-form="log"><label class="grow">What happened?<input name="text" required placeholder="e.g. Installed new checkout app, re-tested Purchase"></label>' +
      '<label>Tool<select name="platform"><option value="">– general –</option>' + opts + '</select></label><button class="btn btn-primary" type="submit">Add</button></form>' +
      '<section class="card">' + (p.log.length ? '<ul class="log">' + p.log.map(function (l) {
        return logRow(l).replace("</li>", ' <button class="link small" data-action="del-log" data-id="' + esc(l.id) + '">delete</button></li>');
      }).join("") + "</ul>" : '<p class="empty">Nothing logged yet.</p>') + "</section>";
  }

  /* --- Learn --- */
  function viewLearn() {
    return '' +
      '<div class="page-head"><div><h1>Learn the basics</h1><p class="muted">Tracking explained for non-technical people.</p></div></div>' +
      '<section class="card"><h2>How it all fits together</h2>' +
      '<div class="flow">' +
      '<div class="flow-box"><b>1. Your store</b><span>Shopify, WooCommerce… A customer views a product, adds to cart, buys.</span></div><div class="flow-arrow">→</div>' +
      '<div class="flow-box"><b>2. Data layer</b><span>The store writes the details (product, price, order number) in a hidden list.</span></div><div class="flow-arrow">→</div>' +
      '<div class="flow-box"><b>3. Google Tag Manager</b><span>Reads the data and decides which tags to fire.</span></div><div class="flow-arrow">→</div>' +
      '<div class="flow-split">' +
      '<div class="flow-box flow-a"><b>4a. Browser pixels</b><span>GA4, Meta Pixel, TikTok Pixel, Google Ads, Clarity – sent directly from the visitor\'s browser. Can be blocked by ad blockers & iPhones.</span></div>' +
      '<div class="flow-box flow-b"><b>4b. Server-side (sGTM on Stape)</b><span>A copy goes to <i>your</i> server (e.g. sst.yourshop.com), which forwards it to Meta CAPI, TikTok Events API, GA4, Google Ads. More accurate.</span></div>' +
      "</div><div class=\"flow-arrow\">→</div>" +
      '<div class="flow-box"><b>5. Platforms</b><span>Count sales, optimise your ads and show reports. Both copies are merged using the same <span class="mono">event_id</span> (deduplication).</span></div>' +
      "</div>" +
      '<p class="muted small">Search Console is different: no code needed – Google simply reports how your store appears in search.</p></section>' +

      '<section class="card"><h2>What the statuses mean</h2><ul class="plain">' + D.STATUSES.map(function (s) { return "<li>" + pill(s.key) + " " + esc(s.hint) + "</li>"; }).join("") + "</ul></section>" +

      '<section class="card"><h2>The 5 most common problems</h2><div class="fix-list">' +
      ["duplicate", "noPurchase", "lowMatch", "wrongId", "noDedup"].map(function (k) {
        var f = D.FIXES[k];
        return "<details><summary><b>" + esc(f.title) + "</b></summary><ol>" + f.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol></details>";
      }).join("") + "</div></section>" +

      '<section class="card"><h2>Event names cheat sheet</h2><p class="muted small">Every platform uses a different name for the same action.</p><div class="table-wrap"><table><thead><tr><th>Action</th><th>GA4</th><th>Meta</th><th>TikTok</th><th>Google Ads</th><th>Pinterest</th><th>Snapchat</th></tr></thead><tbody>' +
      D.EVENT_LIBRARY.map(function (e) {
        return "<tr><td><b>" + esc(e.name) + '</b><div class="muted small">' + esc(e.plain) + "</div></td>" + ["ga4", "meta", "tiktok", "gads", "pinterest", "snapchat"].map(function (k) { return '<td class="mono small">' + esc(e.map[k] || "–") + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody></table></div></section>" +

      '<section class="card"><div class="card-head"><h2>Glossary</h2><input class="search" placeholder="Search a word…" data-action="glossary-search"></div><dl class="glossary">' +
      D.GLOSSARY.map(function (g) { return '<div class="gl-item" data-term="' + esc((g.term + " " + g.text).toLowerCase()) + '"><dt>' + esc(g.term) + "</dt><dd>" + esc(g.text) + "</dd></div>"; }).join("") +
      "</dl></section>";
  }

  /* --- Stores --- */
  function viewStores() {
    var st = S.state;
    return '' +
      '<div class="page-head"><div><h1>My stores</h1><p class="muted">Manage several websites or clients. Click one to switch.</p></div></div>' +
      '<div class="store-grid">' + st.projects.map(function (p) {
        var issues = collectIssues(p);
        var h = overallHealth(issues);
        var cl = checklistStats(p);
        return '<div class="card store-card health-' + h.level + (p.id === st.activeProjectId ? " current" : "") + '">' +
          '<div class="card-head"><h2>' + esc(p.name) + '</h2><span class="dot dot-' + h.level + '" title="' + esc(h.title) + '"></span></div>' +
          '<p class="muted small">' + esc(p.url || "no website saved") + "</p>" +
          '<p class="small">' + esc(h.title) + " · setup " + Math.round(cl.pct * 100) + "% · " + p.enabled.length + " tools</p>" +
          '<button class="btn btn-small' + (p.id === st.activeProjectId ? "" : " btn-primary") + '" data-action="switch-project" data-id="' + esc(p.id) + '">' + (p.id === st.activeProjectId ? "Open" : "Switch to this store") + "</button></div>";
      }).join("") + "</div>" +
      '<form class="card form-inline" data-form="new-project"><label>New store name<input name="name" required placeholder="e.g. Client B"></label><label>Website<input name="url" placeholder="https://"></label><button class="btn btn-primary" type="submit">Add store</button></form>' +
      '<section class="card"><h2>Find an ID anywhere</h2><p class="muted small">Type a pixel ID, GTM ID, measurement ID… to see which store uses it.</p><input class="search" data-action="global-search" placeholder="e.g. GTM-AB12CD3"><div id="searchResults"></div></section>';
  }

  function viewStoreSettings(p) {
    var bases = {};
    p.enabled.forEach(function (k) { bases[S.baseKey(k)] = true; });
    return '' +
      '<a class="back" href="#/dashboard">← Dashboard</a><div class="page-head"><div><h1>Store settings</h1></div></div>' +
      '<section class="card"><div class="fields">' +
      '<div class="field"><label>Store name</label><input data-bind="project" data-key="name" value="' + esc(p.name) + '"></div>' +
      '<div class="field"><label>Website</label><input data-bind="project" data-key="url" value="' + esc(p.url) + '" placeholder="https://www.myshop.com"><div class="help">Used by the extension to recognise your store.</div></div>' +
      '<div class="field"><label>Currency</label><input data-bind="project" data-key="currency" value="' + esc(p.currency) + '" placeholder="USD" maxlength="3"><div class="help">3-letter code: USD, EUR, GBP, BDT, INR…</div></div>' +
      '<div class="field field-wide"><label>Notes</label><textarea rows="3" data-bind="project" data-key="notes">' + esc(p.notes) + "</textarea></div>" +
      "</div></section>" +
      '<div class="danger-zone"><button class="btn btn-danger" data-action="delete-project">Delete this store</button></div>';
  }

  /* --- Data & settings --- */
  function viewData() {
    var st = S.state;
    var p = S.activeProject();
    return '' +
      '<div class="page-head"><div><h1>Backup & settings</h1><p class="muted">Your data is saved only in <b>this browser</b> on this computer. Export a backup regularly, or to move to another computer.</p></div></div>' +
      '<div class="grid-2">' +
      '<section class="card"><h2>Backup</h2>' +
      '<label class="check"><input type="checkbox" id="includeSecrets"> Include secret tokens in the backup file</label>' +
      '<div class="btn-row"><button class="btn btn-primary" data-action="export-all">Export everything (.json)</button>' +
      (p ? '<button class="btn" data-action="export-project">Export this store only</button>' : "") + "</div>" +
      '<h3>Restore / import</h3><p class="muted small">Stores in the file are added. A store with the same ID replaces the existing one.</p>' +
      '<input type="file" id="importFile" accept=".json,application/json">' +
      (p ? '<h3>Spreadsheets</h3><div class="btn-row"><button class="btn" data-action="export-csv-ids">Tool IDs (.csv)</button><button class="btn" data-action="export-csv-events">Events (.csv)</button><button class="btn" data-action="export-csv-numbers">Numbers (.csv)</button><a class="btn" href="#/report">Printable report</a></div>' : "") +
      "</section>" +
      '<section class="card"><h2>Settings</h2>' +
      '<div class="field"><label>Theme</label><select data-bind="setting" data-key="theme"><option value="auto"' + (st.settings.theme === "auto" ? " selected" : "") + '>Same as computer</option><option value="light"' + (st.settings.theme === "light" ? " selected" : "") + '>Light</option><option value="dark"' + (st.settings.theme === "dark" ? " selected" : "") + ">Dark</option></select></div>" +
      '<label class="check"><input type="checkbox" data-bind="setting" data-key="showSecrets"' + (st.settings.showSecrets ? " checked" : "") + "> Always show secret fields (tokens) – only on a private computer</label>" +
      '<h3>Your own tool types</h3>' + (st.customTools.length ? '<ul class="plain">' + st.customTools.map(function (t) {
        return "<li>" + toolBadge(t) + " " + esc(t.name) + ' <button class="link" data-action="custom-tool" data-key="' + esc(t.key) + '">edit</button> <button class="link" data-action="delete-custom" data-key="' + esc(t.key) + '">delete</button></li>';
      }).join("") + "</ul>" : '<p class="muted small">None yet.</p>') + '<button class="btn btn-small" data-action="custom-tool">+ Create your own tool</button>' +
      '<h3>Start over</h3><div class="btn-row"><button class="btn" data-action="load-demo">Add demo store</button><button class="btn btn-danger" data-action="reset-all">Delete ALL data</button></div>' +
      "</section></div>";
  }

  /* --- Printable report --- */
  function viewReport(p) {
    var issues = collectIssues(p);
    var h = overallHealth(issues);
    var t7 = metricTotals(p, 7);
    return '' +
      '<div class="page-head no-print"><div><a class="back" href="#/dashboard">← Dashboard</a></div><div class="head-actions"><button class="btn btn-primary" data-action="print">Print / Save as PDF</button></div></div>' +
      '<article class="report"><h1>Tracking health report – ' + esc(p.name) + '</h1><p class="muted">' + esc(p.url) + " · " + fmtDate(S.today()) + "</p>" +
      '<div class="health health-' + h.level + '"><div class="health-light"></div><div><h2>' + esc(h.title) + "</h2><p>" + esc(h.text) + "</p></div></div>" +
      "<h2>Tools</h2><table><thead><tr><th>Tool</th><th>Status</th><th>Main ID</th><th>Last checked</th><th>Notes</th></tr></thead><tbody>" +
      projectTools(p).map(function (x) { return "<tr><td>" + esc(S.instanceLabel(p, x.inst)) + "</td><td>" + esc(statusLabel(x.rec.status)) + '</td><td class="mono">' + esc(mainIdOf(x.tool, x.rec) || "–") + "</td><td>" + fmtDate(x.rec.lastChecked) + "</td><td>" + esc(x.rec.notes) + "</td></tr>"; }).join("") +
      "</tbody></table>" +
      "<h2>Problems & warnings</h2>" + (issues.length ? "<ul>" + issues.map(function (i) { return "<li><b>" + esc(i.level === "bad" ? "Problem" : i.level === "warn" ? "Warning" : "Note") + ":</b> " + esc(i.text) + "</li>"; }).join("") + "</ul>" : "<p>None.</p>") +
      "<h2>Events</h2>" + (p.events.length ? "<table><thead><tr><th>Event</th><th>Status</th><th>Platforms</th><th>Last tested</th></tr></thead><tbody>" + p.events.map(function (e) {
        return "<tr><td>" + esc(e.name) + "</td><td>" + esc(statusLabel(e.status)) + "</td><td>" + esc(Object.keys(e.map).filter(function (k) { return e.map[k]; }).map(function (k) { var t = S.getTool(k); return (t ? t.short : k) + ": " + e.map[k]; }).join(" · ")) + "</td><td>" + fmtDate(e.lastTested) + "</td></tr>";
      }).join("") + "</tbody></table>" : "<p>No events.</p>") +
      (t7.rows ? "<h2>Numbers (last " + t7.rows + " entries)</h2><p>Orders " + fmtNum(t7.orders) + " · Revenue " + fmtMoney(t7.revenue, p.currency) + (t7.spend ? " · Ad spend " + fmtMoney(t7.spend, p.currency) + " · Blended ROAS " + fmtNum(t7.revenue / t7.spend, 2) + "×" : "") + "</p><ul>" +
        numberTools(p).map(function (nt) { var x = t7.per[nt.key]; return x ? "<li>" + esc(nt.tool.short) + ": captured " + pct(x.capture) + (x.spend ? ", ROAS " + fmtNum(x.roas, 2) + "×" : "") + "</li>" : ""; }).join("") + "</ul>" : "") +
      "<h2>Checklist</h2><p>" + checklistStats(p).done + " of " + checklistStats(p).total + " steps done.</p></article>";
  }

  /* ---------- modals ---------- */

  var modal = document.getElementById("modal");
  function openModal(title, body, wide) {
    modal.className = wide ? "wide" : "";
    modal.innerHTML = '<div class="modal-head"><h2>' + esc(title) + '</h2><button class="icon-btn" data-action="modal-close" title="Close">✕</button></div><div class="modal-body">' + body + "</div>";
    if (!modal.open) modal.showModal();
  }
  function closeModal() { if (modal.open) modal.close(); }
  modal.addEventListener("close", function () { modal.innerHTML = ""; });

  function showFix(key) {
    var f = D.FIXES[key];
    if (!f) return;
    openModal(f.title, '<ol class="fix-steps">' + f.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + '</ol><div class="btn-row"><button class="btn btn-primary" data-action="modal-close">Got it</button></div>');
  }

  function addToolModal() {
    var p = S.activeProject();
    var enabledBases = {};
    p.enabled.forEach(function (k) { enabledBases[S.baseKey(k)] = true; });
    var tools = S.allTools();
    var groups = {};
    tools.forEach(function (t) { (groups[t.category] = groups[t.category] || []).push(t); });
    var cats = Object.keys(groups).sort(function (a, b) { return (CAT_ORDER.indexOf(a) + 100) % 100 - (CAT_ORDER.indexOf(b) + 100) % 100; });
    openModal("Add a tool", '<input class="search" placeholder="Search tools… (e.g. pixel, server, tiktok)" data-action="tool-search" autofocus>' +
      cats.map(function (c) {
        return '<h3 class="cat-title">' + esc(c) + '</h3><div class="pick-list">' + groups[c].map(function (t) {
          var on = enabledBases[t.key];
          return '<div class="pick" data-search="' + esc((t.name + " " + t.short + " " + t.category + " " + t.what).toLowerCase()) + '">' + toolBadge(t) +
            '<div class="grow"><b>' + esc(t.name) + '</b><div class="muted small">' + esc(t.what.split(". ")[0]) + "</div></div>" +
            '<button class="btn btn-small' + (on ? "" : " btn-primary") + '" data-action="enable-tool" data-key="' + esc(t.key) + '">' + (on ? "Add another" : "Add") + "</button></div>";
        }).join("") + "</div>";
      }).join("") +
      '<div class="alert alert-info">Can\'t find your tool? <button class="link" data-action="custom-tool">Create your own tool</button> with any fields you like.</div>', true);
  }

  function customToolModal(key) {
    var t = key ? S.state.customTools.find(function (x) { return x.key === key; }) : null;
    t = t || { name: "", short: "", color: "#607d8b", category: "Other", what: "", why: "", fields: [{ key: "mainId", label: "ID", placeholder: "", help: "" }], links: [], checklist: [] };
    var fieldRows = (t.fields.length ? t.fields : [{}]).map(customFieldRow).join("");
    openModal(key ? "Edit your tool" : "Create your own tool",
      '<form data-form="custom-tool" data-key="' + esc(key || "") + '">' +
      '<div class="fields">' +
      '<div class="field"><label>Tool name *</label><input name="name" required value="' + esc(t.name) + '" placeholder="e.g. Triple Whale, Northbeam, my own server"></div>' +
      '<div class="field"><label>Short name</label><input name="short" value="' + esc(t.short) + '" placeholder="e.g. TW" maxlength="20"></div>' +
      '<div class="field"><label>Group</label><select name="category">' + CAT_ORDER.map(function (c) { return "<option" + (c === t.category ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>Colour</label><input type="color" name="color" value="' + esc(t.color) + '"></div>' +
      '<div class="field field-wide"><label>What is it? (plain words)</label><textarea name="what" rows="2" placeholder="e.g. Attribution tool that shows which ads really bring sales">' + esc(t.what) + "</textarea></div>" +
      '<div class="field field-wide"><label>Why do we use it?</label><textarea name="why" rows="2">' + esc(t.why) + "</textarea></div>" +
      '<div class="field field-wide"><label>Dashboard link</label><input name="link" value="' + esc(t.links[0] ? t.links[0].url : "") + '" placeholder="https://"></div>' +
      "</div>" +
      '<h3>Fields to fill in</h3><p class="muted small">Name each piece of information you want to keep: IDs, URLs, account emails… Tick “secret” for tokens/keys.</p>' +
      '<div id="customFields">' + fieldRows + "</div>" +
      '<button type="button" class="btn btn-small" data-action="custom-add-field">+ Add field</button>' +
      '<h3>Checklist steps (one per line)</h3><textarea name="checklist" rows="4" placeholder="Account created\nScript installed\nData arriving">' + esc(t.checklist.map(function (c) { return c.text; }).join("\n")) + "</textarea>" +
      '<div class="btn-row"><button class="btn btn-primary" type="submit">' + (key ? "Save changes" : "Create & add to this store") + '</button><button type="button" class="btn" data-action="modal-close">Cancel</button></div>' +
      "</form>", true);
  }
  function customFieldRow(f) {
    f = f || {};
    return '<div class="custom-field-row" data-fkey="' + esc(f.key || "") + '"><input data-cf="label" placeholder="Field name (e.g. Account ID)" value="' + esc(f.label || "") + '">' +
      '<input data-cf="placeholder" placeholder="Example value" value="' + esc(f.placeholder || "") + '">' +
      '<input data-cf="help" placeholder="Where to find it (optional)" value="' + esc(f.help || "") + '">' +
      '<label class="check small"><input type="checkbox" data-cf="sensitive"' + (f.sensitive ? " checked" : "") + "> secret</label>" +
      '<button type="button" class="icon-btn" data-action="custom-del-field" title="Remove">✕</button></div>';
  }

  function eventLibraryModal() {
    var p = S.activeProject();
    openModal("Add standard events", '<p class="muted">Pick the shopping actions you want to track. We fill in the correct name for each of your platforms automatically.</p>' +
      '<div class="pick-list">' + D.EVENT_LIBRARY.map(function (e, i) {
        var has = p.events.some(function (x) { return x.name === e.name; });
        return '<label class="pick"><input type="checkbox" name="lib" value="' + i + '"' + (has ? " disabled" : (e.step >= 3 && e.step !== 5 && e.step !== 7 && e.step !== 10 || e.step === 1 ? " checked" : "")) + '><div class="grow"><b>' + esc(e.name) + (has ? ' <span class="tag">already added</span>' : "") + '</b><div class="muted small">' + esc(e.plain) + "</div></div></label>";
      }).join("") + '</div><div class="btn-row"><button class="btn btn-primary" data-action="add-lib-events">Add selected</button></div>', true);
  }

  function eventModal(id) {
    var p = S.activeProject();
    var e = id ? p.events.find(function (x) { return x.id === id; }) : null;
    e = e || { name: "", trigger: "", params: "", map: {}, status: "none", server: false, dedup: "", lastTested: "", notes: "" };
    var dests = destinationsFor(p);
    openModal(id ? "Edit event" : "New event",
      '<form data-form="event" data-id="' + esc(id || "") + '"><div class="fields">' +
      '<div class="field"><label>Event name *</label><input name="name" required value="' + esc(e.name) + '" placeholder="e.g. Purchase"></div>' +
      '<div class="field"><label>When does it happen?</label><input name="trigger" value="' + esc(e.trigger) + '" placeholder="e.g. Thank-you page"></div>' +
      '<div class="field"><label>Status</label><select name="status">' + D.STATUSES.map(function (s) { return '<option value="' + s.key + '"' + (s.key === e.status ? " selected" : "") + ">" + esc(s.label) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label>Last tested</label><input type="date" name="lastTested" value="' + esc(e.lastTested) + '"></div>' +
      '<div class="field"><label class="check"><input type="checkbox" name="server"' + (e.server ? " checked" : "") + "> Also sent from the server (CAPI / Events API)</label></div>" +
      '<div class="field"><label>Deduplication confirmed?</label><select name="dedup">' + YES_NO_OPTS(e.dedup) + '</select><div class="help">Only matters if sent from browser AND server.</div></div>' +
      '<div class="field field-wide"><label>Data sent with it (parameters)</label><input name="params" value="' + esc(e.params) + '" placeholder="value, currency, transaction_id…"></div>' +
      "</div><h3>Name on each platform</h3><p class=\"muted small\">Leave empty if the event is not sent there.</p><div class=\"fields\">" +
      dests.map(function (d) { return '<div class="field"><label>' + esc(d.label) + '</label><input name="map_' + esc(d.key) + '" value="' + esc(e.map[d.key] || "") + '"></div>'; }).join("") +
      '</div><div class="field"><label>Notes</label><textarea name="notes" rows="2">' + esc(e.notes) + "</textarea></div>" +
      '<div class="btn-row"><button class="btn btn-primary" type="submit">Save</button><button type="button" class="btn" data-action="modal-close">Cancel</button></div></form>', true);
  }
  function YES_NO_OPTS(v) {
    return ["", "Yes", "No", "Not sure"].map(function (o) { return '<option value="' + o + '"' + (o === v ? " selected" : "") + ">" + (o || "– choose –") + "</option>"; }).join("");
  }

  function metricModal(id) {
    var p = S.activeProject();
    var m = id ? p.metrics.find(function (x) { return x.id === id; }) : null;
    m = m || { date: S.today(), shopOrders: "", shopRevenue: "", sessions: "", notes: "", platforms: {} };
    var nts = numberTools(p);
    openModal(id ? "Edit numbers" : "Add numbers",
      '<form data-form="metric" data-id="' + esc(id || "") + '">' +
      '<h3>From your shop (the truth)</h3><div class="fields">' +
      '<div class="field"><label>Date *</label><input type="date" name="date" required value="' + esc(m.date) + '"><div class="help">One row per day (or per week – just be consistent).</div></div>' +
      '<div class="field"><label>Orders</label><input inputmode="decimal" name="shopOrders" value="' + esc(m.shopOrders) + '" placeholder="e.g. 42"></div>' +
      '<div class="field"><label>Revenue (' + esc(p.currency) + ')</label><input inputmode="decimal" name="shopRevenue" value="' + esc(m.shopRevenue) + '" placeholder="e.g. 2350"></div>' +
      '<div class="field"><label>Sessions / visits (optional)</label><input inputmode="decimal" name="sessions" value="' + esc(m.sessions) + '" placeholder="from GA4 or shop analytics"></div>' +
      "</div>" +
      (nts.length ? '<h3>From each platform</h3><div class="table-wrap"><table class="input-table"><thead><tr><th>Platform</th><th>Purchases received <span class="hint" title="How many Purchase events the platform received (Events Manager / GA4 transactions). Used for the health check.">?</span></th><th>Ad spend</th><th>Purchases from ads <span class="hint" title="Conversions the ads manager credits to your ads.">?</span></th><th>Conv. value from ads</th></tr></thead><tbody>' +
        nts.map(function (nt) {
          var v = m.platforms[nt.key] || {};
          var isGa = nt.key === "ga4";
          return "<tr><td>" + toolBadge(nt.tool) + " " + esc(nt.tool.short || nt.tool.name) + "</td>" +
            '<td><input inputmode="decimal" name="' + nt.key + '__received" value="' + esc(v.received == null ? "" : v.received) + '"></td>' +
            (isGa ? '<td colspan="3" class="muted small">GA4 has no ad spend – only “purchases received” needed.</td>' :
              '<td><input inputmode="decimal" name="' + nt.key + '__spend" value="' + esc(v.spend == null ? "" : v.spend) + '"></td>' +
              '<td><input inputmode="decimal" name="' + nt.key + '__adPurchases" value="' + esc(v.adPurchases == null ? "" : v.adPurchases) + '"></td>' +
              '<td><input inputmode="decimal" name="' + nt.key + '__adRevenue" value="' + esc(v.adRevenue == null ? "" : v.adRevenue) + '"></td>') + "</tr>";
        }).join("") + "</tbody></table></div>" : "") +
      '<div class="field"><label>Notes (what changed?)</label><input name="notes" value="' + esc(m.notes) + '" placeholder="e.g. Sale started, new app installed"></div>' +
      '<div class="btn-row"><button class="btn btn-primary" type="submit">Save</button><button type="button" class="btn" data-action="modal-close">Cancel</button></div></form>', true);
  }

  /* ---------- actions ---------- */

  function enableTool(base) {
    var p = S.activeProject();
    var inst = S.nextInstanceKey(p, base);
    p.platforms[inst] = S.emptyPlatform();
    p.enabled.push(inst);
    S.addLog(p, "Added " + S.instanceLabel(p, inst), inst);
    closeModal();
    commit(false);
    location.hash = "#/tool/" + encodeURIComponent(inst);
    render();
  }

  function addProject(name, url) {
    var p = S.newProject(name, url);
    S.addLog(p, "Store created");
    S.state.projects.push(p);
    S.state.activeProjectId = p.id;
    commit(false);
    location.hash = "#/tools";
    render();
    toast("Store created. Fill in the IDs for each tool.");
  }

  function csvCell(v) {
    var s = String(v == null ? "" : v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(rows) { return "﻿" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n"); }

  function stripSecrets(projects) {
    return projects.map(function (p) {
      var c = JSON.parse(JSON.stringify(p));
      Object.keys(c.platforms).forEach(function (inst) {
        var t = S.getTool(inst);
        if (!t) return;
        t.fields.forEach(function (f) { if (f.sensitive && c.platforms[inst].fields[f.key]) c.platforms[inst].fields[f.key] = ""; });
      });
      return c;
    });
  }

  function exportData(onlyActive) {
    var include = document.getElementById("includeSecrets") && document.getElementById("includeSecrets").checked;
    var st = S.state;
    var projects = onlyActive ? [S.activeProject()] : st.projects;
    var data = { app: "tracking-health-hub", version: 1, exportedAt: new Date().toISOString(), customTools: st.customTools, projects: include ? projects : stripSecrets(projects) };
    download("tracking-hub-" + (onlyActive ? slug(projects[0].name) : "backup") + "-" + S.today() + ".json", JSON.stringify(data, null, 2));
    toast(include ? "Exported (with secrets – keep the file safe!)" : "Exported (secret tokens removed)");
  }

  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.projects)) throw new Error("not a backup");
        var st = S.state;
        (data.customTools || []).forEach(function (t) {
          var i = st.customTools.findIndex(function (x) { return x.key === t.key; });
          if (i >= 0) st.customTools[i] = t; else st.customTools.push(t);
        });
        data.projects.forEach(function (p) {
          var i = st.projects.findIndex(function (x) { return x.id === p.id; });
          if (i >= 0) st.projects[i] = p; else st.projects.push(p);
        });
        if (!st.activeProjectId && data.projects[0]) st.activeProjectId = data.projects[0].id;
        S.replaceState(st);
        render();
        toast("Imported " + data.projects.length + " store(s).");
      } catch (e) {
        alert("Sorry, this file could not be read. Choose a .json backup made by this app.");
      }
    };
    reader.readAsText(file);
  }

  document.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-action]");
    if (!el) {
      if (ev.target === modal) closeModal();
      return;
    }
    var a = el.getAttribute("data-action");
    var p = S.activeProject();
    var d = el.dataset;
    switch (a) {
      case "modal-close": closeModal(); break;
      case "show-fix": showFix(d.fix); break;
      case "load-demo":
        var demo = S.demoProject();
        S.state.projects.push(demo);
        S.state.activeProjectId = demo.id;
        commit(false);
        location.hash = "#/dashboard";
        render();
        toast("Demo store loaded. Delete it any time in Store settings.");
        break;
      case "toggle-check":
        if (el.checked) p.checklist[d.key] = true; else delete p.checklist[d.key];
        commit();
        break;
      case "set-status":
        var rec = p.platforms[d.inst];
        if (rec.status !== d.status) {
          rec.status = d.status;
          if (d.status === "live") rec.lastChecked = S.today();
          S.addLog(p, S.instanceLabel(p, d.inst) + ": status → " + statusLabel(d.status), d.inst);
          commit();
        }
        break;
      case "checked-today":
        p.platforms[d.inst].lastChecked = S.today();
        S.addLog(p, S.instanceLabel(p, d.inst) + " checked", d.inst);
        commit();
        toast("Marked as checked today");
        break;
      case "reveal":
        var inp = document.getElementById(d.target);
        inp.type = inp.type === "password" ? "text" : "password";
        break;
      case "copy":
        var src = document.getElementById(d.target);
        if (!src.value) { toast("Nothing to copy"); break; }
        (navigator.clipboard ? navigator.clipboard.writeText(src.value) : Promise.reject()).then(function () { toast("Copied"); }, function () {
          src.type = "text"; src.select(); document.execCommand("copy"); toast("Copied");
        });
        break;
      case "add-extra":
        p.platforms[d.inst].extras.push({ label: "", value: "" });
        commit();
        break;
      case "del-extra":
        p.platforms[d.inst].extras.splice(+d.index, 1);
        commit();
        break;
      case "add-tool": addToolModal(); break;
      case "enable-tool": enableTool(d.key); break;
      case "add-copy": enableTool(d.base); break;
      case "remove-tool":
        if (!confirm("Remove " + S.instanceLabel(p, d.inst) + " from this store? Its saved IDs and notes will be deleted.")) break;
        S.addLog(p, "Removed " + S.instanceLabel(p, d.inst), "");
        p.enabled = p.enabled.filter(function (k) { return k !== d.inst; });
        delete p.platforms[d.inst];
        Object.keys(p.checklist).forEach(function (k) { if (k.indexOf(d.inst + "|") === 0) delete p.checklist[k]; });
        commit(false);
        location.hash = "#/tools";
        render();
        break;
      case "custom-tool": customToolModal(d.key); break;
      case "custom-add-field": document.getElementById("customFields").insertAdjacentHTML("beforeend", customFieldRow()); break;
      case "custom-del-field": el.closest(".custom-field-row").remove(); break;
      case "delete-custom":
        var used = S.state.projects.filter(function (pr) { return pr.enabled.some(function (k) { return S.baseKey(k) === d.key; }); }).length;
        if (!confirm("Delete this tool type?" + (used ? " It is used in " + used + " store(s) and will disappear from them." : ""))) break;
        S.state.customTools = S.state.customTools.filter(function (t) { return t.key !== d.key; });
        S.state.projects.forEach(function (pr) {
          pr.enabled = pr.enabled.filter(function (k) { return S.baseKey(k) !== d.key; });
          Object.keys(pr.platforms).forEach(function (k) { if (S.baseKey(k) === d.key) delete pr.platforms[k]; });
        });
        commit();
        break;
      case "event-library": eventLibraryModal(); break;
      case "add-lib-events":
        var dests = destinationsFor(p).map(function (x) { return x.key; });
        var added = 0;
        modal.querySelectorAll('input[name="lib"]:checked:not(:disabled)').forEach(function (cb) {
          var lib = D.EVENT_LIBRARY[+cb.value];
          var map = {};
          dests.forEach(function (k) { if (lib.map[k]) map[k] = lib.map[k]; });
          p.events.push({ id: S.uid(), name: lib.name, trigger: lib.trigger, params: lib.params, map: map, status: "none", server: false, dedup: "", lastTested: "", notes: "" });
          added++;
        });
        p.events.sort(function (x, y) {
          var a1 = D.EVENT_LIBRARY.find(function (l) { return l.name === x.name; }), b1 = D.EVENT_LIBRARY.find(function (l) { return l.name === y.name; });
          return (a1 ? a1.step || 50 : 99) - (b1 ? b1.step || 50 : 99);
        });
        if (added) S.addLog(p, "Added " + added + " standard event(s)");
        closeModal();
        commit();
        break;
      case "edit-event": eventModal(d.id); break;
      case "del-event":
        var e = p.events.find(function (x) { return x.id === d.id; });
        if (e && confirm("Delete event '" + e.name + "'?")) { p.events = p.events.filter(function (x) { return x.id !== d.id; }); commit(); }
        break;
      case "edit-metric": metricModal(d.id); break;
      case "del-metric":
        if (confirm("Delete this row of numbers?")) { p.metrics = p.metrics.filter(function (x) { return x.id !== d.id; }); commit(); }
        break;
      case "del-scan":
        p.scans = p.scans.filter(function (x) { return x.id !== d.id; });
        commit();
        break;
      case "del-log":
        p.log = p.log.filter(function (x) { return x.id !== d.id; });
        commit();
        break;
      case "switch-project":
        S.state.activeProjectId = d.id;
        commit(false);
        location.hash = "#/dashboard";
        render();
        break;
      case "delete-project":
        if (!confirm("Delete the store '" + p.name + "' and ALL its data? This cannot be undone (unless you have a backup).")) break;
        S.state.projects = S.state.projects.filter(function (x) { return x.id !== p.id; });
        S.state.activeProjectId = S.state.projects[0] ? S.state.projects[0].id : null;
        commit(false);
        location.hash = "#/dashboard";
        render();
        break;
      case "export-all": exportData(false); break;
      case "export-project": exportData(true); break;
      case "export-csv-ids":
        var rows = [["Store", "Tool", "Status", "Field", "Value", "Last checked", "Owner"]];
        projectTools(p).forEach(function (x) {
          x.tool.fields.forEach(function (f) {
            if (f.sensitive) return;
            if (x.rec.fields[f.key]) rows.push([p.name, S.instanceLabel(p, x.inst), statusLabel(x.rec.status), f.label, x.rec.fields[f.key], x.rec.lastChecked, x.rec.owner]);
          });
          x.rec.extras.forEach(function (e) { if (e.label || e.value) rows.push([p.name, S.instanceLabel(p, x.inst), statusLabel(x.rec.status), e.label, e.value, x.rec.lastChecked, x.rec.owner]); });
        });
        download(slug(p.name) + "-tool-ids.csv", toCsv(rows), "text/csv");
        break;
      case "export-csv-events":
        var dk = destinationsFor(p);
        var er = [["Event", "When", "Status", "Server-side", "Dedup", "Last tested", "Parameters"].concat(dk.map(function (x) { return x.label; }))];
        p.events.forEach(function (e) { er.push([e.name, e.trigger, statusLabel(e.status), e.server ? "Yes" : "No", e.dedup, e.lastTested, e.params].concat(dk.map(function (x) { return e.map[x.key] || ""; }))); });
        download(slug(p.name) + "-events.csv", toCsv(er), "text/csv");
        break;
      case "export-csv-numbers":
        var nt = numberTools(p);
        var head = ["Date", "Shop orders", "Shop revenue", "Sessions", "Notes"];
        nt.forEach(function (n) { var s = n.tool.short || n.tool.name; head.push(s + " received", s + " spend", s + " ad purchases", s + " ad revenue"); });
        var nr = [head];
        sortedMetrics(p).forEach(function (m) {
          var r = [m.date, m.shopOrders, m.shopRevenue, m.sessions, m.notes];
          nt.forEach(function (n) { var v = m.platforms[n.key] || {}; r.push(v.received, v.spend, v.adPurchases, v.adRevenue); });
          nr.push(r);
        });
        download(slug(p.name) + "-numbers.csv", toCsv(nr), "text/csv");
        break;
      case "reset-all":
        if (!confirm("Delete ALL stores and settings from this browser? Export a backup first if you want to keep anything.")) break;
        if (!confirm("Are you really sure? This cannot be undone.")) break;
        S.replaceState(null);
        location.hash = "#/dashboard";
        render();
        break;
      case "print": window.print(); break;
      case "menu": document.body.classList.toggle("nav-open"); break;
    }
  });

  /* Typing in fields: save without re-rendering (keeps cursor position). */
  document.addEventListener("input", function (ev) {
    var el = ev.target;
    var a = el.getAttribute("data-action");
    if (a === "glossary-search") {
      var q = el.value.toLowerCase();
      document.querySelectorAll(".gl-item").forEach(function (g) { g.style.display = g.dataset.term.indexOf(q) >= 0 ? "" : "none"; });
      return;
    }
    if (a === "tool-search") {
      var q2 = el.value.toLowerCase();
      modal.querySelectorAll(".pick").forEach(function (g) { g.style.display = g.dataset.search.indexOf(q2) >= 0 ? "" : "none"; });
      return;
    }
    if (a === "global-search") { globalSearch(el.value); return; }
    if (el.tagName === "SELECT" || el.type === "checkbox") return; // handled on change
    bindValue(el, false);
  });
  document.addEventListener("change", function (ev) {
    var el = ev.target;
    if (el.id === "importFile" && el.files[0]) { importFile(el.files[0]); el.value = ""; return; }
    if (el.id === "projectSelect") {
      if (el.value === "__new") { location.hash = "#/stores"; render(); setTimeout(function () { var i = document.querySelector('[data-form="new-project"] input'); if (i) i.focus(); }, 50); return; }
      S.state.activeProjectId = el.value;
      commit();
      return;
    }
    if (el.tagName === "SELECT" || el.type === "checkbox") bindValue(el, true);
  });

  function bindValue(el, rerender) {
    var b = el.getAttribute("data-bind");
    if (!b) return;
    var p = S.activeProject();
    var key = el.dataset.key;
    var val = el.type === "checkbox" ? el.checked : el.value;
    if (b === "field") {
      var tool = S.getTool(el.dataset.inst);
      p.platforms[el.dataset.inst].fields[key] = val;
      var f = tool.fields.find(function (x) { return x.key === key; });
      var w = document.querySelector('[data-warn="' + key + '"]');
      if (w && f) w.textContent = fieldWarning(f, val);
      commit(false);
    } else if (b === "rec") {
      p.platforms[el.dataset.inst][key] = val;
      commit(false);
    } else if (b === "extra") {
      p.platforms[el.dataset.inst].extras[+el.dataset.index][el.dataset.part] = val;
      commit(false);
    } else if (b === "project") {
      p[key] = key === "currency" ? String(val).toUpperCase().slice(0, 3) : val;
      commit(false);
      if (key === "name") renderNav(route().name);
    } else if (b === "setting") {
      S.state.settings[key] = val;
      commit(rerender);
    }
  }

  function globalSearch(q) {
    var out = document.getElementById("searchResults");
    q = q.trim().toLowerCase();
    if (q.length < 2) { out.innerHTML = ""; return; }
    var res = [];
    S.state.projects.forEach(function (p) {
      p.enabled.forEach(function (inst) {
        var t = S.getTool(inst), rec = p.platforms[inst];
        if (!t || !rec) return;
        t.fields.forEach(function (f) {
          if (!f.sensitive && rec.fields[f.key] && String(rec.fields[f.key]).toLowerCase().indexOf(q) >= 0) res.push({ p: p, inst: inst, label: f.label, value: rec.fields[f.key] });
        });
        rec.extras.forEach(function (e) { if (String(e.value).toLowerCase().indexOf(q) >= 0) res.push({ p: p, inst: inst, label: e.label, value: e.value }); });
      });
    });
    out.innerHTML = res.length ? '<ul class="plain">' + res.slice(0, 50).map(function (r) {
      return "<li><b>" + esc(r.p.name) + "</b> · " + esc(S.instanceLabel(r.p, r.inst)) + " · " + esc(r.label) + ': <span class="mono">' + esc(r.value) + '</span> <button class="link" data-action="switch-project" data-id="' + esc(r.p.id) + '">open store</button></li>';
    }).join("") + "</ul>" : '<p class="muted small">Not found in any store.</p>';
  }

  document.addEventListener("submit", function (ev) {
    var form = ev.target;
    var kind = form.getAttribute("data-form");
    if (!kind) return;
    ev.preventDefault();
    var fd = new FormData(form);
    var p = S.activeProject();
    if (kind === "new-project") {
      addProject(fd.get("name").trim(), (fd.get("url") || "").trim());
    } else if (kind === "log") {
      S.addLog(p, fd.get("text").trim(), fd.get("platform"));
      commit();
    } else if (kind === "event") {
      var id = form.dataset.id;
      var e = id ? p.events.find(function (x) { return x.id === id; }) : null;
      var isNew = !e;
      e = e || { id: S.uid(), map: {} };
      var oldStatus = e.status;
      e.name = fd.get("name").trim();
      e.trigger = fd.get("trigger");
      e.status = fd.get("status");
      e.lastTested = fd.get("lastTested");
      e.server = !!fd.get("server");
      e.dedup = fd.get("dedup");
      e.params = fd.get("params");
      e.notes = fd.get("notes");
      destinationsFor(p).forEach(function (d) {
        var v = (fd.get("map_" + d.key) || "").trim();
        if (v) e.map[d.key] = v; else delete e.map[d.key];
      });
      if (isNew) { p.events.push(e); S.addLog(p, "Event added: " + e.name); }
      else if (oldStatus !== e.status) S.addLog(p, "Event '" + e.name + "': status → " + statusLabel(e.status));
      closeModal();
      commit();
    } else if (kind === "metric") {
      var mid = form.dataset.id;
      var m = mid ? p.metrics.find(function (x) { return x.id === mid; }) : null;
      m = m || { id: S.uid(), platforms: {} };
      m.date = fd.get("date");
      m.shopOrders = fd.get("shopOrders").trim();
      m.shopRevenue = fd.get("shopRevenue").trim();
      m.sessions = fd.get("sessions").trim();
      m.notes = fd.get("notes");
      numberTools(p).forEach(function (nt) {
        var v = m.platforms[nt.key] = m.platforms[nt.key] || {};
        ["received", "spend", "adPurchases", "adRevenue"].forEach(function (k) {
          if (fd.has(nt.key + "__" + k)) v[k] = String(fd.get(nt.key + "__" + k)).trim();
        });
      });
      if (!mid) p.metrics.push(m);
      closeModal();
      commit();
    } else if (kind === "custom-tool") {
      var key = form.dataset.key;
      var st = S.state;
      var t = key ? st.customTools.find(function (x) { return x.key === key; }) : null;
      var isNewTool = !t;
      t = t || { key: "c_" + S.uid(), custom: true, optional: true };
      t.name = fd.get("name").trim();
      t.short = (fd.get("short") || "").trim() || t.name;
      t.category = fd.get("category");
      t.color = fd.get("color");
      t.what = fd.get("what").trim();
      t.why = fd.get("why").trim();
      var link = (fd.get("link") || "").trim();
      t.links = link ? [{ label: "Open " + t.short, url: /^https?:\/\//.test(link) ? link : "https://" + link }] : [];
      var usedKeys = {};
      t.fields = [];
      form.querySelectorAll(".custom-field-row").forEach(function (row, i) {
        var label = row.querySelector('[data-cf="label"]').value.trim();
        if (!label) return;
        var fk = row.dataset.fkey || ("f" + i + "_" + label.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16));
        while (usedKeys[fk]) fk += "_";
        usedKeys[fk] = true;
        t.fields.push({ key: fk, label: label, placeholder: row.querySelector('[data-cf="placeholder"]').value.trim(), help: row.querySelector('[data-cf="help"]').value.trim(), sensitive: row.querySelector('[data-cf="sensitive"]').checked });
      });
      t.checklist = String(fd.get("checklist") || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean).map(function (text, i) {
        return { id: "s" + i + "_" + text.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20), text: text, help: "" };
      });
      if (isNewTool) st.customTools.push(t);
      closeModal();
      if (isNewTool && p) { enableTool(t.key); toast("Your tool was created and added."); }
      else commit();
    }
  });

  /* ---------- theme ---------- */
  function applyTheme() {
    var t = S.state.settings.theme;
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }

  /* ---------- start ---------- */
  document.getElementById("menuBtn").addEventListener("click", function () { document.body.classList.toggle("nav-open"); });
  window.addEventListener("hashchange", function () { closeModal(); render(); window.scrollTo(0, 0); });
  window.addEventListener("storage", function (e) {
    // Another tab changed the data.
    if (e.key === S.STORAGE_KEY && e.newValue) { try { S.replaceState(JSON.parse(e.newValue)); render(); } catch (x) { /* ignore */ } }
  });
  render();
})();
