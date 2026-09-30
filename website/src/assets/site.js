const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
document.body.classList.add("enhanced");
const reveals = [...document.querySelectorAll(".reveal")];
// Content is visible by default, including without JavaScript or observer support.
if ("IntersectionObserver" in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.remove("is-waiting");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 },
  );
  reveals.forEach((el) => {
    if (el.getBoundingClientRect().top > innerHeight) {
      el.classList.add("is-waiting");
      observer.observe(el);
    }
  });
  const showAll = () => {
    if (reducedMotion.matches) {
      reveals.forEach((el) => el.classList.remove("is-waiting"));
      observer.disconnect();
    }
  };
  reducedMotion.addEventListener("change", showAll);
  // Keyboard navigation must never focus invisible links while an entrance waits.
  document.addEventListener("focusin", (e) =>
    e.target.closest?.(".reveal")?.classList.remove("is-waiting"),
  );
}
const steps = [...document.querySelectorAll("[data-step]")];
steps.forEach((button) =>
  button.addEventListener("click", () => {
    const selected = button.dataset.step;
    steps.forEach((item) => {
      const active = item.dataset.step === selected;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== selected;
    });
  }),
);
if (document.querySelector("#demo-request")) import("./contact.js");
if (document.querySelector(".hero-story")) import("./motion.js");

// The mobile menu is a native disclosure, so navigation also works without scripts.
const menu = document.querySelector(".mobile-menu");
if (menu) {
  const summary = menu.querySelector("summary");
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.open) {
      menu.open = false;
      summary.focus();
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  menu.querySelectorAll("a").forEach((link) =>
    link.addEventListener("click", () => {
      menu.open = false;
      const target = new URL(link.href);
      if (target.pathname === location.pathname && target.hash) {
        const section = document.querySelector(target.hash);
        if (section) {
          section.tabIndex = -1;
          section.focus({ preventScroll: true });
        }
      }
    }),
  );
  document.addEventListener("focusin", (event) => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  const narrow = matchMedia("(max-width: 820px)");
  narrow.addEventListener("change", () => {
    if (!narrow.matches) menu.open = false;
  });
}
