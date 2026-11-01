// HospoReady – permit wallet demo (runs entirely in the browser)

(function () {
  var STORAGE_KEY = "hospoready-demo-v1";
  var ROLE_KEY = "hospoready-demo-role";
  var CHECKLIST_KEY = "hospoready-checklist";
  var TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  var WARN_DAYS = 60;
  var REMINDER_DAYS = 60;
  var DAY_MS = 86400000;
  var IMAGE_MAX = 1000; // px on the long edge – keeps localStorage small

  var TYPE_LABELS = {
    licence: "Licence",
    permit: "Permit",
    registration: "Registration",
    insurance: "Insurance",
    staff: "Staff certificate",
    other: "Other"
  };

  var ROLES = {
    owner: { edit: true, delete: true, export: true, help: "Owners can do everything." },
    manager: { edit: true, delete: false, export: true, help: "Managers can add and update items, but can't delete them." },
    staff: { edit: false, delete: false, export: false, help: "Staff can view documents and use inspection mode, but can't make changes." }
  };

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // ---------- Helpers ----------
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function uid() { return "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function money(n) {
    return Number(n).toLocaleString("en-AU", { style: "currency", currency: "AUD" });
  }

  // ---------- Dates ----------
  function today() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function isoFromDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function dateFromIso(iso) {
    var p = iso.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function shiftIso(iso, days) { return isoFromDate(new Date(dateFromIso(iso).getTime() + days * DAY_MS)); }
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
      { name: "Food business registration", type: "registration", holder: "The Corner Café", issuer: "Local council", number: "FB-20417", issued: addDays(-151), expiry: addDays(214), fee: 560, payments: [{ date: addDays(-151), amount: 560 }] },
      { name: "Liquor licence (annual fee)", type: "licence", holder: "The Corner Café", issuer: "State liquor regulator", number: "LIQO-660012345", issued: addDays(-588), expiry: addDays(142), fee: 754, notes: "Check your regulator's due date for the annual fee.", payments: [{ date: addDays(-588), amount: 732 }, { date: addDays(-223), amount: 754 }] },
      { name: "Food Safety Supervisor certificate", type: "staff", holder: "Priya S.", issuer: "Registered training organisation", number: "FSS-118204", issued: addDays(-1808), expiry: addDays(18), notes: "Book the recertification course." },
      { name: "RSA certificate", type: "staff", holder: "Sam K.", issuer: "RSA training provider", number: "RSA-77310", issued: addDays(-1829), expiry: addDays(-3), notes: "Sam can't serve alcohol until this is renewed." }
    ].map(normalise);
  }

  // Fills in any fields missing from older saved items
  function normalise(i) {
    var item = {
      id: i.id || uid(),
      name: i.name || "",
      type: i.type || "licence",
      number: i.number || "",
      issuer: i.issuer || "",
      holder: i.holder || "",
      issued: i.issued || "",
      expiry: i.expiry || "",
      reminder: i.reminder || "",
      fee: i.fee === 0 || i.fee ? Number(i.fee) : "",
      notes: i.notes || "",
      image: i.image || "",
      payments: Array.isArray(i.payments) ? i.payments : []
    };
    if (!item.reminder && item.expiry) item.reminder = shiftIso(item.expiry, -REMINDER_DAYS);
    return item;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return examples();
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(normalise) : examples();
    } catch (e) {
      return examples();
    }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return true;
    } catch (e) {
      say("Couldn't save – this browser's storage may be full. Try removing some document images.");
      return false;
    }
  }

  var statusMsg = document.getElementById("status-msg");
  function say(msg) { statusMsg.textContent = msg; }

  var items = load();
  save();

  // ---------- Roles ----------
  var role = "owner";
  try { role = localStorage.getItem(ROLE_KEY) || "owner"; } catch (e) { role = "owner"; }
  if (!ROLES[role]) role = "owner";
  var roleSelect = document.getElementById("role-select");
  roleSelect.value = role;
  function can(action) { return !!ROLES[role][action]; }
  function applyRole() {
    document.querySelectorAll("[data-perm]").forEach(function (node) {
      node.hidden = !can(node.getAttribute("data-perm"));
    });
    document.getElementById("role-help").textContent = ROLES[role].help;
  }
  roleSelect.addEventListener("change", function () {
    role = roleSelect.value;
    try { localStorage.setItem(ROLE_KEY, role); } catch (e) { /* ignore */ }
    applyRole();
    render();
    say("Now viewing as " + roleSelect.options[roleSelect.selectedIndex].text + ".");
  });

  // ---------- Images ----------
  // Shrinks a photo to a small JPEG data URL so it fits in browser storage
  function downscale(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, IMAGE_MAX / Math.max(img.naturalWidth, img.naturalHeight));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Unreadable image")); };
      img.src = url;
    });
  }

  var imageDialog = document.getElementById("image-dialog");
  var imageFull = document.getElementById("image-full");
  function showImage(item) {
    imageFull.src = item.image;
    imageFull.alt = "Document for " + item.name;
    imageDialog.showModal();
  }
  document.getElementById("image-close").addEventListener("click", function () { imageDialog.close(); });

  // ---------- Rendering ----------
  var licenceList = document.getElementById("licence-list");
  var staffList = document.getElementById("staff-list");

  function sortItems(list) {
    return list.slice().sort(function (a, b) {
      var sa = status(a), sb = status(b);
      if (sa.days === null && sb.days === null) return a.name.localeCompare(b.name);
      if (sa.days === null) return 1;
      if (sb.days === null) return -1;
      return sa.days - sb.days;
    });
  }

  function thumbButton(item, cls) {
    var btn = el("button", { type: "button", "class": cls || "thumb-btn", "aria-label": "View document for " + item.name });
    btn.appendChild(el("img", { src: item.image, alt: "", loading: "lazy" }));
    btn.addEventListener("click", function () { showImage(item); });
    return btn;
  }

  function renderItem(item) {
    var st = status(item);
    var li = el("li", { "class": "wallet-item" });
    li.appendChild(el("span", { "class": "dot " + st.key, "aria-hidden": "true" }));
    var body = el("div", { "class": "wallet-body" });

    var head = el("div", { "class": "wallet-head" });
    var titles = el("div");
    titles.appendChild(el("h3", null, item.name));
    var sub = [TYPE_LABELS[item.type] || "Item"];
    if (item.holder) sub.push(item.holder);
    if (item.issuer) sub.push(item.issuer);
    if (item.number) sub.push("No. " + item.number);
    titles.appendChild(el("p", { "class": "wallet-sub" }, sub.join(" · ")));
    head.appendChild(titles);
    if (item.image) head.appendChild(thumbButton(item));
    body.appendChild(head);

    var line = el("p", { "class": "wallet-dates" });
    line.appendChild(el("span", { "class": "days " + st.key }, st.label));
    if (item.expiry) line.appendChild(el("span", null, "Expires " + formatDate(item.expiry)));
    if (item.reminder && st.key !== "alert" && item.reminder <= isoFromDate(today())) {
      line.appendChild(el("span", { "class": "days warn" }, "Reminder due"));
    }
    body.appendChild(line);

    var facts = [];
    if (item.issued) facts.push("Issued " + formatDate(item.issued));
    if (item.reminder) facts.push("Reminder " + formatDate(item.reminder));
    if (item.fee !== "") facts.push("Fee paid " + money(item.fee));
    if (facts.length) body.appendChild(el("p", { "class": "wallet-sub" }, facts.join(" · ")));
    if (item.notes) body.appendChild(el("p", { "class": "wallet-notes" }, item.notes));

    if (item.payments.length) {
      var det = el("details", { "class": "payments" });
      var total = item.payments.reduce(function (sum, p) { return sum + Number(p.amount || 0); }, 0);
      det.appendChild(el("summary", null, "Payment history (" + item.payments.length + ") · " + money(total) + " total"));
      var ul = el("ul");
      item.payments.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).forEach(function (p) {
        ul.appendChild(el("li", null, (p.date ? formatDate(p.date) : "No date") + " – " + money(p.amount)));
      });
      det.appendChild(ul);
      body.appendChild(det);
    }

    if (can("edit") || can("delete")) {
      var actions = el("div", { "class": "wallet-actions" });
      if (can("edit")) {
        var edit = el("button", { type: "button", "class": "btn btn-plain", "aria-label": "Edit " + item.name }, "Edit");
        edit.addEventListener("click", function () { openItemDialog(item); });
        actions.appendChild(edit);
      }
      if (can("delete")) {
        var del = el("button", { type: "button", "class": "btn btn-plain btn-danger", "aria-label": "Delete " + item.name }, "Delete");
        del.addEventListener("click", function () {
          if (!window.confirm("Delete \"" + item.name + "\"?")) return;
          items = items.filter(function (i) { return i.id !== item.id; });
          save();
          render();
          say("Deleted " + item.name + ".");
        });
        actions.appendChild(del);
      }
      body.appendChild(actions);
    }
    li.appendChild(body);
    return li;
  }

  function emptyState(list, text, withExamples) {
    var li = el("li", { "class": "empty-state" });
    li.appendChild(el("p", null, text));
    if (withExamples && can("edit")) {
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
  var f = {};
  ["id", "name", "type", "number", "issuer", "holder", "issued", "expiry", "reminder", "fee", "notes", "image"].forEach(function (k) {
    f[k] = document.getElementById("f-" + k);
  });
  var imagePreview = document.getElementById("f-image-preview");
  var imageRemove = document.getElementById("f-image-remove");
  var paymentsList = document.getElementById("f-payments");
  var itemError = document.getElementById("item-error");
  var draft = null; // { image, payments, reminderTouched }

  function showDraftImage() {
    imagePreview.hidden = !draft.image;
    imageRemove.hidden = !draft.image;
    if (draft.image) imagePreview.src = draft.image; else imagePreview.removeAttribute("src");
  }

  function renderDraftPayments() {
    paymentsList.textContent = "";
    if (!draft.payments.length) {
      paymentsList.appendChild(el("li", { "class": "fine" }, "No payments recorded yet."));
      return;
    }
    draft.payments.forEach(function (p, idx) {
      var li = el("li");
      li.appendChild(el("span", null, (p.date ? formatDate(p.date) : "No date") + " – " + money(p.amount)));
      var rm = el("button", { type: "button", "class": "btn btn-plain btn-danger btn-xs", "aria-label": "Remove payment of " + money(p.amount) }, "Remove");
      rm.addEventListener("click", function () { draft.payments.splice(idx, 1); renderDraftPayments(); });
      li.appendChild(rm);
      paymentsList.appendChild(li);
    });
  }

  function openItemDialog(item, title) {
    item = item || {};
    document.getElementById("item-dialog-title").textContent = title || (item.id ? "Edit item" : "Add an item");
    f.id.value = item.id || "";
    ["name", "number", "issuer", "holder", "issued", "expiry", "notes"].forEach(function (k) { f[k].value = item[k] || ""; });
    f.type.value = item.type || "licence";
    f.fee.value = item.fee === 0 || item.fee ? item.fee : "";
    f.reminder.value = item.reminder || (item.expiry ? shiftIso(item.expiry, -REMINDER_DAYS) : "");
    f.image.value = "";
    draft = { image: item.image || "", payments: (item.payments || []).slice(), reminderTouched: !!item.reminder && !!item.id };
    showDraftImage();
    renderDraftPayments();
    document.getElementById("p-date").value = "";
    document.getElementById("p-amount").value = "";
    itemError.textContent = "";
    updateHolderHint();
    itemDialog.showModal();
    f.name.focus();
  }
  function updateHolderHint() {
    document.getElementById("f-holder-hint").textContent = f.type.value === "staff" ? "(staff member's name)" : "(venue or person)";
  }
  f.type.addEventListener("change", updateHolderHint);

  // Reminder defaults to 60 days before expiry until the user sets it themselves
  f.reminder.addEventListener("input", function () { draft.reminderTouched = !!f.reminder.value; });
  f.expiry.addEventListener("change", function () {
    if (!draft.reminderTouched || !f.reminder.value) f.reminder.value = f.expiry.value ? shiftIso(f.expiry.value, -REMINDER_DAYS) : "";
  });

  f.image.addEventListener("change", function () {
    var file = f.image.files && f.image.files[0];
    if (!file) return;
    downscale(file).then(function (dataUrl) {
      draft.image = dataUrl;
      showDraftImage();
    }, function () {
      itemError.className = "form-status error";
      itemError.textContent = "That image couldn't be read. Try a JPG or PNG.";
    });
  });
  imageRemove.addEventListener("click", function () { draft.image = ""; f.image.value = ""; showDraftImage(); });

  document.getElementById("p-add").addEventListener("click", function () {
    var dateIn = document.getElementById("p-date");
    var amountIn = document.getElementById("p-amount");
    var amount = parseFloat(amountIn.value);
    if (isNaN(amount) || amount < 0) {
      itemError.className = "form-status error";
      itemError.textContent = "Enter a payment amount.";
      amountIn.focus();
      return;
    }
    itemError.textContent = "";
    draft.payments.push({ date: dateIn.value, amount: Math.round(amount * 100) / 100 });
    dateIn.value = "";
    amountIn.value = "";
    renderDraftPayments();
  });

  itemForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var name = f.name.value.trim();
    function fail(msg, field) {
      itemError.className = "form-status error";
      itemError.textContent = msg;
      field.focus();
    }
    if (!name) return fail("Please give this item a name.", f.name);
    if (f.type.value === "staff" && !f.holder.value.trim()) return fail("Please add the staff member's name.", f.holder);
    if (f.issued.value && f.expiry.value && f.issued.value > f.expiry.value) return fail("The issue date is after the expiry date.", f.issued);
    var fee = parseFloat(f.fee.value);
    var data = normalise({
      id: f.id.value || uid(),
      name: name,
      type: f.type.value,
      number: f.number.value.trim(),
      issuer: f.issuer.value.trim(),
      holder: f.holder.value.trim(),
      issued: f.issued.value,
      expiry: f.expiry.value,
      reminder: f.reminder.value,
      fee: isNaN(fee) ? "" : Math.round(fee * 100) / 100,
      notes: f.notes.value.trim(),
      image: draft.image,
      payments: draft.payments
    });
    var existing = items.findIndex(function (i) { return i.id === data.id; });
    var previous = existing === -1 ? null : items[existing];
    if (existing === -1) items.push(data); else items[existing] = data;
    if (!save()) {
      // Roll back so what's on screen matches what's stored
      if (previous) items[existing] = previous; else items.pop();
      fail("Couldn't save – this browser's storage is full. Try removing the document image.", f.name);
      return;
    }
    render();
    itemDialog.close();
    say((existing === -1 ? "Added " : "Updated ") + data.name + ".");
  });
  document.getElementById("item-cancel").addEventListener("click", function () { itemDialog.close(); });
  document.getElementById("add-btn").addEventListener("click", function () { openItemDialog(); });

  // ---------- Import from checklist ----------
  function importChecklist() {
    if (!can("edit")) return;
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
      items.push(normalise({ name: c.name, type: type, issuer: c.issuer || "", notes: "Imported from your checklist – add the expiry date if it has one." }));
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
    var rows = [["Name", "Type", "Number", "Issuing authority", "Holder", "Issue date", "Expiry date", "Reminder date", "Status", "Days left", "Fee paid", "Payments total", "Notes"]];
    sortItems(items).forEach(function (i) {
      var st = status(i);
      var total = i.payments.reduce(function (sum, p) { return sum + Number(p.amount || 0); }, 0);
      rows.push([i.name, TYPE_LABELS[i.type] || i.type, i.number, i.issuer, i.holder, i.issued, i.expiry, i.reminder, st.label, st.days === null ? "" : st.days, i.fee, i.payments.length ? total : "", i.notes]);
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

  // ---------- Inspection mode ----------
  var inspect = document.getElementById("inspect");
  var inspectList = document.getElementById("inspect-list");
  var inspectOpener = null;

  function openInspection() {
    inspectList.textContent = "";
    // Show only items that are still valid (current, expiring soon, or no expiry)
    var valid = sortItems(items).filter(function (i) { return status(i).key !== "alert"; });
    valid.sort(function (a, b) { return (a.type === "staff") - (b.type === "staff"); });
    valid.forEach(function (item) {
      var st = status(item);
      var li = el("li", { "class": "inspect-item" });
      var text = el("div", { "class": "inspect-text" });
      text.appendChild(el("h3", null, item.name));
      if (item.holder) text.appendChild(el("p", { "class": "inspect-holder" }, item.holder));
      if (item.number) text.appendChild(el("p", { "class": "inspect-number" }, "No. " + item.number));
      if (item.issuer) text.appendChild(el("p", null, "Issued by " + item.issuer));
      var stat = el("p", { "class": "inspect-status" });
      stat.appendChild(el("span", { "class": "dot " + st.key, "aria-hidden": "true" }));
      stat.appendChild(document.createTextNode(item.expiry ? "Valid until " + formatDate(item.expiry) : "Current – no expiry date"));
      text.appendChild(stat);
      li.appendChild(text);
      if (item.image) li.appendChild(thumbButton(item, "inspect-thumb"));
      inspectList.appendChild(li);
    });
    if (!valid.length) inspectList.appendChild(el("li", { "class": "empty-state" }, "No current licences or certificates to show yet."));
    var venue = items.filter(function (i) { return i.type !== "staff" && i.holder; })[0];
    document.getElementById("inspect-meta").textContent = (venue ? venue.holder + " · " : "") + valid.length + " current items · shown " + new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

    inspectOpener = document.activeElement;
    setBackgroundInert(true);
    inspect.hidden = false;
    document.body.classList.add("inspect-open");
    try { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {}); } catch (e) { /* not supported */ }
    document.getElementById("inspect-close").focus();
  }

  // Keeps keyboard focus inside inspection mode while it's open
  function setBackgroundInert(on) {
    document.querySelectorAll("body > header, body > main, body > footer, body > .skip-link").forEach(function (node) {
      if (on) node.setAttribute("inert", ""); else node.removeAttribute("inert");
    });
  }

  function closeInspection() {
    setBackgroundInert(false);
    inspect.hidden = true;
    document.body.classList.remove("inspect-open");
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {}); } catch (e) { /* ignore */ }
    if (inspectOpener) inspectOpener.focus();
  }

  document.getElementById("inspect-btn").addEventListener("click", openInspection);
  document.getElementById("inspect-close").addEventListener("click", closeInspection);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !inspect.hidden && !imageDialog.open) closeInspection();
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
  var issuerChips = document.getElementById("issuer-chips");
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
    [dateChips, numberChips, issuerChips].forEach(function (c) { c.textContent = ""; });
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

    var imagePromise = downscale(file).catch(function () { return ""; });
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
        return imagePromise.then(function (image) {
          progressWrap.hidden = true;
          showSuggestions((result && result.data && result.data.text) || "", file.name, image);
        });
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

  // Finds dates in OCR text (numeric dates are read day-first, as in Australia).
  // Each date gets an expiry score and an issue score from the words just before it.
  function findDates(text) {
    var found = [];
    function push(iso, index, raw) {
      if (!iso) return;
      // Use the label on the same line; if the date sits on its own line, use the line above
      var lineStart = text.lastIndexOf("\n", index - 1) + 1;
      var before = text.slice(Math.max(lineStart, index - 45), index);
      if (!/[a-z]/i.test(before) && lineStart > 0) {
        var prevStart = text.lastIndexOf("\n", lineStart - 2) + 1;
        before = text.slice(prevStart, lineStart);
      }
      before = before.toLowerCase();
      var expiry = 0, issue = 0;
      if (/expir|valid (until|to|thru|through)|renew|due|until|end date|ceases/.test(before)) expiry += 3;
      if (/issue|issued|granted|from|commenc|start|completed|attained/.test(before)) { expiry -= 2; issue += 3; }
      if (/birth|dob/.test(before)) { expiry -= 5; issue -= 5; }
      found.push({ iso: iso, raw: raw.trim(), expiry: expiry, issue: issue });
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
    found.forEach(function (d) {
      var e = byIso[d.iso];
      if (!e) byIso[d.iso] = d;
      else { e.expiry = Math.max(e.expiry, d.expiry); e.issue = Math.max(e.issue, d.issue); }
    });
    return Object.keys(byIso).map(function (k) { return byIso[k]; }).sort(function (a, b) {
      return b.expiry - a.expiry || (a.iso < b.iso ? 1 : -1); // best expiry context first, then latest date
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

  // Known issuing authorities, plus council-style names found in the text
  var AUTHORITIES = [
    [/liquor\s*(&|and)\s*gaming\s*nsw/i, "Liquor & Gaming NSW"],
    [/nsw\s*food\s*authority/i, "NSW Food Authority"],
    [/service\s*nsw/i, "Service NSW"],
    [/liquor\s*control\s*victoria/i, "Liquor Control Victoria"],
    [/office\s*of\s*liquor\s*and\s*gaming|\bOLGR\b/i, "Office of Liquor and Gaming Regulation (QLD)"],
    [/racing,?\s*gaming\s*(&|and)\s*liquor/i, "Racing, Gaming and Liquor (WA)"],
    [/consumer\s*(&|and)\s*business\s*services/i, "Consumer and Business Services (SA)"],
    [/liquor\s*(&|and)\s*gaming\s*branch|treasury\s*and\s*finance/i, "Liquor and Gaming Branch (TAS)"],
    [/access\s*canberra/i, "Access Canberra"],
    [/licensing\s*nt/i, "Licensing NT"],
    [/nt\s*health/i, "NT Health"],
    [/onemusic/i, "OneMusic Australia"],
    [/\bASIC\b/, "ASIC"],
    [/workcover\s*queensland/i, "WorkCover Queensland"],
    [/icare/i, "icare NSW"],
    [/worksafe\s*victoria/i, "WorkSafe Victoria"]
  ];
  function findIssuers(text) {
    var out = [];
    AUTHORITIES.forEach(function (a) { if (a[0].test(text) && out.indexOf(a[1]) === -1) out.push(a[1]); });
    var re = /\b((?:City|Shire|Town|Municipality) of [A-Z][A-Za-z\- ]{2,30}|[A-Z][A-Za-z\- ]{2,30} (?:City|Shire|Regional|Municipal|Town) Council|[A-Z][A-Za-z\- ]{2,30} Council)\b/g;
    var m;
    while ((m = re.exec(text))) {
      var name = m[1].replace(/\s+/g, " ").trim();
      if (out.indexOf(name) === -1) out.push(name);
    }
    return out.slice(0, 5);
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

  function fillChips(container, values, labelFor, key, emptyText) {
    container.textContent = "";
    if (!values.length) {
      container.appendChild(el("p", { "class": "fine" }, emptyText));
      return;
    }
    values.forEach(function (v, i) {
      var chip = makeChip(container, labelFor(v), v, function (picked) { scanResult[key] = picked; });
      if (i === 0) { chip.setAttribute("aria-pressed", "true"); scanResult[key] = v; }
    });
  }

  function showSuggestions(text, fileName, image) {
    var dates = findDates(text);
    var numbers = findNumbers(text, dates);
    var issuers = findIssuers(text);
    var guess = guessItem(text);
    var holderMatch = text.match(/(?:name|holder|licensee|issued to)\s*[:\-]\s*([A-Za-z][A-Za-z' \-]{2,40})/i);
    var issueDate = dates.filter(function (d) { return d.issue > 0; }).sort(function (a, b) { return b.issue - a.issue; })[0];
    scanResult = {
      name: guess.name,
      type: guess.type,
      holder: holderMatch ? holderMatch[1].trim() : "",
      number: "",
      issuer: "",
      issued: "",
      expiry: "",
      image: image,
      notes: "Scanned from " + fileName + ". Please check these details."
    };

    var expiryOptions = dates.filter(function (d) { return d.expiry >= 0 || dates.length === 1; }).map(function (d) { return d.iso; });
    if (!expiryOptions.length) expiryOptions = dates.map(function (d) { return d.iso; });
    fillChips(dateChips, expiryOptions.slice(0, 6), formatDate, "expiry", "No dates found. You can type the expiry date in the next step.");
    if (issueDate && issueDate.iso !== scanResult.expiry) scanResult.issued = issueDate.iso;
    fillChips(numberChips, numbers, function (n) { return n; }, "number", "No licence numbers found.");
    fillChips(issuerChips, issuers, function (n) { return n; }, "issuer", "No issuing authority found.");

    ocrText.textContent = text.trim() || "(No text found)";
    suggestionsEl.hidden = false;
    scanUse.disabled = false;
    scanStatus.className = "form-status success";
    scanStatus.textContent = dates.length || numbers.length || issuers.length
      ? "Done. We've picked our best guesses – tap to change them, then review."
      : "Done, but we couldn't spot dates, numbers or an issuer. You can still enter them by hand.";
  }

  scanUse.addEventListener("click", function () {
    if (!scanResult) return;
    scanDialog.close();
    openItemDialog(scanResult, "Check the scanned details");
  });

  // ---------- Start ----------
  applyRole();
  render();
  if (new URLSearchParams(window.location.search).get("import") === "checklist") {
    importChecklist();
    try { history.replaceState(null, "", window.location.pathname); } catch (e) { /* ignore */ }
  }
})();
