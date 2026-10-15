/*
 * Data storage. Everything is saved in the browser (localStorage) on this
 * computer only. Use "Data & Backup" to export/import a JSON file.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "trackingHub.v1";
  var D = window.TT_DATA;

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function defaultPlatformKeys() {
    return D.PLATFORMS.filter(function (p) { return !p.optional; }).map(function (p) { return p.key; });
  }

  function emptyPlatform() {
    return { status: "none", label: "", fields: {}, extras: [], notes: "", owner: "", lastChecked: "" };
  }

  function newProject(name, url) {
    var platforms = {};
    defaultPlatformKeys().forEach(function (k) { platforms[k] = emptyPlatform(); });
    return {
      id: uid(),
      name: name || "My website",
      url: url || "",
      notes: "",
      createdAt: new Date().toISOString(),
      enabled: defaultPlatformKeys(),
      platforms: platforms,
      currency: "USD",
      events: [],
      checklist: {},
      metrics: [],
      scans: [],
      connections: {},
      connData: {},
      ads: [],
      adsMeta: {},
      targets: { breakevenRoas: 1.5, targetRoas: 3, minSpend: 20 },
      log: []
    };
  }

  function emptyState() {
    return { version: 1, projects: [], customTools: [], activeProjectId: null, settings: { theme: "auto", showSecrets: false, syncDays: 28, google: {} } };
  }

  /*
   * Tool lookup. A project can contain several copies of one tool
   * ("meta", "meta~2", "meta~3"…), and users can create their own tools
   * (keys starting with "c_").
   */
  function allTools() {
    return D.PLATFORMS.concat(state ? state.customTools : []);
  }

  function baseKey(instKey) {
    return String(instKey).split("~")[0];
  }

  function getTool(instKey) {
    var b = baseKey(instKey);
    return allTools().find(function (t) { return t.key === b; }) || null;
  }

  function instanceLabel(project, instKey) {
    var t = getTool(instKey);
    var rec = project && project.platforms[instKey];
    var name = t ? t.name : instKey;
    if (rec && rec.label) return name + " – " + rec.label;
    var n = String(instKey).split("~")[1];
    return n ? name + " (" + n + ")" : name;
  }

  function nextInstanceKey(project, base) {
    if (!project.platforms[base]) return base;
    var i = 2;
    while (project.platforms[base + "~" + i]) i++;
    return base + "~" + i;
  }

  function checkKey(instKey, itemId) {
    return instKey + "|" + itemId;
  }

  /* Make sure older / imported data has every property the app expects. */
  function normalize(state) {
    var s = Object.assign(emptyState(), state || {});
    s.settings = Object.assign(emptyState().settings, s.settings || {});
    s.settings.google = s.settings.google || {};
    s.customTools = (Array.isArray(s.customTools) ? s.customTools : []).map(function (t) {
      return Object.assign({ name: "Custom tool", short: "", color: "#607d8b", category: "Other", what: "", why: "", fields: [], links: [], checklist: [] }, t, { custom: true, optional: true });
    });
    s.projects = (Array.isArray(s.projects) ? s.projects : []).map(function (p) {
      var np = Object.assign(newProject(), p);
      np.enabled = Array.isArray(np.enabled) ? np.enabled : defaultPlatformKeys();
      np.platforms = np.platforms || {};
      np.enabled.forEach(function (k) {
        np.platforms[k] = Object.assign(emptyPlatform(), np.platforms[k] || {});
        np.platforms[k].fields = np.platforms[k].fields || {};
        np.platforms[k].extras = Array.isArray(np.platforms[k].extras) ? np.platforms[k].extras : [];
      });
      np.events = Array.isArray(np.events) ? np.events : [];
      np.events.forEach(function (e) { e.map = e.map || {}; e.id = e.id || uid(); });
      np.checklist = np.checklist || {};
      np.metrics = Array.isArray(np.metrics) ? np.metrics : [];
      np.metrics.forEach(function (m) { m.id = m.id || uid(); m.platforms = m.platforms || {}; });
      np.scans = Array.isArray(np.scans) ? np.scans : [];
      np.connections = np.connections && typeof np.connections === "object" ? np.connections : {};
      np.connData = np.connData && typeof np.connData === "object" ? np.connData : {};
      np.ads = Array.isArray(np.ads) ? np.ads : [];
      np.adsMeta = np.adsMeta && typeof np.adsMeta === "object" ? np.adsMeta : {};
      np.targets = Object.assign({ breakevenRoas: 1.5, targetRoas: 3, minSpend: 20 }, np.targets || {});
      np.log = Array.isArray(np.log) ? np.log : [];
      return np;
    });
    if (!s.projects.some(function (p) { return p.id === s.activeProjectId; })) {
      s.activeProjectId = s.projects.length ? s.projects[0].id : null;
    }
    return s;
  }

  var listeners = [];
  var storageOk = true;

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return normalize(raw ? JSON.parse(raw) : null);
    } catch (e) {
      storageOk = false;
      return normalize(null);
    }
  }

  var state = null;
  state = load();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageOk = true;
    } catch (e) {
      storageOk = false;
    }
    listeners.forEach(function (fn) { fn(state); });
  }

  function activeProject() {
    return state.projects.find(function (p) { return p.id === state.activeProjectId; }) || null;
  }

  function addLog(project, text, platformKey) {
    project.log.unshift({ id: uid(), date: new Date().toISOString(), text: text, platform: platformKey || "" });
    if (project.log.length > 500) project.log.length = 500;
  }

  function demoProject() {
    var p = newProject("Demo Shop (example)", "https://www.demo-shop.com");
    p.notes = "This is example data so you can see how everything looks. Delete it any time.";
    p.platforms.gtm = Object.assign(emptyPlatform(), { status: "live", lastChecked: today(), owner: "Rahim (agency)", fields: { containerId: "GTM-AB12CD3", account: "Demo Shop", container: "www.demo-shop.com", installed: "Yes", version: "Version 8 – Purchase tags" } });
    p.platforms.ga4 = Object.assign(emptyPlatform(), { status: "live", lastChecked: today(), fields: { measurementId: "G-1A2B3C4D5E", propertyId: "345678901", retention: "14 months", gadsLinked: "Yes" } });
    p.platforms.meta = Object.assign(emptyPlatform(), { status: "problem", notes: "Purchase events double counted – check event_id in server tag.", fields: { pixelId: "123456789012345", adAccountId: "act_1234567890", domainVerified: "Yes", emq: "6.1 / 10" } });
    p.platforms.tiktok = Object.assign(emptyPlatform(), { status: "progress", fields: { pixelId: "C1A2B3C4D5E6F7G8H9I0" } });
    p.platforms.gads = Object.assign(emptyPlatform(), { status: "live", fields: { customerId: "123-456-7890", conversionId: "AW-987654321", labels: "Purchase = AbCdEfGhIjK\nLead = XyZ123abc", enhanced: "Yes", ga4Linked: "Yes", consentMode: "Yes" } });
    p.platforms.gsc = Object.assign(emptyPlatform(), { status: "live", fields: { property: "demo-shop.com", propertyType: "Domain", verification: "DNS record", sitemap: "https://www.demo-shop.com/sitemap.xml", ga4Linked: "No" } });
    p.platforms.clarity = Object.assign(emptyPlatform(), { status: "live", fields: { projectId: "abcd1234ef", installedVia: "GTM", ga4Linked: "Yes", masking: "Balanced" } });
    p.platforms.sgtm = Object.assign(emptyPlatform(), { status: "progress", fields: { containerId: "GTM-XY98ZW7", taggingUrl: "https://sst.demo-shop.com", hosting: "Stape", clients: "GA4" } });
    p.platforms.stape = Object.assign(emptyPlatform(), { status: "progress", fields: { containerName: "demo-shop", stapeUrl: "https://abcdefg.eu.stape.io", customDomain: "https://sst.demo-shop.com", plan: "Pro", customLoader: "No", cookieKeeper: "No" } });
    p.platforms.consent = Object.assign(emptyPlatform(), { status: "none" });

    var lib = D.EVENT_LIBRARY;
    function ev(i, status, server, extra) {
      var e = Object.assign({ id: uid(), name: lib[i].name, trigger: lib[i].trigger, params: lib[i].params, map: {}, status: status, server: server, dedup: server ? "Yes" : "", lastTested: status === "live" ? today() : "", notes: "" }, extra || {});
      ["ga4", "meta", "tiktok", "gads"].forEach(function (k) { if (lib[i].map[k]) e.map[k] = lib[i].map[k]; });
      return e;
    }
    p.events = [ev(0, "live", true), ev(2, "live", false), ev(4, "live", false), ev(6, "progress", false), ev(9, "problem", true, { notes: "Meta shows 2 purchases per order." })];
    [["gtm", "gtm-1"], ["gtm", "gtm-2"], ["gtm", "gtm-3"], ["ga4", "ga4-1"], ["ga4", "ga4-2"], ["ga4", "ga4-3"], ["meta", "meta-1"], ["meta", "meta-2"], ["meta", "meta-3"], ["gads", "gads-1"], ["gads", "gads-2"], ["gsc", "gsc-1"], ["gsc", "gsc-2"], ["clarity", "cl-1"], ["clarity", "cl-2"], ["sgtm", "sgtm-1"], ["stape", "stape-1"]].forEach(function (c) { p.checklist[checkKey(c[0], c[1])] = true; });
    p.currency = "USD";
    var base = new Date();
    for (var i = 13; i >= 0; i--) {
      var d = new Date(base.getTime() - i * 86400000);
      var ds = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      var orders = 38 + Math.round(Math.sin(i / 2) * 6) + (13 - i);
      var aov = 52 + (i % 4) * 2;
      var rev = orders * aov;
      // Meta starts double counting 5 days ago, TikTok loses many events.
      var metaRate = i < 5 ? 1.9 : 0.9;
      p.metrics.push({
        id: uid(), date: ds, shopOrders: orders, shopRevenue: rev, sessions: orders * 45, notes: i === 4 ? "New upsell app installed" : "",
        platforms: {
          ga4: { received: Math.round(orders * 0.93), adPurchases: "", adRevenue: "", spend: "" },
          meta: { received: Math.round(orders * metaRate), adPurchases: Math.round(orders * 0.38), adRevenue: Math.round(rev * 0.38), spend: 420 + (i % 3) * 30 },
          tiktok: { received: Math.round(orders * 0.61), adPurchases: Math.round(orders * 0.08), adRevenue: Math.round(rev * 0.08), spend: 150 },
          gads: { received: Math.round(orders * 0.88), adPurchases: Math.round(orders * 0.22), adRevenue: Math.round(rev * 0.22), spend: 260 }
        }
      });
    }
    p.platforms.shop = Object.assign(emptyPlatform(), { status: "live", fields: { mainId: "Shopify", trackingApps: "Meta Facebook & Instagram app\nGTM via theme\nUpsell app (has own pixel)" } });
    var demoAds = [
      ["meta", "UGC video – happy customer", "Prospecting – Broad", "Women 25-45", 820, 61000, 1180, 31, 3450, 2.1],
      ["meta", "Carousel – best sellers", "Retargeting – 30d visitors", "Site visitors", 310, 18000, 420, 17, 1290, 4.4],
      ["meta", "Static – 20% off banner", "Prospecting – Broad", "Women 25-45", 540, 72000, 380, 4, 210, 1.6],
      ["meta", "Founder story video", "Prospecting – Interests", "Yoga & fitness", 260, 30500, 610, 0, 0, 1.4],
      ["meta", "New collection reel", "Prospecting – Broad", "Lookalike 1%", 12, 1400, 18, 0, 0, 1.0],
      ["tiktok", "Unboxing trend video", "TikTok – Spark ads", "Broad 18-34", 690, 140000, 1650, 14, 760, 0],
      ["tiktok", "Before / after video", "TikTok – Conversions", "Broad 18-34", 360, 52000, 410, 9, 590, 0],
      ["gads", "Performance Max – All products", "Performance Max – All products", "performance max", 1150, 98000, 2100, 46, 4980, 0],
      ["gads", "Search – Brand", "Search – Brand", "search", 220, 3100, 640, 21, 1720, 0],
      ["gads", "Search – Generic 'yoga pants'", "Search – Generic 'yoga pants'", "search", 450, 21000, 520, 3, 190, 0]
    ];
    p.ads = demoAds.map(function (a, i) {
      return { platform: a[0], level: a[0] === "gads" ? "campaign" : "ad", id: "demo" + i, name: a[1], campaign: a[2], adset: a[3], status: "ACTIVE", spend: a[4], impressions: a[5], clicks: a[6], purchases: a[7], revenue: a[8], frequency: a[9], reach: a[9] ? Math.round(a[5] / a[9]) : 0 };
    });
    var since = p.metrics.length ? p.metrics[0].date : today();
    ["meta", "tiktok", "gads"].forEach(function (k) { p.adsMeta[k] = { source: "demo", since: since, until: today(), at: new Date().toISOString() }; });
    p.connData = {
      ga4: { at: new Date().toISOString(), summary: "Demo data", info: { sources: [
        { source: "google / organic", sessions: 9800, transactions: 140, revenue: 7600 },
        { source: "facebook / paid", sessions: 6200, transactions: 70, revenue: 3700 },
        { source: "google / cpc", sessions: 4100, transactions: 95, revenue: 5200 },
        { source: "(direct) / (none)", sessions: 3900, transactions: 88, revenue: 4900 },
        { source: "tiktok / paid", sessions: 3600, transactions: 9, revenue: 420 },
        { source: "klaviyo / email", sessions: 1500, transactions: 41, revenue: 2300 }
      ], devices: [{ device: "mobile", sessions: 21000, transactions: 250 }, { device: "desktop", sessions: 7600, transactions: 180 }] } },
      gsc: { at: new Date().toISOString(), summary: "Demo data", info: {
        current: { clicks: 4120, impressions: 160000, ctr: 0.0257, position: 14.2 },
        previous: { clicks: 3610, impressions: 151000, ctr: 0.0239, position: 15.1 },
        queries: [{ query: "demo shop", clicks: 1300, impressions: 4100, position: 1.1 }, { query: "yoga pants high waist", clicks: 410, impressions: 22000, position: 7.8 }, { query: "seamless leggings", clicks: 220, impressions: 19000, position: 11.4 }],
        pages: [] } },
      clarity: { at: new Date().toISOString(), summary: "Demo data", info: { metrics: {
        Traffic: { totalSessionCount: 4300, totalBotSessionCount: 210, distantUserCount: 3500 },
        RageClickCount: { sessionsWithMetricPercentage: 6.4 },
        DeadClickCount: { sessionsWithMetricPercentage: 11.2 },
        QuickbackClick: { sessionsWithMetricPercentage: 8.1 },
        ScriptErrorCount: { sessionsWithMetricPercentage: 3.2 }
      } } },
      gtm: { at: new Date().toISOString(), summary: "Demo data", info: { container: "www.demo-shop.com", publicId: "GTM-AB12CD3", version: "8", versionName: "Purchase tags", tags: 14, triggers: 9, variables: 21, changedAt: Date.now() - 5 * 86400000 } },
      meta: { at: new Date().toISOString(), summary: "Demo data", info: { pixelEvents: { PageView: 21400, ViewContent: 9800, AddToCart: 1450, InitiateCheckout: 620, Purchase: 690 }, lastPurchaseAt: Date.now() - 3600000 } }
    };
    addLog(p, "Demo project created");
    addLog(p, "Meta: status changed to Problem – double counted purchases", "meta");
    return p;
  }

  window.TT_STORE = {
    uid: uid,
    today: today,
    get state() { return state; },
    get storageOk() { return storageOk; },
    save: save,
    onChange: function (fn) { listeners.push(fn); },
    activeProject: activeProject,
    newProject: newProject,
    emptyPlatform: emptyPlatform,
    demoProject: demoProject,
    addLog: addLog,
    allTools: allTools,
    getTool: getTool,
    baseKey: baseKey,
    instanceLabel: instanceLabel,
    nextInstanceKey: nextInstanceKey,
    checkKey: checkKey,
    normalize: normalize,
    replaceState: function (s) { state = normalize(s); save(); },
    STORAGE_KEY: STORAGE_KEY
  };
})();
