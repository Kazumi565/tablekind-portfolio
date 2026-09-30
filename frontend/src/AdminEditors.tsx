import {
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import type { Branch, Dashboard, Names, Product } from "./types";
import { bani } from "./api";
type Mutation = (path: string, body?: unknown, method?: string) => Promise<any>;
const value = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
function Field({ name, children }: { name: string; children: ReactNode }) {
  const id = useId();
  return (
    <label className="field">
      <span id={id}>{name}</span>
      {isValidElement(children)
        ? cloneElement(
            children as ReactElement<{ "aria-labelledby"?: string }>,
            { "aria-labelledby": id },
          )
        : children}
    </label>
  );
}
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export function BranchEditor({
  branch: b,
  dash,
  mutate,
  endpoint,
}: {
  branch: Branch;
  dash: Dashboard;
  mutate: Mutation;
  endpoint: string;
}) {
  const [hours, setHours] = useState(b.hours),
    [scheduled, setScheduled] = useState(b.hours.length > 0),
    [error, setError] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    if (scheduled && !hours.length) {
      setError("Add at least one opening period, or turn off the schedule.");
      return;
    }
    await mutate(
      `${endpoint}/branches/${b.id}`,
      {
        name: value(f, "name"),
        timezone: value(f, "timezone"),
        approvalRequired: f.has("approval"),
        acceptingOrders: f.has("accepting"),
        hours: scheduled ? hours : [],
      },
      "PUT",
    );
  };
  return (
    <details className="card" open>
      <summary>{b.name}</summary>
      <form onSubmit={submit}>
        <div className="grid2">
          <Field name="Branch name">
            <input name="name" defaultValue={b.name} required maxLength={120} />
          </Field>
          <Field name="Timezone">
            <input
              name="timezone"
              defaultValue={b.timezone}
              required
              maxLength={60}
            />
          </Field>
        </div>
        <div className="row wrap">
          <label className="check">
            <input
              name="approval"
              type="checkbox"
              defaultChecked={b.approval_required}
            />
            Staff approval required
          </label>
          <label className="check">
            <input
              name="accepting"
              type="checkbox"
              defaultChecked={b.accepting_orders}
            />
            Accept new orders
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={scheduled}
            onChange={(e) => setScheduled(e.target.checked)}
          />
          Limit ordering to kitchen opening hours
        </label>
        {scheduled ? (
          <>
            <p>
              Days without an opening period are closed. A closing time earlier
              than the opening time means the following day.
            </p>
            {hours.map((h, i) => (
              <div className="hours-row" key={i}>
                <Field name="Day">
                  <select
                    value={h.day}
                    onChange={(e) =>
                      setHours(
                        hours.map((x, j) =>
                          j === i ? { ...x, day: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  >
                    {days.map((day, j) => (
                      <option key={day} value={j + 1}>
                        {day}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field name="Opens">
                  <input
                    type="time"
                    required
                    value={h.opens}
                    onChange={(e) =>
                      setHours(
                        hours.map((x, j) =>
                          j === i ? { ...x, opens: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field name="Closes">
                  <input
                    type="time"
                    required
                    value={h.closes}
                    onChange={(e) =>
                      setHours(
                        hours.map((x, j) =>
                          j === i ? { ...x, closes: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => setHours(hours.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={hours.length >= 21}
              onClick={() =>
                setHours([
                  ...hours,
                  { day: 1, opens: "10:00", closes: "22:00" },
                ])
              }
            >
              Add opening period
            </button>
          </>
        ) : (
          <p>
            The kitchen accepts orders whenever “Accept new orders” is enabled.
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <button className="primary">Save branch</button>
      </form>
      <h3>Tables</h3>
      {dash.tables
        .filter((t) => t.branch_id === b.id)
        .map((t) => (
          <form
            className="inline-form setup-row"
            key={t.id}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await mutate(
                `${endpoint}/tables/${t.id}`,
                {
                  label: value(f, "label"),
                  pilotEnabled: f.has("enabled"),
                  maxGuests: Number(value(f, "limit")),
                },
                "PUT",
              );
            }}
          >
            <input
              name="label"
              aria-label="Table label"
              defaultValue={t.label}
              required
              maxLength={40}
            />
            <input
              name="limit"
              aria-label={`${t.label} guest limit`}
              type="number"
              min={1}
              max={20}
              defaultValue={t.max_guests}
            />
            <label className="check">
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={t.pilot_enabled}
              />
              Enabled
            </label>
            <button>Save</button>
          </form>
        ))}
      <form
        className="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await mutate(`${endpoint}/branches/${b.id}/tables`, {
            label: value(f, "label"),
            pilotEnabled: true,
            maxGuests: 20,
          });
        }}
      >
        <input
          name="label"
          aria-label="New table label"
          placeholder="New table label"
          required
          maxLength={40}
        />
        <button>Add table</button>
      </form>
    </details>
  );
}

type OptionDraft = { names: Names; price: string; available: boolean };
type GroupDraft = {
  names: Names;
  minSelect: number;
  maxSelect: number;
  options: OptionDraft[];
};
export function ModifiersEditor({
  product,
  endpoint,
  mutate,
  onClose,
}: {
  product: Product;
  endpoint: string;
  mutate: Mutation;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  const [error, setError] = useState("");
  const [groups, setGroups] = useState<GroupDraft[]>(() =>
    product.modifierGroups.map((g) => ({
      names: { ...g.names },
      minSelect: g.min_select,
      maxSelect: g.max_select,
      options: g.options.map((o) => ({
        names: { ...o.names },
        price: (o.price_bani / 100).toFixed(2),
        available: o.available,
      })),
    })),
  );
  const change = (i: number, edit: (g: GroupDraft) => void) =>
    setGroups((old) => {
      const next = structuredClone(old);
      edit(next[i]);
      return next;
    });
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    try {
      const body = {
        groups: groups.map((g) => ({
          names: g.names,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          options: g.options.map((o) => ({
            names: o.names,
            priceBani: bani(o.price),
            available: o.available,
          })),
        })),
      };
      if (
        await mutate(
          `${endpoint}/products/${product.id}/modifiers`,
          body,
          "PUT",
        )
      )
        onClose();
      else
        setError(
          "Could not save these options. Check the selection limits and try again.",
        );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      aria-label={`Options for ${product.names.en}`}
    >
      <div className="dialog-head">
        <h2>Options for {product.names.en}</h2>
        <button aria-label="Close dialog" onClick={onClose}>
          Close
        </button>
      </div>
      <form onSubmit={save}>
        <p>
          Create choices such as size, toppings or sides. Orders already
          submitted keep their original options and need a fresh review if the
          menu changes.
        </p>
        {groups.map((g, i) => (
          <fieldset className="modifier-editor" key={i}>
            <legend>Option group {i + 1}</legend>
            <div className="grid2">
              {(["en", "ro", "ru"] as const).map((l) => (
                <Field key={l} name={`Group name (${l})`}>
                  <input
                    value={g.names[l] ?? ""}
                    required={l === "en"}
                    maxLength={120}
                    onChange={(e) =>
                      change(i, (x) => {
                        x.names[l] = e.target.value;
                      })
                    }
                  />
                </Field>
              ))}
            </div>
            <div className="grid2">
              <Field name="Minimum choices">
                <input
                  type="number"
                  min={0}
                  max={g.options.length}
                  required
                  value={g.minSelect}
                  onChange={(e) =>
                    change(i, (x) => {
                      x.minSelect = Number(e.target.value);
                    })
                  }
                />
              </Field>
              <Field name="Maximum choices">
                <input
                  type="number"
                  min={Math.max(1, g.minSelect)}
                  max={Math.max(1, g.options.length)}
                  required
                  value={g.maxSelect}
                  onChange={(e) =>
                    change(i, (x) => {
                      x.maxSelect = Number(e.target.value);
                    })
                  }
                />
              </Field>
            </div>
            {g.options.map((o, j) => (
              <div className="option-editor" key={j}>
                <div className="grid2">
                  {(["en", "ro", "ru"] as const).map((l) => (
                    <Field key={l} name={`Option ${j + 1} (${l})`}>
                      <input
                        value={o.names[l] ?? ""}
                        required={l === "en"}
                        maxLength={120}
                        onChange={(e) =>
                          change(i, (x) => {
                            x.options[j].names[l] = e.target.value;
                          })
                        }
                      />
                    </Field>
                  ))}
                  <Field name="Extra price in MDL">
                    <input
                      inputMode="decimal"
                      value={o.price}
                      required
                      onChange={(e) =>
                        change(i, (x) => {
                          x.options[j].price = e.target.value;
                        })
                      }
                    />
                  </Field>
                </div>
                <div className="row wrap">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={o.available}
                      onChange={(e) =>
                        change(i, (x) => {
                          x.options[j].available = e.target.checked;
                        })
                      }
                    />
                    Available
                  </label>
                  <button
                    type="button"
                    disabled={g.options.length === 1}
                    onClick={() =>
                      change(i, (x) => {
                        x.options.splice(j, 1);
                      })
                    }
                  >
                    Remove option
                  </button>
                </div>
              </div>
            ))}
            <div className="row wrap">
              <button
                type="button"
                disabled={g.options.length >= 20}
                onClick={() =>
                  change(i, (x) => {
                    x.options.push({
                      names: { en: "" },
                      price: "0.00",
                      available: true,
                    });
                  })
                }
              >
                Add option
              </button>
              <button
                type="button"
                onClick={() => setGroups(groups.filter((_, j) => j !== i))}
              >
                Remove group
              </button>
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={groups.length >= 10}
          onClick={() =>
            setGroups([
              ...groups,
              {
                names: { en: "" },
                minSelect: 0,
                maxSelect: 1,
                options: [
                  { names: { en: "" }, price: "0.00", available: true },
                ],
              },
            ])
          }
        >
          Add option group
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary wide">Save options</button>
      </form>
    </dialog>
  );
}
