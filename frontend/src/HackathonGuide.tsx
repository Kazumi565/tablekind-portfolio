import type { Auth } from "./types";
import type { DemoScenario, DemoView } from "./DemoGuide";

export function HackathonGuide({
  scenario,
  staff,
  onCreate,
  onView,
  blocked,
}: {
  scenario: DemoScenario | null;
  staff: Auth | null;
  onCreate: () => void;
  onView: (view: DemoView, tab: string) => void;
  blocked: boolean;
}) {
  return (
    <section
      className="card hackathon-guide"
      aria-label="Hackathon walkthrough"
    >
      <div>
        <span className="eyebrow">Tablekind · PayPal AI Hackathon</span>
        <h2>One meal. A split everyone agrees to.</h2>
        <p>
          Describe your split, review every cent, agree together, then pay your
          own share.
        </p>
      </div>
      {!scenario ? (
        <>
          <p>
            A fictional EUR meal for Mihai, Diego and Ana. The prepared bill
            includes a burger, pasta, salad and a shared starter.
          </p>
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
          <div className="row wrap">
            <button disabled={blocked} onClick={() => onView("mihai", "menu")}>
              Browse menu
            </button>
            {(["mihai", "diego", "ana"] as const).map((view) => (
              <button
                key={view}
                disabled={blocked}
                onClick={() => onView(view, "bill")}
              >
                {view[0].toUpperCase() + view.slice(1)}
              </button>
            ))}
            <button
              disabled={blocked}
              onClick={() => onView("manager", "bill")}
            >
              Manager
            </button>
          </div>
          <details>
            <summary>How to try the full journey</summary>
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
          <details>
            <summary>Start another dinner</summary>
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
