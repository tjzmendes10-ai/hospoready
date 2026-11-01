// HospoReady – permit wallet demo (runs entirely in the browser)

(function () {
  var STORAGE_KEY = "hospoready-demo-v1";
  var CHECKLIST_KEY = "hospoready-checklist";
  var TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  var WARN_DAYS = 60;
  var DAY_MS = 86400000;

  var TYPE_LABELS = {
    licence: "Licence",
    permit: "Permit",
    registration: "Registration",
    insurance: "Insurance",
    staff: "Staff certificate",
    other: "Other"
  };

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // ---------- Dates ----------
  function today() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function isoFromDate(d) {
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }
  function dateFromIso(iso) {
    var p = iso.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function addDays(n) { return isoFromDate(new Date(today().getTime() + n * DAY_MS)); }
  function formatDate(iso) {
    return dateFromIso(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  }
  function status(item) {
    if (!item.expiry) return { key: "none", days: null, label: "No expiry date" };
    var days = Math.round((dateFromIso(item.expiry) - today()) / DAY_MS);
    if (days < 0) return { key: "alert", days: days, label: "Expired " + Math.abs(days) + (days === -1 ? " day ago" : " days ago") };
    if (days === 0) return { key: "warn", days: 0, label: "Expires today" };
    return { key: days <= WARN_DAYS ? "warn" : "ok", days: days, label: days + (days === 1 ? " day left" : " days left") };
  }

  // ---------- Storage ----------
  function examples() {
    return [
      { id: uid(), name: "Food business registration", type: "registration", holder: "The Corner Café", issuer: "Local council", number: "FB-20417", expiry: addDays(214), notes: "" },
      { id: uid(), name: "Liquor licence (annual fee)", type: "licence", holder: "The Corner Café", issuer: "State liquor regulator", number: "LIQO-660012345", expiry: addDays(142), notes: "Check your regulator's due date for the annual fee." },
      { id: uid(), name: "Food Safety Supervisor certificate", type: "staff", holder: "Priya S.", issuer: "Registered training organisation", number: "", expiry: addDays(18), notes: "Book the recertification course." },
      { id: uid(), name: "RSA certificate", type: "staff", holder: "Sam K.", issuer: "RSA training provider", number: "", expiry: addDays(-3), notes: "Sam can't serve alcohol until this is renewed." }
    ];
  }
  function uid() { return "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return examples();
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : examples();
    } catch (e) {
      return examples();
    }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) { /* storage unavailable */ }
  }

  var items = load();
  save();

  // ---------- Rendering ----------
  var licenceList = document.getElementById("licence-list");
  var staffList = document.getElementById("staff-list");
  var statusMsg = document.getElementById("status-msg");

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function say(msg) { statusMsg.textContent = msg; }

  function sortItems(list) {
    return list.slice().sort(function (a, b) {
      var sa = status(a), sb = status(b);
      if (sa.days === null && sb.days === null) return a.name.localeCompare(b.name);
      if (sa.days === null) return 1;
      if (sb.days === null) return -1;
      return sa.days - sb.days;
    });
  }

  function renderItem(item) {
    var st = status(item);
    var li = el("li", { "class": "wallet-item" });
    li.appendChild(el("span", { "class": "dot " + st.key, "aria-hidden": "true" }));
    var body = el("div", { "class": "wallet-body" });
    body.appendChild(el("h3", null, item.name));
    var sub = [TYPE_LABELS[item.type] || "Item"];
    if (item.holder) sub.push(item.holder);
    if (item.issuer) sub.push(item.issuer);
    if (item.number) sub.push("No. " + item.number);
    body.appendChild(el("p", { "class": "wallet-sub" }, sub.join(" · ")));
    var days = el("span", { "class": "days " + st.key }, st.label);
    body.appendChild(days);
    if (item.expiry) body.appendChild(el("span", { "class": "wallet-sub", style: "margin-left: 8px;" }, formatDate(item.expiry)));
    if (item.notes) body.appendChild(el("p", { "class": "wallet-notes" }, item.notes));
    var actions = el("div", { "class": "wallet-actions" });
    var edit = el("button", { type: "button", "class": "btn btn-plain", "aria-label": "Edit " + item.name }, "Edit");
    edit.addEventListener("click", function () { openItemDialog(item); });
    var del = el("button", { type: "button", "class": "btn btn-plain btn-danger", "aria-label": "Delete " + item.name }, "Delete");
    del.addEventListener("click", function () {
      if (!window.confirm("Delete \"" + item.name + "\"?")) return;
      items = items.filter(function (i) { return i.id !== item.id; });
      save();
      render();
      say("Deleted " + item.name + ".");
    });
    actions.appendChild(edit);
    actions.appendChild(del);
    body.appendChild(actions);
    li.appendChild(body);
    return li;
  }

  function emptyState(list, text, withExamples) {
    var li = el("li", { "class": "empty-state" });
    li.appendChild(el("p", null, text));
    if (withExamples) {
      var btn = el("button", { type: "button", "class": "btn btn-plain" }, "Load example data");
      btn.addEventListener("click", function () {
        items = examples();
        save();
        render();
        say("Example data loaded.");
      });
      li.appendChild(btn);
    }
    list.appendChild(li);
  }

  function render() {
    licenceList.textContent = "";
    staffList.textContent = "";
    var sorted = sortItems(items);
    var staff = sorted.filter(function (i) { return i.type === "staff"; });
    var others = sorted.filter(function (i) { return i.type !== "staff"; });
    others.forEach(function (i) { licenceList.appendChild(renderItem(i)); });
    staff.forEach(function (i) { staffList.appendChild(renderItem(i)); });
    if (!others.length) emptyState(licenceList, "No licences or permits yet. Add one, scan a licence or import your checklist.", !items.length);
    if (!staff.length) emptyState(staffList, "No staff certificates yet. Add each person's RSA or Food Safety Supervisor certificate.", false);

    var counts = { ok: 0, warn: 0, alert: 0 };
    items.forEach(function (i) { var k = status(i).key; if (counts[k] !== undefined) counts[k]++; });
    document.getElementById("count-ok").textContent = counts.ok;
    document.getElementById("count-warn").textContent = counts.warn;
    document.getElementById("count-alert").textContent = counts.alert;
  }

  // ---------- Add / edit dialog ----------
  var itemDialog = document.getElementById("item-dialog");
  var itemForm = document.getElementById("item-form");
  var f = {
    id: document.getElementById("f-id"),
    name: document.getElementById("f-name"),
    type: document.getElementById("f-type"),
    holder: document.getElementById("f-holder"),
    issuer: document.getElementById("f-issuer"),
    number: document.getElementById("f-number"),
    expiry: document.getElementById("f-expiry"),
    notes: document.getElementById("f-notes")
  };
  var itemError = document.getElementById("item-error");

  function openItemDialog(item, title) {
    item = item || {};
    document.getElementById("item-dialog-title").textContent = title || (item.id ? "Edit item" : "Add an item");
    f.id.value = item.id || "";
    f.name.value = item.name || "";
    f.type.value = item.type || "licence";
    f.holder.value = item.holder || "";
    f.issuer.value = item.issuer || "";
    f.number.value = item.number || "";
    f.expiry.value = item.expiry || "";
    f.notes.value = item.notes || "";
    itemError.textContent = "";
    updateHolderHint();
    itemDialog.showModal();
    f.name.focus();
  }
  function updateHolderHint() {
    document.getElementById("f-holder-hint").textContent = f.type.value === "staff" ? "(staff member's name)" : "(venue or person)";
  }
  f.type.addEventListener("change", updateHolderHint);

  itemForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var name = f.name.value.trim();
    if (!name) {
      itemError.className = "form-status error";
      itemError.textContent = "Please give this item a name.";
      f.name.focus();
      return;
    }
    if (f.type.value === "staff" && !f.holder.value.trim()) {
      itemError.className = "form-status error";
      itemError.textContent = "Please add the staff member's name.";
      f.holder.focus();
      return;
    }
    var data = {
      id: f.id.value || uid(),
      name: name,
      type: f.type.value,
      holder: f.holder.value.trim(),
      issuer: f.issuer.value.trim(),
      number: f.number.value.trim(),
      expiry: f.expiry.value,
      notes: f.notes.value.trim()
    };
    var existing = items.findIndex(function (i) { return i.id === data.id; });
    if (existing === -1) items.push(data); else items[existing] = data;
    save();
    render();
    itemDialog.close();
    say((existing === -1 ? "Added " : "Updated ") + data.name + ".");
  });
  document.getElementById("item-cancel").addEventListener("click", function () { itemDialog.close(); });
  document.getElementById("add-btn").addEventListener("click", function () { openItemDialog(); });

  // ---------- Import from checklist ----------
  function importChecklist() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(CHECKLIST_KEY)); } catch (e) { saved = null; }
    if (!saved || !saved.items || !saved.items.length) {
      say("No checklist found on this device yet. Build one on the free checklist page first.");
      return;
    }
    var names = items.map(function (i) { return i.name.toLowerCase(); });
    var added = 0;
    saved.items.forEach(function (c) {
      if (names.indexOf(c.name.toLowerCase()) !== -1) return;
      var lower = c.name.toLowerCase();
      var type = c.group === "staff" ? "staff" :
        /registration|notification|abn|gst|payg/.test(lower) ? "registration" :
        /permit|approval/.test(lower) ? "permit" :
        /insurance/.test(lower) ? "insurance" : "licence";
      items.push({ id: uid(), name: c.name, type: type, holder: "", issuer: c.issuer || "", number: "", expiry: "", notes: "Imported from your checklist – add the expiry date if it has one." });
      added++;
    });
    save();
    render();
    say(added ? "Imported " + added + " items from your checklist. Add expiry dates to start the countdowns." : "Everything from your checklist is already in your wallet.");
  }
  document.getElementById("import-btn").addEventListener("click", importChecklist);

  // ---------- Export CSV ----------
  function csvCell(value) {
    var s = value === null || value === undefined ? "" : String(value);
    if (typeof value === "string" && /^[=+\-@]/.test(s)) s = "'" + s; // stop spreadsheets treating text as a formula
    return '"' + s.replace(/"/g, '""') + '"';
  }
  document.getElementById("export-btn").addEventListener("click", function () {
    var rows = [["Name", "Type", "Holder", "Issuer", "Number", "Expiry date", "Status", "Days left", "Notes"]];
    sortItems(items).forEach(function (i) {
      var st = status(i);
      rows.push([i.name, TYPE_LABELS[i.type] || i.type, i.holder, i.issuer, i.number, i.expiry, st.label, st.days === null ? "" : st.days, i.notes]);
    });
    var csv = rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: "hospoready-permit-wallet.csv" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    say("Exported " + items.length + " items to CSV.");
  });

  // ---------- Clear ----------
  document.getElementById("clear-btn").addEventListener("click", function () {
    if (!window.confirm("Clear all demo data on this device?")) return;
    items = [];
    save();
    render();
    say("Demo data cleared.");
  });

  // ---------- Scan a licence (Tesseract.js, runs in the browser) ----------
  var scanDialog = document.getElementById("scan-dialog");
  var scanFile = document.getElementById("scan-file");
  var scanPreview = document.getElementById("scan-preview");
  var progressWrap = document.getElementById("scan-progress-wrap");
  var progressBar = document.getElementById("scan-progress");
  var progressLabel = document.getElementById("scan-progress-label");
  var scanStatus = document.getElementById("scan-status");
  var suggestionsEl = document.getElementById("scan-suggestions");
  var dateChips = document.getElementById("date-chips");
  var numberChips = document.getElementById("number-chips");
  var ocrText = document.getElementById("ocr-text");
  var scanUse = document.getElementById("scan-use");
  var scanResult = null;
  var previewUrl = null;
  var tesseractPromise = null;

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tesseractPromise) return tesseractPromise;
    tesseractPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = TESSERACT_URL;
      s.async = true;
      s.onload = function () { window.Tesseract ? resolve(window.Tesseract) : reject(new Error("Tesseract missing")); };
      s.onerror = function () { tesseractPromise = null; reject(new Error("Could not load Tesseract")); };
      document.head.appendChild(s);
    });
    return tesseractPromise;
  }

  function resetScan() {
    scanFile.value = "";
    scanPreview.hidden = true;
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    progressWrap.hidden = true;
    progressBar.value = 0;
    scanStatus.textContent = "";
    scanStatus.className = "form-status";
    suggestionsEl.hidden = true;
    dateChips.textContent = "";
    numberChips.textContent = "";
    ocrText.textContent = "";
    scanUse.disabled = true;
    scanResult = null;
  }

  document.getElementById("scan-btn").addEventListener("click", function () {
    resetScan();
    scanDialog.showModal();
  });
  document.getElementById("scan-cancel").addEventListener("click", function () { scanDialog.close(); });

  scanFile.addEventListener("change", function () {
    var file = scanFile.files && scanFile.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      scanStatus.className = "form-status error";
      scanStatus.textContent = "Please choose an image file. For a PDF, take a screenshot of the page and upload that.";
      return;
    }
    previewUrl = URL.createObjectURL(file);
    scanPreview.src = previewUrl;
    scanPreview.hidden = false;
    suggestionsEl.hidden = true;
    scanUse.disabled = true;
    progressWrap.hidden = false;
    progressBar.value = 0;
    progressLabel.textContent = "Loading the text reader…";
    scanStatus.className = "form-status";
    scanStatus.textContent = "";

    loadTesseract()
      .then(function (Tesseract) {
        return Tesseract.recognize(file, "eng", {
          logger: function (m) {
            if (m.status === "recognizing text") {
              progressLabel.textContent = "Reading text…";
              progressBar.value = Math.round(m.progress * 100);
            } else if (m.status) {
              progressLabel.textContent = m.status.charAt(0).toUpperCase() + m.status.slice(1) + "…";
            }
          }
        });
      })
      .then(function (result) {
        progressWrap.hidden = true;
        var text = (result && result.data && result.data.text) || "";
        showSuggestions(text, file.name);
      })
      .catch(function () {
        progressWrap.hidden = true;
        scanStatus.className = "form-status error";
        scanStatus.textContent = "Sorry, we couldn't read that image. Check your internet connection (the reader downloads once) or try a clearer photo.";
      });
  });

  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  var MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

  function makeDate(y, m, d) {
    y = +y; m = +m; d = +d;
    if (y < 100) y += 2000;
    if (y < 1990 || y > 2100) return null;
    var dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return isoFromDate(dt);
  }

  // Finds dates in OCR text. Numeric dates are read day-first (Australian format).
  function findDates(text) {
    var found = [];
    function push(iso, index, raw) {
      if (!iso) return;
      var before = text.slice(Math.max(0, index - 45), index).toLowerCase();
      var score = 0;
      if (/expir|valid (until|to|thru|through)|renew|due|until|end date|ceases/.test(before)) score += 3;
      if (/issue|issued|granted|from|commenc|start|birth|dob|completed|attained/.test(before)) score -= 2;
      found.push({ iso: iso, raw: raw.trim(), score: score });
    }
    var m, re;
    re = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})\b/g;
    while ((m = re.exec(text))) push(makeDate(m[3], m[2], m[1]), m.index, m[0]);
    re = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
    while ((m = re.exec(text))) push(makeDate(m[1], m[2], m[3]), m.index, m[0]);
    re = new RegExp("\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+" + MONTH_RE + "\\.?,?\\s+(\\d{4})\\b", "gi");
    while ((m = re.exec(text))) push(makeDate(m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], m[1]), m.index, m[0]);
    re = new RegExp("\\b" + MONTH_RE + "\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b", "gi");
    while ((m = re.exec(text))) push(makeDate(m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], m[2]), m.index, m[0]);

    var byIso = {};
    found.forEach(function (d) { if (!byIso[d.iso] || byIso[d.iso].score < d.score) byIso[d.iso] = d; });
    return Object.keys(byIso).map(function (k) { return byIso[k]; }).sort(function (a, b) {
      return b.score - a.score || (a.iso < b.iso ? 1 : -1); // best context first, then latest date
    });
  }

  function findNumbers(text, dates) {
    var out = [];
    var raws = dates.map(function (d) { return d.raw; });
    function push(n) {
      n = n.replace(/[.,;:]+$/, "");
      if (!/\d/.test(n) || n.length < 4 || out.indexOf(n) !== -1) return;
      if (raws.some(function (r) { return r.indexOf(n) !== -1 || n.indexOf(r) !== -1; })) return;
      out.push(n);
    }
    var m;
    var labelled = /(?:licen[cs]e|certificate|cert|card|permit|registration|reg|statement|member(?:ship)?)\s*(?:no\.?|number|num|#|id)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-\/]{3,})/gi;
    while ((m = labelled.exec(text))) push(m[1]);
    var generic = /\b[A-Z]{0,5}[\-\/]?\d{5,}[A-Z0-9\-\/]*\b/g;
    while ((m = generic.exec(text))) push(m[0]);
    return out.slice(0, 6);
  }

  function guessItem(text) {
    var rules = [
      [/responsible service of alcohol|\bRSA\b/i, "RSA certificate", "staff"],
      [/food safety supervisor/i, "Food Safety Supervisor certificate", "staff"],
      [/liquor licen[cs]e/i, "Liquor licence", "licence"],
      [/food (business|premises)/i, "Food business registration", "registration"],
      [/onemusic|music licen[cs]e/i, "Music licence", "licence"],
      [/outdoor dining|footpath/i, "Outdoor dining permit", "permit"],
      [/workers.? comp|workcover|icare/i, "Workers compensation insurance", "insurance"]
    ];
    for (var i = 0; i < rules.length; i++) {
      if (rules[i][0].test(text)) return { name: rules[i][1], type: rules[i][2] };
    }
    return { name: "", type: "licence" };
  }

  function makeChip(container, label, value, onPick) {
    var chip = el("button", { type: "button", "class": "chip", "aria-pressed": "false" }, label);
    chip.addEventListener("click", function () {
      var pressed = chip.getAttribute("aria-pressed") === "true";
      container.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
      chip.setAttribute("aria-pressed", pressed ? "false" : "true");
      onPick(pressed ? "" : value);
    });
    container.appendChild(chip);
    return chip;
  }

  function showSuggestions(text, fileName) {
    var dates = findDates(text);
    var numbers = findNumbers(text, dates);
    var guess = guessItem(text);
    var holderMatch = text.match(/(?:name|holder|licensee|issued to)\s*[:\-]\s*([A-Z][A-Za-z' \-]{2,40})/);
    scanResult = {
      name: guess.name,
      type: guess.type,
      holder: holderMatch ? holderMatch[1].trim() : "",
      number: "",
      expiry: "",
      notes: "Scanned from " + fileName + ". Please check these details."
    };

    dateChips.textContent = "";
    numberChips.textContent = "";
    if (dates.length) {
      dates.slice(0, 6).forEach(function (d, i) {
        var chip = makeChip(dateChips, formatDate(d.iso), d.iso, function (v) { scanResult.expiry = v; });
        if (i === 0) { chip.setAttribute("aria-pressed", "true"); scanResult.expiry = d.iso; }
      });
    } else {
      dateChips.appendChild(el("p", { "class": "fine" }, "No dates found. You can type the expiry date in the next step."));
    }
    if (numbers.length) {
      numbers.forEach(function (n, i) {
        var chip = makeChip(numberChips, n, n, function (v) { scanResult.number = v; });
        if (i === 0) { chip.setAttribute("aria-pressed", "true"); scanResult.number = n; }
      });
    } else {
      numberChips.appendChild(el("p", { "class": "fine" }, "No licence numbers found."));
    }
    ocrText.textContent = text.trim() || "(No text found)";
    suggestionsEl.hidden = false;
    scanUse.disabled = false;
    scanStatus.className = "form-status success";
    scanStatus.textContent = dates.length || numbers.length
      ? "Done. We've picked our best guesses – tap to change them, then review."
      : "Done, but we couldn't spot dates or numbers. You can still enter them by hand.";
  }

  scanUse.addEventListener("click", function () {
    if (!scanResult) return;
    scanDialog.close();
    openItemDialog(scanResult, "Check the scanned details");
  });

  // ---------- Start ----------
  render();
  if (new URLSearchParams(window.location.search).get("import") === "checklist") {
    importChecklist();
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* ignore */ }
  }
})();
