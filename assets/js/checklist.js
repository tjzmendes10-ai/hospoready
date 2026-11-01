// HospoReady – permit checklist (reads rules from /data/permits.json)

(function () {
  var DATA_URL = "../data/permits.json";
  var STORAGE_KEY = "hospoready-checklist";
  var GROUP_ORDER = ["federal", "state", "council", "staff", "other"];

  var form = document.getElementById("checklist-form");
  var stateSelect = document.getElementById("cl-state");
  var venueWrap = document.getElementById("venue-choices");
  var togglesWrap = document.getElementById("question-toggles");
  var errorEl = document.getElementById("cl-error");
  var results = document.getElementById("results");
  var groupsEl = document.getElementById("results-groups");
  var summaryEl = document.getElementById("results-summary");
  var titleEl = document.getElementById("results-title");
  var councilHelp = document.getElementById("council-help");
  var data = null;

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

  // ---- Build the form from the data file ----
  function buildForm() {
    var states = data.meta.states;
    Object.keys(states).forEach(function (code) {
      stateSelect.appendChild(el("option", { value: code }, states[code] + " (" + code + ")"));
    });

    var venues = data.meta.venue_types;
    Object.keys(venues).forEach(function (key, i) {
      var label = el("label", { "class": "choice" });
      var input = el("input", { type: "radio", name: "venue", value: key });
      if (i === 0) input.required = true;
      label.appendChild(input);
      label.appendChild(el("span", null, venues[key]));
      venueWrap.appendChild(label);
    });

    var questions = data.meta.questions;
    Object.keys(questions).forEach(function (key) {
      var label = el("label", { "class": "switch switch-light" });
      var input = el("input", { type: "checkbox", role: "switch", name: "q", value: key });
      label.appendChild(input);
      label.appendChild(el("span", { "class": "switch-track", "aria-hidden": "true" }));
      label.appendChild(el("span", null, questions[key]));
      togglesWrap.appendChild(label);
    });
  }

  function readForm() {
    var venue = form.querySelector("input[name=venue]:checked");
    var answers = {};
    form.querySelectorAll("input[name=q]").forEach(function (input) { answers[input.value] = input.checked; });
    return { state: stateSelect.value, venue: venue ? venue.value : "", answers: answers };
  }

  function applyToForm(sel) {
    if (sel.state) stateSelect.value = sel.state;
    var venue = form.querySelector("input[name=venue][value='" + sel.venue + "']");
    if (venue) venue.checked = true;
    form.querySelectorAll("input[name=q]").forEach(function (input) { input.checked = !!sel.answers[input.value]; });
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
        name: d.name || permit.name,
        summary: permit.summary,
        issuer: d.issuer,
        renewal: d.renewal,
        url: d.url,
        verified: d.verified !== false,
        note: d.note,
        varies: !!permit.varies_by_council,
        last_checked: d.last_checked || permit.last_checked
      });
    });
    return items;
  }

  // ---- Render ----
  function renderItem(item, state) {
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

    var dl = el("dl", { "class": "permit-meta" });
    [["Issued by", item.issuer], ["Renewal", item.renewal || "Not confirmed – check with the issuer"]].forEach(function (row) {
      var div = el("div");
      div.appendChild(el("dt", null, row[0]));
      div.appendChild(el("dd", null, row[1]));
      dl.appendChild(div);
    });
    li.appendChild(dl);

    var links = el("p", { "class": "permit-links" });
    if (item.url) {
      links.appendChild(el("a", { href: item.url, target: "_blank", rel: "noopener" }, "Official source ↗"));
    }
    var finder = data.council_finders[state];
    if ((item.varies || item.group === "council" || !item.url) && finder) {
      links.appendChild(el("a", { href: finder.url, target: "_blank", rel: "noopener" }, "Find your council ↗"));
    }
    if (!item.url) {
      links.appendChild(el("a", { href: data.general_links.ablis.url, target: "_blank", rel: "noopener" }, "Search ABLIS ↗"));
    }
    li.appendChild(links);
    if (item.last_checked) li.appendChild(el("p", { "class": "last-checked" }, "Last checked " + formatDate(item.last_checked)));
    return li;
  }

  function render(sel, items) {
    groupsEl.textContent = "";
    var stateName = data.meta.states[sel.state];
    var venueName = data.meta.venue_types[sel.venue];
    titleEl.textContent = "Your checklist: " + venueName + " in " + stateName;
    var unverified = items.filter(function (i) { return !i.verified; }).length;
    summaryEl.textContent = items.length + " items" + (unverified ? " · " + unverified + " to confirm locally" : "");

    GROUP_ORDER.forEach(function (groupKey) {
      var groupItems = items.filter(function (i) { return i.group === groupKey; });
      if (!groupItems.length) return;
      var section = el("section", { "class": "permit-group", "aria-labelledby": "g-" + groupKey });
      var h = el("h3", { id: "g-" + groupKey }, data.meta.groups[groupKey] + " ");
      h.appendChild(el("span", { "class": "group-count" }, String(groupItems.length)));
      section.appendChild(h);
      var ul = el("ul", { "class": "permit-list-items" });
      groupItems.forEach(function (item) { ul.appendChild(renderItem(item, sel.state)); });
      section.appendChild(ul);
      groupsEl.appendChild(section);
    });

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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        state: sel.state,
        venue: sel.venue,
        created: new Date().toISOString(),
        items: items.map(function (i) { return { name: i.name, issuer: i.issuer, group: i.group }; })
      }));
    } catch (e) { /* storage unavailable – checklist still works */ }
  }

  function updateUrl(sel) {
    var on = Object.keys(sel.answers).filter(function (k) { return sel.answers[k]; });
    var params = new URLSearchParams({ state: sel.state, venue: sel.venue });
    if (on.length) params.set("q", on.join(","));
    try { history.replaceState(null, "", "?" + params.toString()); } catch (e) { /* ignore */ }
  }

  function run(sel) {
    var items = buildChecklist(sel);
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
      if (params.get("state") && params.get("venue") && data.meta.states[params.get("state")] && data.meta.venue_types[params.get("venue")]) {
        var answers = {};
        (params.get("q") || "").split(",").forEach(function (k) { if (k) answers[k] = true; });
        var sel = { state: params.get("state"), venue: params.get("venue"), answers: answers };
        applyToForm(sel);
        run(sel);
      }
    })
    .catch(function () {
      errorEl.className = "form-status error";
      errorEl.textContent = "Sorry, the permit data couldn't be loaded. Please refresh the page.";
    });
})();
