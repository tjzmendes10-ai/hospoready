# HospoReady

Landing page for HospoReady (working name): one place for NSW cafés, restaurants and bars to track their licences, permits and certificates.

Plain HTML, CSS and JavaScript, hosted on GitHub Pages. No build step.

## Structure

```
index.html          Landing page (Stage 1)
assets/css/         Shared styles
assets/js/          Shared scripts (waitlist form handling)
checklist/          Future permit checklist quiz (/checklist)
data/               Future permit rules data (JSON)
```

## Setup

1. Create a free form at [formspree.io](https://formspree.io).
2. In `index.html`, replace `YOUR_FORM_ID` in the waitlist form's `action` with your form ID.

## Renaming

The name "HospoReady" appears in `index.html` (title, meta tags, header, footer, text) and `checklist/index.html`. Search and replace to rename.

---

Information only, not legal advice.
