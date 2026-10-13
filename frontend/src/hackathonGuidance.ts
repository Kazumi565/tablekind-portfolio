import type { DemoScenario, DemoView } from "./DemoGuide";
import type { State } from "./types";

export type DinnerGuidance = {
  title: string;
  text: string;
  action: { label: string; view: DemoView; tab: "menu" | "bill" };
};

const dinerViews = ["mihai", "diego", "ana"] as const;

export function dinnerGuidance(
  scenario: DemoScenario,
  state: State | null,
  currentActorId?: string,
): DinnerGuidance {
  const dinerIndex = scenario.guests.findIndex(
    (guest) => guest.actorId === currentActorId,
  );
  const view: DemoView = dinerViews[dinerIndex] ?? "mihai";
  const openBill = { label: "Open Pay & split", view, tab: "bill" as const };
  if (
    !state ||
    state.session.id !== scenario.sessionId ||
    state.actor.id !== currentActorId
  ) {
    return {
      title: "Open your dinner",
      text: "Choose a diner’s view to see their orders, current share and any agreements waiting for them.",
      action: openBill,
    };
  }
  if (state.session.status === "CLOSED") {
    return {
      title: "This dinner is closed",
      text: "You can still review its orders and payment records. Use New dinner when you want to try the journey again.",
      action: { ...openBill, label: "Review this dinner" },
    };
  }
  if (dinerIndex < 0) {
    return {
      title: "See the dinner through a diner’s eyes",
      text: "Manager view lets you check the table and payment records. Switch to Mihai to review a split and try the guest journey.",
      action: { ...openBill, label: "Open Mihai’s view" },
    };
  }

  const ordered = state.items.some((item) =>
    ["ACCEPTED", "PREPARING", "READY", "SERVED"].includes(item.status),
  );
  if (!ordered) {
    return {
      title: "Choose something for the table",
      text: "Browse the menu, add a dish and submit your order. Accepted dishes appear in the bill, where you can share or transfer them.",
      action: { label: "Browse menu", view, tab: "menu" },
    };
  }
  const pending = state.proposals.filter(
    (proposal) => proposal.status === "PENDING",
  );
  if (
    pending.some((proposal) =>
      proposal.votes.some(
        (vote) => vote.guest_id === currentActorId && vote.accepted === null,
      ),
    )
  ) {
    return {
      title: "A split needs your agreement",
      text: "Review how your share would change, then accept or reject the proposal. The current bill stays in place until everyone affected agrees.",
      action: { ...openBill, label: "Review agreement" },
    };
  }
  if (pending.length > 0) {
    const nextVoter = scenario.guests.findIndex((guest) =>
      pending.some((proposal) =>
        proposal.votes.some(
          (vote) => vote.guest_id === guest.actorId && vote.accepted === null,
        ),
      ),
    );
    const nextView = dinerViews[nextVoter];
    const nextName = nextView
      ? nextView[0].toUpperCase() + nextView.slice(1)
      : null;
    return {
      title: "Waiting for the other diners",
      text: "A split is awaiting agreement. You can switch perspective to review it as another diner; changing views does not cast a vote.",
      action:
        nextView && nextName
          ? { label: `Open ${nextName}’s view`, view: nextView, tab: "bill" }
          : { ...openBill, label: "View agreement status" },
    };
  }
  if (state.bill.remainingBani === 0) {
    return {
      title: "Everyone’s share is settled",
      text: "The table has no unpaid balance. Review the payment records, or start a new dinner to try another split.",
      action: { ...openBill, label: "View payment details" },
    };
  }
  const own = state.bill.guests.find((guest) => guest.id === currentActorId);
  if (
    (own?.reserved_bani ?? 0) > 0 ||
    state.payments.some(
      (payment) =>
        payment.payer_id === currentActorId && payment.status === "PENDING",
    )
  ) {
    return {
      title: "Check your payment status",
      text: "A payment is awaiting confirmation. Review its status before starting another payment for the same share.",
      action: { ...openBill, label: "Check payment" },
    };
  }
  if (own && own.remaining_bani === 0) {
    return {
      title: "Your current share is settled",
      text: "Other diners still have an unpaid balance. Switch perspective to check their shares or review your payment records.",
      action: { ...openBill, label: "View payment details" },
    };
  }
  if (state.proposals.some((proposal) => proposal.status === "ACCEPTED")) {
    return {
      title: "Review your share before paying",
      text: "A sharing proposal has been accepted. Check everyone’s current share and the available payment options, then pay your remaining amount.",
      action: { ...openBill, label: "Review my share" },
    };
  }
  return {
    title: "Review how to split the meal",
    text: "Open Pay & split to check everyone’s current share. Ask the assistant for a preview when it is available, or use Share or transfer on a dish. You can also pay your current share.",
    action: openBill,
  };
}
