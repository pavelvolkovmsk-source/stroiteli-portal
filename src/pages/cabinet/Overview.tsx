import { useEffect, useMemo, useState } from "react";

import { decodeToken } from "@/lib/auth";
import {
  getCostSummary,
  getEvents,
  getEventsSummary,
  HubError,
  type CostSummary,
  type EventItem,
  type EventsSummary,
  type StatusBreakdownItem,
} from "@/lib/hubApi";
import { eventTypeLabel, formatDateTime, formatMoney, sourceLabel } from "./labels";

type Period = "7" | "30" | "all";

// Себестоимость — бизнес-тайна: только суперадмин/генеральный (НЕ обычный admin).
function canSeeCost(): boolean {
  const p = decodeToken();
  return Boolean(p?.is_superadmin) || (p?.roles ?? []).includes("general");
}

// KPI «план и факт»: Факт = оплачено+реализовано; План (в работе) = черновик+выставлен.
const FACT_STATUSES = ["paid", "received"];
const PLAN_STATUSES = ["draft", "sent_to_pay"];

interface Bucket {
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number | null;
  count: number;
}

function sumBuckets(items: StatusBreakdownItem[], statuses: string[]): Bucket {
  let revenue = 0;
  let cost = 0;
  let count = 0;
  for (const it of items) {
    if (!statuses.includes(it.status)) continue;
    revenue += Number(it.revenue);
    cost += Number(it.cost);
    count += it.orders_count;
  }
  const margin = revenue - cost;
  return {
    revenue,
    cost,
    margin,
    marginPct: revenue > 0 ? (margin / revenue) * 100 : null,
    count,
  };
}

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: "7", label: "7 дней" },
  { key: "30", label: "30 дней" },
  { key: "all", label: "Всё время" },
];

/** ISO-дата начала периода (или undefined для «всё время»). */
function startDateFor(period: Period): string | undefined {
  if (period === "all") return undefined;
  const d = new Date();
  d.setDate(d.getDate() - Number(period));
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function KpiCard({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function BarList({
  title,
  rows,
  labelOf,
}: {
  title: string;
  rows: Array<{ key: string; count: number }>;
  labelOf: (k: string) => string;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-4 space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Нет данных</p>}
        {rows.map((r) => (
          <div key={r.key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm">{labelOf(r.key)}</span>
              <span className="text-sm font-semibold tabular-nums">{r.count}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.round((r.count / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Дашборд кабинета генерального: сводка по событиям всей экосистемы
 * (журнал шины Hub) с фильтром периода. KPI, разбивки и лента последних событий.
 */
export default function Overview() {
  const [period, setPeriod] = useState<Period>("30");
  const [summary, setSummary] = useState<EventsSummary | null>(null);
  const [recent, setRecent] = useState<EventItem[]>([]);
  const [cost, setCost] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showCost = useMemo(() => canSeeCost(), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const start_date = startDateFor(period);
    // Себестоимость — best-effort: 503/нет доступа НЕ роняют дашборд событий.
    const costReq = showCost
      ? getCostSummary({ start_date, timeline: true }).catch(() => null)
      : Promise.resolve(null);
    Promise.all([
      getEventsSummary({ start_date }),
      getEvents({ start_date, limit: 20 }),
      costReq,
    ])
      .then(([sum, page, costSum]) => {
        if (cancelled) return;
        setSummary(sum);
        setRecent(page.items);
        setCost(costSum);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg =
          e instanceof HubError
            ? e.status === 401 || e.status === 403
              ? "Нет доступа. Войдите под учётной записью генерального."
              : e.message
            : "Не удалось загрузить данные дашборда";
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [period]);

  const byType = useMemo(
    () => (summary?.by_event_type ?? []).map((r) => ({ key: r.event_type, count: r.count })),
    [summary],
  );
  const bySource = useMemo(
    () => (summary?.by_source ?? []).map((r) => ({ key: r.source, count: r.count })),
    [summary],
  );
  const fact = useMemo(() => (cost ? sumBuckets(cost.by_status, FACT_STATUSES) : null), [cost]);
  const plan = useMemo(() => (cost ? sumBuckets(cost.by_status, PLAN_STATUSES) : null), [cost]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Дашборд</h1>
          <p className="text-sm text-muted-foreground">
            Сводка по событиям всей экосистемы «Строители»
          </p>
        </div>
        <div className="inline-flex rounded-lg border bg-card p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                (period === p.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !summary && (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      )}

      {showCost && cost && fact && plan && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Факт (оплачено и реализовано)</h2>
            <div className="mt-2 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard title="Выручка" value={`${formatMoney(fact.revenue)} ₽`} />
              <KpiCard title="Себестоимость" value={`${formatMoney(fact.cost)} ₽`} />
              <KpiCard title="Маржа" value={`${formatMoney(fact.margin)} ₽`} />
              <KpiCard
                title="Маржа, %"
                value={fact.marginPct != null ? `${fact.marginPct.toFixed(1)}%` : "—"}
                hint={`${fact.count} заказ(ов)`}
              />
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground">
              План (в работе: черновики и выставленные)
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KpiCard title="Выручка" value={`${formatMoney(plan.revenue)} ₽`} />
              <KpiCard title="Себестоимость" value={`${formatMoney(plan.cost)} ₽`} />
              <KpiCard title="Маржа" value={`${formatMoney(plan.margin)} ₽`} />
              <KpiCard
                title="Маржа, %"
                value={plan.marginPct != null ? `${plan.marginPct.toFixed(1)}%` : "—"}
                hint={`${plan.count} заказ(ов)`}
              />
            </div>
          </div>
        </section>
      )}

      {summary && (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard title="Всего событий" value={summary.total} hint="за выбранный период" />
            <KpiCard title="Типов событий" value={summary.by_event_type.length} />
            <KpiCard title="Источников" value={summary.by_source.length} />
            <KpiCard
              title="Активных дней"
              value={summary.timeline.length}
              hint="дней с событиями"
            />
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BarList title="По типам событий" rows={byType} labelOf={eventTypeLabel} />
            <BarList title="По источникам" rows={bySource} labelOf={sourceLabel} />
          </section>

          <section className="rounded-xl border bg-card">
            <div className="border-b px-5 py-4">
              <h3 className="text-sm font-semibold">Последние события</h3>
            </div>
            {recent.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                За выбранный период событий нет.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-2.5 font-medium">Событие</th>
                      <th className="px-5 py-2.5 font-medium">Источник</th>
                      <th className="px-5 py-2.5 font-medium">Сделка</th>
                      <th className="px-5 py-2.5 font-medium">Когда</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((ev) => (
                      <tr key={ev.event_id} className="border-b last:border-0">
                        <td className="px-5 py-2.5">{eventTypeLabel(ev.event_type)}</td>
                        <td className="px-5 py-2.5 text-muted-foreground">
                          {sourceLabel(ev.source)}
                        </td>
                        <td className="px-5 py-2.5 tabular-nums text-muted-foreground">
                          {(ev.payload?.bitrix_deal_id as number | undefined) ?? "—"}
                        </td>
                        <td className="px-5 py-2.5 text-muted-foreground">
                          {formatDateTime(ev.created_at)}
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
