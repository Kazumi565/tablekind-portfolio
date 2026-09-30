import { setupTableExample } from "./table-example.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const desktop = matchMedia("(min-width: 1120px) and (min-height: 780px)");
const pointer = matchMedia("(hover: hover) and (pointer: fine)");
const story = document.querySelector(".hero-story");
const hero = story.querySelector(".hero");
const scene = story.querySelector(".table-scene");
const header = document.querySelector(".site-header");
const notes = [...scene.querySelectorAll(".floating-note")];
const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => value * value * (3 - 2 * value);
let frame = 0;
let pointerX = 0;
let pointerY = 0;

// One frame per input batch. Native scrolling, no timer loop or scroll capture.
function render() {
  frame = 0;
  const enabled = desktop.matches && pointer.matches && !reduced.matches;
  document.body.classList.toggle("story-enabled", enabled);
  header?.classList.toggle("is-scrolled", scrollY > 24);
  if (header && !reduced.matches) {
    const length = document.documentElement.scrollHeight - innerHeight;
    header.style.setProperty(
      "--page-progress",
      String(clamp(scrollY / Math.max(1, length))),
    );
  }
  if (!enabled) {
    scene.style.removeProperty("--pointer-x");
    scene.style.removeProperty("--pointer-y");
    return;
  }
  const start = story.getBoundingClientRect().top - 92;
  const distance = Math.max(1, story.offsetHeight - hero.offsetHeight);
  const progress = clamp(-start / distance);
  const opened = ease(clamp(progress / 0.9));
  hero.style.setProperty("--phone-x", `${-110 * opened}px`);
  hero.style.setProperty("--phone-angle", `${-9 * (1 - opened)}deg`);
  hero.style.setProperty("--ring-angle", `${progress * 35}deg`);
  hero.style.setProperty("--ring-scale", String(1 + progress * 0.07));
  scene.style.setProperty("--pointer-x", `${pointerX}px`);
  scene.style.setProperty("--pointer-y", `${pointerY}px`);
  notes.forEach((note, index) => {
    const amount = ease(clamp((progress - 0.08 - index * 0.2) / 0.36));
    hero.style.setProperty(
      ["--joined", "--shared", "--total"][index],
      String(amount),
    );
    note.style.setProperty("--note-opacity", String(amount));
    note.style.setProperty("--note-x", `${-100 * (1 - amount)}px`);
    note.style.setProperty("--note-y", `${(1 - amount) * (30 - index * 16)}px`);
    note.style.setProperty("--note-angle", `${-7 * (1 - amount)}deg`);
  });
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(render);
}
function resetPointer() {
  pointerX = 0;
  pointerY = 0;
  schedule();
}
scene.addEventListener("pointermove", (event) => {
  if (
    !pointer.matches ||
    reduced.matches ||
    !desktop.matches ||
    event.pointerType === "touch"
  )
    return;
  const bounds = scene.getBoundingClientRect();
  pointerX = (clamp((event.clientX - bounds.left) / bounds.width) - 0.5) * 6;
  pointerY = (clamp((event.clientY - bounds.top) / bounds.height) - 0.5) * 6;
  schedule();
});
scene.addEventListener("pointerleave", resetPointer);
addEventListener("scroll", schedule, { passive: true });
addEventListener("resize", schedule, { passive: true });
addEventListener("pageshow", schedule);
for (const media of [reduced, desktop, pointer])
  media.addEventListener("change", resetPointer);
// Content switches can change the document height without resizing the viewport.
if ("ResizeObserver" in window)
  new ResizeObserver(schedule).observe(document.body);
render();

// The examples are local illustrations, with no API, accounts or stored state.
function restartAnimation(element, name) {
  element.classList.remove(name);
  if (reduced.matches) return;
  // Flush only on an intentional click, never during scrolling.
  void element.offsetWidth;
  element.classList.add(name);
}
setupTableExample({ reduced, restartAnimation });
const roleDetails = {
  guest: {
    title: "My evening, my way.",
    description: "Join a table, order favourites and see your own share.",
    chips: ["Table 08", "My order", "My share"],
    rows: [
      ["Margherita · My share", "40 MDL"],
      ["Lemonade", "35 MDL"],
      ["My part", "75 MDL"],
    ],
  },
  waiter: {
    title: "More time for the table.",
    description: "Keep table requests and order approvals in one focused view.",
    chips: ["My tables", "Orders", "Requests"],
    rows: [
      ["Table 08", "Order to approve"],
      ["Table 12", "Ready to serve"],
      ["Table 03", "Sharing request"],
    ],
  },
  manager: {
    title: "The details, in good hands.",
    description: "Look after the menu, team access and restaurant settings.",
    chips: ["Menu", "Team", "Settings"],
    rows: [
      ["Menu", "8 sample items"],
      ["Team", "4 sample members"],
      ["Tables", "12 sample tables"],
    ],
  },
};
const roleDetailsRo = {
  guest: {
    title: "Seara mea, în ritmul meu.",
    description: "Intră la masă, comandă ce îți place și vezi cât îți revine.",
    chips: ["Masa 08", "Comanda mea", "Partea mea"],
    rows: [["Margherita · Partea mea", "40 MDL"], ["Limonadă", "35 MDL"], ["Partea mea", "75 MDL"]],
  },
  waiter: {
    title: "Mai mult timp pentru fiecare masă.",
    description: "Urmărește solicitările și aprobă comenzile într-o interfață dedicată.",
    chips: ["Mesele mele", "Comenzi", "Solicitări"],
    rows: [["Masa 08", "Comandă de aprobat"], ["Masa 12", "Gata de servire"], ["Masa 03", "Solicitare de împărțire"]],
  },
  manager: {
    title: "Detaliile sunt sub control.",
    description: "Gestionează meniul, accesul echipei și setările restaurantului.",
    chips: ["Meniu", "Echipă", "Setări"],
    rows: [["Meniu", "8 preparate fictive"], ["Echipă", "4 membri fictivi"], ["Mese", "12 mese fictive"]],
  },
};
const roleNamesRo = { guest: "client", waiter: "chelner", manager: "manager" };
const roles = [...document.querySelectorAll("[data-role]")];
const detail = document.querySelector("#role-detail");
roles.forEach((button) =>
  button.addEventListener("click", () => {
    const role = button.dataset.role;
    const content = (document.documentElement.lang === "ro" ? roleDetailsRo : roleDetails)[role];
    if (!content) return;
    roles.forEach((item) =>
      item.setAttribute("aria-pressed", String(item === button)),
    );
    detail.querySelector(".role-detail-label").textContent =
      document.documentElement.lang === "ro" ? `Interfață ilustrativă pentru ${roleNamesRo[role]}` : `Illustrative ${role} view`;
    detail.querySelector("strong").textContent = content.title;
    detail.querySelector("p").textContent = content.description;
    detail.querySelector(".role-detail-chips").replaceChildren(
      ...content.chips.map((text) => {
        const chip = document.createElement("span");
        chip.textContent = text;
        return chip;
      }),
    );
    detail.querySelector(".workspace-preview").replaceChildren(
      ...content.rows.map(([label, value]) => {
        const row = document.createElement("div");
        const text = document.createElement("span");
        const badge = document.createElement("strong");
        text.textContent = label;
        badge.textContent = value;
        row.append(text, badge);
        return row;
      }),
    );
    restartAnimation(detail.parentElement, "role-changed");
  }),
);
document.querySelectorAll("[data-enhancement]").forEach((element) => {
  element.hidden = false;
});
