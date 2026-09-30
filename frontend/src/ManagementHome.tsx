import type { Dashboard } from "./types";

export function ManagementHome({
  dash,
  onSection,
}: {
  dash: Dashboard;
  onSection: (section: string) => void;
}) {
  const total = (
    field: "pending_orders" | "help_requests" | "collection_requests",
  ) => dash.tables.reduce((n, t) => n + t[field], 0);
  return (
    <section className="management-home">
      <div className="section-heading">
        <div>
          <span className="eyebrow">
            {dash.role === "OWNER" ? "Restaurant owner" : "Restaurant manager"}
          </span>
          <h2>Restaurant overview</h2>
          <p>What needs your attention, at a glance.</p>
        </div>
      </div>
      <div className="workspace-metrics">
        <button className="card" onClick={() => onSection("table")}>
          <strong>{dash.tables.filter((t) => t.session_id).length}</strong>
          <span>Open tables</span>
        </button>
        <button className="card" onClick={() => onSection("table")}>
          <strong>{total("pending_orders")}</strong>
          <span>Orders to review</span>
        </button>
        <button className="card" onClick={() => onSection("table")}>
          <strong>{total("help_requests")}</strong>
          <span>Guests need help</span>
        </button>
        <button className="card" onClick={() => onSection("bill")}>
          <strong>{total("collection_requests")}</strong>
          <span>Collection requests</span>
        </button>
      </div>
      <div className="workspace-actions">
        <button
          className="card"
          onClick={() => onSection("practice-reservations")}
        >
          <h3>Practice reservations</h3>
          <p>Review fictional requests without holding a real table.</p>
        </button>
        <button className="card" onClick={() => onSection("setup")}>
          <h3>Get ready for a pilot</h3>
          <p>First table, menu, staff and printed QR codes.</p>
        </button>
        <button className="card" onClick={() => onSection("setup")}>
          <h3>Your restaurant</h3>
          <p>Menu, tables and team.</p>
        </button>
        <button className="card" onClick={() => onSection("operations")}>
          <h3>System status</h3>
          <p>Readiness and service alerts.</p>
        </button>
        <button className="card" onClick={() => onSection("pos")}>
          <h3>TEST POS integration</h3>
          <p>Simulated orders and reconciliation.</p>
        </button>
      </div>
      {dash.role === "OWNER" && (
        <details className="role-note">
          <summary>Owner permissions</summary>
          <p>
            Appoint managers and transfer ownership in Restaurant setup → staff.
          </p>
        </details>
      )}
    </section>
  );
}
