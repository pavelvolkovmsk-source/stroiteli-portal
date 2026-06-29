import { useEffect, useMemo, useState } from "react";

import { decodeToken } from "@/lib/auth";
import { getProjects, HubError, type ProjectRow } from "@/lib/hubApi";
import { formatDateTime, formatMoney } from "./labels";

const ALL = "__all__";

// Себестоимость — бизнес-тайна: только суперадмин/генеральный (НЕ обычный admin).
function canSeeCost(): boolean {
  const p = decodeToken();
  return Boolean(p?.is_superadmin) || (p?.roles ?? []).includes("general");
}

/** Уникальные непустые значения поля для выпадающего фильтра. */
function uniq(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) =>
    a.localeCompare(b, "ru"),
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value={ALL}>Все</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Проекты: карта сделок (из событий шины + обогащение из Bitrix) со сквозными
 * фильтрами по стадии, отделу и менеджеру. Бэкенд — GET /api/v1/projects.
 */
export default function Projects() {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [q, setQ] = useState("");
  const [stage, setStage] = useState(ALL);
  const [department, setDepartment] = useState(ALL);
  const [manager, setManager] = useState(ALL);

  const showCost = useMemo(() => canSeeCost(), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getProjects()
      .then((page) => {
        if (!cancelled) setRows(page.items);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof HubError && e.status === 404) {
          setPending(true);
        } else if (e instanceof HubError && (e.status === 401 || e.status === 403)) {
          setError("Нет доступа. Войдите под учётной записью генерального.");
        } else {
          setError(e instanceof Error ? e.message : "Не удалось загрузить проекты");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stages = useMemo(() => uniq(rows.map((r) => r.stage_name)), [rows]);
  const departments = useMemo(() => uniq(rows.map((r) => r.department)), [rows]);
  const managers = useMemo(() => uniq(rows.map((r) => r.manager)), [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (stage !== ALL && r.stage_name !== stage) return false;
        if (department !== ALL && r.department !== department) return false;
        if (manager !== ALL && r.manager !== manager) return false;
        if (q.trim()) {
          const needle = q.trim().toLowerCase();
          const hay = `${r.title ?? ""} ${r.bitrix_deal_id}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      }),
    [rows, stage, department, manager, q],
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Проекты</h1>
        <p className="text-sm text-muted-foreground">
          Карта сделок экосистемы со сквозными фильтрами
        </p>
      </header>

      {pending && (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Раздел подключается: бэкенд <code>GET /api/v1/projects</code> ещё не развёрнут.
          После деплоя здесь появится список сделок со стадиями, отделами и менеджерами.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!pending && !error && (
        <>
          <section className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Поиск</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Название или № сделки"
                className="h-9 w-56 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <Select label="Стадия" value={stage} options={stages} onChange={setStage} />
            <Select label="Отдел" value={department} options={departments} onChange={setDepartment} />
            <Select label="Менеджер" value={manager} options={managers} onChange={setManager} />
          </section>

          <section className="rounded-xl border bg-card">
            {loading ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">Загрузка…</p>
            ) : filtered.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">Проектов не найдено.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-2.5 font-medium">Сделка</th>
                      <th className="px-5 py-2.5 font-medium">Стадия</th>
                      <th className="px-5 py-2.5 font-medium">Отдел</th>
                      <th className="px-5 py-2.5 font-medium">Менеджер</th>
                      <th className="px-5 py-2.5 font-medium">Сумма</th>
                      {showCost && <th className="px-5 py-2.5 font-medium">Себестоимость</th>}
                      {showCost && <th className="px-5 py-2.5 font-medium">Маржа</th>}
                      <th className="px-5 py-2.5 font-medium">Обновлено</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.bitrix_deal_id} className="border-b last:border-0">
                        <td className="px-5 py-2.5">
                          <span className="font-medium">{r.title ?? `Сделка №${r.bitrix_deal_id}`}</span>
                          <span className="ml-1 text-xs text-muted-foreground">#{r.bitrix_deal_id}</span>
                        </td>
                        <td className="px-5 py-2.5">{r.stage_name ?? r.stage_id ?? "—"}</td>
                        <td className="px-5 py-2.5 text-muted-foreground">{r.department ?? "—"}</td>
                        <td className="px-5 py-2.5 text-muted-foreground">{r.manager ?? "—"}</td>
                        <td className="px-5 py-2.5 tabular-nums">
                          {r.opportunity != null ? r.opportunity.toLocaleString("ru-RU") : "—"}
                        </td>
                        {showCost && (
                          <td className="px-5 py-2.5 tabular-nums">{formatMoney(r.cost)}</td>
                        )}
                        {showCost && (
                          <td className="px-5 py-2.5 tabular-nums">{formatMoney(r.margin)}</td>
                        )}
                        <td className="px-5 py-2.5 text-muted-foreground">
                          {r.last_event_at ? formatDateTime(r.last_event_at) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
