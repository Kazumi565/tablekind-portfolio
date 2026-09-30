import { BranchEditor, ModifiersEditor } from "./AdminEditors";
import { CustomerPanel } from "./CustomerPanel";
import { ManagementHome } from "./ManagementHome";
import { PracticeReservationsPanel } from "./PracticeReservationsPanel";
import { TableQrScanner } from "./TableQrScanner";
import { parseTableCode } from "./tableCode";
import { WorkspaceNav } from "./WorkspaceNav";
import { initialArea, managesRestaurant, type Area } from "./interfaces";
import { PaymentsPanel } from "./PaymentsPanel";
import {
  OnboardingPanel,
  BranchPolicy,
  TableQrPanel,
  AuditPanel,
  PilotPanel,
} from "./OnboardingPanel";
import { SecurityPanel } from "./SecurityPanel";
import { OperationsPanel } from "./OperationsPanel";
import { PosPanel } from "./PosPanel";
import { DemoGuide, type DemoScenario, type DemoView } from "./DemoGuide";
import {
  createContext,
  useContext,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import QRCode from "qrcode";
import {
  ArrowRight,
  Bell,
  Check,
  ChefHat,
  ClipboardList,
  LogOut,
  Menu as MenuIcon,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Settings,
  Users,
  X,
} from "lucide-react";
import { ApiError, bani, live, money, request } from "./api";
import {
  clearPending,
  keepPending,
  readPending,
  sameActor,
  savePending,
  type PendingCommand,
} from "./pendingCommand";
import type {
  Auth,
  Branch,
  Dashboard,
  Guest,
  Item,
  Names,
  Product,
  Quote,
  State,
} from "./types";

const FormErrorContext = createContext("");

type Mutation = (path: string, body?: unknown, method?: string) => Promise<any>;
const stored = <T,>(key: string): T | null => {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
};
const label = (names: Names, lang: string) =>
  names[lang as keyof Names] || names.en;
const data = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  return new FormData(e.currentTarget);
};
const text = (f: FormData, key: string) => String(f.get(key) ?? "").trim();

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const error = useContext(FormErrorContext);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const d = ref.current;
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} aria-label={title}>
      <div className="dialog-head">
        <h2>{title}</h2>
        <button className="icon" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {children}
    </dialog>
  );
}
function Pill({ children }: { children: ReactNode }) {
  return <span className="pill">{children}</span>;
}
function Field({
  label: caption,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <label className="field">
      <span id={id}>{caption}</span>
      {isValidElement(children)
        ? cloneElement(
            children as ReactElement<{ "aria-labelledby"?: string }>,
            { "aria-labelledby": id },
          )
        : children}
    </label>
  );
}

export default function App() {
  const startingArea = initialArea(location.pathname, location.search);
  const [workspace, setWorkspace] = useState<"manage" | "staff">(
    startingArea === "staff" ? "staff" : "manage",
  );
  const [recovery] = useState(() => {
    try {
      return { command: readPending(sessionStorage), error: "" };
    } catch (e) {
      return { command: null, error: (e as Error).message };
    }
  });
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [demoScenario, setDemoScenario] = useState<DemoScenario | null>(
    stored<DemoScenario>("demoScenario"),
  );
  useEffect(() => {
    let active = true;
    void request<{ enabled: boolean }>("/demo/config")
      .then((value) => {
        if (active) setDemoEnabled(value.enabled === true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const incoming =
    new URLSearchParams(location.search).get("join") ??
    new URLSearchParams(location.search).get("table") ??
    "";
  const [joinInfo, setJoinInfo] = useState<any>(null);
  const [previewedInput, setPreviewedInput] = useState("");
  const [previewRevision, setPreviewRevision] = useState(0);
  const [joinProblem, setJoinProblem] = useState("");
  const [needsAttention, setNeedsAttention] = useState(false);
  const [loginMfa, setLoginMfa] = useState(false);
  const [branchFilter, setBranchFilter] = useState("");
  const [mode, setMode] = useState<"staff" | "guest">(
    recovery.command
      ? recovery.command.actorScope?.startsWith("STAFF:")
        ? "staff"
        : "guest"
      : startingArea === "guest"
        ? "guest"
        : location.pathname === "/" && stored<string>("mode") === "guest"
          ? "guest"
          : "staff",
  );
  const [staff, setStaff] = useState<Auth | null>(stored<Auth>("staff"));
  const [guest, setGuest] = useState<Auth | null>(stored<Auth>("guest"));
  const [customer, setCustomer] = useState<Auth | null>(
    stored<Auth>("customer"),
  );
  const [customerName, setCustomerName] = useState("");
  const [rid, setRid] = useState(sessionStorage.getItem("restaurantId") ?? "");
  const [sid, setSid] = useState(
    sessionStorage.getItem("staffSessionId") ?? "",
  );
  const [members, setMembers] = useState<
    { restaurant_id: string; name: string; role: string }[]
  >([]);
  const [dash, setDash] = useState<Dashboard | null>(null),
    [state, setState] = useState<State | null>(null);
  const [tab, setTab] = useState(
      location.pathname === "/guest/account"
        ? "account"
        : mode === "staff" && workspace === "manage"
          ? "overview"
          : "table",
    ),
    [lang, setLang] = useState("en");
  const [error, setError] = useState(""),
    [commandBusy, setBusy] = useState(false),
    [connected, setConnected] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const busy = commandBusy || accountBusy;
  const [notice, setNotice] = useState(""),
    [joinToken, setJoinToken] = useState(incoming),
    [qr, setQr] = useState("");
  const [pending, setPending] = useState<PendingCommand | null>(
    recovery.command,
  );
  const pendingRef = useRef(pending);
  const inFlight = useRef(false);
  const joinFormRef = useRef<HTMLFormElement>(null);
  const [retryPassword, setRetryPassword] = useState("");
  const reloadId = useRef(0);
  const auth = mode === "staff" ? staff : guest;
  const canManage = managesRestaurant(dash?.role);
  const manager = mode === "staff" && workspace === "manage" && canManage;
  const operationalState =
    state && mode === "staff" && workspace === "staff"
      ? { ...state, actor: { ...state.actor, role: "WAITER" } }
      : state;
  const continueToJoin = () => {
    const form = joinFormRef.current;
    if (!form) return;
    form.querySelector<HTMLInputElement>('input[name="nickname"]')?.focus({
      preventScroll: true,
    });
    form.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
  };
  const changeArea = (area: Area) => {
    if (pendingRef.current || recovery.error || inFlight.current) {
      setError("Resolve the saved request before changing workspace.");
      return;
    }
    setMode(area === "guest" ? "guest" : "staff");
    if (area !== "guest") setWorkspace(area);
    setTab(area === "manage" ? "overview" : "table");
    history.replaceState({}, "", `/${area}`);
  };
  const updateCustomer = (a: Auth | null) => {
    if (a) sessionStorage.setItem("customer", JSON.stringify(a));
    else {
      sessionStorage.removeItem("customer");
      setCustomerName("");
    }
    setCustomer(a);
  };
  const clearGuest = () => {
    sessionStorage.removeItem("guest");
    setGuest(null);
    setState(null);
  };
  useEffect(() => {
    let active = true;
    setJoinInfo(null);
    setPreviewedInput("");
    setJoinProblem("");
    let token = "";
    try {
      if (joinToken.trim()) token = parseTableCode(joinToken, location.origin);
    } catch {
      setJoinProblem("Use a table link for this Tablekind address, or scan the QR again.");
      return;
    }
    if (token)
      void request<any>(
        token.includes(".")
          ? `/table-links/${encodeURIComponent(token)}`
          : `/join/${encodeURIComponent(token)}`,
      )
        .then((r) => {
          if (active) {
            setJoinInfo(r);
            setPreviewedInput(joinToken);
            setLang(r.table.default_language ?? "en");
          }
        })
        .catch((e) => {
          if (active) setJoinProblem(e.message);
        });
    return () => {
      active = false;
    };
  }, [joinToken, previewRevision]);
  useEffect(() => {
    if (state?.table.languages && !state.table.languages.includes(lang))
      setLang(state.table.default_language);
  }, [state?.table.languages, lang]);
  const activeSid = mode === "staff" ? sid : (guest?.sessionId ?? "");
  useEffect(() => {
    sessionStorage.setItem("mode", JSON.stringify(mode));
  }, [mode]);
  useEffect(() => {
    sessionStorage.setItem("restaurantId", rid);
  }, [rid]);
  useEffect(() => {
    sessionStorage.setItem("staffSessionId", sid);
  }, [sid]);
  const reload = useCallback(async () => {
    if (!auth) return;
    const n = ++reloadId.current;
    try {
      if (mode === "staff") {
        const me = await request<{ memberships: typeof members }>(
          "/auth/me",
          auth.accessToken,
        );
        if (n !== reloadId.current) return;
        setMembers(me.memberships);
        const chosen = me.memberships.some((m) => m.restaurant_id === rid)
          ? rid
          : me.memberships[0]?.restaurant_id || "";
        if (chosen !== rid) setRid(chosen);
        if (chosen) {
          const d = await request<Dashboard>(
            `/restaurants/${chosen}`,
            auth.accessToken,
          );
          if (n !== reloadId.current) return;
          setDash(d);
        }
      }
      if (activeSid) {
        const s = await request<State>(
          `/sessions/${activeSid}`,
          auth.accessToken,
        );
        if (n !== reloadId.current) return;
        setState(s);
      } else if (n === reloadId.current) setState(null);
    } catch (e) {
      if (n === reloadId.current) setError((e as Error).message);
    }
  }, [auth, mode, rid, activeSid]);
  useEffect(() => {
    setState(null);
    setDash(null);
    void reload();
    return () => {
      reloadId.current++;
    };
  }, [reload]);
  useEffect(() => {
    if (!auth) return;
    const path =
      mode === "staff" && rid
        ? `/restaurants/${rid}/events`
        : activeSid
          ? `/sessions/${activeSid}/events`
          : "";
    if (!path) return;
    const controller = new AbortController();
    void live(
      path,
      auth.accessToken,
      () => void reload(),
      setConnected,
      controller.signal,
    );
    // Refresh time-based reservation expiry even when there is no new event.
    const interval = setInterval(() => void reload(), 15000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [auth, mode, rid, activeSid, reload]);
  const perform = async (op: PendingCommand) => {
    if (inFlight.current || recovery.error) return null;
    const actor =
      op.actorScope === null
        ? null
        : ([staff, guest].find((candidate) => sameActor(op, candidate)) ??
          null);
    if (!sameActor(op, actor)) {
      setError(
        "Sign in with the account that sent this request before retrying it. Ask staff for help if guest access has expired.",
      );
      return null;
    }
    if (op.needsPassword && !retryPassword) {
      setError(
        "Re-enter the same initial staff password to retry this request.",
      );
      return null;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    let dispatched = false;
    try {
      const saved = savePending(sessionStorage, op);
      pendingRef.current = saved;
      setPending(saved);
      dispatched = true;
      const result = await request<any>(
        op.path,
        actor?.accessToken,
        op.method,
        op.needsPassword ? { ...op.body, password: retryPassword } : op.body,
        op.key,
      );
      if (op.path === "/join" || op.path === "/table-links/join") {
        // Store recovered guest access before forgetting the join command.
        sessionStorage.setItem("guest", JSON.stringify(result));
        setGuest(result);
        history.replaceState({}, "", location.pathname);
        setTab("menu");
      }
      clearPending(sessionStorage);
      pendingRef.current = null;
      setPending(null);
      setRetryPassword("");
      await reload();
      setNotice("Saved.");
      return result;
    } catch (e) {
      setError((e as Error).message);
      if (dispatched && !keepPending(e instanceof ApiError ? e : {}, op)) {
        try {
          clearPending(sessionStorage);
          pendingRef.current = null;
          setPending(null);
          await reload();
        } catch {
          setError(
            "The response was received, but this tab could not clear its saved request. Keep this tab open and retry recovery.",
          );
        }
      }
      if (
        e instanceof ApiError &&
        e.status === 401 &&
        actor?.kind === "STAFF"
      ) {
        sessionStorage.removeItem("staff");
        setStaff(null);
        setMode("staff");
      }
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const mutate: Mutation = (path, body = {}, method = "POST") => {
    if (pendingRef.current || recovery.error || accountBusy) {
      setError(
        "Resolve the uncertain request using Retry before making another change.",
      );
      return Promise.resolve(null);
    }
    const anonymous = path === "/join" || path === "/table-links/join";
    return perform({
      path,
      body: body as Record<string, unknown>,
      method,
      key: crypto.randomUUID(),
      actorScope: anonymous
        ? null
        : auth
          ? `${auth.kind}:${auth.actorId}`
          : null,
    });
  };
  const action: Mutation = (path, body = {}, method = "POST") =>
    method === "GET"
      ? request(`/sessions/${activeSid}${path}`, auth?.accessToken)
      : mutate(
          `/sessions/${activeSid}${path}`,
          {
            revision: state?.session.revision,
            ...(body as Record<string, unknown>),
          },
          method,
        );
  const signIn = async (e: FormEvent<HTMLFormElement>) => {
    const f = data(e);
    setBusy(true);
    setError("");
    try {
      const a = await request<Auth>("/auth/login", undefined, "POST", {
        email: text(f, "email"),
        password: text(f, "password"),
        code: text(f, "code") || null,
      });
      if (pendingRef.current?.actorScope && !sameActor(pendingRef.current, a)) {
        throw new Error(
          "Use the account that sent the unresolved request to finish recovery.",
        );
      }
      sessionStorage.setItem("staff", JSON.stringify(a));
      setStaff(a);
      const me = await request<{
        memberships: { restaurant_id: string; role: string }[];
      }>("/auth/me", a.accessToken);
      const membership =
        me.memberships.find((m) => m.restaurant_id === rid) ??
        me.memberships[0];
      if (
        !pendingRef.current &&
        membership &&
        !managesRestaurant(membership.role)
      )
        changeArea("staff");
    } catch (e) {
      setError((e as Error).message);
      if (
        e instanceof ApiError &&
        (e.code === "MFA_REQUIRED" || e.code === "MFA_INVALID")
      )
        setLoginMfa(true);
    } finally {
      setBusy(false);
    }
  };
  const join = async (e: FormEvent<HTMLFormElement>) => {
    const f = data(e);
    let token: string;
    try {
      token = parseTableCode(joinToken, location.origin);
    } catch (error) {
      setJoinProblem((error as Error).message);
      return;
    }
    if (!joinInfo || previewedInput !== joinToken) {
      setJoinProblem("Wait for the restaurant and table preview before joining.");
      return;
    }
    const a = await mutate(
      token.includes(".") ? "/table-links/join" : "/join",
      {
        token,
        nickname: text(f, "nickname"),
        ...(token.includes(".") ? { sessionId: joinInfo?.sessionId } : {}),
      },
    );
    if (a) {
      setNotice(`Joined ${joinInfo.table.label} at ${joinInfo.table.restaurant_name}.`);
      sessionStorage.setItem("guest", JSON.stringify(a));
      setGuest(a);
      setJoinToken("");
      history.replaceState({}, "", location.pathname);
      setTab("menu");
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    }
  };
  const signOut = () => {
    if (
      pendingRef.current ||
      recovery.error ||
      inFlight.current ||
      accountBusy
    ) {
      setError("Resolve the saved request before signing out of this tab.");
      return;
    }
    if (demoEnabled) {
      for (const key of [
        "staff",
        "guest",
        "demoScenario",
        "demoStep",
        "demoStartKey",
        "restaurantId",
        "staffSessionId",
      ])
        sessionStorage.removeItem(key);
      setStaff(null);
      setGuest(null);
      setDemoScenario(null);
      updateCustomer(null);
      setRid("");
      setSid("");
      setMode("staff");
      setState(null);
      setPending(null);
      return;
    }
    sessionStorage.removeItem(mode);
    if (mode === "staff") setStaff(null);
    else {
      setGuest(null);
      updateCustomer(null);
    }
    setState(null);
    setPending(null);
  };
  const open = async (tid: string) => {
    const r = await mutate(`/restaurants/${rid}/tables/${tid}/sessions`);
    if (r) {
      setSid(r.sessionId);
      setQr(r.joinToken);
      setTab("table");
    }
  };
  const showQr = async () => {
    const r = await action("/qr");
    if (r) setQr(r.joinToken);
  };
  const demoView = (
    view: DemoView,
    targetTab: string,
    scenario = demoScenario,
  ) => {
    if (!demoEnabled || !staff || !scenario || busy || pending) return;
    setError("");
    setNotice("");
    setRid(scenario.restaurantId);
    setSid(scenario.sessionId);
    if (view === "staff" || view === "manager") {
      setMode("staff");
      setWorkspace(view === "manager" ? "manage" : "staff");
    } else {
      const selected = scenario.guests[view === "mihai" ? 0 : 1];
      sessionStorage.setItem("guest", JSON.stringify(selected));
      setGuest(selected);
      setMode("guest");
    }
    setTab(targetTab);
  };
  const createDemo = async () => {
    if (!staff || busy || pending || !demoEnabled) return;
    setBusy(true);
    setError("");
    // Keep the key across refresh/network loss so Retry cannot create a second practice table.
    const key = sessionStorage.getItem("demoStartKey") ?? crypto.randomUUID();
    sessionStorage.setItem("demoStartKey", key);
    try {
      const scenario = await request<DemoScenario>(
        "/demo/scenarios",
        staff.accessToken,
        "POST",
        {},
        key,
      );
      sessionStorage.setItem("demoScenario", JSON.stringify(scenario));
      sessionStorage.removeItem("demoStartKey");
      setDemoScenario(scenario);
      demoView("mihai", "menu", scenario);
    } catch (e) {
      if (e instanceof ApiError && e.status < 500)
        sessionStorage.removeItem("demoStartKey");
      setError(
        `${(e as Error).message} Use Start practice table again to retry.`,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <FormErrorContext.Provider value={error}>
      <>
        <header>
          <a className="brand" href="/" aria-label="Tablekind home">
            <span className="mark">t</span>tablekind
            <span className="local-label">
              {demoEnabled ? "demo" : "local"}
            </span>
          </a>
          {!(mode === "guest" && (guest || incoming) && !demoEnabled) && (
            <label className="workspace-switcher">
              <span className="sr-only">Workspace</span>
              <select
                aria-label="Workspace"
                value={mode === "guest" ? "guest" : workspace}
                disabled={busy || !!pending}
                onChange={(e) => changeArea(e.target.value as Area)}
              >
                {(!staff || canManage) && (
                  <option value="manage">Management</option>
                )}
                <option value="staff">Waiter</option>
                <option value="guest">Guest</option>
              </select>
            </label>
          )}
          <div className="header-right">
            {mode === "guest" && (
              <button
                className="account-shortcut"
                disabled={busy}
                onClick={() => setTab("account")}
              >
                Account
              </button>
            )}
            <select
              aria-label="Menu language"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            >
              {(mode === "guest"
                ? (state?.table.languages ??
                  joinInfo?.table.languages ?? ["en", "ro", "ru"])
                : ["en", "ro", "ru"]
              ).map((l: string) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
            {auth && (
              <button
                className="icon"
                title="Sign out on this tab"
                aria-label="Sign out on this tab"
                disabled={busy || !!pending}
                onClick={signOut}
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </header>
        <div className="phase-note">
          {demoEnabled
            ? "Private demo · TEST payments only · No real charges"
            : "Local preview · TEST payments only · No real charges"}
        </div>
        <main
          aria-busy={busy}
          className={`workspace-${mode === "guest" ? "guest" : workspace}`}
        >
          {notice && (
            <div className="notice" role="status" aria-live="polite">
              <Check size={16} />
              {notice}
            </div>
          )}
          {mode === "guest" &&
            joinToken &&
            guest &&
            joinInfo &&
            guest.sessionId !== joinInfo.sessionId && (
              <div className="notice">
                <p>
                  You scanned {joinInfo.table.restaurant_name} ·{" "}
                  {joinInfo.table.label}, but this tab is joined to another
                  table. Switching tabs does not pay or remove any outstanding
                  share.
                </p>
                <button
                  disabled={busy || !!pending || !!recovery.error}
                  onClick={() => {
                    sessionStorage.removeItem("guest");
                    setGuest(null);
                    setState(null);
                  }}
                >
                  Join scanned table
                </button>
                <button
                  onClick={() => {
                    setJoinToken("");
                    history.replaceState({}, "", location.pathname);
                  }}
                >
                  Stay at my current table
                </button>
              </div>
            )}
          {mode === "guest" && (
            <TableQrScanner
              disabled={busy || !!pending || !!recovery.error}
              onContinue={continueToJoin}
              preview={
                joinInfo && previewedInput === joinToken
                  ? {
                      restaurant: joinInfo.table.restaurant_name,
                      branch: joinInfo.table.branch_name,
                      table: joinInfo.table.label,
                    }
                  : null
              }
              onCode={(token) => {
                setJoinInfo(null);
                setPreviewedInput("");
                setJoinToken(token);
                setPreviewRevision((value) => value + 1);
                setTab("table");
                history.replaceState({}, "", "/guest");
              }}
            />
          )}
          {demoEnabled && (
            <DemoGuide
              scenario={demoScenario}
              staff={staff}
              canStart={members.some((m) => managesRestaurant(m.role))}
              state={state}
              currentView={
                mode === "staff"
                  ? workspace === "manage"
                    ? "manager"
                    : "staff"
                  : guest?.actorId === demoScenario?.guests[1].actorId
                    ? "diego"
                    : "mihai"
              }
              blocked={busy || !!pending}
              onCreate={() => void createDemo()}
              onView={demoView}
            />
          )}
          {(error || pending || recovery.error) && (
            <div className="alert" role="alert">
              {recovery.error ||
                error ||
                "An earlier request needs confirmation. Retry it before making another change."}
              {pending && (
                <>
                  {pending.needsPassword && (
                    <label className="field">
                      Initial staff password used for this request
                      <input
                        type="password"
                        autoComplete="off"
                        value={retryPassword}
                        onChange={(e) => setRetryPassword(e.target.value)}
                      />
                    </label>
                  )}
                  <button
                    onClick={() => void perform(pending)}
                    disabled={busy || !!recovery.error}
                  >
                    Retry the same request
                  </button>
                </>
              )}
              <button
                className="icon"
                aria-label="Dismiss message"
                onClick={() => setError("")}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {mode === "guest" && tab === "account" ? (
            <div className="account-page-heading">
              <button
                className="text-button"
                disabled={busy}
                onClick={() => setTab(guest ? "menu" : "table")}
              >
                <ArrowRight className="back-arrow" size={16} />
                Back to {guest ? "your table" : "joining a table"}
              </button>
            </div>
          ) : !auth ? (
            <section className="welcome">
              <div>
                <span className="eyebrow">
                  {mode === "guest"
                    ? "Your table, together"
                    : workspace === "manage"
                      ? "Restaurant management"
                      : "Waiter workspace"}
                </span>
                <h1>
                  A good meal.
                  <br />A clear bill.
                </h1>
                <p>
                  {mode === "guest"
                    ? "Choose what you love. Share if you like. Pay your part."
                    : "A calmer service starts here. Sign in to your restaurant workspace."}
                </p>
                <div className="feature-line">
                  <Users />{" "}
                  {mode === "guest"
                    ? "Together at one table"
                    : "Individual accounts for your team"}
                </div>
                <div className="feature-line">
                  <Receipt />{" "}
                  {mode === "guest"
                    ? "Your share, always clear"
                    : "Orders and bills in one place"}
                </div>
                {mode === "staff" && (
                  <button type="button" className="text-button" onClick={() => changeArea("guest")}>
                    Dining here? Scan a table QR without signing in
                  </button>
                )}
              </div>
              <form
                ref={joinFormRef}
                className="card login"
                onSubmit={mode === "staff" ? signIn : join}
              >
                <h2>
                  {mode === "staff"
                    ? workspace === "manage"
                      ? "Manager sign in"
                      : "Waiter sign in"
                    : "Join your table"}
                </h2>
                {mode === "staff" ? (
                  <>
                    <Field label="Email">
                      <input
                        type="email"
                        name="email"
                        defaultValue={
                          demoEnabled
                            ? "demo@tablekind.local"
                            : "manager@tablekind.test"
                        }
                        required
                        autoComplete="username"
                      />
                    </Field>
                    <Field label="Password">
                      <input
                        type="password"
                        name="password"
                        required
                        autoComplete="current-password"
                      />
                    </Field>
                    <details open={loginMfa || undefined}>
                      <summary>Using two-step sign-in?</summary>
                      <Field label="Authenticator or recovery code">
                        <input
                          name="code"
                          autoComplete="one-time-code"
                          maxLength={64}
                        />
                      </Field>
                    </details>
                    <small>
                      {demoEnabled
                        ? "Use the credentials shared by the demo owner."
                        : "The local setup guide contains the review account credentials."}
                    </small>
                  </>
                ) : (
                  <>
                    {joinInfo && (
                      <p className="join-confirmation">
                        {joinInfo.table.restaurant_name} ·{" "}
                        {joinInfo.table.branch_name}
                        <br />
                        <strong>{joinInfo.table.label}</strong>
                      </p>
                    )}
                    {joinProblem && <p role="alert">{joinProblem}</p>}
                    {!joinInfo && !joinProblem && joinToken && <p role="status">Checking table link…</p>}
                    <Field label="Your nickname">
                      <input
                        name="nickname"
                        key={customerName}
                        defaultValue={customerName}
                        maxLength={40}
                        required
                        autoComplete="off"
                      />
                    </Field>
                    <small>
                      No account needed. Your nickname helps your waiter find
                      you.
                    </small>
                  </>
                )}
                <button
                  className="primary"
                  disabled={busy || (mode === "guest" && (!joinInfo || previewedInput !== joinToken))}
                >
                  {mode === "staff" ? "Sign in" : "Join table"}
                  <ArrowRight size={18} />
                </button>
              </form>
            </section>
          ) : mode === "staff" &&
            workspace === "manage" &&
            dash &&
            !canManage ? (
            <section className="card">
              <h1>Waiter access</h1>
              <p>
                Your account has waiter access at this restaurant. Management
                settings require an owner or manager.
              </p>
              <button onClick={() => changeArea("staff")}>
                Open waiter workspace
              </button>
            </section>
          ) : (
            <>
              <div className="page-title">
                <div>
                  <span className="eyebrow">
                    {mode === "staff"
                      ? workspace === "manage"
                        ? "Restaurant management"
                        : "Waiter workspace"
                      : "Welcome to the table"}
                  </span>
                  <h1>
                    {mode === "staff"
                      ? (dash?.restaurant.name ?? "Your restaurants")
                      : (state?.table.restaurant_name ?? "Your table")}
                  </h1>
                  <p>
                    {mode === "staff"
                      ? workspace === "manage"
                        ? "A clear view of your restaurant."
                        : "Everything you need for this service."
                      : `${state?.table.label ?? ""} · ${state?.table.branch_name ?? ""}`}
                  </p>
                </div>
                <div className="row">
                  <span className={`connection ${connected ? "online" : ""}`}>
                    {connected ? "Live updates" : "Reconnecting"}
                  </span>
                  <button
                    className="icon"
                    aria-label="Refresh"
                    onClick={() => void reload()}
                  >
                    <RefreshCw size={18} />
                  </button>
                  {mode === "staff" && members.length > 0 && (
                    <select
                      aria-label="Restaurant"
                      value={rid}
                      onChange={(e) => {
                        setRid(e.target.value);
                        setSid("");
                      }}
                    >
                      {members.map((m) => (
                        <option key={m.restaurant_id} value={m.restaurant_id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              {mode === "staff" &&
                dash &&
                ["table", "menu", "bill"].includes(tab) && (
                  <>
                    <div className="row wrap table-filters">
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={needsAttention}
                          onChange={(e) => setNeedsAttention(e.target.checked)}
                        />
                        Needs attention
                      </label>
                      <label>
                        Branch{" "}
                        <select
                          aria-label="Filter branch"
                          value={branchFilter}
                          onChange={(e) => setBranchFilter(e.target.value)}
                        >
                          <option value="">All branches</option>
                          {dash.branches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="table-strip">
                      {dash.tables
                        .filter(
                          (t) =>
                            (!branchFilter || t.branch_id === branchFilter) &&
                            (!needsAttention ||
                              t.collection_requests > 0 ||
                              t.pending_orders > 0 ||
                              t.help_requests > 0),
                        )
                        .map((t) => (
                          <button
                            key={t.id}
                            disabled={busy || !t.pilot_enabled}
                            className={`table-button ${sid === t.session_id ? "active" : ""}`}
                            onClick={() => {
                              if (t.session_id) {
                                setSid(t.session_id);
                                setTab("table");
                              } else void open(t.id);
                            }}
                          >
                            <span>{t.label}</span>
                            {t.pending_orders > 0 && (
                              <small>{t.pending_orders} new order(s)</small>
                            )}
                            {t.help_requests > 0 && (
                              <small>{t.help_requests} help request(s)</small>
                            )}
                            <small>
                              {t.session_id
                                ? `${t.guest_count} guests`
                                : "Open table"}
                            </small>
                            {t.session_id && (
                              <small>{money(t.remaining_bani)} unpaid</small>
                            )}
                            {t.collection_requests > 0 && (
                              <small>
                                {t.collection_requests} collection request
                                {t.collection_requests === 1 ? "" : "s"}
                              </small>
                            )}
                          </button>
                        ))}
                    </div>
                  </>
                )}
              {manager &&
                dash &&
                ["table", "bill"].includes(tab) &&
                dash.recentSessions.length > 0 && (
                  <details>
                    <summary>Closed tables</summary>
                    <Field label="Review a recently closed table">
                      <select
                        value={
                          dash.recentSessions.some((s) => s.id === sid)
                            ? sid
                            : ""
                        }
                        onChange={(e) => {
                          if (e.target.value) {
                            setSid(e.target.value);
                            setTab("bill");
                          }
                        }}
                      >
                        <option value="">Select a closed session</option>
                        {dash.recentSessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label} · {new Date(s.closed_at).toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </details>
                )}
              <WorkspaceNav
                guest={mode === "guest"}
                manager={manager}
                tab={tab}
                onTab={setTab}
                disabled={busy}
              />
              {tab === "overview" && manager && dash ? (
                <ManagementHome dash={dash} onSection={setTab} />
              ) : tab === "security" && mode === "staff" && staff ? (
                <SecurityPanel token={staff.accessToken} onSignOut={signOut} />
              ) : tab === "operations" && manager && rid && staff ? (
                <OperationsPanel
                  key={rid}
                  rid={rid}
                  token={staff.accessToken}
                />
              ) : tab === "availability" && mode === "staff" ? (
                <Setup
                  dash={dash ? { ...dash, role: "WAITER" } : null}
                  mutate={mutate}
                  rid={rid}
                  onRestaurant={setRid}
                  token={staff!.accessToken}
                  onSection={setTab}
                />
              ) : tab === "pos" && manager && dash && staff ? (
                <PosPanel
                  key={rid}
                  dash={dash}
                  token={staff.accessToken}
                  mutate={mutate}
                  busy={busy}
                />
              ) : tab === "setup" && manager ? (
                <Setup
                  dash={dash}
                  mutate={mutate}
                  rid={rid}
                  onRestaurant={setRid}
                  token={staff!.accessToken}
                  onSection={setTab}
                />
              ) : tab === "practice-reservations" && manager && rid && staff ? (
                <PracticeReservationsPanel
                  key={rid}
                  rid={rid}
                  token={staff.accessToken}
                  mutate={mutate}
                />
              ) : tab === "practice-reservations" &&
                mode === "guest" &&
                guest?.sessionId ? (
                <PracticeReservationsPanel
                  key={guest.sessionId}
                  sid={guest.sessionId}
                  token={guest.accessToken}
                  mutate={mutate}
                />
              ) : state ? (
                <>
                  <div className="session-bar">
                    <div className="row">
                      <Pill>{state.table.label}</Pill>
                      <span>
                        {state.guests.filter((g) => g.active).length} guests
                      </span>
                      {state.session.status === "CLOSED" && <Pill>Closed</Pill>}
                    </div>
                    <div className="row">
                      {mode === "staff" ? (
                        <>
                          <button
                            disabled={busy || state.session.status === "CLOSED"}
                            onClick={() => void showQr()}
                          >
                            <QrCode size={16} />
                            New QR link
                          </button>
                          <button
                            disabled={busy || state.session.status === "CLOSED"}
                            onClick={() => void action("/close")}
                          >
                            Close session
                          </button>
                        </>
                      ) : (
                        <Help action={action} />
                      )}
                    </div>
                  </div>
                  {mode === "staff" &&
                    state.pos &&
                    (state.pos.failed > 0 ||
                      state.pos.pending > 0 ||
                      state.pos.paused) && (
                      <p className="notice">
                        TEST POS: {state.pos.paused ? "paused · " : ""}
                        {state.pos.pending > 0
                          ? `${state.pos.pending} update(s) awaiting confirmation`
                          : "current bill acknowledged"}
                        {state.pos.failed > 0
                          ? ` · ${state.pos.failed} need manager review`
                          : ""}
                        . Check POS integration before manually re-entering an
                        uncertain order. No real kitchen is connected.
                      </p>
                    )}
                  {tab === "menu" &&
                    (state.actor.kind === "GUEST" &&
                    state.table.operating_mode === "PAY_AT_TABLE" ? (
                      <div className="card">
                        <h2>Order with your waiter</h2>
                        <p>
                          You can use this table to see your food, split shared
                          items and pay your share.
                        </p>
                        <button onClick={() => setTab("bill")}>
                          Pay & split
                        </button>
                      </div>
                    ) : (
                      <MenuView
                        state={state}
                        lang={lang}
                        action={action}
                        busy={busy}
                      />
                    ))}
                  {tab === "table" && (
                    <TableView
                      key={activeSid + mode}
                      state={operationalState!}
                      lang={lang}
                      action={action}
                      setTab={setTab}
                      busy={busy}
                    />
                  )}
                  {tab === "bill" && (
                    <BillView
                      key={activeSid + mode}
                      state={operationalState!}
                      lang={lang}
                      action={action}
                      busy={busy}
                    />
                  )}
                </>
              ) : (
                <div className="empty card">
                  <ChefHat size={40} />
                  <h2>
                    {mode === "staff"
                      ? "Open a table to start"
                      : "Loading your table"}
                  </h2>
                  <p>
                    {mode === "staff"
                      ? manager
                        ? "Choose a table above, or add tables in Restaurant setup."
                        : "Choose one of the tables above to begin service."
                      : "Loading your saved table."}
                  </p>
                </div>
              )}
            </>
          )}
          {mode === "guest" && tab === "account" && (
            <CustomerPanel
              customer={customer}
              guest={guest}
              blocked={busy || !!pending || !!recovery.error}
              recoveryGuestId={
                !busy &&
                !recovery.error &&
                pending?.actorScope?.startsWith("GUEST:")
                  ? pending.actorScope.slice(6)
                  : undefined
              }
              onAuth={updateCustomer}
              onClearGuest={clearGuest}
              onBusy={setAccountBusy}
              onPreferences={(name, language) => {
                setCustomerName(name);
                if (!state || state.table.languages.includes(language))
                  setLang(language);
              }}
              onResume={(a) => {
                if (
                  recovery.error ||
                  inFlight.current ||
                  (pendingRef.current && !sameActor(pendingRef.current, a))
                )
                  return;
                sessionStorage.setItem("guest", JSON.stringify(a));
                setGuest(a);
                setTab("table");
                setJoinToken("");
                history.replaceState({}, "", "/guest");
              }}
            />
          )}
        </main>
        <footer>
          {demoEnabled
            ? "Tablekind · Practice only · No real charges"
            : "Tablekind · Test environment · No real charges"}
        </footer>
        {qr && <QrModal token={qr} onClose={() => setQr("")} />}
        <div className="sr-only" aria-live="polite">
          {busy ? "Saving change" : ""}
        </div>
      </>
    </FormErrorContext.Provider>
  );
}

function QrModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [image, setImage] = useState("");
  const url = `${location.origin}/?join=${encodeURIComponent(token)}`;
  useEffect(() => {
    void QRCode.toDataURL(url, { width: 300, margin: 2 }).then(setImage);
  }, [url]);
  return (
    <Modal title="Join this table" onClose={onClose}>
      <div className="qr">
        {image && (
          <img
            src={image}
            width={250}
            height={250}
            alt="QR code for this table"
          />
        )}
        <p>
          A new QR link replaces the previous one. Existing guests stay signed
          in.
        </p>
        <a
          className="button primary"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open guest tab
          <ArrowRight size={16} />
        </a>
        <Field label="Join link">
          <input value={url} readOnly onFocus={(e) => e.target.select()} />
        </Field>
        <a href={image} download="tablekind-table-qr.png">
          Download QR
        </a>
        <small>
          A localhost QR works on this computer. Phone testing needs a reachable
          local address and the network setup described in the guide.
        </small>
      </div>
    </Modal>
  );
}
function Help({ action }: { action: Mutation }) {
  const [reason, setReason] = useState("General assistance");
  return (
    <div className="row">
      <select
        aria-label="Assistance type"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      >
        <option>General assistance</option>
        <option>Cutlery or water</option>
        <option>Ingredient or allergen question</option>
        <option>Order change</option>
        <option>Bill question</option>
      </select>
      <button onClick={() => void action("/help", { reason })}>
        <Bell size={16} />
        Ask waiter
      </button>
    </div>
  );
}

function MenuView({
  state,
  lang,
  action,
  busy,
}: {
  state: State;
  lang: string;
  action: Mutation;
  busy: boolean;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [selected, setSelected] = useState<Product | null>(null);
  const products = state.menu.products.filter(
    (p) =>
      (!category || p.category_id === category) &&
      `${label(p.names, lang)} ${label(p.descriptions, lang)}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Something for everyone</h2>
          <p>Find your next favourite. Ask your waiter about allergens.</p>
        </div>
        <input
          type="search"
          aria-label="Search menu"
          placeholder="Find a dish…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="chips">
        <button
          className={!category ? "active" : ""}
          onClick={() => setCategory("")}
        >
          All
        </button>
        {state.menu.categories.map((c) => (
          <button
            key={c.id}
            className={category === c.id ? "active" : ""}
            onClick={() => setCategory(c.id)}
          >
            {label(c.names, lang)}
          </button>
        ))}
      </div>
      <div className="menu-grid">
        {products.map((p) => (
          <article className="card menu-card" key={p.id}>
            <div className="dish-icon">
              {p.dietary_labels.includes("vegan") ? "◌" : "◒"}
            </div>
            <div>
              <h3>{label(p.names, lang)}</h3>
              <p>{label(p.descriptions, lang)}</p>
              <small>
                {p.allergens.length
                  ? `Allergens: ${p.allergens.join(", ")}`
                  : "No allergens listed in this test menu"}
              </small>
            </div>
            <div className="spread">
              <strong>{money(p.price_bani)}</strong>
              <button
                className="primary"
                disabled={
                  busy || !p.available || state.session.status === "CLOSED"
                }
                onClick={() => setSelected(p)}
              >
                {p.available ? (
                  <>
                    <Plus size={16} />
                    Order
                  </>
                ) : (
                  "Unavailable"
                )}
              </button>
            </div>
          </article>
        ))}
      </div>
      {selected && (
        <OrderModal
          product={selected}
          state={state}
          lang={lang}
          action={action}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function OrderModal({
  product: p,
  state,
  lang,
  action,
  onClose,
}: {
  product: Product;
  state: State;
  lang: string;
  action: Mutation;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<string[]>([]),
    [count, setCount] = useState(1),
    [waiting, setWaiting] = useState(false);
  const total =
    (p.price_bani +
      p.modifierGroups
        .flatMap((g) => g.options)
        .filter((o) => options.includes(o.id))
        .reduce((n, o) => n + o.price_bani, 0)) *
    count;
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    const f = data(e);
    setWaiting(true);
    try {
      const result = await action("/orders", {
        productId: p.id,
        productVersion: p.version,
        quantity: count,
        optionIds: options,
        note: text(f, "note"),
        orderedBy: state.actor.kind === "STAFF" ? text(f, "orderedBy") : null,
        servedTo: text(f, "servedTo") || null,
      });
      if (result) onClose();
    } finally {
      setWaiting(false);
    }
  };
  return (
    <Modal title={label(p.names, lang)} onClose={onClose}>
      <form onSubmit={submit}>
        {state.actor.kind === "STAFF" && (
          <Field label="Guest placing the order">
            <select name="orderedBy" required>
              <option value="">Choose guest</option>
              {state.guests
                .filter((g) => g.active)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nickname}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <Field label="Who is this dish for?">
          <select name="servedTo">
            <option value="">The person placing the order</option>
            {state.guests
              .filter((g) => g.active)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nickname}
                </option>
              ))}
          </select>
        </Field>
        <small>
          The person placing the order keeps financial responsibility until a
          share or transfer is accepted.
        </small>
        {p.modifierGroups.map((g) => (
          <fieldset key={g.id}>
            <legend>
              {label(g.names, lang)} · choose {g.min_select}–{g.max_select}
            </legend>
            {g.options.map((o) => (
              <label className="check" key={o.id}>
                <input
                  type="checkbox"
                  checked={options.includes(o.id)}
                  disabled={!o.available}
                  onChange={(e) =>
                    setOptions(
                      e.target.checked
                        ? [...options, o.id]
                        : options.filter((id) => id !== o.id),
                    )
                  }
                />
                <span>
                  {label(o.names, lang)} {!o.available && "(unavailable)"}
                </span>
                <strong>+{money(o.price_bani)}</strong>
              </label>
            ))}
          </fieldset>
        ))}
        <div className="grid2">
          <Field label="Quantity">
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              required
            />
          </Field>
          <Field label="Order note">
            <input name="note" maxLength={400} placeholder="Optional" />
          </Field>
        </div>
        <button className="primary wide" disabled={waiting}>
          Submit order · {money(total)}
        </button>
      </form>
    </Modal>
  );
}
function TableView({
  state,
  lang,
  action,
  setTab,
  busy,
}: {
  state: State;
  lang: string;
  action: Mutation;
  setTab: (t: string) => void;
  busy: boolean;
}) {
  const name = (id: string) =>
    state.guests.find((g) => g.id === id)?.nickname ?? "Guest";
  const [all, setAll] = useState(false);
  const personal = state.actor.kind === "GUEST";
  const own = state.bill.guests.find((g) => g.id === state.actor.id);
  const visibleItems =
    personal && !all
      ? state.items.filter(
          (i) =>
            i.ordered_by === state.actor.id ||
            i.shares.some((s) => s.guestId === state.actor.id),
        )
      : state.items;
  const transition = async (item: Item, status: string) => {
    const reason =
      status === "CANCELLED" && item.status !== "SUBMITTED"
        ? prompt("Reason for cancelling this item")
        : "";
    if (reason === null) return;
    await action(`/orders/${item.id}/status`, { status, reason });
  };
  const next: Record<string, string> = {
    SUBMITTED: "ACCEPTED",
    ACCEPTED: "PREPARING",
    PREPARING: "READY",
    READY: "SERVED",
  };
  return (
    <div className="workspace-grid">
      <section>
        <div className="section-heading">
          <div>
            <h2>{personal && !all ? "My order" : "At your table"}</h2>
            <p>
              {state.guests
                .filter((g) => g.active)
                .map((g) => g.nickname)
                .join(" · ") || "Waiting for the first guest"}
            </p>
          </div>
          {(!personal || state.table.operating_mode !== "PAY_AT_TABLE") && (
            <button onClick={() => setTab("menu")}>
              <Plus size={16} />
              Add an order
            </button>
          )}
        </div>
        {personal && (
          <div className="chips">
            <button aria-pressed={!all} onClick={() => setAll(false)}>
              My items
            </button>
            <button aria-pressed={all} onClick={() => setAll(true)}>
              Whole table
            </button>
          </div>
        )}
        {visibleItems.length === 0 ? (
          <div className="empty card">
            <ClipboardList size={32} />
            <h3>Nothing ordered yet</h3>
            <p>Open the menu to add the first dish.</p>
          </div>
        ) : (
          visibleItems.map((item) => (
            <article
              className={`card order-card ${["CANCELLED", "REJECTED"].includes(item.status) ? "muted" : ""}`}
              key={item.id}
            >
              <div className="spread">
                <h3>
                  {item.quantity} × {label(item.snapshot.names, lang)}
                </h3>
                <Pill>{item.status.toLowerCase()}</Pill>
              </div>
              <p>
                Ordered by {name(item.ordered_by)} · for {name(item.served_to)}
              </p>
              {item.snapshot.options.length > 0 && (
                <small>
                  {item.snapshot.options
                    .map((o) => label(o.names, lang))
                    .join(", ")}
                </small>
              )}
              {item.note && <p>“{item.note}”</p>}
              <div className="spread">
                <strong>
                  {money(
                    item.status === "SUBMITTED"
                      ? item.unit_price_bani * item.quantity
                      : item.total_bani,
                  )}
                </strong>
                <div className="row wrap">
                  {state.actor.kind === "STAFF" && next[item.status] && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => void transition(item, next[item.status])}
                    >
                      {next[item.status] === "ACCEPTED"
                        ? "Accept order"
                        : `Mark ${next[item.status].toLowerCase()}`}
                    </button>
                  )}
                  {state.actor.kind === "STAFF" &&
                    item.status === "SUBMITTED" && (
                      <button
                        disabled={busy}
                        onClick={() => void transition(item, "REJECTED")}
                      >
                        Reject
                      </button>
                    )}
                  {((state.actor.kind === "STAFF" &&
                    next[item.status] &&
                    (item.status === "SUBMITTED" ||
                      managesRestaurant(state.actor.role))) ||
                    (state.actor.id === item.ordered_by &&
                      item.status === "SUBMITTED")) && (
                    <button
                      disabled={busy}
                      onClick={() => void transition(item, "CANCELLED")}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </section>
      <aside>
        <div className="card summary-card">
          <span className="eyebrow">
            {personal ? "My unpaid share" : "Accepted bill"}
          </span>
          <h2 className="big-number">
            {money(
              personal ? (own?.remaining_bani ?? 0) : state.bill.totalBani,
            )}
          </h2>
          <div className="summary-row">
            <span>Reserved for checkout</span>
            <strong>
              {money(
                personal ? (own?.reserved_bani ?? 0) : state.bill.reservedBani,
              )}
            </strong>
          </div>
          <div className="summary-row">
            <span>Still unpaid</span>
            <strong>{money(state.bill.remainingBani)}</strong>
          </div>
          <button className="primary wide" onClick={() => setTab("bill")}>
            {personal ? "Pay & split" : "Open bill & sharing"}
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="card">
          <h3>Waiter requests</h3>
          {state.help.filter((h) => h.status === "OPEN").length === 0 ? (
            <p className="muted">No open requests.</p>
          ) : (
            state.help
              .filter((h) => h.status === "OPEN")
              .map((h) => (
                <div className="request" key={h.id}>
                  <strong>{name(h.guest_id)}</strong>
                  <p>{h.reason}</p>
                  {state.actor.kind === "STAFF" && (
                    <button
                      disabled={busy}
                      onClick={() => void action(`/help/${h.id}/complete`)}
                    >
                      Complete
                    </button>
                  )}
                </div>
              ))
          )}
        </div>
        {state.actor.kind === "STAFF" && (
          <details className="card">
            <summary>Guest access</summary>
            <p>
              Resolve a guest's orders and shares before removing their access.
            </p>
            {state.guests
              .filter((g) => g.active)
              .map((g) => (
                <div className="setup-row" key={g.id}>
                  <span>{g.nickname}</span>
                  <button
                    disabled={busy || state.session.status !== "OPEN"}
                    onClick={() => {
                      if (
                        confirm(`Remove ${g.nickname}'s access to this table?`)
                      )
                        void action(`/guests/${g.id}/revoke`);
                    }}
                  >
                    Remove guest access
                  </button>
                </div>
              ))}
          </details>
        )}
        {managesRestaurant(state.actor.role) && (
          <details className="card">
            <summary>Recent activity</summary>
            {state.audit.slice(0, 20).map((e) => (
              <p className="audit" key={e.id}>
                {e.action.replaceAll("_", " ").toLowerCase()}
                <small>{new Date(e.created_at).toLocaleTimeString()}</small>
              </p>
            ))}
          </details>
        )}
      </aside>
    </div>
  );
}

function BillView({
  state,
  lang,
  action,
  busy,
}: {
  state: State;
  lang: string;
  action: Mutation;
  busy: boolean;
}) {
  const [split, setSplit] = useState<Item | null>(null),
    [adjust, setAdjust] = useState(false),
    [whole, setWhole] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const personal = state.actor.kind === "GUEST";
  const own = state.bill.guests.find((g) => g.id === state.actor.id);
  const guests = state.guests.filter((g) => g.active);
  const name = (id: string) =>
    state.guests.find((g) => g.id === id)?.nickname ?? "Guest";
  return (
    <>
      {personal && (
        <div className="card personal-bill">
          <div>
            <span>My unpaid share</span>
            <h2>{money(own?.remaining_bani ?? 0)}</h2>
            <p>
              {money(own?.paid_bani ?? 0)} paid
              {own?.reserved_bani
                ? ` · ${money(own.reserved_bani)} awaiting confirmation`
                : ""}
            </p>
          </div>
          <a className="button primary" href="#checkout">
            Pay my share
          </a>
        </div>
      )}
      <details className="bill-totals" open={!personal}>
        <summary>Whole-table totals</summary>
        <div className="metrics">
          <div className="card">
            <small>Accepted total</small>
            <strong>{money(state.bill.totalBani)}</strong>
          </div>
          <div className="card">
            <small>Reserved, still unpaid</small>
            <strong>{money(state.bill.reservedBani)}</strong>
          </div>
          <div className="card">
            <small>Paid toward bill</small>
            <strong>{money(state.bill.paidBani)}</strong>
          </div>
          <div className="card">
            <small>Outstanding</small>
            <strong>{money(state.bill.remainingBani)}</strong>
          </div>
        </div>
      </details>
      <div className={`workspace-grid ${personal ? "guest-bill-grid" : ""}`}>
        <section>
          <div className="section-heading">
            <h2>Who covers what</h2>
            <div className="row">
              <button disabled={busy} onClick={() => setWhole(true)}>
                Split whole bill equally
              </button>
              {managesRestaurant(state.actor.role) && (
                <button onClick={() => setAdjust(true)}>Adjust bill</button>
              )}
            </div>
          </div>
          {personal && (
            <div className="chips">
              <button aria-pressed={!showAll} onClick={() => setShowAll(false)}>
                My shares
              </button>
              <button aria-pressed={showAll} onClick={() => setShowAll(true)}>
                All table items
              </button>
            </div>
          )}
          <details open={!personal} className="card">
            <summary>Everyone's shares</summary>
            <div className="guest-balances">
              {state.bill.guests.map((g) => (
                <div className="balance" key={g.id}>
                  <span>
                    <span className="avatar">{g.nickname[0]}</span>
                    {g.nickname}
                    {g.id === state.actor.id && <small>you</small>}
                  </span>
                  <span>
                    <strong>{money(g.remaining_bani)}</strong>
                    {g.reserved_bani > 0 && (
                      <small>{money(g.reserved_bani)} reserved</small>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </details>
          {state.proposals
            .filter((p) => p.status === "PENDING")
            .map((p) => (
              <article className="card proposal" key={p.id}>
                <div className="spread">
                  <h3>Agreement needed</h3>
                  <Pill>{p.kind.replaceAll("_", " ").toLowerCase()}</Pill>
                </div>
                <p>{p.reason}</p>
                {p.shares.map((s, i) => (
                  <div className="summary-row" key={i}>
                    <span>
                      {name(s.guest_id)} ·{" "}
                      {label(
                        state.items.find((x) => x.id === s.item_id)?.snapshot
                          .names ?? { en: "Item" },
                        lang,
                      )}
                    </span>
                    <strong>{money(s.amount_bani)}</strong>
                  </div>
                ))}
                <p className="muted">
                  Waiting for{" "}
                  {p.votes
                    .filter((v) => v.accepted === null)
                    .map((v) => name(v.guest_id))
                    .join(", ")}
                  . The current bill stays unchanged until everyone agrees.
                </p>
                <div className="row">
                  {p.votes.some(
                    (v) => v.guest_id === state.actor.id && v.accepted === null,
                  ) && (
                    <>
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          void action(`/proposals/${p.id}/vote`, {
                            accept: true,
                          })
                        }
                      >
                        Agree to my share
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void action(`/proposals/${p.id}/vote`, {
                            accept: false,
                          })
                        }
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {(p.proposed_by === state.actor.id ||
                    state.actor.kind === "STAFF") && (
                    <button
                      disabled={busy}
                      onClick={() => void action(`/proposals/${p.id}/withdraw`)}
                    >
                      Withdraw proposal
                    </button>
                  )}
                </div>
              </article>
            ))}
          {state.items
            .filter(
              (i) =>
                !personal ||
                showAll ||
                i.shares.some((s) => s.guestId === state.actor.id),
            )
            .filter(
              (i) => !["SUBMITTED", "CANCELLED", "REJECTED"].includes(i.status),
            )
            .map((i) => (
              <article className="card order-card" key={i.id}>
                <div className="spread">
                  <h3>
                    {i.quantity} × {label(i.snapshot.names, lang)}
                  </h3>
                  <strong>{money(i.total_bani)}</strong>
                </div>
                {i.shares.map((s) => (
                  <div className="summary-row" key={s.guestId}>
                    <span>{name(s.guestId)}</span>
                    <span>{money(s.amountBani)}</span>
                  </div>
                ))}
                {i.adjustments.length > 1 && (
                  <details>
                    <summary>Charges & adjustments</summary>
                    {i.adjustments.map((a, n) => (
                      <div className="summary-row" key={n}>
                        <small>
                          {a.kind}: {a.reason}
                        </small>
                        <span>{money(a.amount_bani)}</span>
                      </div>
                    ))}
                  </details>
                )}
                <div className="row wrap item-actions">
                  <button disabled={busy} onClick={() => setSplit(i)}>
                    Share or transfer
                  </button>
                  {state.actor.kind === "GUEST" &&
                    i.shares.some((s) => s.guestId !== state.actor.id) && (
                      <button
                        disabled={busy}
                        onClick={() => void action(`/items/${i.id}/takeover`)}
                      >
                        I'll cover this
                      </button>
                    )}
                </div>
              </article>
            ))}
        </section>
        <aside>
          <Checkout state={state} action={action} busy={busy} />
          {state.reservations.some(
            (r) => !state.payments.some((p) => p.reservation_id === r.id),
          ) && (
            <div className="card">
              <h3>Checkout holds</h3>
              {state.reservations.filter(
                (r) => !state.payments.some((p) => p.reservation_id === r.id),
              ).length === 0 ? (
                <p className="muted">No reservations yet.</p>
              ) : (
                state.reservations
                  .filter(
                    (r) =>
                      !state.payments.some((p) => p.reservation_id === r.id),
                  )
                  .slice(0, 10)
                  .map((r) => (
                    <div className="request" key={r.id}>
                      <div className="spread">
                        <strong>{money(r.amount_bani)}</strong>
                        <Pill>{r.effective_status.toLowerCase()}</Pill>
                      </div>
                      <p>{name(r.payer_id)}</p>
                      <small>
                        Expires {new Date(r.expires_at).toLocaleTimeString()}
                      </small>
                      {r.effective_status === "HELD" &&
                        (state.actor.kind === "STAFF" ||
                          r.payer_id === state.actor.id) && (
                          <button
                            className="wide"
                            disabled={busy}
                            onClick={() =>
                              void action(
                                `/checkout/reservations/${r.id}/release`,
                              )
                            }
                          >
                            Release hold
                          </button>
                        )}
                    </div>
                  ))
              )}
            </div>
          )}
        </aside>
      </div>
      <PaymentsPanel state={state} action={action} busy={busy} />
      {split && (
        <SplitModal
          item={split}
          guests={guests}
          action={action}
          onClose={() => setSplit(null)}
        />
      )}
      {whole && (
        <WholeModal
          guests={guests}
          action={action}
          onClose={() => setWhole(false)}
        />
      )}
      {adjust && (
        <AdjustmentModal
          items={state.items}
          action={action}
          onClose={() => setAdjust(false)}
        />
      )}
    </>
  );
}
function SplitModal({
  item,
  guests,
  action,
  onClose,
}: {
  item: Item;
  guests: Guest[];
  action: Mutation;
  onClose: () => void;
}) {
  const [mode, setMode] = useState("EQUAL"),
    [selected, setSelected] = useState<string[]>(
      item.shares.map((s) => s.guestId),
    ),
    [error, setError] = useState(""),
    [waiting, setWaiting] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    const f = data(e);
    setError("");
    setWaiting(true);
    try {
      let result;
      if (mode === "TRANSFER")
        result = await action(`/items/${item.id}/transfer`, {
          guestId: text(f, "target"),
          reason: "Transfer dish and responsibility with consent",
        });
      else {
        const shares = selected.map((guestId) => ({
          guestId,
          value:
            mode === "EQUAL"
              ? 1
              : mode === "PROPORTION" || mode === "AMOUNTS"
                ? bani(text(f, guestId))
                : Number(text(f, guestId)),
        }));
        result = await action(`/items/${item.id}/split`, {
          mode,
          shares,
          totalUnits:
            mode === "QUANTITY" ? Number(text(f, "totalUnits")) : null,
          reason: `${mode.toLowerCase()} split of ${item.snapshot.names.en}`,
        });
      }
      if (result) onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWaiting(false);
    }
  };
  return (
    <Modal title={`Share ${item.snapshot.names.en}`} onClose={onClose}>
      <form onSubmit={submit}>
        <p>
          Current total: <strong>{money(item.total_bani)}</strong>. Affected
          guests must approve the proposal.
        </p>
        <p>Choose the guests to share equally.</p>
        <details>
          <summary>Other ways to split or transfer</summary>
          <Field label="Split method">
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="EQUAL">Equal shares</option>
              <option value="PROPORTION">Percentages</option>
              <option value="QUANTITY">Portions or pieces</option>
              <option value="AMOUNTS">Exact MDL amounts</option>
              <option value="TRANSFER">Transfer dish and responsibility</option>
            </select>
          </Field>
        </details>
        {mode === "TRANSFER" ? (
          <Field label="New owner">
            <select name="target" required>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nickname}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            {guests.map((g) => (
              <div className="share-input" key={g.id}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={selected.includes(g.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, g.id]
                          : selected.filter((x) => x !== g.id),
                      )
                    }
                  />
                  {g.nickname}
                </label>
                {mode !== "EQUAL" && selected.includes(g.id) && (
                  <input
                    name={g.id}
                    aria-label={`${g.nickname} ${mode === "PROPORTION" ? "percentage" : mode === "QUANTITY" ? "pieces" : "MDL amount"}`}
                    placeholder={
                      mode === "PROPORTION"
                        ? "%"
                        : mode === "QUANTITY"
                          ? "pieces"
                          : "MDL"
                    }
                    inputMode="decimal"
                    required
                  />
                )}
              </div>
            ))}
            {mode === "QUANTITY" && (
              <Field label="Total number of portions or pieces">
                <input
                  name="totalUnits"
                  type="number"
                  min={1}
                  max={1000000}
                  required
                />
              </Field>
            )}
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary wide" disabled={waiting}>
          Propose allocation
        </button>
      </form>
    </Modal>
  );
}
function WholeModal({
  guests,
  action,
  onClose,
}: {
  guests: Guest[];
  action: Mutation;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(guests.map((g) => g.id));
  return (
    <Modal title="Split the current bill equally" onClose={onClose}>
      <p>
        This proposes equal shares of all accepted items. Resolve submitted
        orders and existing holds first.
      </p>
      {guests.map((g) => (
        <label className="check" key={g.id}>
          <input
            type="checkbox"
            checked={selected.includes(g.id)}
            onChange={(e) =>
              setSelected(
                e.target.checked
                  ? [...selected, g.id]
                  : selected.filter((x) => x !== g.id),
              )
            }
          />
          {g.nickname}
        </label>
      ))}
      <button
        className="primary wide"
        onClick={async () => {
          if (await action("/split-equally", { guestIds: selected })) onClose();
        }}
      >
        Propose equal bill
      </button>
    </Modal>
  );
}
function AdjustmentModal({
  items,
  action,
  onClose,
}: {
  items: Item[];
  action: Mutation;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <Modal title="Record a bill adjustment" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          const f = data(e);
          try {
            const percent = text(f, "unit") === "percent";
            const r = await action("/adjustments", {
              itemId: text(f, "item") || null,
              kind: text(f, "kind"),
              amountBani: percent ? null : bani(text(f, "amount")),
              basisPoints: percent ? bani(text(f, "amount")) : null,
              reason: text(f, "reason"),
            });
            if (r) onClose();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Field label="Apply to">
          <select name="item">
            <option value="">Whole accepted bill</option>
            {items
              .filter(
                (i) =>
                  !["SUBMITTED", "REJECTED", "CANCELLED"].includes(i.status),
              )
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.snapshot.names.en}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Adjustment">
          <select name="kind">
            <option value="DISCOUNT">Discount</option>
            <option value="SERVICE_CHARGE">Service charge</option>
            <option value="TAX">Explicit tax adjustment</option>
            <option value="CORRECTION">Correction (may be negative)</option>
          </select>
        </Field>
        <div className="grid2">
          <Field label="Amount">
            <input name="amount" inputMode="decimal" required />
          </Field>
          <Field label="Unit">
            <select name="unit">
              <option value="mdl">MDL</option>
              <option value="percent">Percent</option>
            </select>
          </Field>
        </div>
        <Field label="Reason">
          <input name="reason" required maxLength={400} />
        </Field>
        <p>
          Adjustments append new accounting entries. Tax rates here are inputs
          for testing, not configured Moldovan fiscal rules.
        </p>
        {error && <p className="error">{error}</p>}
        <button className="primary wide">Record adjustment</button>
      </form>
    </Modal>
  );
}
function Checkout({
  state,
  action,
  busy,
}: {
  state: State;
  action: Mutation;
  busy: boolean;
}) {
  const [target, setTarget] = useState("SELF"),
    [amount, setAmount] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [quote, setQuote] = useState<Quote | null>(null),
    [method, setMethod] = useState("CASH"),
    [tip, setTip] = useState("0"),
    [error, setError] = useState(""),
    [payer, setPayer] = useState(state.guests[0]?.id ?? "");
  useEffect(
    () => setQuote(null),
    [state.session.revision, target, amount, payer, selected, method, tip],
  );
  const run = async (pay: boolean) => {
    setError("");
    try {
      const tipBani = bani(tip || "0");
      if (tipBani < 0 || tipBani > 100_000_000)
        throw new Error(
          "Enter a non-negative tip within the supported amount.",
        );
      const r = await action(pay ? "/payments" : "/checkout/quote", {
        target,
        guestIds: selected,
        payerId: state.actor.kind === "STAFF" ? payer : null,
        amountBani: amount ? bani(amount) : null,
        ...(pay ? { method, tipBani } : {}),
      });
      if (r) setQuote(pay ? null : { ...r, tipBani });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (state.paymentsEnabled === false)
    return (
      <div className="card checkout">
        <h2>Checkout unavailable</h2>
        <p>
          This installation has no enabled payment provider. Payments are
          available only in the local or private TEST demo.
        </p>
      </div>
    );
  return (
    <div className="card checkout" id="checkout">
      <h2>Checkout</h2>
      <p>
        {state.actor.kind === "GUEST"
          ? "Your share is selected. Check the amount before confirming."
          : "Choose the guest and payment method."}
      </p>
      {state.actor.kind === "STAFF" && (
        <Field label="Paying guest">
          <select value={payer} onChange={(e) => setPayer(e.target.value)}>
            {state.guests
              .filter((g) => g.active)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nickname}
                </option>
              ))}
          </select>
        </Field>
      )}
      <details open={state.actor.kind === "STAFF"}>
        <summary>Pay for others or enter a custom amount</summary>
        <Field label="Cover">
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="SELF">My share</option>
            <option value="GUESTS">Selected guests</option>
            <option value="REMAINDER">Everything remaining</option>
          </select>
        </Field>
        {target === "GUESTS" &&
          state.guests
            .filter((g) => g.active)
            .map((g) => (
              <label className="check" key={g.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(g.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, g.id]
                        : selected.filter((x) => x !== g.id),
                    )
                  }
                />
                {g.nickname}
              </label>
            ))}
        <Field label="Custom amount in MDL (optional)">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Full available amount"
            inputMode="decimal"
          />
        </Field>
      </details>
      {error && <p className="error">{error}</p>}
      <Field label="Payment method">
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="CASH">Cash — waiter collects</option>
          <option value="TERMINAL">
            Physical card terminal — waiter assists
          </option>
          {state.actor.kind === "GUEST" && (
            <>
              <option value="CARD">
                {state.testPayments ? "Card — TEST checkout" : "Card"}
              </option>
              <option value="MIA">
                {state.testPayments ? "MIA — TEST checkout" : "MIA"}
              </option>
            </>
          )}
        </select>
      </Field>
      <Field label="Optional tip in MDL">
        <input
          inputMode="decimal"
          value={tip}
          onChange={(e) => setTip(e.target.value)}
        />
      </Field>
      <button
        className="wide"
        disabled={busy || state.session.status === "CLOSED"}
        onClick={() => void run(false)}
      >
        Calculate checkout
      </button>
      {quote && (
        <div className="quote">
          <strong>
            {money(quote.amountBani + (quote.tipBani ?? 0))} total including tip
          </strong>
          <small>{money(quote.amountBani)} toward the bill</small>
          <p>
            Tip: {tip || "0"} MDL. Requesting payment does not mark it as paid.
          </p>
        </div>
      )}
      {quote && (
        <button
          className="primary wide"
          disabled={busy || state.session.status === "CLOSED"}
          onClick={() => void run(true)}
        >
          {method === "CASH"
            ? "Request cash collection"
            : method === "TERMINAL"
              ? "Request card terminal"
              : state.testPayments
                ? "Start TEST checkout"
                : "Start checkout"}
        </button>
      )}
      <small>
        Payments reserve the selected shares until the provider or staff
        confirms the outcome. Tips do not change anyone else's bill.
      </small>
    </div>
  );
}

function Setup({
  dash,
  mutate,
  rid,
  onRestaurant,
  token,
  onSection,
}: {
  dash: Dashboard | null;
  mutate: Mutation;
  rid: string;
  onRestaurant: (id: string) => void;
  token: string;
  onSection: (section: string) => void;
}) {
  const [panel, setPanel] = useState(
      dash?.role === "WAITER" ? "menu" : "start",
    ),
    [edit, setEdit] = useState<Product | null | undefined>(undefined),
    [modifiers, setModifiers] = useState<Product | null>(null),
    [error, setError] = useState("");
  const endpoint = `/restaurants/${rid}`;
  const manager = !!dash && managesRestaurant(dash.role);
  const [newRestaurant, setNewRestaurant] = useState(false);
  const [newCategory, setNewCategory] = useState(false);
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>{manager ? "Restaurant setup" : "Menu availability"}</h2>
          <p>
            {manager
              ? "Manage your menu, tables and staff."
              : "Mark items available or unavailable for service."}
          </p>
        </div>
        {manager && (
          <button onClick={() => setNewRestaurant(true)}>
            <Plus size={16} />
            New restaurant
          </button>
        )}
      </div>
      {newRestaurant && (
        <form
          className="card"
          onSubmit={async (e) => {
            const f = data(e);
            const r = await mutate("/restaurants", { name: text(f, "name") });
            if (r) {
              onRestaurant(r.id);
              setPanel("start");
              setNewRestaurant(false);
            }
          }}
        >
          <Field label="Restaurant name">
            <input name="name" required maxLength={120} autoFocus />
          </Field>
          <button className="primary">Create restaurant</button>
          <button type="button" onClick={() => setNewRestaurant(false)}>
            Cancel
          </button>
        </form>
      )}
      {!dash ? (
        <p>Create a restaurant to begin.</p>
      ) : (
        <>
          <div className="chips">
            {(manager
              ? [
                  "start",
                  "menu",
                  "branches & tables",
                  "QR codes",
                  "staff",
                  "activity",
                  "pilot",
                ]
              : ["menu"]
            ).map((p) => (
              <button
                key={p}
                className={panel === p ? "active" : ""}
                onClick={() => setPanel(p)}
              >
                {p}
              </button>
            ))}
          </div>
          {error && <div className="alert">{error}</div>}
          {panel === "start" && manager && (
            <OnboardingPanel
              rid={rid}
              token={token}
              mutate={mutate}
              onSection={(s) =>
                s === "practice"
                  ? onSection("table")
                  : s === "integrations"
                    ? onSection("pos")
                    : setPanel(s)
              }
            />
          )}
          {panel === "QR codes" && manager && (
            <TableQrPanel dash={dash} token={token} mutate={mutate} />
          )}
          {panel === "activity" && manager && (
            <AuditPanel rid={rid} token={token} />
          )}
          {panel === "pilot" && manager && (
            <PilotPanel rid={rid} token={token} />
          )}
          {panel === "menu" && (
            <>
              {dash.posManaged && (
                <p className="notice">
                  This menu is POS-managed. Change the source menu and use
                  Import POS catalog in POS integration. Prices and availability
                  are read-only here.
                </p>
              )}
              <div className="row wrap section-heading">
                {manager && !dash.posManaged && (
                  <>
                    <button className="primary" onClick={() => setEdit(null)}>
                      Add product
                    </button>
                    <button onClick={() => setNewCategory(true)}>
                      Add category
                    </button>
                  </>
                )}
              </div>
              {newCategory && (
                <form
                  className="card"
                  onSubmit={async (e) => {
                    const f = data(e);
                    const r = await mutate(`${endpoint}/categories`, {
                      names: {
                        en: text(f, "en"),
                        ro: text(f, "ro"),
                        ru: text(f, "ru"),
                      },
                      sortOrder: dash.menu.categories.length,
                    });
                    if (r) setNewCategory(false);
                  }}
                >
                  {["en", "ro", "ru"].map((l) => (
                    <Field key={l} label={`Category name (${l})`}>
                      <input name={l} required={l === "en"} maxLength={120} />
                    </Field>
                  ))}
                  <button className="primary">Save category</button>
                  <button type="button" onClick={() => setNewCategory(false)}>
                    Cancel
                  </button>
                </form>
              )}
              <div className="card">
                {dash.menu.products.map((p) => (
                  <div className="setup-row" key={p.id}>
                    <div>
                      <strong>{p.names.en}</strong>
                      <small>{money(p.price_bani)}</small>
                    </div>
                    <div className="row wrap">
                      <button
                        disabled={dash.posManaged}
                        onClick={() =>
                          void mutate(
                            `${endpoint}/products/${p.id}/availability`,
                            { available: !p.available },
                            "PUT",
                          )
                        }
                      >
                        {p.available
                          ? "Mark unavailable"
                          : "Restore availability"}
                      </button>
                      {manager && !dash.posManaged && (
                        <>
                          <button onClick={() => setEdit(p)}>Edit</button>
                          <button onClick={() => setModifiers(p)}>
                            Modifiers
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {panel === "branches & tables" && manager && (
            <>
              <div className="card">
                <h3>Add a branch</h3>
                <form
                  className="inline-form"
                  onSubmit={async (e) => {
                    const f = data(e);
                    await mutate(`${endpoint}/branches`, {
                      name: text(f, "name"),
                      timezone: text(f, "timezone"),
                      approvalRequired: true,
                      acceptingOrders: true,
                      hours: [],
                    });
                  }}
                >
                  <input
                    name="name"
                    aria-label="Branch name"
                    placeholder="Branch name"
                    required
                    maxLength={120}
                  />
                  <input
                    name="timezone"
                    aria-label="Timezone"
                    defaultValue="Europe/Chisinau"
                    required
                  />
                  <button className="primary">Add branch</button>
                </form>
              </div>
              {dash.branches.map((b) => (
                <div key={b.id}>
                  <BranchEditor
                    key={b.id}
                    branch={b}
                    dash={dash}
                    mutate={mutate}
                    endpoint={endpoint}
                  />
                  <BranchPolicy
                    branch={b}
                    endpoint={endpoint}
                    mutate={mutate}
                  />
                </div>
              ))}
            </>
          )}
          {panel === "staff" && manager && (
            <>
              <div className="card">
                <h3>Add a staff account</h3>
                <form
                  onSubmit={async (e) => {
                    const f = data(e);
                    await mutate(`${endpoint}/staff`, {
                      email: text(f, "email"),
                      displayName: text(f, "name"),
                      password: text(f, "password"),
                      role: text(f, "role"),
                    });
                  }}
                >
                  <div className="grid2">
                    <Field label="Name">
                      <input name="name" required maxLength={80} />
                    </Field>
                    <Field label="Email">
                      <input name="email" type="email" required />
                    </Field>
                    <Field label="Initial password (12+ characters)">
                      <input
                        name="password"
                        type="password"
                        minLength={12}
                        maxLength={72}
                        required
                        autoComplete="new-password"
                      />
                    </Field>
                    <Field label="Role">
                      <select name="role">
                        <option value="WAITER">Waiter</option>
                        {dash.role === "OWNER" && (
                          <option value="MANAGER">Manager</option>
                        )}
                      </select>
                    </Field>
                  </div>
                  <button className="primary">Create account</button>
                </form>
              </div>
              <div className="card">
                {dash.staff.map((s) => (
                  <div className="setup-row" key={s.id}>
                    <div>
                      <strong>{s.display_name}</strong>
                      <small>
                        {s.email} · {s.role.toLowerCase()}
                      </small>
                    </div>
                    <button
                      disabled={
                        s.role === "OWNER" ||
                        (dash.role !== "OWNER" && s.role !== "WAITER")
                      }
                      onClick={async () => {
                        if (
                          confirm(
                            `Remove ${s.display_name}'s access to this restaurant?`,
                          )
                        )
                          await mutate(
                            `${endpoint}/staff/${s.id}`,
                            undefined,
                            "DELETE",
                          );
                      }}
                    >
                      Remove access
                    </button>
                    {dash.role === "OWNER" && s.role !== "OWNER" && (
                      <button
                        onClick={() =>
                          void mutate(
                            `${endpoint}/staff/${s.id}/role`,
                            {
                              role: s.role === "MANAGER" ? "WAITER" : "MANAGER",
                            },
                            "PUT",
                          )
                        }
                      >
                        {s.role === "MANAGER" ? "Make waiter" : "Make manager"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {dash.role === "OWNER" && (
                <form
                  className="card"
                  onSubmit={async (e) => {
                    const f = data(e);
                    if (
                      !confirm(
                        "Transfer ownership to this manager? Your own role becomes manager.",
                      )
                    )
                      return;
                    await mutate(`${endpoint}/ownership`, {
                      staffId: text(f, "staffId"),
                      reason: text(f, "reason"),
                    });
                  }}
                >
                  <h3>Transfer restaurant ownership</h3>
                  <p>
                    One owner controls manager access. Choose an existing
                    manager. Every transfer is recorded.
                  </p>
                  <Field label="New restaurant owner">
                    <select name="staffId" required defaultValue="">
                      <option value="" disabled>
                        Choose a manager
                      </option>
                      {dash.staff
                        .filter((s) => s.role === "MANAGER")
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.display_name} · {s.email}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Ownership transfer reason">
                    <input name="reason" required maxLength={400} />
                  </Field>
                  <button>Transfer ownership</button>
                </form>
              )}
            </>
          )}
          {(panel === "staff" || panel === "branches & tables") && !manager && (
            <p>These settings require a manager account.</p>
          )}
        </>
      )}
      {edit !== undefined && dash && (
        <ProductEditor
          product={edit}
          dash={dash}
          endpoint={endpoint}
          mutate={mutate}
          onClose={() => setEdit(undefined)}
        />
      )}
      {modifiers && (
        <ModifiersEditor
          product={modifiers}
          endpoint={endpoint}
          mutate={mutate}
          onClose={() => setModifiers(null)}
        />
      )}
    </>
  );
}
function ProductEditor({
  product: p,
  dash,
  endpoint,
  mutate,
  onClose,
}: {
  product: Product | null;
  dash: Dashboard;
  endpoint: string;
  mutate: Mutation;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <Modal title={p ? "Edit product" : "Add product"} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          const f = data(e);
          try {
            const names = {
              en: text(f, "en"),
              ro: text(f, "ro"),
              ru: text(f, "ru"),
            };
            const result = await mutate(
              p ? `${endpoint}/products/${p.id}` : `${endpoint}/products`,
              {
                categoryId: text(f, "category"),
                names,
                descriptions: {
                  en: text(f, "description"),
                  ro: text(f, "descriptionRo"),
                  ru: text(f, "descriptionRu"),
                },
                priceBani: bani(text(f, "price")),
                allergens: text(f, "allergens")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                dietaryLabels: text(f, "dietary")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                available: f.has("available"),
              },
              p ? "PUT" : "POST",
            );
            if (result) onClose();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Field label="Category">
          <select name="category" defaultValue={p?.category_id} required>
            {dash.menu.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.names.en}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid2">
          {["en", "ro", "ru"].map((l) => (
            <Field key={l} label={`Name (${l})`}>
              <input
                name={l}
                defaultValue={p?.names[l as keyof Names] ?? ""}
                required={l === "en"}
              />
            </Field>
          ))}
          <Field label="Price in MDL">
            <input
              name="price"
              defaultValue={p ? (p.price_bani / 100).toFixed(2) : ""}
              inputMode="decimal"
              required
            />
          </Field>
        </div>
        <Field label="Description (English)">
          <textarea
            name="description"
            defaultValue={p?.descriptions.en ?? ""}
          />
        </Field>
        <Field label="Description (Romanian)">
          <textarea
            name="descriptionRo"
            defaultValue={p?.descriptions.ro ?? ""}
          />
        </Field>
        <Field label="Description (Russian)">
          <textarea
            name="descriptionRu"
            defaultValue={p?.descriptions.ru ?? ""}
          />
        </Field>
        <Field label="Allergens, separated by commas">
          <input
            name="allergens"
            defaultValue={p?.allergens.join(", ") ?? ""}
          />
        </Field>
        <Field label="Dietary labels, separated by commas">
          <input
            name="dietary"
            defaultValue={p?.dietary_labels.join(", ") ?? ""}
          />
        </Field>
        <label className="check">
          <input
            name="available"
            type="checkbox"
            defaultChecked={p?.available ?? true}
          />
          Available
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary wide">Save product</button>
      </form>
    </Modal>
  );
}
