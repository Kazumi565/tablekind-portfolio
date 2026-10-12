import {
  ClipboardList,
  Menu,
  MoreHorizontal,
  CalendarDays,
  Receipt,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

type Entry = {
  id: string;
  name: string;
  icon: ComponentType<{ size?: number }>;
};
export function WorkspaceNav({
  guest,
  manager,
  tab,
  onTab,
  disabled,
  balance,
  practiceReservations = true,
}: {
  guest: boolean;
  manager: boolean;
  tab: string;
  onTab: (id: string) => void;
  disabled: boolean;
  balance?: string;
  practiceReservations?: boolean;
}) {
  const primary: Entry[] = guest
    ? [
        { id: "menu", name: "Menu", icon: Menu },
        { id: "table", name: "My order", icon: Users },
        { id: "bill", name: "Pay & split", icon: Receipt },
        ...(balance === undefined
          ? [
              {
                id: "practice-reservations",
                name: "Try reservations",
                icon: CalendarDays,
              },
              { id: "account", name: "My account", icon: UserRound },
            ]
          : []),
      ]
    : [
        ...(manager
          ? [{ id: "overview", name: "Overview", icon: ClipboardList }]
          : []),
        { id: "table", name: "Our table", icon: Users },
        { id: "menu", name: "Menu", icon: Menu },
        { id: "bill", name: "Bill & sharing", icon: Receipt },
        ...(manager
          ? [{ id: "setup", name: "Restaurant setup", icon: Settings }]
          : [{ id: "availability", name: "Availability", icon: Menu }]),
      ];
  const extra: Entry[] = guest
    ? balance === undefined
      ? []
      : [
          {
            id: "practice-reservations",
            name: "Try reservations",
            icon: CalendarDays,
          },
          { id: "account", name: "My account", icon: UserRound },
        ]
    : [
        ...(manager
          ? [
              {
                id: "practice-reservations",
                name: "Practice reservations",
                icon: CalendarDays,
              },
              { id: "pos", name: "POS integration", icon: ClipboardList },
              { id: "operations", name: "System status", icon: Settings },
            ]
          : []),
        { id: "security", name: "My account", icon: UserRound },
      ];
  const visible = (entry: Entry) =>
    practiceReservations || entry.id !== "practice-reservations";
  const availablePrimary = primary.filter(visible);
  const availableExtra = extra.filter(visible);
  const button = (entry: Entry) => (
    <button
      key={entry.id}
      className={tab === entry.id ? "active" : ""}
      aria-current={tab === entry.id ? "page" : undefined}
      disabled={disabled}
      onClick={() => onTab(entry.id)}
    >
      <entry.icon size={18} />
      <span>{entry.name}</span>
    </button>
  );
  return (
    <nav
      className={`tabs workspace-nav ${guest ? "guest-nav" : ""}`}
      aria-label="Workspace sections"
    >
      {guest && balance && (
        <div className="nav-share">
          <span>Your unpaid share</span>
          <strong>{balance}</strong>
        </div>
      )}
      <div className="nav-primary">{availablePrimary.map(button)}</div>
      {!!availableExtra.length && (
        <details className="workspace-more" key={tab}>
          <summary
            aria-label={
              guest
                ? "More"
                : (availableExtra.find((e) => e.id === tab)?.name ?? "More")
            }
          >
            <MoreHorizontal size={20} />
            <span>
              {guest
                ? "More"
                : (availableExtra.find((e) => e.id === tab)?.name ?? "More")}
            </span>
          </summary>
          <div className="more-menu">{availableExtra.map(button)}</div>
        </details>
      )}
    </nav>
  );
}
