/*
 * Ad performance analysis: decides which ads are winners and which lose
 * money, and explains why in plain words. Also imports CSV reports exported
 * from Meta Ads Manager, TikTok Ads Manager and Google Ads.
 */
(function () {
  "use strict";

  var VERDICTS = {
    winner: { label: "Winner", level: "ok", action: "Scale it: raise the budget 15–20% every 2–3 days while ROAS stays high. Make variations of this ad." },
    ok: { label: "Profitable", level: "ok", action: "Keep it running. Test 1–2 new creatives next to it to find the next winner." },
    watch: { label: "Watch", level: "warn", action: "Close to break-even. Give it a few more days, or try a new hook/first 3 seconds, before deciding." },
    losing: { label: "Losing money", level: "bad", action: "Pause it or change it (new creative, new audience or better offer). Move the budget to your winners." },
    early: { label: "Too early", level: "info", action: "Not enough spend yet to judge. Wait until it has spent at least your 'minimum spend' setting." }
  };

  var DEFAULT_TARGETS = { breakevenRoas: 1.5, targetRoas: 3, minSpend: 20 };

  function n(v) { return isFinite(v) ? v : 0; }

  function analyzeAds(ads, targets) {
    var t = Object.assign({}, DEFAULT_TARGETS, targets || {});
    var be = parseFloat(t.breakevenRoas) || DEFAULT_TARGETS.breakevenRoas;
    var target = Math.max(parseFloat(t.targetRoas) || DEFAULT_TARGETS.targetRoas, be);
    var minSpend = parseFloat(t.minSpend);
    if (!isFinite(minSpend)) minSpend = DEFAULT_TARGETS.minSpend;

    // Averages per platform, to compare each ad with its neighbours.
    var avg = {};
    ads.forEach(function (a) {
      var x = avg[a.platform] = avg[a.platform] || { spend: 0, purchases: 0, clicks: 0, impressions: 0 };
      x.spend += n(a.spend); x.purchases += n(a.purchases); x.clicks += n(a.clicks); x.impressions += n(a.impressions);
    });
    Object.keys(avg).forEach(function (k) {
      var x = avg[k];
      x.cpa = x.purchases ? x.spend / x.purchases : null;
      x.cpc = x.clicks ? x.spend / x.clicks : null;
      x.ctr = x.impressions ? x.clicks / x.impressions : null;
    });

    var rows = ads.map(function (a) {
      var r = Object.assign({}, a);
      r.roas = r.spend ? n(r.revenue) / r.spend : null;
      r.cpa = r.purchases ? r.spend / r.purchases : null;
      r.ctr = r.impressions ? n(r.clicks) / r.impressions : null;
      r.cpc = r.clicks ? r.spend / r.clicks : null;
      r.cpm = r.impressions ? r.spend / r.impressions * 1000 : null;
      var a0 = avg[r.platform];
      var reasons = [];

      if (r.spend < minSpend) r.verdict = "early";
      else if (!r.purchases) r.verdict = r.spend >= minSpend * 2 ? "losing" : "watch";
      else if (r.roas >= target) r.verdict = "winner";
      else if (r.roas >= be) r.verdict = "ok";
      else if (r.roas >= be * 0.7) r.verdict = "watch";
      else r.verdict = "losing";

      if (r.verdict === "losing" && !r.purchases) reasons.push("Spent " + r.spend.toFixed(0) + " and got no purchases.");
      else if (r.roas != null && r.purchases) {
        if (r.roas >= target) reasons.push("ROAS " + r.roas.toFixed(2) + "× is above your target of " + target + "×.");
        else if (r.roas < be) reasons.push("ROAS " + r.roas.toFixed(2) + "× is below break-even (" + be + "×) – you lose money on each sale.");
      }
      var lowCtr = r.platform === "meta" ? 0.008 : r.platform === "tiktok" ? 0.007 : null;
      if (lowCtr && r.ctr != null && r.impressions > 1000 && r.ctr < lowCtr) {
        reasons.push("Low click rate (" + (r.ctr * 100).toFixed(2) + "%): the image/video doesn't grab attention. Try a stronger hook in the first 3 seconds.");
      }
      if (r.ctr != null && r.clicks >= 30 && !r.purchases && r.ctr >= (lowCtr || 0.01) * 1.5) {
        reasons.push("People click but don't buy: check the product page, price, shipping cost and page speed.");
      }
      if (r.frequency && r.frequency > 3.5) reasons.push("Frequency " + r.frequency.toFixed(1) + ": the same people saw it many times (ad fatigue). Refresh the creative or widen the audience.");
      if (a0 && a0.cpa && r.cpa && r.cpa > a0.cpa * 1.5 && r.spend >= minSpend) reasons.push("Each sale costs " + Math.round((r.cpa / a0.cpa - 1) * 100) + "% more than your average on this platform.");
      if (a0 && a0.cpc && r.cpc && r.cpc > a0.cpc * 2 && r.clicks >= 20) reasons.push("Clicks are twice as expensive as average – audience may be too narrow or competitive.");
      if (r.verdict === "early") reasons.push("Only " + r.spend.toFixed(0) + " spent – minimum to judge is " + minSpend + ".");
      r.reasons = reasons;
      r.action = VERDICTS[r.verdict].action;
      return r;
    });

    var sum = { spend: 0, revenue: 0, purchases: 0, byVerdict: {}, byPlatform: {} };
    rows.forEach(function (r) {
      sum.spend += n(r.spend); sum.revenue += n(r.revenue); sum.purchases += n(r.purchases);
      var v = sum.byVerdict[r.verdict] = sum.byVerdict[r.verdict] || { count: 0, spend: 0, revenue: 0 };
      v.count++; v.spend += n(r.spend); v.revenue += n(r.revenue);
      var p = sum.byPlatform[r.platform] = sum.byPlatform[r.platform] || { count: 0, spend: 0, revenue: 0, purchases: 0 };
      p.count++; p.spend += n(r.spend); p.revenue += n(r.revenue); p.purchases += n(r.purchases);
    });
    sum.roas = sum.spend ? sum.revenue / sum.spend : null;
    Object.keys(sum.byPlatform).forEach(function (k) { var p = sum.byPlatform[k]; p.roas = p.spend ? p.revenue / p.spend : null; p.cpa = p.purchases ? p.spend / p.purchases : null; });
    return { rows: rows, summary: sum, targets: { breakevenRoas: be, targetRoas: target, minSpend: minSpend } };
  }

  /* ---------- CSV import ---------- */

  function parseCsv(text) {
    text = text.replace(/^﻿/, "");
    var firstLine = text.split(/\r?\n/).slice(0, 5).join("\n");
    var delim = [",", ";", "\t"].sort(function (a, b) { return firstLine.split(b).length - firstLine.split(a).length; })[0];
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
  }

  var COLUMNS = {
    name: ["ad name", "ad", "ad_name", "campaign name", "campaign"],
    campaign: ["campaign name", "campaign"],
    adset: ["ad set name", "ad group name", "ad group", "adgroup name", "ad set"],
    status: ["ad delivery", "delivery", "ad status", "status", "campaign status", "campaign state"],
    spend: ["amount spent", "cost", "spend", "total cost"],
    impressions: ["impressions", "impr.", "impression"],
    clicks: ["link clicks", "clicks (destination)", "clicks"],
    purchases: ["purchases", "website purchases", "complete payment", "conversions", "purchase", "results"],
    revenue: ["purchases conversion value", "website purchases conversion value", "total complete payment value", "conv. value", "conversion value", "purchase value", "total purchase value"],
    reach: ["reach"],
    frequency: ["frequency"]
  };
  var FIELD_LABELS = { name: "Ad name", campaign: "Campaign", adset: "Ad set / group", status: "Status", spend: "Spend", impressions: "Impressions", clicks: "Clicks", purchases: "Purchases", revenue: "Revenue (conversion value)", reach: "Reach", frequency: "Frequency" };

  function normHeader(h) { return String(h || "").toLowerCase().replace(/\(.*?\)/g, function (m) { return /destination/.test(m) ? m : ""; }).replace(/\s+/g, " ").trim(); }

  /* Find header row and guess which column is which. */
  function detect(rows) {
    var best = { index: 0, score: -1 };
    rows.slice(0, 8).forEach(function (r, i) {
      var hs = r.map(normHeader);
      var score = 0;
      Object.keys(COLUMNS).forEach(function (f) { if (COLUMNS[f].some(function (s) { return hs.indexOf(s) >= 0; })) score++; });
      if (score > best.score) best = { index: i, score: score };
    });
    var headers = rows[best.index] || [];
    var hs = headers.map(normHeader);
    var map = {};
    var used = {};
    Object.keys(COLUMNS).forEach(function (f) {
      for (var i = 0; i < COLUMNS[f].length; i++) {
        var idx = hs.indexOf(COLUMNS[f][i]);
        if (idx >= 0 && (!used[idx] || f === "campaign")) { map[f] = idx; if (f !== "campaign") used[idx] = true; return; }
      }
      map[f] = -1;
    });
    var platform = hs.indexOf("amount spent") >= 0 || hs.indexOf("ad set name") >= 0 ? "meta" :
      hs.indexOf("impr.") >= 0 || hs.indexOf("conv. value") >= 0 ? "gads" :
      hs.some(function (h) { return /complete payment|ad group name/.test(h); }) ? "tiktok" : "other";
    return { headerIndex: best.index, headers: headers, map: map, platform: platform };
  }

  function toNumber(v) {
    var s = String(v == null ? "" : v).trim().replace(/[^\d.,\-]/g, "");
    if (!s || s === "-" ) return 0;
    if (s.indexOf(",") >= 0 && s.indexOf(".") < 0 && /,\d{1,2}$/.test(s)) s = s.replace(/,/g, ".");
    else s = s.replace(/,/g, "");
    var x = parseFloat(s);
    return isFinite(x) ? x : 0;
  }

  function buildRows(rows, det, platform) {
    var out = [];
    var m = det.map;
    function cell(r, f) { return m[f] >= 0 ? r[m[f]] : ""; }
    rows.slice(det.headerIndex + 1).forEach(function (r, i) {
      var name = String(cell(r, "name") || "").trim();
      if (!name || /^total/i.test(name) || /^--$/.test(name)) return;
      var spend = toNumber(cell(r, "spend"));
      var impressions = toNumber(cell(r, "impressions"));
      if (!spend && !impressions) return;
      out.push({
        platform: platform, level: m.name === m.campaign ? "campaign" : "ad", id: "csv" + i, name: name,
        campaign: String(cell(r, "campaign") || ""), adset: String(cell(r, "adset") || ""), status: String(cell(r, "status") || ""),
        spend: spend, impressions: impressions, clicks: toNumber(cell(r, "clicks")), purchases: toNumber(cell(r, "purchases")),
        revenue: toNumber(cell(r, "revenue")), reach: toNumber(cell(r, "reach")), frequency: toNumber(cell(r, "frequency"))
      });
    });
    return out;
  }

  window.TT_ADS = {
    VERDICTS: VERDICTS,
    DEFAULT_TARGETS: DEFAULT_TARGETS,
    analyzeAds: analyzeAds,
    parseCsv: parseCsv,
    detect: detect,
    buildRows: buildRows,
    FIELD_LABELS: FIELD_LABELS
  };
})();
