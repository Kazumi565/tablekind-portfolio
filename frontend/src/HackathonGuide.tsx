import type { Auth } from "./types";
import type { DemoScenario, DemoView } from "./DemoGuide";
import { BookOpen, UsersRound } from "lucide-react";
import "./dinnerPanels.css";

export function HackathonGuide({
  scenario,
  staff,
  onCreate,
  onView,
  blocked,
  currentActorId,
}: {
  scenario: DemoScenario | null;
  staff: Auth | null;
  onCreate: () => void;
  onView: (view: DemoView, tab: string) => void;
  blocked: boolean;
  currentActorId?: string;
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
                A prepared EUR meal for Mihai, Diego and Ana. Describe, review,
                agree, then pay your share.
              </p>
            </div>
          </div>
          {staff ? (
            <button className="primary" disabled={blocked} onClick={onCreate}>
              Start EUR dinner
            </button>
          ) : (
            <p>
              Sign in with the demo manager credentials from your local
              configuration to start.
            </p>
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
              disabled={blocked}
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
                disabled={blocked}
                onClick={() => onView(view, "bill")}
              >
                {view[0].toUpperCase() + view.slice(1)}
              </button>
            ))}
            <button
              aria-pressed={Boolean(
                currentActorId && currentActorId === staff?.actorId,
              )}
              disabled={blocked}
              onClick={() => onView("manager", "bill")}
            >
              Manager
            </button>
          </div>
          <details className="dinner-demo-help">
            <summary aria-label="How to try the full journey">
              <BookOpen size={14} aria-hidden="true" /> Demo guide
            </summary>
            <ol>
              <li>
                As Mihai, describe who pays for each dish and share the starter
                equally.
              </li>
              <li>
                Review the preview and send it for agreement. Switch diners to
                accept or reject.
              </li>
              <li>
                Each diner approves with their PayPal sandbox buyer. TableKind
                verifies capture and updates the remaining balance.
              </li>
            </ol>
          </details>
          <details className="dinner-demo-reset">
            <summary aria-label="Start another dinner">New dinner</summary>
            <p>
              Creates a new table; existing payment attempts keep their recovery
              records.
            </p>
            <button disabled={blocked} onClick={onCreate}>
              Start EUR dinner
            </button>
          </details>
        </>
      )}
    </section>
  );
}
