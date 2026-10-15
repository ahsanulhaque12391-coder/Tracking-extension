# Tracking Health Hub

**One place to check whether your online store's tracking is working:** Meta (Facebook) Pixel & Conversions API, Google Tag Manager, GA4, TikTok, Google Ads, server-side tracking (sGTM / Stape), Clarity, Search Console, and more.

It's written for beginners. Every field says what it is and where to find it, and every problem comes with "How to fix" steps in plain English.

---

## What it does

| Page | What you get |
|---|---|
| **Good & bad** | Automatic insights written in plain words: revenue trend, best and worst ads, platforms below break-even, ad fatigue, traffic that doesn't convert, mobile vs desktop, Google search trend, rage clicks / JS errors (Clarity), recent GTM changes, pixel problems. |
| **Ads performance** | Every ad (Meta, TikTok) and campaign (Google Ads) judged against **your** profit targets: Winner / Profitable / Watch / Losing money / Too early. It explains why (low click rate, no sales, ad fatigue, expensive sales…) and what to do next. Data comes from a connection or a CSV export. |
| **Connections** | Connect Shopify, WooCommerce, Meta Ads & Pixel, TikTok Ads, Google Ads, GA4, Search Console, Tag Manager and Clarity. One click on **Sync everything** pulls in the latest numbers. |
| **Health dashboard** | A traffic light (🟢 all good / 🟠 needs attention / 🔴 broken), a list of problems with fixes, the status of every tool, revenue and ROAS. |
| **Tools & IDs** | Every tracking tool with its IDs (Pixel ID, GTM-…, G-…, AW-…), status, who manages it, when it was last checked, a checklist and notes. Warns you if an ID looks wrong. |
| **Events (funnel)** | The shopping journey (view product → add to cart → checkout → **purchase**) and what each platform calls each event. |
| **Numbers & gaps** | Real shop orders vs what GA4 and each ad platform recorded. You fill it in automatically from Connections, or by hand. It shows the **tracking gap** (lost or double-counted sales), the **attribution gap** (platforms together claiming more sales than you made) and **where sales really come from** according to GA4. |
| **Live scan** *(Chrome extension)* | Open your store and click the icon. It shows which pixels really fire, with their IDs and events, and flags the wrong ID, a missing pixel, a double-fired PageView/Purchase, a Purchase missing on the thank-you page, missing deduplication, and no server-side traffic. |
| **Setup checklist** | Step-by-step setup tasks for every tool, in a sensible order. |
| **Activity log** | A diary of changes, so you can see "it broke after we installed app X". |
| **Learn the basics** | How tracking fits together, the 5 most common problems, an event-name cheat sheet and a glossary. |
| **My stores** | Manage several stores or clients, and search for any ID across all of them. |
| **Backup & settings** | Export or import backups (.json), CSV files, a printable/PDF report, and dark mode. |

### Connecting your tools
Open **Connections**. Each tool has step-by-step instructions inside the app. Short version:

| Tool | What you need | Notes |
|---|---|---|
| Shopify | Store address + Admin API token from a custom app with `read_orders` | Extension version only (Shopify blocks normal web pages) |
| WooCommerce | Website + REST API key/secret (Read) | Extension version recommended |
| Meta Ads & Pixel | Access token with `ads_read` (a System User token never expires) | Works everywhere |
| TikTok Ads | Long-term token from a TikTok API for Business developer app | Extension version only. CSV import is the easy alternative |
| Google Ads | Google sign-in + developer token (Google Ads API Center) | Developer token needs "Basic access" approval. Until then, use CSV import |
| GA4, Search Console, Tag Manager | Google sign-in only | One-time Google Cloud OAuth Client ID setup, explained in the app |
| Microsoft Clarity | Data Export API token (Clarity → Settings → Data Export) | Max 10 syncs/day, last 3 days |
| Anything else | Import a CSV report from any ads manager | Columns are recognised automatically, and you can fix the mapping |

Google sign-in lasts 1 hour (that's how Google's browser sign-in works). Just click **Sign in with Google** again when it expires.

### Add any tool
- **24 built-in tools** in these groups:
  - Ads: Meta, TikTok, Google Ads, Microsoft Ads, Pinterest, Snapchat, X, Reddit, Merchant Center, Meta Catalog
  - Analytics: GA4, Clarity, Hotjar
  - Server-side: sGTM, Stape, Addingwell, TAGGRS, Cloud Run, Cloudflare Zaraz, Elevar
  - Search: Search Console
  - Setup: cookie banner / Consent Mode, and your shop platform
- **Several copies of the same tool.** For example, two Meta pixels or two server containers: use "Add another".
- **Create your own tool** for anything that isn't listed. You choose its name, colour, fields (with secret fields for tokens) and checklist.
- **Extra fields** on any tool for anything else you want to remember.

---

## How to use it

### Option A – the Chrome extension (recommended, includes Live scan)
1. Download this folder (on GitHub: **Code → Download ZIP**, then unzip).
2. In Chrome, open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the folder that contains `manifest.json`.
4. Pin the extension. Click it and choose **Open dashboard** to use the hub.
5. Open your store and click the extension icon to scan it. Then click **Save scan to hub**.

Scan these 3 pages: the homepage, a product page, and the **thank-you page after a test order**. Most problems hide on the thank-you page.

### Option B – just the web app
Double-click `index.html`, or host the folder on any static host (GitHub Pages, Netlify…). Everything works except Live scan.

> **Note:** the extension's dashboard and a web-app copy each keep their own data. To move data between them, use **Backup & settings → Export / Import**.

---

## Good to know
- **Each platform counts sales its own way.** Meta, TikTok and Google Ads each claim credit for sales, so their numbers added together are usually higher than your real orders. The app shows this gap. Judge overall success by **real shop revenue ÷ total ad spend**.
- **Set your targets.** On Ads performance, set your **break-even ROAS** to 1 ÷ your profit margin (there's a calculator). The app judges every ad against it.

## Privacy
- Everything is stored **only in your browser** (localStorage). There is no server and no account. API keys are only ever sent to the tool they belong to (Meta, Google, Shopify…).
- The extension only reads network requests in your own browser so it can recognise tracking pixels. It sends nothing anywhere.
- Secret tokens (CAPI token, API secrets, connection keys) are hidden by default and are **left out of exports** unless you tick "Include secret tokens".

## Files
```
index.html        the dashboard (web app)
popup.html        the extension popup
manifest.json     Chrome extension settings
background.js     extension: watches tracking requests per tab
js/data.js        tools, events, fixes, glossary, detection rules (edit here to add built-in tools)
js/store.js       saving / loading data
js/scan.js        live-scan detection + problem analysis
js/connectors.js  API connections (Shopify, WooCommerce, Meta, TikTok, Google Ads, GA4, Search Console, GTM, Clarity)
js/ads.js         ad verdicts (winner / losing…) + CSV import
js/app.js         dashboard screens
js/popup.js       extension popup screen
css/              styles (light + dark)
```
