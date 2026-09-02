/* Mobile navigation drawer. */
(function () {
  const toggle   = document.getElementById("nav-toggle");
  const closeBtn = document.getElementById("nav-close");
  const drawer   = document.getElementById("mobile-nav");
  const backdrop = document.getElementById("nav-backdrop");
  if (!toggle || !drawer || !backdrop) return;

  let lastFocused = null;

  function open() {
    lastFocused = document.activeElement;
    drawer.dataset.open = "true";
    backdrop.dataset.open = "true";
    toggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    (drawer.querySelector("a") || closeBtn).focus();
  }

  function close() {
    delete drawer.dataset.open;
    delete backdrop.dataset.open;
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    if (lastFocused) lastFocused.focus();
  }

  toggle.addEventListener("click", () =>
    drawer.dataset.open === "true" ? close() : open()
  );
  closeBtn?.addEventListener("click", close);
  backdrop.addEventListener("click", close);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && drawer.dataset.open === "true") close();
  });

  // Keep tabbing inside the drawer while it is open.
  drawer.addEventListener("keydown", e => {
    if (e.key !== "Tab" || drawer.dataset.open !== "true") return;
    const items = drawer.querySelectorAll("a, button");
    const first = items[0];
    const last  = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
})();

/* Estimate form. Builds a pre-filled email so the office receives the
   address, job type and callback number instead of a blank message.
   To switch to a real form service later, give the <form> an action
   attribute and delete this block. */
(function () {
  const form = document.getElementById("estimate-form");
  if (!form || form.getAttribute("action")) return;

  form.addEventListener("submit", e => {
    e.preventDefault();
    const v = name => (form.elements[name]?.value || "").trim();

    const kind = v("jobtype");
    const to = kind === "Commercial" || kind === "Fire alarm"
      ? "frank@tonerelectric.com"
      : "scott@tonerelectric.com";

    const body = [
      `Name:  ${v("name")}`,
      `Phone: ${v("phone")}`,
      `Email: ${v("email")}`,
      `Town:  ${v("town")}`,
      `Type of work: ${kind}`,
      "",
      "Details:",
      v("details")
    ].join("\n");

    window.location.href =
      `mailto:${to}?subject=${encodeURIComponent("Estimate request - " + v("name"))}` +
      `&body=${encodeURIComponent(body)}`;

    const note = document.getElementById("form-note");
    if (note) note.hidden = false;
  });
})();
