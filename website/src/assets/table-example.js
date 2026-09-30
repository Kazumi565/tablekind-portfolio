// A local presentation example only. No orders, accounts or money are processed.
export function setupTableExample({ reduced, restartAnimation }) {
  const ro = document.documentElement.lang === "ro";
  const menu = {
    pizza: {
      name: "Margherita",
      phrase: "One pizza.",
      short: "pizza",
      bani: 12000,
    },
    vegetables: {
      name: "Grilled vegetables",
      phrase: "Something fresh.",
      short: "vegetables",
      bani: 14400,
    },
    cake: {
      name: "Chocolate cake",
      phrase: "A sweet ending.",
      short: "cake",
      bani: 9600,
    },
  };
  const names = ["You", "Alex", "Sam", "Mara"];
  const words = { 2: "Two", 3: "Three", 4: "Four" };
  const wordsRo = { 2: "Două", 3: "Trei", 4: "Patru" };
  const fractions = { 2: "½", 3: "⅓", 4: "¼" };
  const state = { dish: "pizza", guests: 3, lemonade: true };
  const share = document.querySelector('[data-panel="share"]');
  const guestButtons = [...document.querySelectorAll("[data-guests]")];
  const dishButtons = [...document.querySelectorAll("[data-dish]")];
  const drink = document.querySelector("[data-personal-drink]");
  const status = document.querySelector("[data-example-status]");
  const text = (selector, value) => {
    document.querySelector(selector).textContent = value;
  };
  function update({ announce = true, animate = true } = {}) {
    const dish = menu[state.dish];
    // All three fixed illustration prices divide exactly for 2, 3 and 4 guests.
    const partBani = dish.bani / state.guests;
    const personalBani = state.lemonade ? 3500 : 0;
    const totalBani = partBani + personalBani;
    guestButtons.forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(Number(button.dataset.guests) === state.guests),
      ),
    );
    dishButtons.forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.dish === state.dish),
      ),
    );
    share.dataset.places = String(state.guests);
    share.dataset.selectedDish = state.dish;
    drink.checked = state.lemonade;
    text("[data-share-heading]", ro
      ? `${{pizza:"O pizza.", vegetables:"Ceva proaspăt.", cake:"Un desert dulce."}[state.dish]} ${wordsRo[state.guests]} persoane mulțumite.`
      : `${dish.phrase} ${words[state.guests]} happy people.`);
    text("[data-dish-price]", String(dish.bani / 100));
    text("[data-share-caption]", ro ? `${wordsRo[state.guests]} părți egale.` : `${words[state.guests]} equal shares.`);
    const people = names.slice(0, state.guests).map((name) => {
      const person = document.createElement("span");
      person.append(document.createTextNode(ro && name === "You" ? "Tu" : name));
      const amount = document.createElement("strong");
      amount.textContent = `${partBani / 100} MDL`;
      const consent = document.createElement("small");
      consent.textContent = ro ? "Confirmat ✓" : "Agreed ✓";
      person.append(amount, consent);
      return person;
    });
    document.querySelector("[data-share-people]").replaceChildren(...people);
    text(
      "[data-share-equation]",
      `${dish.bani / 100} MDL ÷ ${state.guests} = ${partBani / 100} MDL ${ro ? "de persoană" : "each"}`,
    );
    text("[data-example-total]", String(totalBani / 100));
    text(
      "[data-example-breakdown]",
      ro ? `${partBani / 100} preparat împărțit${state.lemonade ? " + 35 limonadă" : " · Fără extra individuale"}` : `${partBani / 100} shared food${state.lemonade ? " + 35 lemonade" : " · No personal extras"}`,
    );
    text("[data-receipt-share]", `${fractions[state.guests]} ${ro ? {pizza:"Margherita", vegetables:"Legume la grătar", cake:"Tort de ciocolată"}[state.dish] : dish.name}`);
    text("[data-receipt-amount]", `${partBani / 100} MDL`);
    text("[data-receipt-total]", String(totalBani / 100));
    document.querySelector("[data-receipt-drink]").hidden = !state.lemonade;
    text(
      "[data-bill-insight]",
      ro ? state.lemonade
        ? `${{pizza:"Pizza este împărțită", vegetables:"Legumele sunt împărțite", cake:"Tortul este împărțit"}[state.dish]}. Limonada este a ta.`
        : `Doar partea confirmată din ${ {pizza:"pizza", vegetables:"legume", cake:"tort"}[state.dish]}.`
      : state.lemonade
        ? `The ${dish.short} ${state.dish === "vegetables" ? "are" : "is"} shared. Your lemonade is yours.`
        : `Just your agreed share of the ${dish.short}.`,
    );
    if (announce)
      status.textContent = ro
        ? `${ {pizza:"Margherita", vegetables:"Legume la grătar", cake:"Tort de ciocolată"}[state.dish]}, împărțit între ${state.guests} persoane. ${partBani / 100} MDL de persoană. ${state.lemonade ? "Limonada ta adaugă 35 MDL. " : "Fără băutură individuală. "}Totalul din exemplu este ${totalBani / 100} MDL.`
        : `${dish.name}, shared by ${state.guests}. ${partBani / 100} MDL each. ${state.lemonade ? "Your lemonade adds 35 MDL. " : "No personal drink. "}Your example total is ${totalBani / 100} MDL.`;
    if (animate) restartAnimation(share, "share-changed");
  }
  guestButtons.forEach((button) =>
    button.addEventListener("click", () => {
      const guests = Number(button.dataset.guests);
      if (![2, 3, 4].includes(guests)) return;
      state.guests = guests;
      update();
    }),
  );
  dishButtons.forEach((button) =>
    button.addEventListener("click", () => {
      if (!Object.hasOwn(menu, button.dataset.dish)) return;
      state.dish = button.dataset.dish;
      update();
    }),
  );
  drink.addEventListener("change", () => {
    state.lemonade = drink.checked;
    update();
  });
  function openStep(name) {
    if (!["join", "share", "bill"].includes(name)) return;
    document.querySelector(`[data-step="${name}"]`).click();
    const panel = document.querySelector(`[data-panel="${name}"]`);
    const heading = panel.querySelector("h3");
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    panel.scrollIntoView({
      block: "nearest",
      behavior: reduced.matches ? "instant" : "smooth",
    });
  }
  document
    .querySelectorAll("[data-next]")
    .forEach((button) =>
      button.addEventListener("click", () => openStep(button.dataset.next)),
    );
  document
    .querySelector("[data-reset-example]")
    .addEventListener("click", () => {
      Object.assign(state, { dish: "pizza", guests: 3, lemonade: true });
      update();
      openStep("share");
      status.textContent = ro
        ? "Exemplul a fost resetat. Margherita pentru trei persoane și limonada ta. Partea ta este 75 MDL."
        : "Example reset. Margherita for three, with your own lemonade. Your part is 75 MDL.";
    });
  update({ announce: false, animate: false });
}
