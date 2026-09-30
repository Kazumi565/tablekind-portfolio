import { config } from "./config.js";
const form = document.querySelector("#demo-request");
const draft = document.querySelector("#draft");
const preview = document.querySelector("#draft-text");
const emailLink = document.querySelector("#open-email");
const feedback = document.querySelector("#draft-feedback");
const copy = document.querySelector("#copy-draft");
const ro = document.documentElement.lang === "ro";
const subject = ro ? "Solicitare de demonstrație Tablekind pentru restaurant" : "Tablekind restaurant demonstration enquiry";
const messages = ro ? {
  blank: "Completează numele, restaurantul și orașul, nu doar spații.",
  ready: "Ciorna a fost pregătită pe dispozitiv. Nu a fost trimis nimic.",
  copied: "Ciorna a fost copiată. Lipește textul în aplicația ta de email. Nu a fost trimis nimic.",
  copyError: "Copierea automată nu este disponibilă. Selectează și copiază manual ciorna. Nu a fost trimis nimic.",
  open: "Aplicația ta de email se poate deschide. Verifică și trimite mesajul acolo. Dacă nu se deschide, copiază ciorna. Site-ul nu poate confirma livrarea.",
  clear: "Formularul și ciorna au fost golite din această pagină.",
} : {
  blank: "Please enter your name, restaurant and city, not just spaces.",
  ready: "Draft prepared on this device. Nothing has been sent.",
  copied: "Copied. Paste the draft into your email app. Nothing has been sent.",
  copyError: "Automatic copying is unavailable. Select and copy the draft manually. Nothing has been sent.",
  open: "Your email app may open. Review and send there. If it does not open, copy the draft. This website cannot confirm delivery.",
  clear: "Form and draft cleared from this page.",
};
let scrollTimer;
// This form is a local draft composer, not a mail sender. No API or browser storage.
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const get = (key) => String(values.get(key) ?? "").trim();
  if (!get("name") || !get("restaurant") || !get("city")) {
    document.querySelector("#form-feedback").textContent = messages.blank;
    return;
  }
  document.querySelector("#form-feedback").textContent = "";
  const body = ro ? [
    "Bună, Tablekind,", "",
    "Aș dori să discut despre o demonstrație ghidată pentru restaurant.", "",
    `Nume: ${get("name")}`,
    `Restaurant: ${get("restaurant")}`,
    `Oraș: ${get("city")}`,
    get("message") ? `\nDespre restaurantul nostru:\n${get("message")}` : "", "",
    "Înțeleg că Tablekind este un prototip, iar solicitarea nu înseamnă abonament sau activarea unui serviciu real în restaurant.",
  ] : [
    "Hello Tablekind,",
    "",
    "I would like to discuss a guided restaurant demonstration.",
    "",
    `Name: ${get("name")}`,
    `Restaurant: ${get("restaurant")}`,
    `City: ${get("city")}`,
    get("message") ? `\nAbout our service:\n${get("message")}` : "",
    "",
    "I understand that Tablekind is a prototype and this is not a subscription or live restaurant activation.",
  ];
  const prepared = body
    .filter((line, index, array) => line !== "" || array[index - 1] !== "")
    .join("\n");
  preview.value = prepared;
  emailLink.hidden = !config.contactEmail;
  if (config.contactEmail)
    emailLink.href = `mailto:${encodeURIComponent(config.contactEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(prepared)}`;
  draft.hidden = false;
  feedback.textContent = messages.ready;
  document.querySelector("#draft-title").focus({ preventScroll: true });
  // Let a double click/tap finish before moving controls under the pointer.
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    if (!draft.hidden)
      draft.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
  }, 350);
});
// Invalidate old drafts whenever the source changes: never open an outdated enquiry.
form.addEventListener("input", () => {
  clearTimeout(scrollTimer);
  draft.hidden = true;
  emailLink.removeAttribute("href");
  preview.value = "";
  feedback.textContent = "";
});
copy.addEventListener("click", async () => {
  try {
    if (!navigator.clipboard?.writeText)
      throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(preview.value);
    feedback.textContent = messages.copied;
  } catch {
    preview.focus();
    preview.select();
    feedback.textContent = messages.copyError;
  }
});
emailLink.addEventListener("click", () => {
  feedback.textContent = messages.open;
});
document.querySelector("#clear-draft").addEventListener("click", () => {
  clearTimeout(scrollTimer);
  form.reset();
  draft.hidden = true;
  preview.value = "";
  emailLink.removeAttribute("href");
  feedback.textContent = "";
  document.querySelector("#form-feedback").textContent = messages.clear;
  document.querySelector("#request-name").focus();
});
// The JavaScript composer is enabled only after all handlers are attached.
document.querySelector("#composer-fields").disabled = false;
document.querySelector("#composer-unavailable").hidden = true;
