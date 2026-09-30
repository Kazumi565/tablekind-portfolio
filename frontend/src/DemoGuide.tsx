import { useEffect, useState } from "react";
import type { Auth, State } from "./types";

export type DemoScenario = {
  restaurantId: string;
  sessionId: string;
  guests: [Auth, Auth];
};
export type DemoView = "mihai" | "diego" | "staff" | "manager";

const steps: { title: string; view: DemoView; tab: string; text: string }[] = [
  {
    title: "Order a pizza",
    view: "mihai",
    tab: "menu",
    text: "You're Mihai. Add one Shared pizza from the menu and submit it. It starts out belonging entirely to you. Leave the lemonade for later if you want to follow the example exactly.",
  },
  {
    title: "Accept the order",
    view: "staff",
    tab: "table",
    text: "Now you're the waiter. Find the submitted pizza and tap Accept order. Only accepted food enters the bill. The accepted order also goes to the test POS.",
  },
  {
    title: "Offer to share",
    view: "mihai",
    tab: "bill",
    text: "On the pizza, tap Share or transfer. Choose Equal and select both Mihai and Diego, then send the proposal. Diego must agree before his share changes.",
  },
  {
    title: "Agree to the split",
    view: "diego",
    tab: "bill",
    text: "You're Diego now. Accept the sharing proposal. The 181.01 MDL pizza becomes two shares of 90.50 and 90.51 MDL. That extra ban is assigned once, so the total stays exact.",
  },
  {
    title: "Try a card payment",
    view: "mihai",
    tab: "bill",
    text: "Choose your share, select Card and review the amount before starting payment. Use the test payment controls to succeed. No bank card details or real money are involved. You can also try failure and retry.",
  },
  {
    title: "Ask to pay cash",
    view: "diego",
    tab: "bill",
    text: "Select Cash for your remaining share and send the request. It stays unpaid until the waiter confirms collecting the money. You cannot confirm your own cash payment.",
  },
  {
    title: "Collect the cash",
    view: "staff",
    tab: "bill",
    text: "Find Diego's cash request and confirm collection. Try entering 100 MDL received and no tip to see the change calculated. The table's remaining balance should reach zero when both payments are settled.",
  },
  {
    title: "Check the POS",
    view: "manager",
    tab: "pos",
    text: "Check delivery and compare the practice table with the TEST POS. Queued work may take a few seconds. Reconcile the table to see whether its accepted bill and payments match. This is a simulator; connecting a real restaurant is a separate step.",
  },
  {
    title: "Explore management",
    view: "manager",
    tab: "setup",
    text: "Open Restaurant setup: the first-table form creates a branch, a basic menu and a printable QR code together. To try Scan table QR, display the printed link on a second device and open /guest on your phone; preview the restaurant and table before joining. Add a waiter or manager from Staff, then open Pilot measurements. Platform administration has its own private sign-in.",
  },
  {
    title: "Save a visit with an account",
    view: "mihai",
    tab: "account",
    text: "Create an optional account using a fictional email, such as mihai@example.test. On the host PC, open localhost:8026 to read the Mailpit code. Verify it, then link this table. No message reaches a real mailbox. Anonymous dining remains available.",
  },
  {
    title: "Try a reservation request",
    view: "mihai",
    tab: "practice-reservations",
    text: "Request a future practice slot with a party size, then switch to Manager → Practice reservations to approve or decline it. This is a simulation: no capacity is held, no email or SMS is sent, and no restaurant accepts a real booking.",
  },
];

export function DemoGuide({
  scenario,
  staff,
  canStart,
  state,
  currentView,
  blocked,
  onCreate,
  onView,
}: {
  scenario: DemoScenario | null;
  staff: Auth | null;
  canStart: boolean;
  state: State | null;
  currentView: DemoView;
  blocked: boolean;
  onCreate: () => void;
  onView: (view: DemoView, tab: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [step, setStep] = useState(() => {
    const saved = Number(sessionStorage.getItem("demoStep") ?? 0);
    return Number.isInteger(saved) && saved >= 0 && saved < steps.length
      ? saved
      : 0;
  });
  useEffect(() => {
    sessionStorage.setItem("demoStep", String(step));
  }, [step]);
  const active = steps[step];
  const sameTable = state?.session.id === scenario?.sessionId;
  return (
    <section className="demo-guide card" aria-label="Practice walkthrough">
      <div className="demo-guide-heading">
        <div>
          <span className="eyebrow">Private demo · test money only</span>
          <h2>One meal. Every perspective.</h2>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls="demo-guide-body"
        >
          {expanded ? "Hide guide" : "Show guide"}
        </button>
      </div>
      {expanded && (
        <div id="demo-guide-body">
          {!scenario ? (
            <>
              <p>
                One phone is enough. Start a practice table, then switch between
                Mihai, Diego, the waiter and management. Order, share and try a
                TEST payment.
              </p>
              <p>
                Payments and the POS are simulated. The rest uses the app's
                actual ordering and bill calculations.
              </p>
              {staff && canStart ? (
                <button
                  className="primary"
                  disabled={blocked}
                  onClick={() => {
                    setStep(0);
                    onCreate();
                  }}
                >
                  Start practice table
                </button>
              ) : staff ? (
                <p>Ask a manager to start a practice table.</p>
              ) : (
                <p>
                  <strong>
                    Use the waiter or management workspace to sign in with your
                    demo staff account.
                  </strong>
                </p>
              )}
            </>
          ) : (
            <>
              <div
                className="demo-personas"
                role="group"
                aria-label="Practice role"
              >
                {(["mihai", "diego", "staff", "manager"] as const).map(
                  (view) => (
                    <button
                      key={view}
                      aria-pressed={currentView === view}
                      className={currentView === view ? "selected" : ""}
                      disabled={blocked || !staff}
                      onClick={() =>
                        onView(view, view === "manager" ? "overview" : "table")
                      }
                    >
                      {view === "staff"
                        ? "Waiter"
                        : view === "manager"
                          ? "Manager"
                          : view === "mihai"
                            ? "Mihai"
                            : "Diego"}
                    </button>
                  ),
                )}
              </div>
              <p className="demo-step-count">
                Step {step + 1} of {steps.length} ·{" "}
                {active.view === "staff" || active.view === "manager"
                  ? active.view === "manager"
                    ? "Manager view"
                    : "Waiter view"
                  : `${active.view === "mihai" ? "Mihai" : "Diego"}'s view`}
              </p>
              <h3>{active.title}</h3>
              <p>{active.text}</p>
              <div className="demo-step-actions">
                <button
                  disabled={blocked || step === 0}
                  onClick={() => setStep(step - 1)}
                >
                  Previous
                </button>
                <button
                  className="primary"
                  disabled={blocked || !staff}
                  onClick={() => onView(active.view, active.tab)}
                >
                  Open this step
                </button>
                <button
                  disabled={blocked || step === steps.length - 1}
                  onClick={() => setStep(step + 1)}
                >
                  Next
                </button>
              </div>
              <small>
                The steps are a guide, not automatic actions. Use the app below,
                then tap Next.
              </small>
              {sameTable && state && (
                <p className="demo-balance">
                  Practice table: {(state.bill.paidBani / 100).toFixed(2)} MDL
                  paid · {(state.bill.remainingBani / 100).toFixed(2)} MDL
                  remaining
                </p>
              )}
              <details>
                <summary>Try more or start again</summary>
                <p>
                  Try ordering a drink, asking for help, taking over an unpaid
                  item with consent, cancelling a pending test payment, or
                  issuing a manager refund. You can explore freely and return to
                  any step.
                </p>
                <p>
                  A fresh practice table keeps the previous one in the demo
                  history. It doesn't erase payments or touch your development
                  database. Refreshing this page keeps your current roles and
                  guide step in this browser tab.
                </p>
                <button
                  disabled={blocked || !staff}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Start a fresh practice table? The current table stays in the demo history.",
                      )
                    ) {
                      setStep(0);
                      onCreate();
                    }
                  }}
                >
                  Start a fresh practice table
                </button>
              </details>
            </>
          )}
        </div>
      )}
    </section>
  );
}
