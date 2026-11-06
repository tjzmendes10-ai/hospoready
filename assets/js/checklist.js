// HospoReady – permit checklist, readiness score and new-venue timeline
// Rules come from /data/permits.json

(function () {
  var DATA_URL = "../data/permits.json?v=62527ba3";
  var STORAGE_KEY = "hospoready-checklist";
  var TICKS_KEY = "hospoready-readiness";
  var GROUP_ORDER = ["federal", "state", "council", "staff", "other"];
  var RING_CIRCUMFERENCE = 2 * Math.PI * 52;

  var form = document.getElementById("checklist-form");
  var stateSelect = document.getElementById("cl-state");
  var venueWrap = document.getElementById("venue-choices");
  var togglesWrap = document.getElementById("question-toggles");
  var newVenueToggle = document.getElementById("cl-new");
  var errorEl = document.getElementById("cl-error");
  var results = document.getElementById("results");
  var groupsEl = document.getElementById("results-groups");
  var summaryEl = document.getElementById("results-summary");
  var titleEl = document.getElementById("results-title");
  var councilHelp = document.getElementById("council-help");
  var data = null;
  var current = null; // { sel, items, ticks }

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatDate(iso) {
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  }

  function readStore(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }

  // ---- Build the form from the data file ----
  function buildForm() {
    var states = data.meta.states;
    Object.keys(states).forEach(function (code) {
      stateSelect.appendChild(el("option", { value: code }, states[code] + " (" + code + ")"));
    });

    var venues = data.meta.venue_types;
    Object.keys(venues).forEach(function (key) {
      var label = el("label", { "class": "choice" });
      label.appendChild(el("input", { type: "radio", name: "venue", value: key }));
      label.appendChild(el("span", null, venues[key]));
      venueWrap.appendChild(label);
    });

    var questions = data.meta.questions;
    Object.keys(questions).forEach(function (key) {
      var label = el("label", { "class": "switch switch-light" });
      label.appendChild(el("input", { type: "checkbox", role: "switch", name: "q", value: key }));
      label.appendChild(el("span", { "class": "switch-track", "aria-hidden": "true" }));
      label.appendChild(el("span", null, questions[key]));
      togglesWrap.appendChild(label);
    });
  }

  function readForm() {
    var venue = form.querySelector("input[name=venue]:checked");
    var answers = {};
    form.querySelectorAll("input[name=q]").forEach(function (input) { answers[input.value] = input.checked; });
    return { state: stateSelect.value, venue: venue ? venue.value : "", answers: answers, isNew: newVenueToggle.checked };
  }

  function applyToForm(sel) {
    if (sel.state) stateSelect.value = sel.state;
    var venue = form.querySelector("input[name=venue][value='" + sel.venue + "']");
    if (venue) venue.checked = true;
    form.querySelectorAll("input[name=q]").forEach(function (input) { input.checked = !!sel.answers[input.value]; });
    newVenueToggle.checked = !!sel.isNew;
  }

  // ---- Rules ----
  function triggered(permit, sel) {
    var t = permit.triggers || {};
    if (t.always) return true;
    if (t.any && t.any.some(function (k) { return sel.answers[k]; })) return true;
    if (t.venue_types && t.venue_types.indexOf(sel.venue) !== -1) return true;
    return false;
  }

  function detailFor(permit, state) {
    if (permit.applies_to_states && permit.applies_to_states.indexOf(state) === -1) return null;
    if (permit.state_details) return permit.state_details[state] || null;
    return permit.details || null;
  }

  function buildChecklist(sel) {
    var items = [];
    data.permits.forEach(function (permit) {
      if (!triggered(permit, sel)) return;
      var d = detailFor(permit, sel.state);
      if (!d) return;
      items.push({
        id: permit.id,
        group: d.group || permit.group,
        phase: permit.phase || 5,
        name: d.name || permit.name,
        summary: permit.summary,
        issuer: d.issuer,
        renewal: d.renewal,
        url: d.url,
        lead_time: d.lead_time,
        verified: d.verified !== false,
        note: d.note,
        varies: !!permit.varies_by_council,
        last_checked: d.last_checked || permit.last_checked
      });
    });
    return items;
  }

  function sourceLinks(item, state) {
    var links = [];
    if (item.url) links.push({ text: "Official source ↗", href: item.url });
    var finder = data.council_finders[state];
    if ((item.varies || item.group === "council" || !item.url) && finder) links.push({ text: "Find your council ↗", href: finder.url });
    if (!item.url) links.push({ text: "Search ABLIS ↗", href: data.general_links.ablis.url });
    return links;
  }

  // ---- Render items ----
  function renderItem(item, sel) {
    var li = el("li", { "class": "permit-item" });
    li.appendChild(el("h4", null, item.name));
    li.appendChild(el("p", { "class": "summary" }, item.summary));

    if (!item.verified) {
      var warn = el("p", { "class": "unverified" });
      warn.appendChild(el("span", { "aria-hidden": "true" }, "⚠️"));
      var txt = el("span");
      txt.appendChild(el("strong", null, "Not fully verified. "));
      txt.appendChild(document.createTextNode(item.note || "Please confirm with the issuing authority."));
      warn.appendChild(txt);
      li.appendChild(warn);
    }

    var rows = [["Issued by", item.issuer], ["Renewal", item.renewal || "Not confirmed – check with the issuer"]];
    if (sel.isNew) rows.push(["Lead time", item.lead_time || data.meta.default_lead_time]);
    var dl = el("dl", { "class": "permit-meta" });
    rows.forEach(function (row) {
      var div = el("div");
      div.appendChild(el("dt", null, row[0]));
      div.appendChild(el("dd", null, row[1]));
      dl.appendChild(div);
    });
    li.appendChild(dl);

    var links = el("p", { "class": "permit-links" });
    sourceLinks(item, sel.state).forEach(function (l) {
      links.appendChild(el("a", { href: l.href, target: "_blank", rel: "noopener" }, l.text));
    });
    li.appendChild(links);

    var have = el("label", { "class": "have-it no-print" });
    var box = el("input", { type: "checkbox", "data-id": item.id });
    box.checked = current.ticks.indexOf(item.id) !== -1;
    box.addEventListener("change", function () { onTick(item.id, box.checked); });
    have.appendChild(box);
    have.appendChild(el("span", null, "I have this and it's current"));
    li.appendChild(have);

    if (item.last_checked) li.appendChild(el("p", { "class": "last-checked" }, "Info last checked " + formatDate(item.last_checked)));
    return li;
  }

  function renderGroups(sel, items) {
    GROUP_ORDER.forEach(function (groupKey) {
      var groupItems = items.filter(function (i) { return i.group === groupKey; });
      if (!groupItems.length) return;
      var section = el("section", { "class": "permit-group", "aria-labelledby": "g-" + groupKey });
      var h = el("h3", { id: "g-" + groupKey }, data.meta.groups[groupKey] + " ");
      h.appendChild(el("span", { "class": "group-count" }, String(groupItems.length)));
      section.appendChild(h);
      var ul = el("ul", { "class": "permit-list-items" });
      groupItems.forEach(function (item) { ul.appendChild(renderItem(item, sel)); });
      section.appendChild(ul);
      groupsEl.appendChild(section);
    });
  }

  // New-venue mode: the same items, ordered into a timeline of phases
  function renderTimeline(sel, items) {
    var intro = el("p", { "class": "timeline-intro" }, "A suggested order for getting set up. Lead times are only shown where an official source confirms them – otherwise check with the issuer for current processing times.");
    groupsEl.appendChild(intro);
    var ol = el("ol", { "class": "timeline" });
    Object.keys(data.meta.phases).sort().forEach(function (key) {
      var phaseItems = items.filter(function (i) { return String(i.phase) === key; });
      if (!phaseItems.length) return;
      var phase = data.meta.phases[key];
      var step = el("li", { "class": "timeline-step" });
      step.appendChild(el("span", { "class": "timeline-num", "aria-hidden": "true" }, key));
      var body = el("div", { "class": "timeline-body" });
      body.appendChild(el("h3", null, "Step " + key + ": " + phase.title));
      body.appendChild(el("p", { "class": "timeline-hint" }, phase.hint));
      var ul = el("ul", { "class": "permit-list-items" });
      phaseItems.forEach(function (item) { ul.appendChild(renderItem(item, sel)); });
      body.appendChild(ul);
      step.appendChild(body);
      ol.appendChild(step);
    });
    groupsEl.appendChild(ol);
  }

  // ---- Readiness score ----
  function scoreFor(items, ticks) {
    if (!items.length) return 0;
    var have = items.filter(function (i) { return ticks.indexOf(i.id) !== -1; }).length;
    return Math.round((have / items.length) * 100);
  }

  function renderScore() {
    var items = current.items, sel = current.sel;
    var score = scoreFor(items, current.ticks);
    var level = score >= 80 ? "ok" : score >= 50 ? "warn" : "alert";
    var ring = document.getElementById("ring-fg");
    ring.style.strokeDasharray = RING_CIRCUMFERENCE.toFixed(1);
    ring.style.strokeDashoffset = (RING_CIRCUMFERENCE * (1 - score / 100)).toFixed(1);
    ring.setAttribute("class", "ring-fg " + level);
    document.getElementById("score-num").textContent = score;
    var gaps = items.filter(function (i) { return current.ticks.indexOf(i.id) === -1; });
    var text = score + " out of 100. ";
    text += !current.ticks.length ? "Tick the items you already have to see your score."
      : score === 100 ? "Everything's ticked off – nice work."
      : score >= 80 ? "Looking good – just a few gaps left."
      : score >= 50 ? "Getting there – " + gaps.length + " gaps to fix."
      : gaps.length + " gaps to fix.";
    document.getElementById("score-text").textContent = text;

    var list = document.getElementById("gaps-list");
    list.textContent = "";
    document.getElementById("gaps").hidden = !gaps.length;
    gaps.forEach(function (item) {
      var li = el("li");
      li.appendChild(el("span", { "class": "gap-name" }, item.name));
      var link = sourceLinks(item, sel.state)[0];
      if (link) li.appendChild(el("a", { href: link.href, target: "_blank", rel: "noopener" }, link.text));
      list.appendChild(li);
    });
  }

  function onTick(id, checked) {
    var i = current.ticks.indexOf(id);
    if (checked && i === -1) current.ticks.push(id);
    if (!checked && i !== -1) current.ticks.splice(i, 1);
    var all = readStore(TICKS_KEY) || {};
    all[current.sel.state + "|" + current.sel.venue] = current.ticks;
    writeStore(TICKS_KEY, all);
    renderScore();
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = el("textarea", { readonly: "", style: "position:fixed;opacity:0;" });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      ta.remove();
      ok ? resolve() : reject();
    });
  }

  document.getElementById("share-btn").addEventListener("click", function () {
    var status = document.getElementById("share-status");
    var score = scoreFor(current.items, current.ticks);
    var link = window.location.origin + window.location.pathname;
    var msg = "My venue's Hospo Readiness Score is " + score + "/100. Check yours free in 2 minutes: " + link;
    copyText(msg).then(function () {
      status.textContent = "Copied! Paste it anywhere to share.";
    }, function () {
      status.textContent = "Copy this message: " + msg;
    });
  });

  // ---- Main render ----
  function render(sel, items) {
    groupsEl.textContent = "";
    var stateName = data.meta.states[sel.state];
    var venueName = data.meta.venue_types[sel.venue];
    titleEl.textContent = (sel.isNew ? "Opening a " + venueName.toLowerCase() : "Your checklist: " + venueName) + " in " + stateName;
    var unverified = items.filter(function (i) { return !i.verified; }).length;
    summaryEl.textContent = items.length + " items" + (unverified ? " · " + unverified + " to confirm locally" : "");

    if (sel.isNew) renderTimeline(sel, items); else renderGroups(sel, items);
    renderScore();

    var finder = data.council_finders[sel.state];
    councilHelp.textContent = "";
    if (finder) {
      councilHelp.appendChild(document.createTextNode("Not sure who your council is? "));
      councilHelp.appendChild(el("a", { href: finder.url, target: "_blank", rel: "noopener" }, finder.name + " ↗"));
      councilHelp.appendChild(document.createTextNode(". For a full search of government licences, try "));
      councilHelp.appendChild(el("a", { href: data.general_links.ablis.url, target: "_blank", rel: "noopener" }, "ABLIS ↗"));
      councilHelp.appendChild(document.createTextNode("."));
    }

    results.hidden = false;
    results.focus({ preventScroll: true });
    results.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  function save(sel, items) {
    writeStore(STORAGE_KEY, {
      state: sel.state,
      venue: sel.venue,
      created: new Date().toISOString(),
      items: items.map(function (i) { return { name: i.name, issuer: i.issuer, group: i.group }; })
    });
  }

  function updateUrl(sel) {
    var on = Object.keys(sel.answers).filter(function (k) { return sel.answers[k]; });
    var params = new URLSearchParams({ state: sel.state, venue: sel.venue });
    if (on.length) params.set("q", on.join(","));
    if (sel.isNew) params.set("new", "1");
    try { history.replaceState(null, "", "?" + params.toString()); } catch (e) { /* ignore */ }
  }

  function run(sel) {
    var items = buildChecklist(sel);
    var ids = items.map(function (i) { return i.id; });
    var stored = (readStore(TICKS_KEY) || {})[sel.state + "|" + sel.venue] || [];
    current = { sel: sel, items: items, ticks: stored.filter(function (id) { return ids.indexOf(id) !== -1; }) };
    render(sel, items);
    save(sel, items);
    updateUrl(sel);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var sel = readForm();
    if (!sel.state || !sel.venue) {
      errorEl.className = "form-status error";
      errorEl.textContent = !sel.state ? "Please choose your state or territory." : "Please choose your venue type.";
      (!sel.state ? stateSelect : form.querySelector("input[name=venue]")).focus();
      return;
    }
    errorEl.textContent = "";
    run(sel);
  });

  document.getElementById("print-btn").addEventListener("click", function () { window.print(); });

  // ---- Load data ----
  fetch(DATA_URL)
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (json) {
      data = json;
      buildForm();
      var params = new URLSearchParams(window.location.search);
      if (params.get("new") === "1") newVenueToggle.checked = true;
      if (params.get("state") && params.get("venue") && data.meta.states[params.get("state")] && data.meta.venue_types[params.get("venue")]) {
        var answers = {};
        (params.get("q") || "").split(",").forEach(function (k) { if (k) answers[k] = true; });
        var sel = { state: params.get("state"), venue: params.get("venue"), answers: answers, isNew: params.get("new") === "1" };
        applyToForm(sel);
        run(sel);
      }
    })
    .catch(function () {
      errorEl.className = "form-status error";
      errorEl.textContent = "Sorry, the permit data couldn't be loaded. Please refresh the page.";
    });
})();
