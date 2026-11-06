# HospoReady

HospoReady: one place for cafés, restaurants, bars, pubs and food trucks across Australia to track their licences, permits and certificates.

Plain HTML, CSS and JavaScript, hosted on GitHub Pages. No build step.

## Structure

```
index.html          Landing page
checklist/          Free permit checklist + Hospo Readiness Score (/checklist/)
demo/               Permit wallet demo with inspection mode, runs in the browser (/demo/)
privacy/            Privacy policy (/privacy/)
og-image.png        Social preview image (1200x630)
data/permits.json   Permit rules for all 8 states and territories
assets/css/         Shared styles
assets/js/          site-config.js (contact email), main.js (landing), checklist.js, demo.js
scripts/            stamp-assets.py (adds cache-busting versions, see below)
.githooks/          pre-commit hook that runs the stamping for you
```

## Setup

1. Create a free form at [formspree.io](https://formspree.io).
2. In `index.html`, replace `YOUR_FORM_ID` in the waitlist form's `action` with your form ID.
3. In `assets/js/site-config.js`, set `contactEmail` to your real address. It's used on every page.
4. GitHub Pages must stay enabled (Settings → Pages → deploy from `main`, `/ (root)`).

## Renaming

The name "HospoReady" appears in the HTML pages, the JS files and og-image.png. Search and replace to rename.

## Updating permit rules

Edit `data/permits.json` – see `data/README.md`. The demo's licence scanning uses Tesseract.js from jsDelivr and runs entirely in the browser.

---

Information only, not legal advice.

## Making changes show up straight away

GitHub Pages lets browsers keep each file for 10 minutes, so after a push a visitor could get the new page with an old script. To stop that, every local CSS and JS link carries a short version code that changes when the file changes (for example `style.css?v=70af9e78`).

- **Automatic:** turn the commit hook on once per clone with `git config core.hooksPath .githooks`. Every commit then updates the version codes for you. It needs Python 3.
- **By hand:** run `python3 scripts/stamp-assets.py` before committing. `--check` reports whether anything is out of date without changing files.
- The permit data file is versioned inside `assets/js/checklist.js`, so edits to `data/permits.json` are picked up the same way.
- The pages themselves can still be cached for up to 10 minutes, but a normal refresh checks for a newer page.
