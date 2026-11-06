// HospoReady – shared site script

(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasObserver = "IntersectionObserver" in window;

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // ---- Fade-in on scroll (and docket items one by one) ----
  var revealEls = document.querySelectorAll(".reveal, .docket");
  if (reduceMotion || !hasObserver) {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  }

  // ---- Hero phone: countdowns tick down to their value ----
  if (!reduceMotion) {
    document.querySelectorAll(".countdown").forEach(function (el) {
      var to = parseInt(el.getAttribute("data-to"), 10);
      var from = to + 30;
      var start = null;
      var duration = 1400;
      function tick(now) {
        if (!start) start = now;
        var t = Math.min((now - start) / duration, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(from - (from - to) * eased);
        if (t < 1) requestAnimationFrame(tick);
      }
      el.textContent = from;
      setTimeout(function () { requestAnimationFrame(tick); }, 400);
    });
  }

  // ---- Problem: scattered notes come together as you scroll ----
  var stage = document.getElementById("notes-stage");
  if (stage && !reduceMotion) {
    var notes = stage.querySelectorAll(".note");
    // [x as a share of free width, y in px, rotation in deg]
    var scatter = [
      [-0.45, 10, -8], [0.42, 48, 7], [-0.3, 128, 5],
      [0.4, 186, -6], [-0.42, 262, 8], [0.25, 318, -4]
    ];
    var ticking = false;

    function layoutScatter() {
      var free = Math.max(stage.clientWidth - 232, 110);
      notes.forEach(function (note, i) {
        var s = scatter[i % scatter.length];
        note.style.setProperty("--sx", (s[0] * free) + "px");
        note.style.setProperty("--sy", s[1] + "px");
        note.style.setProperty("--sr", s[2] + "deg");
      });
    }

    function update() {
      ticking = false;
      var rect = stage.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = (vh * 0.85 - rect.top) / (vh * 0.55);
      p = Math.max(0, Math.min(1, p));
      p = p * p * (3 - 2 * p); // smoothstep
      stage.style.setProperty("--p", p.toFixed(3));
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    layoutScatter();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () { layoutScatter(); onScroll(); });
  }

  // ---- Permit estimate teaser: starts at 0 and builds up one item at a time ----
  var teaser = document.getElementById("teaser");
  if (teaser) {
    var STEP_MS = 140;
    var countEl = document.getElementById("teaser-count");
    var emptyEl = document.getElementById("teaser-empty");
    var items = teaser.querySelectorAll(".teaser-list li[data-key]");
    var toggles = teaser.querySelectorAll("input[data-adds]");
    var countTimers = [];

    function setCount(n) {
      if (countEl.textContent === String(n)) return;
      countEl.textContent = n;
      countEl.classList.remove("bump");
      void countEl.offsetWidth;
      countEl.classList.add("bump");
    }

    function updateEstimate() {
      var active = {};
      toggles.forEach(function (t) {
        if (t.checked) t.getAttribute("data-adds").split(" ").forEach(function (k) { active[k] = true; });
      });
      countTimers.forEach(clearTimeout);
      countTimers = [];

      var newlyShown = [];
      var kept = 0;
      items.forEach(function (li) {
        var show = !!active[li.getAttribute("data-key")];
        if (!show) { li.hidden = true; li.classList.remove("added"); }
        else if (li.hidden) newlyShown.push(li);
        else kept++;
      });

      setCount(kept);
      newlyShown.forEach(function (li, i) {
        var delay = reduceMotion ? 0 : i * STEP_MS;
        li.style.animationDelay = delay + "ms";
        li.classList.remove("added");
        li.hidden = false;
        void li.offsetWidth;
        li.classList.add("added");
        if (delay === 0) setCount(kept + i + 1);
        else countTimers.push(setTimeout(function () { setCount(kept + i + 1); }, delay));
      });
      emptyEl.hidden = (kept + newlyShown.length) > 0;
    }

    toggles.forEach(function (t) { t.addEventListener("change", updateEstimate); });
  }

  // ---- Sticky mobile CTA: show after the hero, hide at the form ----
  var sticky = document.getElementById("sticky-cta");
  var heroCta = document.getElementById("hero-cta");
  var waitlist = document.getElementById("waitlist");
  if (sticky && heroCta && waitlist && hasObserver) {
    var heroVisible = true;
    var formVisible = false;
    var refresh = function () {
      sticky.classList.toggle("is-shown", !heroVisible && !formVisible);
    };
    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting || entries[0].boundingClientRect.top > 0;
      refresh();
    }).observe(heroCta);
    new IntersectionObserver(function (entries) {
      formVisible = entries[0].isIntersecting;
      refresh();
    }, { rootMargin: "0px 0px -20% 0px" }).observe(waitlist);
  }

  // ---- Waitlist form ----
  var form = document.getElementById("waitlist-form");
  if (!form) return;

  // Pricing buttons (and ?plan= links) preselect the plan in the form
  var planSelect = document.getElementById("plan");
  function selectPlan(plan) {
    if (!planSelect || !plan) return;
    for (var i = 0; i < planSelect.options.length; i++) {
      if (planSelect.options[i].text === plan) planSelect.selectedIndex = i;
    }
  }
  document.querySelectorAll("[data-plan]").forEach(function (link) {
    link.addEventListener("click", function () { selectPlan(link.getAttribute("data-plan")); });
  });
  var planParam = new URLSearchParams(window.location.search).get("plan");
  if (planParam) selectPlan(planParam);

  var status = form.querySelector(".form-status");
  var contactEmail = (window.HOSPOREADY_CONFIG || {}).contactEmail || "us";
  var button = form.querySelector("button[type=submit]");

  function setStatus(message, type) {
    status.textContent = message;
    status.className = "form-status" + (type ? " " + type : "");
  }

  function validate() {
    var ok = true;
    form.querySelectorAll("[required]").forEach(function (field) {
      var wrapper = field.closest(".field");
      var valid = field.checkValidity();
      if (wrapper) wrapper.classList.toggle("invalid", !valid);
      field.setAttribute("aria-invalid", valid ? "false" : "true");
      if (!valid && ok) {
        field.focus();
        ok = false;
      }
    });
    return ok;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!validate()) {
      setStatus("Please fill in the required fields (marked *) and check your email address.", "error");
      return;
    }

    if (form.action.indexOf("YOUR_FORM_ID") !== -1) {
      setStatus("Sorry, the waitlist isn't connected yet. Please email " + contactEmail + " and we'll add you.", "error");
      return;
    }

    button.disabled = true;
    setStatus("Sending…");

    fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" }
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Request failed");
        form.reset();
        form.querySelectorAll(".field.invalid").forEach(function (el) { el.classList.remove("invalid"); });
        setStatus("Thanks, you're on the list! We'll be in touch before launch.", "success");
      })
      .catch(function () {
        setStatus(navigator.onLine === false
          ? "You seem to be offline. Check your connection and try again."
          : "Sorry, we couldn't add you just now. Please try again in a minute, or email " + contactEmail + ".", "error");
      })
      .finally(function () {
        button.disabled = false;
      });
  });
})();
