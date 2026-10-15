/*
 * Static reference data: platforms, standard events, checklist, glossary.
 * Everything here is written in plain language so beginners can follow it.
 */
(function () {
  "use strict";

  var STATUSES = [
    { key: "none", label: "Not set up", hint: "Nothing has been done yet." },
    { key: "progress", label: "In progress", hint: "Someone is working on it." },
    { key: "live", label: "Working", hint: "Set up and tested. Data is coming in." },
    { key: "problem", label: "Problem", hint: "Something is broken or data looks wrong." }
  ];

  var YES_NO = ["", "Yes", "No", "Not sure"];

  var PLATFORMS = [
    {
      key: "gtm",
      name: "Google Tag Manager (Web)",
      short: "GTM",
      color: "#2a7de1",
      category: "Foundation",
      what: "A 'control box' for your website. Instead of asking a developer to paste code for every tool, you install GTM once and then add Facebook, GA4, TikTok, etc. from inside GTM.",
      why: "It is the base of almost every tracking setup. Most other tools on this list are installed through it.",
      fields: [
        { key: "containerId", label: "Container ID", placeholder: "GTM-ABC1234", pattern: "^GTM-[A-Z0-9]{4,10}$", help: "Starts with GTM-. Find it in the top bar of tagmanager.google.com next to your container name." },
        { key: "account", label: "Account name", placeholder: "My Company", help: "The account the container lives in (top-left in GTM)." },
        { key: "container", label: "Container name", placeholder: "www.example.com", help: "Usually the website domain." },
        { key: "installed", label: "GTM code is on every page?", type: "select", options: YES_NO, help: "Check with the Tag Assistant extension or 'Preview' mode in GTM." },
        { key: "version", label: "Last published version", placeholder: "Version 12 – added TikTok purchase", help: "GTM > Versions. Write the number and what changed." }
      ],
      links: [
        { label: "Open Tag Manager", url: "https://tagmanager.google.com/" },
        { label: "Tag Assistant (testing)", url: "https://tagassistant.google.com/" }
      ],
      checklist: [
        { id: "gtm-1", text: "GTM container created", help: "tagmanager.google.com > Create account > choose 'Web'." },
        { id: "gtm-2", text: "GTM code added to every page (head + body)", help: "Paste both snippets GTM gives you, or use your CMS plugin (e.g. Shopify, WordPress 'GTM4WP')." },
        { id: "gtm-3", text: "Preview mode tested and container published", help: "Click 'Preview', browse your site, then 'Submit' to publish." }
      ]
    },
    {
      key: "ga4",
      name: "Google Analytics 4",
      short: "GA4",
      color: "#e37400",
      category: "Analytics",
      what: "Google's free website statistics tool. It tells you how many people visit, where they come from, what they do and what they buy.",
      why: "It is your main 'source of truth' for website traffic and sales, and it feeds data to Google Ads.",
      fields: [
        { key: "measurementId", label: "Measurement ID", placeholder: "G-ABC123XYZ9", pattern: "^G-[A-Z0-9]{6,12}$", help: "Admin > Data streams > click your web stream. Starts with G-." },
        { key: "propertyId", label: "Property ID", placeholder: "345678901", pattern: "^\\d{6,12}$", help: "Admin > Property settings. A number only." },
        { key: "streamId", label: "Stream ID", placeholder: "4567890123", pattern: "^\\d{6,14}$", help: "Shown on the web stream page." },
        { key: "apiSecret", label: "Measurement Protocol API secret", placeholder: "xxxxxxxxxxxxxxxx", sensitive: true, help: "Only needed for server-side / offline events. Data stream > Measurement Protocol API secrets." },
        { key: "retention", label: "Data retention", type: "select", options: ["", "2 months", "14 months", "Not sure"], help: "Admin > Data collection > Data retention. Set 14 months for better reports." },
        { key: "gadsLinked", label: "Linked to Google Ads?", type: "select", options: YES_NO, help: "Admin > Product links > Google Ads links." }
      ],
      links: [
        { label: "Open Google Analytics", url: "https://analytics.google.com/" },
        { label: "DebugView help", url: "https://support.google.com/analytics/answer/7201382" }
      ],
      checklist: [
        { id: "ga4-1", text: "GA4 property and web data stream created", help: "Admin > Create > Property, then add a 'Web' stream for your domain." },
        { id: "ga4-2", text: "Google tag (G-ID) firing on all pages via GTM", help: "In GTM add a 'Google Tag' with your Measurement ID, trigger: Initialization – All Pages." },
        { id: "ga4-3", text: "Key events (conversions) marked", help: "Admin > Events > mark purchase / generate_lead as Key events." },
        { id: "ga4-4", text: "Data retention set to 14 months", help: "Admin > Data collection and modification > Data retention." },
        { id: "ga4-5", text: "Internal traffic & unwanted referrals filtered", help: "Exclude your own office IP and payment gateways (PayPal, Stripe) as referrals." }
      ]
    },
    {
      key: "meta",
      name: "Meta (Facebook) Pixel & Conversions API",
      short: "Meta",
      color: "#1877f2",
      category: "Ads",
      what: "The Pixel is a small code from Facebook/Instagram that tells Meta when someone visits or buys. The Conversions API (CAPI) sends the same information from your server, so it is not blocked by browsers or ad blockers.",
      why: "Without it, Meta cannot see your sales, so your Facebook/Instagram ads cannot optimise and you cannot measure results.",
      fields: [
        { key: "pixelId", label: "Pixel / Dataset ID", placeholder: "123456789012345", pattern: "^\\d{14,17}$", help: "Events Manager > Data sources > select your pixel. A 15–16 digit number." },
        { key: "bmId", label: "Business Manager ID", placeholder: "1234567890123456", pattern: "^\\d{8,20}$", help: "Business settings > Business info." },
        { key: "adAccountId", label: "Ad account ID", placeholder: "act_1234567890", pattern: "^(act_)?\\d{6,20}$", help: "Ads Manager top-left drop-down." },
        { key: "capiToken", label: "Conversions API access token", placeholder: "EAAB...", sensitive: true, help: "Events Manager > Settings > Conversions API > Generate access token. Keep secret!" },
        { key: "testCode", label: "Test event code", placeholder: "TEST12345", help: "Events Manager > Test events. Used only while testing, remove after." },
        { key: "domainVerified", label: "Domain verified?", type: "select", options: YES_NO, help: "Business settings > Brand safety > Domains." },
        { key: "emq", label: "Event Match Quality (Purchase)", placeholder: "e.g. 7.8 / 10", help: "Events Manager > Overview > click Purchase. 6+ is OK, 8+ is great." }
      ],
      links: [
        { label: "Open Events Manager", url: "https://business.facebook.com/events_manager2/" },
        { label: "Meta Pixel Helper (Chrome)", url: "https://chromewebstore.google.com/detail/meta-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc" }
      ],
      checklist: [
        { id: "meta-1", text: "Pixel (dataset) created in Events Manager", help: "Events Manager > Connect data sources > Web." },
        { id: "meta-2", text: "Domain verified in Business settings", help: "Required for proper event setup on iOS traffic." },
        { id: "meta-3", text: "Browser Pixel firing PageView + key events", help: "Use Meta Pixel Helper to check on your website." },
        { id: "meta-4", text: "Conversions API (server) sending the same events", help: "Usually through server-side GTM / Stape or a platform integration." },
        { id: "meta-5", text: "Deduplication working (same event_id in browser + server)", help: "Events Manager > event > 'Deduplication' should show browser and server merged." },
        { id: "meta-6", text: "Event Match Quality checked (6+)", help: "Send email/phone (hashed) and fbp/fbc to improve it." }
      ]
    },
    {
      key: "tiktok",
      name: "TikTok Pixel & Events API",
      short: "TikTok",
      color: "#111111",
      category: "Ads",
      what: "Same idea as the Meta Pixel but for TikTok ads. The Pixel works in the browser, the Events API sends events from the server.",
      why: "TikTok needs to see conversions to show your ads to the right people and report results.",
      fields: [
        { key: "pixelId", label: "Pixel ID", placeholder: "C1A2B3C4D5E6F7G8H9I0", pattern: "^[A-Za-z0-9]{15,25}$", help: "TikTok Ads Manager > Tools > Events > Web events. About 20 letters/numbers." },
        { key: "adsAccountId", label: "Ad account ID", placeholder: "7012345678901234567", pattern: "^\\d{10,22}$", help: "Shown in the top-right account menu of TikTok Ads Manager." },
        { key: "bcId", label: "Business Center ID", placeholder: "7012345678901234567", help: "business.tiktok.com > Business settings." },
        { key: "accessToken", label: "Events API access token", placeholder: "xxxxxxxx", sensitive: true, help: "Events > your pixel > Settings > Generate access token. Keep secret!" },
        { key: "testCode", label: "Test event code", placeholder: "TEST12345", help: "Events > your pixel > Test events." }
      ],
      links: [
        { label: "Open TikTok Ads Manager", url: "https://ads.tiktok.com/" },
        { label: "TikTok Pixel Helper (Chrome)", url: "https://chromewebstore.google.com/detail/tiktok-pixel-helper/aelgobmabdmlfmiblddjfnjodalhidnn" }
      ],
      checklist: [
        { id: "tt-1", text: "TikTok Pixel created", help: "Tools > Events > Web events > Set up web events." },
        { id: "tt-2", text: "Browser pixel firing on site", help: "Check with TikTok Pixel Helper." },
        { id: "tt-3", text: "Events API (server) connected", help: "Via server-side GTM / Stape or your shop platform's partner integration." },
        { id: "tt-4", text: "Deduplication with event_id confirmed", help: "Use the same event_id in browser and server events." }
      ]
    },
    {
      key: "gads",
      name: "Google Ads Conversion Tracking",
      short: "Google Ads",
      color: "#34a853",
      category: "Ads",
      what: "Tells Google Ads which clicks turned into a sale or lead, so Google can bid smarter and you can see which ads make money.",
      why: "Smart bidding (Max conversions, Target ROAS) does not work well without good conversion data.",
      fields: [
        { key: "customerId", label: "Customer ID", placeholder: "123-456-7890", pattern: "^\\d{3}-?\\d{3}-?\\d{4}$", help: "Top-right corner of Google Ads." },
        { key: "conversionId", label: "Conversion ID", placeholder: "AW-123456789", pattern: "^AW-\\d{6,12}$", help: "Goals > Conversions > a conversion > Tag setup. Starts with AW-." },
        { key: "labels", label: "Conversion labels", type: "textarea", placeholder: "Purchase = AbC-D_efGhIjK\nLead = XyZ123abc", help: "One per line: name = label. The label is the text after the slash in 'AW-123/AbC...'." },
        { key: "enhanced", label: "Enhanced conversions on?", type: "select", options: YES_NO, help: "Sends hashed email/phone to improve matching. Goals > Settings." },
        { key: "ga4Linked", label: "Linked to GA4?", type: "select", options: YES_NO, help: "Tools > Data manager > Google Analytics." },
        { key: "consentMode", label: "Consent Mode v2 active?", type: "select", options: YES_NO, help: "Required for EU/EEA visitors. Usually done with a cookie banner (CMP)." }
      ],
      links: [
        { label: "Open Google Ads", url: "https://ads.google.com/" }
      ],
      checklist: [
        { id: "gads-1", text: "Conversion actions created (Purchase / Lead)", help: "Goals > Conversions > New conversion action > Website." },
        { id: "gads-2", text: "Conversion Linker + conversion tags in GTM", help: "Add a 'Conversion Linker' tag on all pages and a 'Google Ads Conversion Tracking' tag per conversion." },
        { id: "gads-3", text: "Enhanced conversions enabled", help: "Better matching for Purchase and Lead conversions." },
        { id: "gads-4", text: "Google Ads linked to GA4", help: "Lets you import audiences and see Ads data in GA4." }
      ]
    },
    {
      key: "gsc",
      name: "Google Search Console",
      short: "Search Console",
      color: "#4285f4",
      category: "SEO",
      what: "A free Google tool that shows how your website appears in Google Search: which searches show you, clicks, and technical problems.",
      why: "It is the only place to see real Google search keywords and indexing errors.",
      fields: [
        { key: "property", label: "Property (domain or URL)", placeholder: "example.com or https://www.example.com/", help: "The property name shown in the Search Console drop-down." },
        { key: "propertyType", label: "Property type", type: "select", options: ["", "Domain", "URL prefix"], help: "Domain property covers all subdomains and http/https (recommended)." },
        { key: "verification", label: "Verification method", type: "select", options: ["", "DNS record", "HTML file", "HTML tag", "Google Analytics", "Google Tag Manager"], help: "Settings > Ownership verification." },
        { key: "sitemap", label: "Sitemap URL", placeholder: "https://www.example.com/sitemap.xml", pattern: "^https?://\\S+$", help: "Indexing > Sitemaps." },
        { key: "ga4Linked", label: "Linked to GA4?", type: "select", options: YES_NO, help: "GA4 Admin > Product links > Search Console links." }
      ],
      links: [
        { label: "Open Search Console", url: "https://search.google.com/search-console" }
      ],
      checklist: [
        { id: "gsc-1", text: "Property added and verified", help: "Prefer a Domain property verified with a DNS record." },
        { id: "gsc-2", text: "Sitemap submitted", help: "Indexing > Sitemaps > enter sitemap.xml." },
        { id: "gsc-3", text: "Linked to GA4", help: "So you can see search queries inside GA4." }
      ]
    },
    {
      key: "clarity",
      name: "Microsoft Clarity",
      short: "Clarity",
      color: "#7b4cd8",
      category: "Analytics",
      what: "A free tool that records anonymous videos of visitors using your site and shows heatmaps of where people click and scroll.",
      why: "Helps you see WHY people leave or don't buy – e.g. a broken button or confusing page.",
      fields: [
        { key: "projectId", label: "Project ID", placeholder: "abcd1234ef", pattern: "^[a-z0-9]{6,14}$", help: "Clarity > Settings > Overview. Short code of letters/numbers." },
        { key: "installedVia", label: "Installed via", type: "select", options: ["", "GTM", "Website code", "Plugin / app", "Not sure"], help: "How the Clarity script was added." },
        { key: "ga4Linked", label: "Linked to GA4?", type: "select", options: YES_NO, help: "Settings > Setup > Google Analytics integration." },
        { key: "masking", label: "Masking mode", type: "select", options: ["", "Strict", "Balanced", "Relaxed"], help: "How much text is hidden in recordings (privacy). Settings > Masking." }
      ],
      links: [
        { label: "Open Clarity", url: "https://clarity.microsoft.com/" }
      ],
      checklist: [
        { id: "cl-1", text: "Clarity project created & script installed", help: "Easiest: Clarity has a GTM template / 'Install via GTM' button." },
        { id: "cl-2", text: "Recordings appearing in dashboard", help: "Can take up to 2 hours after installation." },
        { id: "cl-3", text: "Masking mode set (privacy)", help: "Use Balanced or Strict if you handle personal data." }
      ]
    },
    {
      key: "sgtm",
      name: "Server-side GTM (sGTM)",
      short: "Server GTM",
      color: "#0f9d58",
      category: "Server-side",
      what: "A second Tag Manager that runs on a server instead of in the visitor's browser. The website sends data to your own server, and the server forwards it to Meta, TikTok, GA4, Google Ads…",
      why: "More accurate data (fewer ad-blocker losses, longer-lasting first-party cookies), faster website and more control over what you share.",
      fields: [
        { key: "containerId", label: "Server container ID", placeholder: "GTM-XYZ9876", pattern: "^GTM-[A-Z0-9]{4,10}$", help: "Create a container with type 'Server' in Tag Manager." },
        { key: "taggingUrl", label: "Tagging server URL", placeholder: "https://sst.example.com", pattern: "^https://\\S+$", help: "Your server address. Best on your own sub-domain (first-party)." },
        { key: "config", label: "Container config string", placeholder: "aWQ9R1RNLVhYWFg...", sensitive: true, help: "Admin > Container settings > Container config. Needed by the hosting provider." },
        { key: "hosting", label: "Hosting", type: "select", options: ["", "Stape", "Google Cloud Run", "App Engine", "Other"], help: "Where the server container runs." },
        { key: "clients", label: "Clients used", placeholder: "GA4, Data Client, Meta…", help: "Clients receive incoming data in the server container." }
      ],
      links: [
        { label: "Open Tag Manager", url: "https://tagmanager.google.com/" },
        { label: "Server-side tagging intro", url: "https://developers.google.com/tag-platform/tag-manager/server-side" }
      ],
      checklist: [
        { id: "sgtm-1", text: "Server container created", help: "Tag Manager > Admin > Create container > Server." },
        { id: "sgtm-2", text: "Hosting set up (Stape or Cloud Run)", help: "Paste the container config string into your hosting provider." },
        { id: "sgtm-3", text: "Custom sub-domain (e.g. sst.yoursite.com) connected", help: "Add the DNS records your host gives you. Makes cookies first-party." },
        { id: "sgtm-4", text: "Web GTM sends data to the server URL", help: "In the web Google Tag set 'server_container_url' to your tagging URL." },
        { id: "sgtm-5", text: "Server preview tested for every platform", help: "Check that each outgoing request (Meta, TikTok, GA4…) returns status 200." }
      ]
    },
    {
      key: "stape",
      name: "Stape (server hosting)",
      short: "Stape",
      color: "#ff5a36",
      category: "Server-side",
      what: "A company that hosts your server-side GTM container for you – no coding or Google Cloud knowledge needed. It also has helper tools (Cookie Keeper, Custom Loader, etc.).",
      why: "The easiest and cheapest way for beginners to run server-side tracking.",
      fields: [
        { key: "containerName", label: "Stape container name", placeholder: "example-shop", help: "Name of the container in your Stape dashboard." },
        { key: "stapeUrl", label: "Default Stape URL", placeholder: "https://abcdefg.eu.stape.io", pattern: "^https://\\S+$", help: "Stape dashboard > container > 'Default domain'." },
        { key: "customDomain", label: "Custom domain", placeholder: "https://sst.example.com", pattern: "^https://\\S+$", help: "Your own sub-domain connected in Stape (recommended)." },
        { key: "plan", label: "Plan", type: "select", options: ["", "Free", "Pro", "Business", "Enterprise", "Custom"], help: "Free plan has a request limit – check usage monthly." },
        { key: "accountEmail", label: "Stape login email", placeholder: "marketing@example.com", help: "Who owns the Stape account." },
        { key: "customLoader", label: "Custom Loader on?", type: "select", options: YES_NO, help: "Loads GTM from your domain so ad blockers block it less." },
        { key: "cookieKeeper", label: "Cookie Keeper on?", type: "select", options: YES_NO, help: "Keeps tracking cookies alive longer (helps Safari/iOS)." }
      ],
      links: [
        { label: "Open Stape", url: "https://app.stape.io/" },
        { label: "Stape guides", url: "https://stape.io/blog" }
      ],
      checklist: [
        { id: "stape-1", text: "Stape container created with sGTM config", help: "Paste the server container config from GTM." },
        { id: "stape-2", text: "Custom domain connected and SSL active", help: "Add DNS records (A/CNAME) from Stape; wait for green status." },
        { id: "stape-3", text: "Custom Loader / Cookie Keeper enabled", help: "Power-ups in Stape dashboard." },
        { id: "stape-4", text: "Monthly request usage checked", help: "If you go over your plan limit, tracking stops." }
      ]
    },
    {
      key: "consent",
      name: "Cookie Banner / Consent Mode",
      short: "Consent",
      color: "#8d6e63",
      category: "Foundation",
      what: "The cookie pop-up that asks visitors for permission. 'Consent Mode' tells Google, Meta etc. what each visitor allowed.",
      why: "Required by law in many countries (EU/UK GDPR). Google Ads needs Consent Mode v2 for EU traffic.",
      fields: [
        { key: "cmp", label: "Consent tool (CMP)", placeholder: "Cookiebot, CookieYes, OneTrust…", help: "The company/app that shows your cookie banner." },
        { key: "cmpId", label: "CMP ID / domain group ID", placeholder: "abcd-1234-…", help: "Found in your CMP dashboard." },
        { key: "consentModeV2", label: "Google Consent Mode v2?", type: "select", options: YES_NO, help: "Sends ad_storage, analytics_storage, ad_user_data, ad_personalization." },
        { key: "mode", label: "Mode", type: "select", options: ["", "Basic", "Advanced", "Not sure"], help: "Advanced = Google tags load before consent but send cookieless pings." }
      ],
      links: [
        { label: "Consent Mode guide", url: "https://developers.google.com/tag-platform/security/guides/consent" }
      ],
      checklist: [
        { id: "cons-1", text: "Cookie banner showing to visitors", help: "Install your CMP (often via GTM template)." },
        { id: "cons-2", text: "Consent Mode v2 signals sent", help: "Check in GTM Preview > Consent tab." },
        { id: "cons-3", text: "Tags respect consent (don't fire when declined)", help: "Test by rejecting cookies and watching tags in Preview." }
      ]
    },
    {
      key: "msads",
      name: "Microsoft Ads (Bing) UET",
      short: "Microsoft Ads",
      color: "#00a4ef",
      category: "Ads",
      optional: true,
      what: "The tracking tag for Microsoft/Bing ads (called UET).",
      why: "Needed if you run ads on Bing, Yahoo or Microsoft network.",
      fields: [
        { key: "uetId", label: "UET tag ID", placeholder: "12345678", pattern: "^\\d{6,10}$", help: "Tools > UET tag." },
        { key: "accountId", label: "Account ID", placeholder: "F123ABCD", help: "Shown in Microsoft Advertising account menu." }
      ],
      links: [{ label: "Open Microsoft Ads", url: "https://ads.microsoft.com/" }],
      checklist: [
        { id: "ms-1", text: "UET tag installed and verified", help: "Use the 'UET Tag Helper' Chrome extension." }
      ]
    },
    {
      key: "pinterest",
      name: "Pinterest Tag",
      short: "Pinterest",
      color: "#e60023",
      category: "Ads",
      optional: true,
      what: "Pinterest's tracking code for ads.",
      why: "Needed if you advertise on Pinterest.",
      fields: [
        { key: "tagId", label: "Tag ID", placeholder: "2612345678901", pattern: "^\\d{10,16}$", help: "Ads > Conversions." },
        { key: "capiToken", label: "Conversions API token", placeholder: "pina_...", sensitive: true, help: "Only if using server-side." }
      ],
      links: [{ label: "Open Pinterest Ads", url: "https://ads.pinterest.com/" }],
      checklist: [
        { id: "pin-1", text: "Pinterest Tag installed and checked", help: "Use Pinterest Tag Helper." }
      ]
    },
    {
      key: "snapchat",
      name: "Snapchat Pixel",
      short: "Snapchat",
      color: "#f7d900",
      category: "Ads",
      optional: true,
      what: "Snapchat's tracking code for ads.",
      why: "Needed if you advertise on Snapchat.",
      fields: [
        { key: "pixelId", label: "Pixel ID", placeholder: "a1b2c3d4-....", help: "Ads Manager > Events Manager." },
        { key: "capiToken", label: "Conversions API token", placeholder: "xxxx", sensitive: true, help: "Only if using server-side." }
      ],
      links: [{ label: "Open Snapchat Ads", url: "https://ads.snapchat.com/" }],
      checklist: [
        { id: "snap-1", text: "Snap Pixel installed and checked", help: "Use Snap Pixel Helper." }
      ]
    }
  ];

  /*
   * Extra built-in tools (optional – switch them on per website in
   * "Website settings"). Written compactly: every tool gets a main ID field,
   * optional extra fields, an access-token field when it has a server API,
   * and a basic checklist.
   */
  function tool(key, name, short, color, category, what, why, idLabel, idPlaceholder, url, opts) {
    opts = opts || {};
    var fields = [{ key: "mainId", label: idLabel, placeholder: idPlaceholder, help: opts.idHelp || "Find this in the tool's settings / installation page." }];
    (opts.fields || []).forEach(function (f) { fields.push(f); });
    if (opts.token) fields.push({ key: "apiToken", label: opts.token, placeholder: "xxxxxxxx", sensitive: true, help: "Secret key used for server-side sending. Keep it private!" });
    return {
      key: key, name: name, short: short, color: color, category: category, optional: true,
      what: what, why: why, fields: fields,
      links: url ? [{ label: "Open " + short, url: url }] : [],
      checklist: opts.checklist || [
        { id: key + "-1", text: short + " account / project created", help: "Create the account and copy the ID into this page." },
        { id: key + "-2", text: short + " installed on the website", help: opts.install || "Usually through a GTM template, a plugin/app, or a code snippet." },
        { id: key + "-3", text: short + " tested – data is arriving", help: "Open the tool and check that today's visits/events appear." }
      ]
    };
  }

  var SELECT_YN = { type: "select", options: YES_NO };

  PLATFORMS = PLATFORMS.concat([
    // ---- More ad platforms ----
    tool("x", "X (Twitter) Pixel", "X Ads", "#000000", "Ads", "The tracking code for ads on X (formerly Twitter).", "Needed if you run ads on X.", "Pixel ID", "o1234", "https://ads.x.com/", { token: "Conversions API token" }),
    tool("reddit", "Reddit Pixel", "Reddit", "#ff4500", "Ads", "Reddit's tracking code for ads.", "Needed if you advertise on Reddit.", "Pixel ID", "t2_abc123", "https://ads.reddit.com/", { token: "Conversions API token" }),
    tool("gmc", "Google Merchant Center", "Merchant Center", "#1a73e8", "Ads", "Where your product feed lives for Google Shopping ads and free listings.", "Needed to show products in Google Shopping.", "Merchant ID", "123456789", "https://merchants.google.com/", { fields: [{ key: "feedUrl", label: "Product feed URL", placeholder: "https://…/feed.xml", help: "Products > Feeds." }, Object.assign({ key: "gadsLinked", label: "Linked to Google Ads?", help: "Settings > Linked accounts." }, SELECT_YN)] }),
    tool("metacatalog", "Meta Product Catalog", "Meta Catalog", "#4267b2", "Ads", "Your product list inside Meta Commerce Manager for dynamic/catalog ads.", "Needed for Advantage+ catalog ads and Instagram/Facebook shops.", "Catalog ID", "123456789012345", "https://business.facebook.com/commerce/", { fields: [{ key: "feedUrl", label: "Feed URL", placeholder: "https://…/feed.xml", help: "Data sources inside the catalog." }] }),
    // ---- Analytics / behaviour ----
    tool("hotjar", "Hotjar", "Hotjar", "#fd3a5c", "Analytics", "Heatmaps, session recordings and on-site surveys.", "Shows how people use your pages, like Clarity.", "Site ID", "1234567", "https://insights.hotjar.com/"),
    // ---- Server-side & tag management alternatives ----
    tool("addingwell", "Addingwell (sGTM hosting)", "Addingwell", "#4c3cf6", "Server-side", "Another hosting service for server-side GTM, like Stape.", "Runs your server container for you.", "Container name", "my-container", "https://app.addingwell.com/", { fields: [{ key: "serverUrl", label: "Tagging server URL", placeholder: "https://sst.example.com", help: "Your custom domain." }] }),
    tool("taggrs", "TAGGRS (sGTM hosting)", "TAGGRS", "#00c27a", "Server-side", "Another hosting service for server-side GTM.", "Runs your server container for you.", "Container name", "my-container", "https://taggrs.io/", { fields: [{ key: "serverUrl", label: "Tagging server URL", placeholder: "https://sst.example.com", help: "Your custom domain." }] }),
    tool("cloudrun", "Google Cloud Run (self-hosted sGTM)", "Cloud Run", "#4285f4", "Server-side", "Running server-side GTM yourself on Google Cloud.", "More control, but you manage billing and scaling.", "GCP project ID", "my-sgtm-project", "https://console.cloud.google.com/run", { fields: [{ key: "region", label: "Region", placeholder: "europe-west1", help: "Where the server runs." }, { key: "serverUrl", label: "Service / custom domain URL", placeholder: "https://sst.example.com", help: "The tagging server address." }, { key: "billing", label: "Billing account / monthly cost", placeholder: "~$120/month", help: "Keep an eye on cost." }] }),
    tool("zaraz", "Cloudflare Zaraz", "Zaraz", "#f38020", "Server-side", "Cloudflare's tool that loads tags from its servers instead of the browser.", "Faster site and server-side delivery, if your site uses Cloudflare.", "Cloudflare zone / domain", "example.com", "https://dash.cloudflare.com/"),
    tool("elevar", "Elevar (Shopify)", "Elevar", "#2d2a6e", "Server-side", "A Shopify app that builds the data layer and sends server-side events to ad platforms.", "Popular, ready-made accurate tracking for Shopify shops.", "Elevar account / store", "my-store.myshopify.com", "https://app.getelevar.com/"),
    // ---- Site platform ----
    tool("shop", "Shop / CMS platform", "Website platform", "#5e8e3e", "Foundation", "The system your website runs on: Shopify, WooCommerce, WordPress, Wix, Webflow…", "Many tracking setups depend on which platform and which apps/plugins you use.", "Platform", "Shopify / WooCommerce / WordPress…", "", { fields: [{ key: "trackingApps", label: "Tracking apps / plugins installed", type: "textarea", placeholder: "GTM4WP\nPixelYourSite\nShopify Facebook channel", help: "List every app that adds tracking – duplicates cause double counting!" }, { key: "admin", label: "Admin URL", placeholder: "https://example.com/wp-admin", help: "Where you log in." }], checklist: [
      { id: "shop-1", text: "List every app/plugin that adds tracking", help: "Shopify: Settings > Apps and Customer events. WordPress: Plugins. Write them in 'Tracking apps' above." },
      { id: "shop-2", text: "Each pixel is installed only ONCE (app or GTM, not both)", help: "Two installations = double counted sales." },
      { id: "shop-3", text: "Checkout / thank-you page tracking confirmed", help: "Shopify checkout needs 'Customer events' or an app – theme code does not run there." },
      { id: "shop-4", text: "Test order placed and seen in every platform", help: "Use a 100% discount code, then check GA4, Meta, TikTok and Google Ads." }
    ] })
  ]);

  // The shop platform is part of every setup, so it is on by default.
  PLATFORMS.forEach(function (p) { if (p.key === "shop") p.optional = false; });

  /* Categories used to group tools (also offered when you create your own tool). */
  var CATEGORIES = ["Foundation", "Analytics", "Ads", "Server-side", "SEO", "Other"];

  /* Destinations an event can be sent to (column headers on the Events page). */
  var EVENT_DESTINATIONS = [
    { key: "ga4", label: "GA4" },
    { key: "meta", label: "Meta" },
    { key: "tiktok", label: "TikTok" },
    { key: "gads", label: "Google Ads" },
    { key: "msads", label: "Microsoft Ads" },
    { key: "pinterest", label: "Pinterest" },
    { key: "snapchat", label: "Snapchat" },
    { key: "x", label: "X" },
    { key: "reddit", label: "Reddit" },
    { key: "sgtm", label: "Server GTM" }
  ];

  /*
   * Standard events and the name each platform uses for them.
   * Beginners can add these with one click.
   */
  var EVENT_LIBRARY = [
    {
      name: "Page view", trigger: "Every page load", step: 1,
      plain: "Someone opened a page of your store.",
      params: "page_location, page_title",
      map: { ga4: "page_view", meta: "PageView", tiktok: "Pageview (automatic)", msads: "page_view", pinterest: "pagevisit", snapchat: "PAGE_VIEW", x: "PageView", reddit: "PageVisit" }
    },
    {
      name: "View collection / category", trigger: "Collection or category page opened", step: 2,
      plain: "Someone looked at a list of products.",
      params: "item_list_name, items",
      map: { ga4: "view_item_list", meta: "ViewCategory (custom)", tiktok: "", pinterest: "viewcategory" }
    },
    {
      name: "View product", trigger: "Product page opened", step: 3,
      plain: "Someone looked at a product.",
      params: "content_ids / items, value, currency",
      map: { ga4: "view_item", meta: "ViewContent", tiktok: "ViewContent", msads: "view_item", pinterest: "pagevisit", snapchat: "VIEW_CONTENT", x: "ContentView", reddit: "ViewContent" }
    },
    {
      name: "Search", trigger: "Store search used", step: 3,
      plain: "Someone used the search box in your store.",
      params: "search_term",
      map: { ga4: "search", meta: "Search", tiktok: "Search", msads: "search", pinterest: "search", snapchat: "SEARCH", x: "Search", reddit: "Search" }
    },
    {
      name: "Add to cart", trigger: "Add-to-cart button clicked", step: 4,
      plain: "Someone put a product in the cart.",
      params: "items / content_ids, value, currency",
      map: { ga4: "add_to_cart", meta: "AddToCart", tiktok: "AddToCart", gads: "Add to cart (secondary)", msads: "add_to_cart", pinterest: "addtocart", snapchat: "ADD_CART", x: "AddToCart", reddit: "AddToCart" }
    },
    {
      name: "View cart", trigger: "Cart page / drawer opened", step: 5,
      plain: "Someone opened their cart.",
      params: "items, value, currency",
      map: { ga4: "view_cart" }
    },
    {
      name: "Start checkout", trigger: "Checkout page opened", step: 6,
      plain: "Someone started the checkout.",
      params: "items, value, currency",
      map: { ga4: "begin_checkout", meta: "InitiateCheckout", tiktok: "InitiateCheckout", gads: "Begin checkout (secondary)", msads: "begin_checkout", pinterest: "checkout", snapchat: "START_CHECKOUT", x: "CheckoutInitiated" }
    },
    {
      name: "Add shipping info", trigger: "Shipping step completed", step: 7,
      plain: "Someone entered their delivery address.",
      params: "shipping_tier, value, currency",
      map: { ga4: "add_shipping_info" }
    },
    {
      name: "Add payment info", trigger: "Payment step completed", step: 8,
      plain: "Someone entered payment details.",
      params: "payment_type, value, currency",
      map: { ga4: "add_payment_info", meta: "AddPaymentInfo", tiktok: "AddPaymentInfo", snapchat: "ADD_BILLING", x: "AddedPaymentInfo" }
    },
    {
      name: "Purchase", trigger: "Thank-you / order confirmation page", step: 9,
      plain: "Someone bought something. The MOST important event – everything else is secondary.",
      params: "transaction_id, value, currency, items, event_id (dedup), email/phone (hashed)",
      map: { ga4: "purchase", meta: "Purchase", tiktok: "CompletePayment / Purchase", gads: "Purchase conversion", msads: "purchase", pinterest: "checkout", snapchat: "PURCHASE", x: "Purchase", reddit: "Purchase", sgtm: "purchase (forwarded)" }
    },
    {
      name: "Refund", trigger: "Order refunded (sent from server/shop)", step: 10,
      plain: "An order was refunded – removes the revenue from reports.",
      params: "transaction_id, value, currency",
      map: { ga4: "refund" }
    },
    {
      name: "Sign up / create account", trigger: "Account created", step: 0,
      plain: "Someone created a customer account.",
      params: "method",
      map: { ga4: "sign_up", meta: "CompleteRegistration", tiktok: "CompleteRegistration", pinterest: "signup", snapchat: "SIGN_UP", x: "SignUp", reddit: "SignUp" }
    }
  ];

  /*
   * Live scan rules (used by the Chrome extension). Each rule recognises a
   * tracking request in the browser's network traffic and pulls out the ID
   * and event name.
   */
  var DETECTORS = [
    { tool: "gtm", label: "Google Tag Manager", match: /googletagmanager\.com\/gtm\.js|\/gtm\.js\?id=GTM-/i, idParam: "id", eventName: "container loaded" },
    { tool: "ga4", label: "Google Analytics 4", match: /(google-analytics\.com|analytics\.google\.com)\/g\/collect|\/g\/collect\?v=2/i, idParam: "tid", eventParam: "en" },
    { tool: "ga4", label: "Google tag (gtag.js)", match: /googletagmanager\.com\/gtag\/js\?id=G-/i, idParam: "id", eventName: "tag loaded" },
    { tool: "gads", label: "Google Ads", match: /googleadservices\.com\/pagead\/conversion|googleads\.g\.doubleclick\.net\/pagead\/(viewthrough)?conversion|google\.com\/pagead\/1p-conversion/i, idFromPath: /conversion\/(\d+)/, idPrefix: "AW-", eventParam: "label", eventFallback: "remarketing / page view" },
    { tool: "gads", label: "Google tag (Ads)", match: /googletagmanager\.com\/gtag\/js\?id=AW-/i, idParam: "id", eventName: "tag loaded" },
    { tool: "meta", label: "Meta Pixel", match: /facebook\.com\/tr\/?\?|facebook\.com\/tr$/i, idParam: "id", eventParam: "ev", dedupParam: "eid" },
    { tool: "meta", label: "Meta Pixel script", match: /connect\.facebook\.net\/.*\/fbevents\.js|connect\.facebook\.net\/signals\/config\/(\d+)/i, idFromPath: /config\/(\d+)/, eventName: "script loaded" },
    { tool: "tiktok", label: "TikTok Pixel", match: /analytics\.tiktok\.com\/api\/v2\/pixel|analytics\.tiktok\.com\/i18n\/pixel\/events\.js/i, idParam: "sdkid", eventName: "pixel active", bodyId: "pixel_code", bodyEvent: "event" },
    { tool: "clarity", label: "Microsoft Clarity", match: /clarity\.ms\/tag\/|\.clarity\.ms\/collect/i, idFromPath: /tag\/([a-z0-9]+)/i, eventName: "recording" },
    { tool: "msads", label: "Microsoft Ads (UET)", match: /bat\.bing\.com\/action/i, idParam: "ti", eventParam: "ea", eventFallback: "page view" },
    { tool: "pinterest", label: "Pinterest Tag", match: /ct\.pinterest\.com\/v3|ct\.pinterest\.com\/user/i, idParam: "tid", eventParam: "event" },
    { tool: "snapchat", label: "Snapchat Pixel", match: /tr\.snapchat\.com\/(p|cm|gateway)/i, idParam: "pid", eventParam: "ev" },
    { tool: "x", label: "X (Twitter) Pixel", match: /analytics\.twitter\.com\/i\/adsct|static\.ads-twitter\.com\/uwt\.js|ads-api\.x\.com/i, idParam: "txn_id", eventParam: "events" },
    { tool: "reddit", label: "Reddit Pixel", match: /alb\.reddit\.com\/rp\.gif|redditstatic\.com\/ads\/pixel\.js/i, idParam: "id", eventParam: "event" },
    { tool: "hotjar", label: "Hotjar", match: /static\.hotjar\.com\/c\/hotjar-(\d+)/i, idFromPath: /hotjar-(\d+)/, eventName: "recording" },
    { tool: "stape", label: "Stape server", match: /\.stape\.(io|net)\//i, eventName: "server request" }
  ];

  /*
   * Plain-language fixes for the problems the app can detect.
   * "steps" are written for non-technical people.
   */
  var FIXES = {
    notInstalled: { title: "Tool not found on the website", steps: ["Open GTM and check the tag for this tool exists and is published (Submit > Publish).", "Check the trigger is 'All Pages' (or the right page).", "If you installed it with a shop app/plugin, check the app is switched on.", "Re-scan the page with the Chrome extension."] },
    wrongId: { title: "The website uses a different ID than you saved", steps: ["Somebody may have installed an old or wrong pixel/ID.", "Compare the ID in the tool's dashboard with the one in GTM / the shop app.", "Update GTM (or the app), publish, and re-scan.", "If the saved ID here is wrong, just correct it on the tool page."] },
    duplicate: { title: "Event fires more than once (double counting)", steps: ["Usually the same pixel is installed twice – e.g. by a shop app AND by GTM.", "Pick ONE way of installing each pixel and turn the other off.", "For browser + server (CAPI) setups, make sure both send the same event_id so the platform can merge them.", "Re-test with a test order."] },
    noPurchase: { title: "Purchase is not being tracked", steps: ["Make a test order (or use a 100% discount code).", "On the thank-you page, run the extension scan or GTM Preview.", "Check the purchase tag's trigger matches the thank-you page / purchase dataLayer event.", "On Shopify, checkout tracking must use 'Customer events' / an app – GTM on the theme does not run on checkout pages."] },
    noDedup: { title: "Browser + server events without deduplication", steps: ["When you send an event from the browser AND the server (CAPI / Events API), both must carry the same event_id.", "In GTM set the same event ID variable in the browser pixel tag and the server tag.", "In Meta Events Manager open the event > check 'Deduplication' shows browser and server merged."] },
    lowMatch: { title: "Platform reports far fewer sales than your shop", steps: ["Some loss is normal (ad blockers, people who didn't accept cookies). 70–95% is typical.", "Below 70% usually means something is broken: check the Purchase tag fires on every order.", "Add server-side tracking (CAPI / Events API via Stape) to recover lost sales.", "Check the cookie banner is not blocking tags for everyone."] },
    highMatch: { title: "Platform reports MORE sales than your shop", steps: ["Purchase is probably counted twice (page reload of thank-you page, or two installations).", "Use transaction_id / event_id so repeated sends are ignored.", "Check there is only one installation of the pixel (app OR GTM, not both).", "Remember: ad platforms also count 'view-through' sales, so Meta/TikTok can be a bit higher – but more than ~120% is a red flag."] },
    problemStatus: { title: "Marked as Problem", steps: ["Read the notes on the tool page to see what was found.", "Fix it, re-test, then change the status back to Working."] },
    testCode: { title: "Test event code still filled in", steps: ["Test codes are only for testing. Remove it from the server tag (and from this page) after testing, otherwise events may only show in 'Test events'."] },
    badFormat: { title: "ID looks wrong", steps: ["Compare with the format shown in the grey example text in the field.", "Copy the ID directly from the tool's dashboard to avoid typos."] },
    staleCheck: { title: "Not checked for a long time", steps: ["Tracking breaks silently – theme updates, new apps and checkout changes often break pixels.", "Do a quick test (scan or test order) and update 'Last checked'."] },
    multiApps: { title: "Several tracking apps/plugins installed", steps: ["Two apps sending the same pixel = double counting.", "Keep one app per platform and remove the duplicates."] }
  };

  var GLOSSARY = [
    { term: "Pixel / Tag", text: "A small piece of code on your website that sends information (like 'someone bought') to a platform such as Facebook or Google. 'Tag' and 'pixel' mean almost the same thing." },
    { term: "Event", text: "Something a visitor does that you want to count: viewing a page, adding to cart, buying, filling a form." },
    { term: "Conversion / Key event", text: "An event that is valuable to your business – usually a purchase or a lead. Ad platforms optimise for conversions." },
    { term: "Parameters", text: "Extra details sent with an event, e.g. the price (value), currency, product IDs or order number." },
    { term: "Google Tag Manager (GTM)", text: "A free tool to manage all your tags in one place without editing website code each time." },
    { term: "Container", text: "Your 'box' in GTM that holds all tags, triggers and variables for one website (web container) or one server (server container)." },
    { term: "Trigger", text: "A rule in GTM that says WHEN a tag fires, e.g. 'on the thank-you page' or 'when the form is submitted'." },
    { term: "Variable", text: "A value GTM reads from the page, e.g. the order total or the product name, so it can be passed to tags." },
    { term: "Data layer", text: "A hidden list on your website where the shop/developer puts information (order value, products…) so GTM can read it reliably." },
    { term: "Client-side (browser) tracking", text: "Tracking that runs in the visitor's browser. Easy to set up but can be blocked by ad blockers, Safari and privacy settings." },
    { term: "Server-side tracking", text: "Your website sends data to your own server first, and the server forwards it to Meta, Google, TikTok… More accurate and private, a bit more setup." },
    { term: "Conversions API (CAPI) / Events API", text: "The server-side way to send events to Meta (CAPI) or TikTok (Events API). Works together with the browser pixel." },
    { term: "Deduplication", text: "When the same purchase is sent both from the browser and the server, the platform must count it only once. It does this by matching an identical event_id." },
    { term: "event_id", text: "A unique code for each event (e.g. the order number). Must be the same in the browser and server versions of an event for deduplication." },
    { term: "Event Match Quality (EMQ)", text: "Meta's score (0–10) for how well it can match your events to Facebook users. Sending hashed email/phone raises it." },
    { term: "Hashing", text: "Turning personal data (like an email) into a scrambled code (SHA-256) before sending, so the real value is not shared." },
    { term: "First-party cookie", text: "A cookie set by your own domain. Lasts longer and is trusted more by browsers than third-party cookies." },
    { term: "Consent Mode", text: "Google's system that adjusts tags based on what the visitor allowed in your cookie banner." },
    { term: "UTM parameters", text: "Tags added to links (utm_source, utm_medium, utm_campaign) so GA4 knows where a visitor came from." },
    { term: "Attribution", text: "Deciding which ad or channel gets credit for a sale. Different tools often report different numbers because they use different rules." },
    { term: "Measurement ID", text: "Your GA4 identifier that starts with G-. Tells the tag which GA4 property to send data to." },
    { term: "Stape", text: "A hosting service that runs your server-side GTM container for you." },
    { term: "Heatmap / Session recording", text: "Visual reports (e.g. in Clarity) that show where people click and scroll, or a replay of a visit." },
    { term: "Match rate / capture rate", text: "How many of your real shop orders a platform also saw. Shop 100 orders, Meta 82 purchases = 82%. 70–95% is normal; much lower means tracking is broken; above ~120% means double counting." },
    { term: "ROAS", text: "Return On Ad Spend = revenue ÷ ad spend. ROAS 3 means every 1 spent on ads brought back 3 in sales." },
    { term: "AOV", text: "Average Order Value = revenue ÷ number of orders." },
    { term: "Conversion rate", text: "Orders ÷ sessions (visits). An online store usually converts 1–3% of visits." },
    { term: "Debug / Preview mode", text: "A testing mode (in GTM, GA4 DebugView, Meta Test Events) where you can see events live before publishing." }
  ];

  (typeof window !== "undefined" ? window : self).TT_DATA = {
    STATUSES: STATUSES,
    PLATFORMS: PLATFORMS,
    CATEGORIES: CATEGORIES,
    EVENT_DESTINATIONS: EVENT_DESTINATIONS,
    EVENT_LIBRARY: EVENT_LIBRARY,
    DETECTORS: DETECTORS,
    FIXES: FIXES,
    GLOSSARY: GLOSSARY
  };
})();
