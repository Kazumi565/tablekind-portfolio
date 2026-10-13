import test from "node:test";
import assert from "node:assert/strict";
import { dinnerGuidance } from "../src/hackathonGuidance.ts";

const scenario = {
  restaurantId: "restaurant",
  sessionId: "dinner",
  guests: ["mihai", "diego", "ana"].map((actorId) => ({
    actorId,
    kind: "GUEST",
    accessToken: "fictional-token",
  })),
};
const state = (overrides = {}) => ({
  session: { id: "dinner", status: "OPEN" },
  actor: { id: "mihai", kind: "GUEST" },
  items: [{ status: "ACCEPTED" }],
  proposals: [],
  payments: [],
  bill: {
    remainingBani: 3801,
    guests: [
      { id: "mihai", remaining_bani: 1901, reserved_bani: 0 },
      { id: "diego", remaining_bani: 1000, reserved_bani: 0 },
      { id: "ana", remaining_bani: 900, reserved_bani: 0 },
    ],
  },
  ...overrides,
});
const proposal = {
  status: "PENDING",
  votes: [
    { guest_id: "mihai", accepted: true },
    { guest_id: "diego", accepted: true },
    { guest_id: "ana", accepted: null },
  ],
};

test("a diner with an outstanding vote is guided to review, not pay", () => {
  const guidance = dinnerGuidance(
    scenario,
    state({ actor: { id: "ana" }, proposals: [proposal] }),
    "ana",
  );
  assert.equal(guidance.action.label, "Review agreement");
  assert.equal(guidance.action.view, "ana");
  assert.match(guidance.text, /accept or reject/);
});

test("voting does not present a split as accepted while other votes remain", () => {
  const guidance = dinnerGuidance(
    scenario,
    state({ proposals: [proposal] }),
    "mihai",
  );
  assert.equal(guidance.title, "Waiting for the other diners");
  assert.equal(guidance.action.view, "ana");
  assert.match(guidance.text, /does not cast a vote/);
});

test("an accepted proposal allows payment guidance only after pending votes are gone", () => {
  const accepted = { status: "ACCEPTED", votes: [] };
  const withPending = dinnerGuidance(
    scenario,
    state({ proposals: [accepted, proposal] }),
    "mihai",
  );
  assert.equal(withPending.title, "Waiting for the other diners");
  const agreed = dinnerGuidance(
    scenario,
    state({ proposals: [accepted] }),
    "mihai",
  );
  assert.equal(agreed.title, "Review your share before paying");
  assert.match(agreed.text, /available payment options/);
});

test("pending payment or reserved funds guide a diner to recovery", () => {
  for (const overrides of [
    { payments: [{ payer_id: "mihai", status: "PENDING" }] },
    {
      bill: {
        remainingBani: 3801,
        guests: [{ id: "mihai", reserved_bani: 1901, remaining_bani: 1901 }],
      },
    },
  ]) {
    const guidance = dinnerGuidance(scenario, state(overrides), "mihai");
    assert.equal(guidance.action.label, "Check payment");
    assert.match(guidance.text, /before starting another/);
  }
});

test("one paid diner is distinct from a fully settled table", () => {
  const partlyPaid = state({
    bill: {
      remainingBani: 1900,
      guests: [{ id: "mihai", reserved_bani: 0, remaining_bani: 0 }],
    },
  });
  assert.equal(
    dinnerGuidance(scenario, partlyPaid, "mihai").title,
    "Your current share is settled",
  );
  const fullyPaid = {
    ...partlyPaid,
    bill: { ...partlyPaid.bill, remainingBani: 0 },
  };
  assert.equal(
    dinnerGuidance(scenario, fullyPaid, "mihai").title,
    "Everyone’s share is settled",
  );
});

test("loading, another dinner or a stale actor never supplies payment guidance", () => {
  for (const current of [
    null,
    state({ session: { id: "other-dinner", status: "OPEN" } }),
    state({ actor: { id: "diego" } }),
  ]) {
    assert.equal(
      dinnerGuidance(scenario, current, "mihai").title,
      "Open your dinner",
    );
  }
});

test("a closed dinner stays a review action and an empty dinner goes to menu", () => {
  assert.equal(
    dinnerGuidance(
      scenario,
      state({ session: { id: "dinner", status: "CLOSED" } }),
      "mihai",
    ).action.label,
    "Review this dinner",
  );
  assert.equal(
    dinnerGuidance(scenario, state({ items: [] }), "mihai").action.tab,
    "menu",
  );
});

test("manager guidance offers a guest perspective without inventing a manager share", () => {
  const guidance = dinnerGuidance(
    scenario,
    state({ actor: { id: "manager", kind: "STAFF" } }),
    "manager",
  );
  assert.equal(guidance.action.view, "mihai");
  assert.equal(guidance.action.label, "Open Mihai’s view");
});
