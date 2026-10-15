/*
 * Live scan engine.
 * 1. detect()      – recognises tracking requests (Meta, GA4, TikTok…) from a URL + body.
 * 2. analyzeScan() – compares what was found on a page with what you saved in the hub
 *                    and returns plain-language problems.
 * Used by the Chrome extension (background + popup) and by the dashboard.
 */
(function (root) {
  "use strict";

  var D = root.TT_DATA;

  /* Which saved field holds the "main ID" for each tool. */
  var ID_FIELD = {
    gtm: "containerId", ga4: "measurementId", gads: "conversionId", meta: "pixelId",
    tiktok: "pixelId", clarity: "projectId", msads: "uetId", pinterest: "tagId", snapchat: "pixelId"
  };

  /* Events that should normally fire only once per page load. */
  var ONCE_PER_PAGE = /^(pageview|page_view|purchase|completepayment|checkout)$/i;
  var PURCHASE = /^(purchase|completepayment|checkout|conversion)$/i;

  function parseParams(text) {
    var out = {};
    if (!text) return out;
    String(text).split("&").forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf("=");
      var k = i < 0 ? pair : pair.slice(0, i);
      var v = i < 0 ? "" : pair.slice(i + 1);
      try { k = decodeURIComponent(k.replace(/\+/g, " ")); v = decodeURIComponent(v.replace(/\+/g, " ")); } catch (e) { /* keep raw */ }
      if (!(k in out)) out[k] = v;
    });
    return out;
  }

  function hostOf(url) {
    try { return new URL(url).hostname.toLowerCase(); } catch (e) { return ""; }
  }

  function isGoogleHost(h) {
    return /(^|\.)(google-analytics\.com|googletagmanager\.com|google\.com|doubleclick\.net|googleadservices\.com|analytics\.google\.com)$/.test(h);
  }

  /*
   * Returns a list of hits: { tool, label, id, event, eid, host, server }.
   * body: optional request body as text (POST requests).
   */
  function detect(url, body) {
    var hits = [];
    if (!url || /^(chrome|chrome-extension|data|blob|about):/.test(url)) return hits;
    var host = hostOf(url);
    var qIndex = url.indexOf("?");
    var query = parseParams(qIndex >= 0 ? url.slice(qIndex + 1) : "");

    // GA4 sent to a NON-Google domain = server-side tagging (sGTM / Stape).
    if (/\/g\/collect/.test(url) && host && !isGoogleHost(host)) {
      ga4Events(query, body).forEach(function (en) {
        hits.push({ tool: "sgtm", label: "Server-side GTM (first-party)", id: query.tid || "", event: en || "hit", eid: "", host: host, server: true });
      });
      return hits;
    }

    for (var i = 0; i < D.DETECTORS.length; i++) {
      var r = D.DETECTORS[i];
      if (!r.match.test(url)) continue;
      var bodyParams = body && body.charAt(0) !== "{" ? parseParams(body.split("\n")[0]) : {};
      var id = query[r.idParam] || bodyParams[r.idParam] || "";
      if (!id && r.idFromPath) {
        var m = url.match(r.idFromPath);
        if (m) id = m[1];
      }
      if (id && r.idPrefix && id.indexOf(r.idPrefix) !== 0) id = r.idPrefix + id;

      if (r.tool === "ga4" && r.eventParam) {
        ga4Events(query, body).forEach(function (en) {
          hits.push({ tool: "ga4", label: r.label, id: id, event: en || "hit", eid: "", host: host });
        });
        break;
      }

      if (r.bodyId && body && body.charAt(0) === "{") {
        // TikTok sends JSON bodies (sometimes batches of events).
        var codes = body.match(/"(?:code|pixel_code)"\s*:\s*"([A-Za-z0-9]{10,30})"/);
        var evs = body.match(/"event"\s*:\s*"([A-Za-z_]+)"/g) || [];
        var eids = body.match(/"event_id"\s*:\s*"([^"]*)"/);
        if (!evs.length) evs = ['"event":"' + (r.eventName || "hit") + '"'];
        evs.forEach(function (e) {
          hits.push({ tool: r.tool, label: r.label, id: codes ? codes[1] : id, event: e.replace(/.*"([^"]+)"$/, "$1"), eid: eids ? eids[1] : "", host: host });
        });
        break;
      }

      var ev = (r.eventParam && (query[r.eventParam] || bodyParams[r.eventParam])) || r.eventName || r.eventFallback || "hit";
      var eid = r.dedupParam ? (query[r.dedupParam] || bodyParams[r.dedupParam] || "") : "";
      hits.push({ tool: r.tool, label: r.label, id: id, event: ev, eid: eid, host: host });
      break;
    }
    return hits;
  }

  function ga4Events(query, body) {
    // GA4 can batch several events in the POST body, one per line.
    var list = [];
    if (body && body.charAt(0) !== "{") {
      body.split("\n").forEach(function (line) {
        var p = parseParams(line);
        if (p.en) list.push(p.en);
      });
    }
    if (!list.length) list.push(query.en || "");
    return list;
  }

  /* Merge identical hits and count them. */
  function summarize(hits) {
    var map = {};
    var out = [];
    (hits || []).forEach(function (h) {
      var k = [h.tool, h.id, h.event].join("|");
      if (!map[k]) {
        map[k] = Object.assign({}, h, { count: 0, eids: [] });
        out.push(map[k]);
      }
      map[k].count++;
      if (h.eid && map[k].eids.indexOf(h.eid) < 0) map[k].eids.push(h.eid);
    });
    return out;
  }

  function norm(v) {
    return String(v || "").trim().toUpperCase();
  }

  /*
   * Compare a scan with the saved setup of a project.
   * Returns [{ level: "bad"|"warn"|"info"|"ok", tool, text, fix }]
   */
  function analyzeScan(scan, project, getTool) {
    var results = [];
    var hits = summarize(scan.hits);
    var byTool = {};
    hits.forEach(function (h) { (byTool[h.tool] = byTool[h.tool] || []).push(h); });
    var isPurchasePage = /thank|order-received|orders?\/|checkouts?\/.*(thank|complete)|success|confirmation/i.test(scan.url || "") ||
      hits.some(function (h) { return PURCHASE.test(h.event); });

    var detectable = {};
    D.DETECTORS.forEach(function (r) { detectable[r.tool] = true; });

    var enabled = project ? project.enabled : [];
    var serverHosts = [];

    enabled.forEach(function (inst) {
      var base = String(inst).split("~")[0];
      var rec = project.platforms[inst] || { fields: {} };
      var tool = getTool ? getTool(inst) : null;
      var name = tool ? tool.short || tool.name : base;
      ["taggingUrl", "customDomain", "stapeUrl", "serverUrl"].forEach(function (f) {
        var h = hostOf(rec.fields[f] || "");
        if (h) serverHosts.push(h);
      });
      if (!detectable[base]) return;
      var saved = norm(rec.fields[ID_FIELD[base] || "mainId"]);
      var found = byTool[base] || [];
      if (!found.length) {
        if (saved || rec.status === "live") {
          results.push({ level: "bad", tool: inst, text: name + " was NOT found on this page.", fix: "notInstalled" });
        }
        return;
      }
      var ids = [];
      found.forEach(function (h) { if (h.id && ids.indexOf(norm(h.id)) < 0) ids.push(norm(h.id)); });
      if (saved && ids.length && ids.indexOf(saved) < 0) {
        results.push({ level: "bad", tool: inst, text: name + ": the website uses ID " + ids.join(", ") + " but you saved " + saved + ".", fix: "wrongId" });
      } else {
        results.push({ level: "ok", tool: inst, text: name + " is active" + (ids.length ? " (" + ids.join(", ") + ")" : "") + ".", fix: "" });
      }
    });

    // IDs / tools on the site that are not in the hub at all.
    Object.keys(byTool).forEach(function (base) {
      if (base === "sgtm") return;
      var savedIds = [];
      var known = enabled.some(function (inst) {
        if (String(inst).split("~")[0] !== base) return false;
        var v = norm((project.platforms[inst] || { fields: {} }).fields[ID_FIELD[base] || "mainId"]);
        if (v) savedIds.push(v);
        return true;
      });
      var label = byTool[base][0].label;
      if (!known) {
        results.push({ level: "info", tool: base, text: label + " was found on the site but is not in your hub yet.", fix: "" });
        return;
      }
      var extra = [];
      byTool[base].forEach(function (h) { var v = norm(h.id); if (v && savedIds.length && savedIds.indexOf(v) < 0 && extra.indexOf(v) < 0) extra.push(v); });
      if (extra.length && savedIds.length && byTool[base].some(function (h) { return savedIds.indexOf(norm(h.id)) >= 0; })) {
        results.push({ level: "warn", tool: base, text: label + ": an extra/unknown ID is also firing: " + extra.join(", ") + ". Old pixel or second installation?", fix: "wrongId" });
      }
    });

    // Double firing.
    hits.forEach(function (h) {
      if (h.count > 1 && ONCE_PER_PAGE.test(h.event) && h.tool !== "sgtm" && h.eids.length !== 1) {
        results.push({ level: "bad", tool: h.tool, text: h.label + ": '" + h.event + "' fired " + h.count + " times on one page – likely double counting.", fix: "duplicate" });
      }
    });

    // Purchase page checks.
    if (isPurchasePage) {
      ["ga4", "meta", "tiktok", "gads"].forEach(function (base) {
        if (enabled.indexOf(base) < 0) return;
        var hasPurchase = (byTool[base] || []).some(function (h) { return PURCHASE.test(h.event) || (base === "gads" && h.event !== "remarketing / page view" && h.event !== "tag loaded"); });
        if (!hasPurchase) results.push({ level: "bad", tool: base, text: (getTool && getTool(base) ? getTool(base).short : base) + ": no Purchase event seen on what looks like an order confirmation page.", fix: "noPurchase" });
      });
      (byTool.meta || []).forEach(function (h) {
        if (PURCHASE.test(h.event) && !h.eids.length && enabled.some(function (i) { return /^(sgtm|stape)/.test(i); })) {
          results.push({ level: "warn", tool: "meta", text: "Meta Purchase has no event_id, so it cannot be deduplicated with server (CAPI) events.", fix: "noDedup" });
        }
      });
    }

    // Server-side traffic.
    var serverHit = (byTool.sgtm || []).length || (scan.hits || []).some(function (h) { return h.host && serverHosts.indexOf(h.host) >= 0; });
    var wantsServer = enabled.some(function (i) { return /^(sgtm|stape|addingwell|taggrs|cloudrun)/.test(i); });
    if (wantsServer) {
      if (serverHit) results.push({ level: "ok", tool: "sgtm", text: "Server-side tracking: data is being sent to your server container.", fix: "" });
      else results.push({ level: "warn", tool: "sgtm", text: "Server-side tracking: no request to your server container was seen on this page.", fix: "notInstalled" });
    }

    var order = { bad: 0, warn: 1, info: 2, ok: 3 };
    results.sort(function (a, b) { return order[a.level] - order[b.level]; });
    return results;
  }

  root.TT_SCAN = { detect: detect, summarize: summarize, analyzeScan: analyzeScan, hostOf: hostOf, ID_FIELD: ID_FIELD };
})(typeof window !== "undefined" ? window : self);
