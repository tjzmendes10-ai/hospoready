// PermitPal – shared site script

(function () {
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  var form = document.getElementById("waitlist-form");
  if (!form) return;

  var status = form.querySelector(".form-status");
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
      setStatus("Please fill in all fields with a valid email address.", "error");
      return;
    }

    if (form.action.indexOf("YOUR_FORM_ID") !== -1) {
      setStatus("The waitlist isn't connected yet – please check back soon.", "error");
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
        setStatus("Thanks! You're on the list. We'll be in touch before launch.", "success");
      })
      .catch(function () {
        setStatus("Sorry, something went wrong. Please try again in a moment.", "error");
      })
      .finally(function () {
        button.disabled = false;
      });
  });
})();
