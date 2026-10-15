/*
 * Connectors: pull live data from your tools through their official APIs.
 *
 * Every connector returns the same shape so the rest of the app doesn't care
 * where data came from:
 *   { daily: { "YYYY-MM-DD": { ...numbers } }, ads: [ adRow ], info: { ... }, summary: "text" }
 *
 * Tokens are stored only in this browser. In the Chrome-extension version the
 * dashboard may call any API directly; in a normal web page some APIs
 * (Shopify, TikTok…) block browser calls, so the extension is recommended.
 */
(function () {
  "use strict";

  var IS_EXTENSION = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id && location.protocol === "chrome-extension:";

  /* ---------- helpers ---------- */

  function pad(n) { return String(n).padStart(2, "0"); }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function makeRange(days) {
    var until = new Date();
    var since = new Date(until.getTime() - (days - 1) * 86400000);
    return { since: ymd(since), until: ymd(until), days: days };
  }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  function ConnectorError(message, hint) {
    var e = new Error(message);
    e.hint = hint || "";
    return e;
  }

  /* fetch + JSON with beginner-friendly error messages. */
  function http(url, opts) {
    opts = opts || {};
    return fetch(url, opts).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (!res.ok) {
          var apiMsg = apiErrorMessage(data) || text.slice(0, 200) || res.statusText;
          var hint = res.status === 401 ? "The token/key is wrong or expired – create a new one and paste it again." :
            res.status === 403 ? "The token has no permission for this account. Check the account ID and the token's permissions." :
            res.status === 404 ? "Not found – check the ID (account / property / store address)." :
            res.status === 429 ? "Too many requests – wait a few minutes and try again." : "";
          throw ConnectorError("Error " + res.status + ": " + apiMsg, hint);
        }
        return { data: data, headers: res.headers };
      });
    }, function () {
      throw ConnectorError("Could not reach the service.",
        IS_EXTENSION ? "Check your internet connection and the address you entered." :
          "This service blocks requests from normal web pages. Use the dashboard inside the Chrome extension (click the extension icon → Open dashboard).");
    });
  }
  function apiErrorMessage(d) {
    if (!d) return "";
    if (d.error && typeof d.error === "object") return d.error.message || d.error.error_user_msg || JSON.stringify(d.error).slice(0, 200);
    if (typeof d.error === "string") return d.error_description || d.error;
    if (d.errors) return typeof d.errors === "string" ? d.errors : JSON.stringify(d.errors).slice(0, 200);
    if (d.message) return d.message;
    if (Array.isArray(d) && d[0] && d[0].error) return d[0].error.message;
    return "";
  }
  function need(cfg, keys) {
    keys.forEach(function (k) {
      if (!String(cfg[k] || "").trim()) throw ConnectorError("Missing: " + k + ".", "Open 'Connect' and fill in every field.");
    });
  }
  function addDaily(daily, date, obj) {
    var row = daily[date] = daily[date] || {};
    Object.keys(obj).forEach(function (k) { row[k] = (row[k] || 0) + (obj[k] || 0); });
  }

  /* Meta returns purchases in a list of "actions" – pick the purchase one. */
  var META_PURCHASE = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase", "onsite_web_purchase"];
  function metaAction(list) {
    if (!Array.isArray(list)) return 0;
    for (var i = 0; i < META_PURCHASE.length; i++) {
      var a = list.find(function (x) { return x.action_type === META_PURCHASE[i]; });
      if (a) return num(a.value);
    }
    return 0;
  }
  function metaLinkClicks(list) {
    if (!Array.isArray(list)) return 0;
    var a = list.find(function (x) { return x.action_type === "link_click"; });
    return a ? num(a.value) : 0;
  }

  /* Follow "next" pages (Meta style). */
  function metaAll(url, out) {
    out = out || [];
    return http(url).then(function (r) {
      (r.data.data || []).forEach(function (x) { out.push(x); });
      if (r.data.paging && r.data.paging.next && out.length < 5000) return metaAll(r.data.paging.next, out);
      return out;
    });
  }

  /* ---------- Google sign-in (shared by GA4, Search Console, Google Ads, GTM) ---------- */

  var GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/tagmanager.readonly",
    "https://www.googleapis.com/auth/adwords"
  ];

  function googleRedirectUri() {
    if (IS_EXTENSION && chrome.identity) return chrome.identity.getRedirectURL();
    return location.origin + location.pathname;
  }
  function googleAuthUrl(clientId) {
    return "https://accounts.google.com/o/oauth2/v2/auth?" + [
      "client_id=" + encodeURIComponent(clientId),
      "redirect_uri=" + encodeURIComponent(googleRedirectUri()),
      "response_type=token",
      "scope=" + encodeURIComponent(GOOGLE_SCOPES.join(" ")),
      "include_granted_scopes=true",
      "prompt=consent",
      "state=tthub"
    ].join("&");
  }
  /* Parse "#access_token=…&expires_in=…" from a URL. */
  function parseGoogleToken(url) {
    var i = url.indexOf("#");
    if (i < 0) return null;
    var p = {};
    url.slice(i + 1).split("&").forEach(function (kv) { var s = kv.split("="); p[decodeURIComponent(s[0])] = decodeURIComponent(s[1] || ""); });
    if (!p.access_token) return null;
    return { token: p.access_token, expiresAt: Date.now() + (num(p.expires_in) || 3600) * 1000 };
  }
  /* Starts Google sign-in. Extension: popup window. Web page: full redirect. */
  function googleSignIn(clientId) {
    if (!clientId) return Promise.reject(ConnectorError("Enter your Google OAuth Client ID first."));
    if (IS_EXTENSION) {
      if (!chrome.identity) return Promise.reject(ConnectorError("The extension needs the 'identity' permission – reload the extension."));
      return new Promise(function (resolve, reject) {
        chrome.identity.launchWebAuthFlow({ url: googleAuthUrl(clientId), interactive: true }, function (redirect) {
          if (chrome.runtime.lastError || !redirect) return reject(ConnectorError("Google sign-in was cancelled or failed.", chrome.runtime.lastError ? chrome.runtime.lastError.message : ""));
          var t = parseGoogleToken(redirect);
          if (!t) return reject(ConnectorError("Google did not return a token."));
          resolve(t);
        });
      });
    }
    if (location.protocol === "file:") {
      return Promise.reject(ConnectorError("Google sign-in can't work from a file opened on your computer.", "Use the Chrome-extension version, host the app on a website (e.g. GitHub Pages), or paste a token from the OAuth Playground."));
    }
    location.href = googleAuthUrl(clientId);
    return new Promise(function () {}); // page navigates away
  }
  function googleHeaders(ctx, extra) {
    var g = ctx.google || {};
    if (!g.token || (g.expiresAt && g.expiresAt < Date.now() + 30000)) {
      throw ConnectorError("Google sign-in has expired.", "Click 'Sign in with Google' on the Connections page (Google tokens last 1 hour).");
    }
    return Object.assign({ Authorization: "Bearer " + g.token, "Content-Type": "application/json" }, extra || {});
  }

  /* ---------- connector definitions ---------- */

  var CONNECTORS = [
    {
      key: "shopify", tool: "shop", name: "Shopify (orders)", color: "#5e8e3e", group: "Your shop",
      what: "Real orders and revenue per day – the truth everything else is compared with.",
      fields: [
        { key: "shop", label: "Store address", placeholder: "my-store.myshopify.com", help: "The .myshopify.com address (Shopify admin → Settings → Domains)." },
        { key: "token", label: "Admin API access token", placeholder: "shpat_…", secret: true, help: "From a custom app with the read_orders permission." }
      ],
      steps: [
        "In Shopify admin open Settings → Apps → Develop apps (or Shopify's Dev Dashboard) and create an app called 'Tracking Hub'.",
        "Give it Admin API permission: read_orders (nothing else is needed).",
        "Install the app and copy the Admin API access token (starts with shpat_). It is shown only once!",
        "Paste the store address and token here and click Test."
      ],
      sync: function (ctx) {
        var c = ctx.cfg;
        need(c, ["shop", "token"]);
        var shop = c.shop.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        var url = "https://" + shop + "/admin/api/2025-07/orders.json?status=any&limit=250&fields=created_at,total_price,cancelled_at,test,financial_status&created_at_min=" + ctx.range.since + "T00:00:00";
        var daily = {};
        var count = 0;
        function page(u) {
          return http(u, { headers: { "X-Shopify-Access-Token": c.token.trim() } }).then(function (r) {
            (r.data.orders || []).forEach(function (o) {
              if (o.cancelled_at || o.test) return;
              count++;
              addDaily(daily, String(o.created_at).slice(0, 10), { shopOrders: 1, shopRevenue: num(o.total_price) });
            });
            var link = r.headers.get("Link") || r.headers.get("link") || "";
            var m = link.match(/<([^>]+)>;\s*rel="next"/);
            if (m && count < 20000) return page(m[1]);
          });
        }
        return page(url).then(function () {
          return { daily: daily, summary: count + " orders in the last " + ctx.range.days + " days." };
        });
      }
    },
    {
      key: "woo", tool: "shop", name: "WooCommerce (orders)", color: "#7f54b3", group: "Your shop",
      what: "Real orders and revenue per day from your WordPress/WooCommerce shop.",
      fields: [
        { key: "site", label: "Website address", placeholder: "https://www.myshop.com", help: "Must start with https://" },
        { key: "key", label: "Consumer key", placeholder: "ck_…", secret: true, help: "WooCommerce → Settings → Advanced → REST API." },
        { key: "secret", label: "Consumer secret", placeholder: "cs_…", secret: true, help: "Shown once when you create the key." }
      ],
      steps: [
        "In WordPress go to WooCommerce → Settings → Advanced → REST API → Add key.",
        "Description 'Tracking Hub', Permissions: Read. Click Generate API key.",
        "Copy the Consumer key (ck_…) and Consumer secret (cs_…) and paste them here."
      ],
      sync: function (ctx) {
        var c = ctx.cfg;
        need(c, ["site", "key", "secret"]);
        var base = c.site.trim().replace(/\/+$/, "");
        var auth = "Basic " + btoa(c.key.trim() + ":" + c.secret.trim());
        var daily = {};
        var count = 0;
        function page(n) {
          var u = base + "/wp-json/wc/v3/orders?per_page=100&page=" + n + "&status=processing,completed,on-hold&after=" + ctx.range.since + "T00:00:00";
          return http(u, { headers: { Authorization: auth } }).then(function (r) {
            (r.data || []).forEach(function (o) {
              count++;
              addDaily(daily, String(o.date_created).slice(0, 10), { shopOrders: 1, shopRevenue: num(o.total) });
            });
            var pages = num(r.headers.get("X-WP-TotalPages"));
            if (n < pages && n < 200) return page(n + 1);
          });
        }
        return page(1).then(function () { return { daily: daily, summary: count + " orders in the last " + ctx.range.days + " days." }; });
      }
    },
    {
      key: "meta", tool: "meta", name: "Meta Ads & Pixel", color: "#1877f2", group: "Ads",
      what: "Spend, purchases and revenue for every ad, plus how many events your pixel received.",
      fields: [
        { key: "token", label: "Access token", placeholder: "EAAB…", secret: true, help: "Needs the ads_read permission. A System User token never expires." },
        { key: "adAccountId", label: "Ad account ID", placeholder: "act_1234567890", from: ["meta", "adAccountId"], help: "Ads Manager → account drop-down. Filled from Tools & IDs." },
        { key: "pixelId", label: "Pixel / Dataset ID (optional)", placeholder: "1234567890", from: ["meta", "pixelId"], help: "To check that your pixel receives events." }
      ],
      steps: [
        "Easiest long-lasting way: Business settings → Users → System users → Add (role Admin or Employee).",
        "Click 'Assign assets' and give it your Ad account and Pixel (dataset).",
        "Click 'Generate new token', choose any app (create one at developers.facebook.com if needed), tick ads_read, and copy the token.",
        "Quick test way (expires in ~1 hour): developers.facebook.com/tools/explorer → add permission ads_read → Generate Access Token.",
        "Paste the token here. The ad account and pixel ID are taken from your Tools & IDs page."
      ],
      sync: function (ctx) {
        var c = ctx.cfg;
        need(c, ["token", "adAccountId"]);
        var acc = c.adAccountId.trim();
        if (acc.indexOf("act_") !== 0) acc = "act_" + acc;
        var G = "https://graph.facebook.com/" + (c.apiVersion ? c.apiVersion.replace(/^\/|\/$/g, "") + "/" : "");
        var tok = "access_token=" + encodeURIComponent(c.token.trim());
        var tr = "time_range=" + encodeURIComponent(JSON.stringify({ since: ctx.range.since, until: ctx.range.until }));
        var daily = {};
        var info = {};
        var p1 = metaAll(G + acc + "/insights?level=account&time_increment=1&fields=spend,actions,action_values&" + tr + "&limit=100&" + tok).then(function (rows) {
          rows.forEach(function (r) {
            addDaily(daily, r.date_start, { spend: num(r.spend), adPurchases: metaAction(r.actions), adRevenue: metaAction(r.action_values) });
          });
        });
        var statuses = {};
        var p2 = metaAll(G + acc + "/ads?fields=effective_status&limit=500&" + tok).then(function (rows) {
          rows.forEach(function (a) { statuses[a.id] = a.effective_status; });
        }).catch(function () { /* statuses are optional */ });
        var ads = [];
        var p3 = metaAll(G + acc + "/insights?level=ad&fields=ad_id,ad_name,adset_name,campaign_name,spend,impressions,reach,frequency,clicks,actions,action_values&" + tr + "&limit=500&" + tok).then(function (rows) {
          rows.forEach(function (r) {
            ads.push({
              platform: "meta", level: "ad", id: r.ad_id, name: r.ad_name, campaign: r.campaign_name, adset: r.adset_name,
              spend: num(r.spend), impressions: num(r.impressions), reach: num(r.reach), frequency: num(r.frequency),
              clicks: metaLinkClicks(r.actions) || num(r.clicks), purchases: metaAction(r.actions), revenue: metaAction(r.action_values)
            });
          });
        });
        var p4 = c.pixelId ? http(G + c.pixelId.trim() + "/stats?aggregation=event&start_time=" + Math.floor(Date.now() / 1000 - 7 * 86400) + "&" + tok).then(function (r) {
          var counts = {};
          var lastPurchase = 0;
          (r.data.data || []).forEach(function (bucket) {
            (bucket.data || []).forEach(function (e) {
              counts[e.value] = (counts[e.value] || 0) + num(e.count);
              if (/^purchase$/i.test(e.value) && num(e.count) > 0) {
                var t = Date.parse(bucket.start_time);
                if (t > lastPurchase) lastPurchase = t;
              }
            });
          });
          info.pixelEvents = counts;
          info.lastPurchaseAt = lastPurchase || null;
        }).catch(function (e) { info.pixelError = e.message; }) : Promise.resolve();
        return Promise.all([p1, p2, p3, p4]).then(function () {
          ads.forEach(function (a) { a.status = statuses[a.id] || ""; });
          var spend = ads.reduce(function (s, a) { return s + a.spend; }, 0);
          return { daily: daily, ads: ads, info: info, summary: ads.length + " ads, spend " + spend.toFixed(0) + " in the last " + ctx.range.days + " days." };
        });
      }
    },
    {
      key: "tiktok", tool: "tiktok", name: "TikTok Ads", color: "#111111", group: "Ads",
      what: "Spend, purchases and revenue for every TikTok ad.",
      fields: [
        { key: "token", label: "Access token", placeholder: "xxxxxxxx", secret: true, help: "Long-term token from your TikTok for Business developer app." },
        { key: "advertiserId", label: "Advertiser (ad account) ID", placeholder: "7012345678901234567", from: ["tiktok", "adsAccountId"], help: "Filled from Tools & IDs." }
      ],
      steps: [
        "Go to business-api.tiktok.com (TikTok API for Business) and register as a developer (free).",
        "Create an app, ask for the 'Reporting' and 'Ad Account Management' permissions, and wait for approval.",
        "Open the app's 'Advertiser authorization URL', log in, and allow access to your ad account.",
        "Copy the long-term Access Token you receive and paste it here with your advertiser ID.",
        "Too complicated? Use 'Import CSV' on the Ads performance page with a report exported from TikTok Ads Manager."
      ],
      sync: function (ctx) {
        var c = ctx.cfg;
        need(c, ["token", "advertiserId"]);
        var base = "https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?advertiser_id=" + encodeURIComponent(c.advertiserId.trim()) +
          "&report_type=BASIC&start_date=" + ctx.range.since + "&end_date=" + ctx.range.until + "&page_size=1000";
        var H = { headers: { "Access-Token": c.token.trim() } };
        function check(r) {
          if (r.data && r.data.code && r.data.code !== 0) throw ConnectorError("TikTok: " + r.data.message, "Check the token and the advertiser ID.");
          return (r.data && r.data.data && r.data.data.list) || [];
        }
        var daily = {};
        var p1 = http(base + "&data_level=AUCTION_ADVERTISER&dimensions=" + encodeURIComponent('["advertiser_id","stat_time_day"]') +
          "&metrics=" + encodeURIComponent('["spend","complete_payment","complete_payment_roas"]'), H).then(function (r) {
          check(r).forEach(function (row) {
            var m = row.metrics || {};
            var d = String((row.dimensions || {}).stat_time_day || "").slice(0, 10);
            addDaily(daily, d, { spend: num(m.spend), adPurchases: num(m.complete_payment), adRevenue: num(m.complete_payment_roas) * num(m.spend) });
          });
        });
        var ads = [];
        var p2 = http(base + "&data_level=AUCTION_AD&dimensions=" + encodeURIComponent('["ad_id"]') +
          "&metrics=" + encodeURIComponent('["ad_name","campaign_name","adgroup_name","spend","impressions","clicks","reach","frequency","complete_payment","complete_payment_roas"]'), H).then(function (r) {
          check(r).forEach(function (row) {
            var m = row.metrics || {};
            ads.push({
              platform: "tiktok", level: "ad", id: (row.dimensions || {}).ad_id, name: m.ad_name, campaign: m.campaign_name, adset: m.adgroup_name, status: "",
              spend: num(m.spend), impressions: num(m.impressions), clicks: num(m.clicks), reach: num(m.reach), frequency: num(m.frequency),
              purchases: num(m.complete_payment), revenue: num(m.complete_payment_roas) * num(m.spend)
            });
          });
        });
        return Promise.all([p1, p2]).then(function () {
          return { daily: daily, ads: ads, summary: ads.length + " ads in the last " + ctx.range.days + " days." };
        });
      }
    },
    {
      key: "gads", tool: "gads", name: "Google Ads", color: "#34a853", group: "Ads", google: true,
      what: "Spend, conversions and conversion value for every campaign (incl. Performance Max).",
      fields: [
        { key: "customerId", label: "Customer ID", placeholder: "123-456-7890", from: ["gads", "customerId"], help: "Top-right in Google Ads. Filled from Tools & IDs." },
        { key: "developerToken", label: "Developer token", placeholder: "AbCdEf…", secret: true, help: "Google Ads → Tools → API Center (needs a manager account). Must be approved for 'Basic access' to read real accounts." },
        { key: "managerId", label: "Manager (MCC) ID – only if you log in via a manager", placeholder: "111-222-3333", help: "Leave empty if you use the ad account directly." },
        { key: "apiVersion", label: "API version (advanced)", placeholder: "auto", help: "Leave empty – the newest working version is found automatically." }
      ],
      steps: [
        "Sign in with Google at the top of this page (same Google account that can see your Google Ads).",
        "Get a developer token: create a Google Ads manager account (free), then Tools → API Center → apply. Basic access approval can take a few days.",
        "Paste the developer token and your Customer ID here.",
        "Until approved, use 'Import CSV' on the Ads performance page with a campaign report downloaded from Google Ads."
      ],
      sync: function (ctx) {
        var c = ctx.cfg;
        need(c, ["customerId", "developerToken"]);
        var cid = c.customerId.replace(/\D/g, "");
        var extra = { "developer-token": c.developerToken.trim() };
        if (c.managerId) extra["login-customer-id"] = c.managerId.replace(/\D/g, "");
        var H = googleHeaders(ctx, extra);
        var versions = c.apiVersion ? [c.apiVersion.trim()] : ["v24", "v23", "v22", "v21", "v20"];
        function search(q, vi) {
          vi = vi || 0;
          return http("https://googleads.googleapis.com/" + versions[vi] + "/customers/" + cid + "/googleAds:searchStream", { method: "POST", headers: H, body: JSON.stringify({ query: q }) })
            .then(function (r) {
              var rows = [];
              (r.data || []).forEach(function (chunk) { (chunk.results || []).forEach(function (x) { rows.push(x); }); });
              return rows;
            }, function (e) {
              if (/Error 404/.test(e.message) && vi + 1 < versions.length) return search(q, vi + 1);
              throw e;
            });
        }
        var between = " WHERE segments.date BETWEEN '" + ctx.range.since + "' AND '" + ctx.range.until + "'";
        var daily = {};
        var ads = [];
        return search("SELECT segments.date, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM customer" + between).then(function (rows) {
          rows.forEach(function (x) {
            var m = x.metrics || {};
            addDaily(daily, x.segments.date, { spend: num(m.costMicros) / 1e6, adPurchases: num(m.conversions), adRevenue: num(m.conversionsValue) });
          });
          return search("SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign" + between + " AND metrics.impressions > 0");
        }).then(function (rows) {
          rows.forEach(function (x) {
            var m = x.metrics || {}, cp = x.campaign || {};
            ads.push({
              platform: "gads", level: "campaign", id: cp.id, name: cp.name, campaign: cp.name, adset: String(cp.advertisingChannelType || "").replace(/_/g, " ").toLowerCase(),
              status: cp.status, spend: num(m.costMicros) / 1e6, impressions: num(m.impressions), clicks: num(m.clicks), purchases: num(m.conversions), revenue: num(m.conversionsValue)
            });
          });
          return { daily: daily, ads: ads, summary: ads.length + " campaigns in the last " + ctx.range.days + " days." };
        });
      }
    },
    {
      key: "ga4", tool: "ga4", name: "Google Analytics 4", color: "#e37400", group: "Analytics", google: true,
      what: "Sessions, purchases and revenue per day, and which traffic sources bring sales.",
      fields: [
        { key: "propertyId", label: "Property ID", placeholder: "345678901", from: ["ga4", "propertyId"], help: "GA4 Admin → Property settings (numbers only). Filled from Tools & IDs." }
      ],
      steps: [
        "Sign in with Google at the top of this page (an account with at least 'Viewer' access to the GA4 property).",
        "Check the Property ID (numbers only, not the G- ID) and click Test."
      ],
      sync: function (ctx) {
        var c = ctx.cfg;
        need(c, ["propertyId"]);
        var url = "https://analyticsdata.googleapis.com/v1beta/properties/" + c.propertyId.replace(/\D/g, "") + ":runReport";
        var H = { method: "POST", headers: googleHeaders(ctx) };
        var dr = [{ startDate: ctx.range.since, endDate: ctx.range.until }];
        var daily = {};
        var info = {};
        var p1 = http(url, Object.assign({}, H, { body: JSON.stringify({ dateRanges: dr, dimensions: [{ name: "date" }], metrics: [{ name: "sessions" }, { name: "transactions" }, { name: "purchaseRevenue" }] }) })).then(function (r) {
          (r.data.rows || []).forEach(function (row) {
            var d = row.dimensionValues[0].value;
            var v = row.metricValues;
            addDaily(daily, d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8), { sessions: num(v[0].value), received: num(v[1].value), revenue: num(v[2].value) });
          });
        });
        var p2 = http(url, Object.assign({}, H, { body: JSON.stringify({ dateRanges: dr, dimensions: [{ name: "sessionSourceMedium" }], metrics: [{ name: "sessions" }, { name: "transactions" }, { name: "purchaseRevenue" }], orderBys: [{ metric: { metricName: "purchaseRevenue" }, desc: true }], limit: 15 }) })).then(function (r) {
          info.sources = (r.data.rows || []).map(function (row) {
            return { source: row.dimensionValues[0].value, sessions: num(row.metricValues[0].value), transactions: num(row.metricValues[1].value), revenue: num(row.metricValues[2].value) };
          });
        });
        var p3 = http(url, Object.assign({}, H, { body: JSON.stringify({ dateRanges: dr, dimensions: [{ name: "deviceCategory" }], metrics: [{ name: "sessions" }, { name: "transactions" }] }) })).then(function (r) {
          info.devices = (r.data.rows || []).map(function (row) {
            return { device: row.dimensionValues[0].value, sessions: num(row.metricValues[0].value), transactions: num(row.metricValues[1].value) };
          });
        }).catch(function () {});
        return Promise.all([p1, p2, p3]).then(function () {
          var tx = Object.keys(daily).reduce(function (s, d) { return s + daily[d].received; }, 0);
          return { daily: daily, info: info, summary: tx + " purchases recorded by GA4 in the last " + ctx.range.days + " days." };
        });
      }
    },
    {
      key: "gsc", tool: "gsc", name: "Google Search Console", color: "#4285f4", group: "Analytics", google: true,
      what: "Free Google search traffic: clicks, impressions, position and top searches – compared with the previous period.",
      fields: [
        { key: "property", label: "Property", placeholder: "sc-domain:myshop.com or https://www.myshop.com/", from: ["gsc", "property"], help: "Domain property: write sc-domain:yourdomain.com. URL property: the full URL with / at the end." }
      ],
      steps: [
        "Sign in with Google at the top of this page (an account that can see the Search Console property).",
        "Enter the property exactly as Search Console shows it. For a Domain property write sc-domain:yourshop.com."
      ],
      sync: function (ctx) {
        var c = ctx.cfg;
        need(c, ["property"]);
        var prop = c.property.trim();
        if (!/^sc-domain:|^https?:\/\//.test(prop)) prop = "sc-domain:" + prop.replace(/^www\./, "");
        var url = "https://www.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(prop) + "/searchAnalytics/query";
        var H = { method: "POST", headers: googleHeaders(ctx) };
        // Search Console data is ~2 days behind.
        var end = new Date(Date.now() - 2 * 86400000);
        var start = new Date(end.getTime() - (ctx.range.days - 1) * 86400000);
        var pEnd = new Date(start.getTime() - 86400000);
        var pStart = new Date(pEnd.getTime() - (ctx.range.days - 1) * 86400000);
        function q(body) { return http(url, Object.assign({}, H, { body: JSON.stringify(body) })).then(function (r) { return r.data.rows || []; }); }
        function totals(rows) {
          var t = { clicks: 0, impressions: 0, posSum: 0 };
          rows.forEach(function (r) { t.clicks += r.clicks; t.impressions += r.impressions; t.posSum += r.position * r.impressions; });
          t.ctr = t.impressions ? t.clicks / t.impressions : 0;
          t.position = t.impressions ? t.posSum / t.impressions : 0;
          return t;
        }
        var info = {};
        return Promise.all([
          q({ startDate: ymd(start), endDate: ymd(end), dimensions: ["date"] }),
          q({ startDate: ymd(pStart), endDate: ymd(pEnd), dimensions: ["date"] }),
          q({ startDate: ymd(start), endDate: ymd(end), dimensions: ["query"], rowLimit: 10 }),
          q({ startDate: ymd(start), endDate: ymd(end), dimensions: ["page"], rowLimit: 10 })
        ]).then(function (res) {
          info.days = res[0].map(function (r) { return { date: r.keys[0], clicks: r.clicks, impressions: r.impressions }; });
          info.current = totals(res[0]);
          info.previous = totals(res[1]);
          info.queries = res[2].map(function (r) { return { query: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: r.position }; });
          info.pages = res[3].map(function (r) { return { page: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: r.position }; });
          return { info: info, summary: Math.round(info.current.clicks) + " clicks from Google search (" + ymd(start) + " → " + ymd(end) + ")." };
        });
      }
    },
    {
      key: "gtm", tool: "gtm", name: "Google Tag Manager", color: "#2a7de1", group: "Tracking setup", google: true,
      what: "Shows the live (published) GTM version and how many tags it has – so you know when someone changed tracking.",
      fields: [
        { key: "containerId", label: "Container ID", placeholder: "GTM-ABC1234", from: ["gtm", "containerId"], help: "Filled from Tools & IDs." }
      ],
      steps: [
        "Sign in with Google at the top of this page (an account with access to the GTM container).",
        "Check the container ID and click Test."
      ],
      sync: function (ctx) {
        var c = ctx.cfg;
        need(c, ["containerId"]);
        var H = { headers: googleHeaders(ctx) };
        var B = "https://tagmanager.googleapis.com/tagmanager/v2/";
        var publicId = c.containerId.trim().toUpperCase();
        return http(B + "accounts", H).then(function (r) {
          var accounts = r.data.account || [];
          return Promise.all(accounts.map(function (a) {
            return http(B + a.path + "/containers", H).then(function (cr) { return cr.data.container || []; }, function () { return []; });
          }));
        }).then(function (lists) {
          var found = null;
          lists.forEach(function (l) { l.forEach(function (ct) { if (String(ct.publicId).toUpperCase() === publicId) found = ct; }); });
          if (!found) throw ConnectorError("Container " + publicId + " was not found in this Google account.", "Sign in with a Google account that has access to it.");
          return http(B + found.path + "/version_headers:latest", H).then(function (vr) {
            var v = vr.data || {};
            return http(B + found.path + "/versions/" + v.containerVersionId, H).then(function (full) {
              var fv = full.data || {};
              var fp = num(fv.fingerprint);
              var info = {
                container: found.name, publicId: found.publicId, version: v.containerVersionId, versionName: v.name || "",
                tags: num(v.numTags), triggers: num(v.numTriggers), variables: num(v.numVariables),
                changedAt: fp > 1e12 ? fp : null,
                tagNames: (fv.tag || []).map(function (t) { return { name: t.name, type: t.type, paused: !!t.paused }; })
              };
              return { info: info, summary: "Live version " + info.version + (info.versionName ? " (" + info.versionName + ")" : "") + " with " + info.tags + " tags." };
            });
          });
        });
      }
    },
    {
      key: "clarity", tool: "clarity", name: "Microsoft Clarity", color: "#7b4cd8", group: "Analytics",
      what: "Visitor frustration signals: rage clicks, dead clicks, quick-backs and JavaScript errors (last 1–3 days).",
      fields: [
        { key: "token", label: "Data export API token", placeholder: "eyJhbGciOi…", secret: true, help: "Clarity → Settings → Data Export → Generate new API token." }
      ],
      steps: [
        "Open clarity.microsoft.com → your project → Settings → Data Export.",
        "Click 'Generate new API token', give it a name and copy it.",
        "Paste it here. Note: Clarity allows only 10 syncs per day and shows the last 3 days."
      ],
      sync: function (ctx) {
        var c = ctx.cfg;
        need(c, ["token"]);
        return http("https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=3", { headers: { Authorization: "Bearer " + c.token.trim() } }).then(function (r) {
          var info = { metrics: {} };
          (r.data || []).forEach(function (m) {
            var first = (m.information || [])[0] || {};
            info.metrics[m.metricName] = first;
          });
          var t = info.metrics.Traffic || {};
          return { info: info, summary: num(t.totalSessionCount) + " sessions in the last 3 days." };
        });
      }
    }
  ];

  function get(key) { return CONNECTORS.find(function (c) { return c.key === key; }) || null; }

  window.TT_CONNECT = {
    CONNECTORS: CONNECTORS,
    get: get,
    makeRange: makeRange,
    googleSignIn: googleSignIn,
    googleRedirectUri: googleRedirectUri,
    parseGoogleToken: parseGoogleToken,
    IS_EXTENSION: IS_EXTENSION
  };
})();
