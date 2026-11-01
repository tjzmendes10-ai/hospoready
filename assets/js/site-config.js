// HospoReady – site-wide settings, loaded on every page.
//
// ===================== PLACEHOLDER EMAIL =====================
// Change this one line to your real contact address. It updates
// every footer, the privacy page, the group pricing link and the
// waitlist form's error messages.
// =============================================================
window.HOSPOREADY_CONFIG = {
  contactEmail: "hello@example.com"
};

// Fills in every element marked with data-contact-email.
// Optional data-email-subject adds a subject line to the mailto link.
(function () {
  var email = window.HOSPOREADY_CONFIG.contactEmail;
  function fill() {
    document.querySelectorAll("[data-contact-email]").forEach(function (link) {
      var subject = link.getAttribute("data-email-subject");
      link.href = "mailto:" + email + (subject ? "?subject=" + encodeURIComponent(subject) : "");
      if (!link.hasAttribute("data-keep-text")) link.textContent = email;
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fill);
  else fill();
})();
