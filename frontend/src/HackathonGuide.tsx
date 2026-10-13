import { useId, useRef, useState } from "react";
import type { Auth, State } from "./types";
import type { DemoScenario, DemoView } from "./DemoGuide";
import { ArrowRight, BookOpen, UsersRound, X } from "lucide-react";
import { dinnerGuidance } from "./hackathonGuidance";
import "./dinnerPanels.css";
import "./hackathonGuide.css";

function DinnerWalkthrough({
  scenario,
  state,
  currentActorId,
  blocked,
  canSwitch,
  onView,
}: {
  scenario: DemoScenario;
  state: State | null;
  currentActorId?: string;
  blocked: boolean;
  canSwitch: boolean;
  onView: (view: DemoView, tab: string) => void;
}) {
  const id = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const storageKey = `dinnerGuideDismissed:${scenario.sessionId}`;
  const [expanded, setExpanded] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) !== "true";
    } catch {
      return true;
    }
  });
  const toggle = (next: boolean) => {
    setExpanded(next);
    try {
      sessionStorage.setItem(storageKey, String(!next));
    } catch {
      // The guide remains usable when this browser does not allow storage.
    }
  };
  const next = dinnerGuidance(scenario, state, currentActorId);
  return (
    <div className="dinner-walkthrough">
      <button
        ref={toggleRef}
        className="dinner-guide-toggle"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => toggle(!expanded)}
      >
        <BookOpen size={14} aria-hidden="true" />
        {expanded ? "Hide guide" : "Show guide"}
      </button>
      {expanded && (
        <div id={id} className="dinner-next-step">
          <div className="dinner-next-heading">
            <span className="eyebrow">Your next step</span>
            <button
              className="icon"
              aria-label="Dismiss dinner guide"
              onClick={() => {
                toggle(false);
                toggleRef.current?.focus();
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <h3>{next.title}</h3>
          <p>{next.text}</p>
          <button
            className="primary"
            disabled={blocked || !canSwitch}
            onClick={() => onView(next.action.view, next.action.tab)}
          >
            {next.action.label} <ArrowRight size={14} aria-hidden="true" />
          </button>
          <details className="dinner-journey-help">
            <summary>How the full journey works</summary>
            <ol>
              <li>
                Browse the menu or use the prepared meal. Each accepted dish has
                a current owner and share.
              </li>
              <li>
                Preview a new split, check the amounts, then send a proposal.
                Everyone affected must agree before their share changes.
              </li>
              <li>
                Pay each diner’s remaining share with a PayPal sandbox buyer.
                TableKind verifies the payment and updates the bill.
              </li>
            </ol>
            <p>
              One browser is enough: switch between Mihai, Diego and Ana to try
              their perspectives. These are fictional EUR payments using sandbox
              funds.
            </p>
          </details>
        </div>
      )}
    </div>
  );
}

export function HackathonGuide({
  scenario,
  staff,
  onCreate,
  onView,
  blocked,
  currentActorId,
  state = null,
  canStart = Boolean(staff),
  checkingAccess = false,
  accessProblem = false,
}: {
  scenario: DemoScenario | null;
  staff: Auth | null;
  onCreate: () => void;
  onView: (view: DemoView, tab: string) => void;
  blocked: boolean;
  currentActorId?: string;
  state?: State | null;
  canStart?: boolean;
  checkingAccess?: boolean;
  accessProblem?: boolean;
}) {
  return (
    <section
      className="card hackathon-guide dinner-demo-toolbar"
      aria-label="Hackathon walkthrough"
    >
      {!scenario ? (
        <>
          <div className="dinner-demo-intro">
            <UsersRound size={21} aria-hidden="true" />
            <div>
              <span className="eyebrow">Sandbox dinner · test money only</span>
              <h2>One meal. A split everyone agrees to.</h2>
              <p>
                Start with a prepared EUR 38.01 meal for Mihai, Diego and Ana.
                One browser is enough to try every perspective: explore the
                menu, review a split, agree, then pay each share.
              </p>
              <p className="dinner-start-note">
                PayPal sandbox uses fictional funds. Use the sandbox buyer
                access provided with your demo invitation.
              </p>
            </div>
          </div>
          {staff && checkingAccess ? (
            <div className="dinner-start-action" role="status">
              <button className="primary" disabled>
                Verifying manager access…
              </button>
              <small>
                Checking whether your staff account can start a dinner.
              </small>
            </div>
          ) : staff && accessProblem ? (
            <p className="dinner-access-note" role="status">
              We couldn’t verify your manager access. Check your connection, or
              sign out and sign in again in the{" "}
              <a href="/manage">manager workspace</a>.
            </p>
          ) : staff && canStart ? (
            <div className="dinner-start-action">
              <button className="primary" disabled={blocked} onClick={onCreate}>
                {blocked ? "Please wait…" : "Start EUR dinner"}
                {!blocked && <ArrowRight size={15} aria-hidden="true" />}
              </button>
              <small>
                Creates a fresh dinner with three diners and an existing bill.
              </small>
            </div>
          ) : staff ? (
            <p className="dinner-access-note">
              A demo manager needs to start this dinner. Your current staff
              account does not have manager access.
            </p>
          ) : (
            <div className="dinner-start-action">
              <a className="button primary" href="/manage">
                Open manager sign-in <ArrowRight size={15} aria-hidden="true" />
              </a>
              <small>
                Sign in with the demo manager access shared with you, then
                choose Start EUR dinner. Ask the demo host if you need access.
              </small>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="dinner-demo-controls">
            <span className="dinner-demo-label">
              <UsersRound size={16} aria-hidden="true" /> Try each perspective
            </span>
            <button
              className="dinner-browse-menu"
              disabled={blocked || !staff}
              onClick={() => onView("mihai", "menu")}
            >
              Browse menu
            </button>
            {(["mihai", "diego", "ana"] as const).map((view, index) => (
              <button
                key={view}
                aria-pressed={Boolean(
                  currentActorId &&
                  currentActorId === scenario.guests[index]?.actorId,
                )}
                className="dinner-demo-diner"
                disabled={blocked || !staff}
                onClick={() => onView(view, "bill")}
              >
                {view[0].toUpperCase() + view.slice(1)}
              </button>
            ))}
            <button
              aria-pressed={Boolean(
                currentActorId && currentActorId === staff?.actorId,
              )}
              disabled={blocked || !staff}
              onClick={() => onView("manager", "bill")}
            >
              Manager
            </button>
          </div>
          <details className="dinner-demo-reset">
            <summary aria-label="Start another dinner">New dinner</summary>
            <p>
              Creates a new table; existing payment attempts keep their recovery
              records.
            </p>
            {staff && checkingAccess ? (
              <p role="status">
                Verifying your manager access before starting a dinner…
              </p>
            ) : staff && accessProblem ? (
              <p role="status">
                We couldn’t verify your manager access. Check your connection,
                or sign out and sign in again in the{" "}
                <a href="/manage">manager workspace</a>.
              </p>
            ) : staff && !canStart ? (
              <p>A demo manager needs to start the next dinner.</p>
            ) : null}
            <button
              disabled={
                blocked ||
                !staff ||
                !canStart ||
                checkingAccess ||
                accessProblem
              }
              onClick={onCreate}
            >
              {checkingAccess
                ? "Verifying manager access…"
                : "Start EUR dinner"}
            </button>
          </details>
          {!staff && (
            <p className="dinner-access-note">
              Sign in again with your demo manager access to switch perspectives
              or start a dinner. <a href="/manage">Open manager sign-in</a>.
            </p>
          )}
          <DinnerWalkthrough
            key={scenario.sessionId}
            scenario={scenario}
            state={state}
            currentActorId={currentActorId}
            blocked={blocked}
            canSwitch={Boolean(staff)}
            onView={onView}
          />
        </>
      )}
    </section>
  );
}
