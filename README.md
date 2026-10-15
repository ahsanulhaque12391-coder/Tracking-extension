# Tracking Health Hub

**One place to check whether your online store's tracking is working:** Meta (Facebook) Pixel & Conversions API, Google Tag Manager, GA4, TikTok, Google Ads, server-side tracking (sGTM / Stape), Clarity, Search Console, and more.

It's written for beginners. Every field says what it is and where to find it, and every problem comes with "How to fix" steps in plain English.

---

## What it does

| Page | What you get |
|---|---|
| **Health dashboard** | A traffic light (🟢 all good / 🟠 needs attention / 🔴 broken), a list of problems with fixes, the status of every tool, revenue and ROAS. |
| **Tools & IDs** | Every tracking tool with its IDs (Pixel ID, GTM-…, G-…, AW-…), status, who manages it, when it was last checked, a checklist and notes. Warns you if an ID looks wrong. |
| **Events (funnel)** | The shopping journey (view product → add to cart → checkout → **purchase**) and what each platform calls each event. |
| **Numbers check** | Type in your real shop orders and what each platform received. It shows how many sales each platform captured. Too low means events are being lost; too high means double counting. You also get spend, ROAS and CPA. |
| **Live scan** *(Chrome extension)* | Open your store and click the icon. It shows which pixels really fire, with their IDs and events, and flags the wrong ID, a missing pixel, a double-fired PageView/Purchase, a Purchase missing on the thank-you page, missing deduplication, and no server-side traffic. |
| **Setup checklist** | Step-by-step setup tasks for every tool, in a sensible order. |
| **Activity log** | A diary of changes, so you can see "it broke after we installed app X". |
| **Learn the basics** | How tracking fits together, the 5 most common problems, an event-name cheat sheet and a glossary. |
| **My stores** | Manage several stores or clients, and search for any ID across all of them. |
| **Backup & settings** | Export or import backups (.json), CSV files, a printable/PDF report, and dark mode. |

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

## Privacy
- Everything is stored **only in your browser** (localStorage). There is no server and no account, and nothing is uploaded.
- The extension only reads network requests in your own browser so it can recognise tracking pixels. It sends nothing anywhere.
- Secret tokens (CAPI token, API secrets) are hidden by default and are **left out of exports** unless you tick "Include secret tokens".

## Files
```
index.html        the dashboard (web app)
popup.html        the extension popup
manifest.json     Chrome extension settings
background.js     extension: watches tracking requests per tab
js/data.js        tools, events, fixes, glossary, detection rules (edit here to add built-in tools)
js/store.js       saving / loading data
js/scan.js        live-scan detection + problem analysis
js/app.js         dashboard screens
js/popup.js       extension popup screen
css/              styles (light + dark)
```
