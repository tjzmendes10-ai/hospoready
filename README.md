# HospoReady

Landing page for HospoReady (working name): one place for cafés, restaurants, bars and pubs across Australia to track their licences, permits and certificates.

Plain HTML, CSS and JavaScript, hosted on GitHub Pages. No build step.

## Structure

```
index.html          Landing page
checklist/          Free permit checklist tool (/checklist/)
demo/               Permit wallet demo, runs in the browser (/demo/)
data/permits.json   Permit rules for all 8 states and territories
assets/css/         Shared styles
assets/js/          main.js (landing), checklist.js, demo.js
```

## Setup

1. Create a free form at [formspree.io](https://formspree.io).
2. In `index.html`, replace `YOUR_FORM_ID` in the waitlist form's `action` with your form ID.

## Renaming

The name "HospoReady" appears in the three HTML pages and the JS files. Search and replace to rename.

## Updating permit rules

Edit `data/permits.json` – see `data/README.md`. The demo's licence scanning uses Tesseract.js from jsDelivr and runs entirely in the browser.

---

Information only, not legal advice.
