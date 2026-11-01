# Permit rules data

`permits.json` drives the `/checklist/` tool. Edit it to update rules – no code changes needed.

- `meta` – states, venue types, questions and group names shown in the checklist.
- `council_finders` – a "find your council" link per state/territory.
- `permits` – one entry per licence/permit/certificate:
  - `group`: `federal`, `state`, `council`, `staff` or `other` (a state entry can override it).
  - `triggers`: `{"always": true}`, `{"any": ["alcohol", ...]}` (question keys) and/or `{"venue_types": ["food_truck"]}`.
  - `details` (same everywhere) **or** `state_details` keyed by `NSW`, `VIC`, `QLD`, `WA`, `SA`, `TAS`, `ACT`, `NT`.
  - Each detail: `name` (optional override), `issuer`, `renewal` (`null` if not confirmed), `url` (official source), `verified`, `note`, `last_checked`.

Rules: only use official government sources. Never guess fees, dates or renewal cycles – set `"verified": false` with a `note` instead.

New-venue timeline: each permit has a `phase` (1–5, titles in `meta.phases`). Add a `lead_time` to a detail only when an official source confirms it; otherwise the checklist shows `meta.default_lead_time` ("Check with the issuer for current processing times.").
