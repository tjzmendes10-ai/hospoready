#!/usr/bin/env python3
"""Adds cache-busting versions to the site's local CSS and JS links.

GitHub Pages tells browsers to keep files for 10 minutes, so right after a
deploy a visitor can get the new page with an old script. This stamps every
local asset link with a short hash of the file (style.css?v=1a2b3c4d), so a
changed file always has a new address. The permit data file is stamped inside
checklist.js the same way.

Usage:
  python3 scripts/stamp-assets.py          update the files in place
  python3 scripts/stamp-assets.py --check  exit 1 if anything is out of date
  python3 scripts/stamp-assets.py --list   update, and print the changed files
"""
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["index.html", "checklist/index.html", "demo/index.html", "privacy/index.html"]
CHECKLIST_JS = ROOT / "assets/js/checklist.js"
DATA_FILE = ROOT / "data/permits.json"

check_only = "--check" in sys.argv
changed = []
pending = {}  # new file text, used so hashes are right even in --check mode


def short_hash(data: bytes) -> str:
    return hashlib.sha1(data).hexdigest()[:8]


def asset_hash(path: Path) -> str:
    if path in pending:
        return short_hash(pending[path].encode("utf-8"))
    return short_hash(path.read_bytes())


def save(path: Path, new_text: str) -> None:
    if path.read_text(encoding="utf-8") == new_text:
        return
    pending[path] = new_text
    changed.append(str(path.relative_to(ROOT)))
    if not check_only:
        path.write_text(new_text, encoding="utf-8")


# 1. checklist.js loads the permit data, so stamp that address first
text = CHECKLIST_JS.read_text(encoding="utf-8")
text = re.sub(
    r'(DATA_URL = "\.\./data/permits\.json)(?:\?v=[0-9a-f]+)?(")',
    lambda m: f"{m.group(1)}?v={asset_hash(DATA_FILE)}{m.group(2)}",
    text,
)
save(CHECKLIST_JS, text)

# 2. stamp every local CSS/JS link in the pages
LINK = re.compile(r'(href|src)="([^"?]*assets/(?:css|js)/[^"?]+)(?:\?v=[0-9a-f]+)?"')
for page in PAGES:
    page_path = ROOT / page
    html = page_path.read_text(encoding="utf-8")

    def stamp(match):
        target = (page_path.parent / match.group(2)).resolve()
        if not target.exists():
            return match.group(0)
        return f'{match.group(1)}="{match.group(2)}?v={asset_hash(target)}"'

    save(page_path, LINK.sub(stamp, html))

if "--list" in sys.argv:
    print("\n".join(changed))
elif changed:
    verb = "out of date" if check_only else "updated"
    print(f"Asset versions {verb}: " + ", ".join(changed), file=sys.stderr)
else:
    print("Asset versions are up to date.", file=sys.stderr)

sys.exit(1 if (check_only and changed) else 0)
