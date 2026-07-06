/**
 * Карта интеграций «простым языком»: кто что отдаёт и получает в экосистеме.
 *
 * ЖИВАЯ: строится из блоков `flows` манифестов приложений, зарегистрированных
 * в Hub (`GET /api/v1/apps/ui`). Сверху — СХЕМА (SVG, узлы и стрелки), понятная
 * без чтения списка; клик по узлу или стрелке фильтрует подробный список ниже.
 * Свободный текст counterpart из манифестов нормализуется к каноническим узлам
 * («Смета (cost)» и «Себестоимость и КП» — один узел); незнакомые контрагенты
 * добавляются отдельными узлами, схема не ломается.
 */
import { useEffect, useMemo, useState } from "react";

import { getAppsUi, type AppUi } from "@/lib/hubApi";
import { cn } from "@/lib/utils";

interface FlowRow {
  from: string;
  to: string;
  what: string;
}

/** Базовые потоки ядра (Bitrix/Hub) — их манифесты приложений не описывают. */
const CORE_FLOWS: FlowRow[] = [
  { from: "Bitrix24", to: "Hub", what: "создание и смена стадии сделки, оплаты" },
  { from: "Hub", to: "Bitrix24", what: "запись результатов в поля сделки (цена, готовность)" },
  { from: "Hub", to: "Кабинет генерального", what: "журнал событий для дашборда и проектов" },
];

/** Статичный запасной список — на случай недоступного Hub (прежнее поведение). */
const FALLBACK_FLOWS: FlowRow[] = [
  ...CORE_FLOWS,
  { from: "Себестоимость", to: "Hub", what: "заявка на ПДП, одобрение КП" },
  { from: "Hub", to: "Юр-блок", what: "сигнал «чек-лист ОП заполнен» по сделке" },
];

/** Развернуть flows приложений из реестра в строки карты. */
function flowsFromRegistry(apps: AppUi[]): FlowRow[] {
  const rows: FlowRow[] = [];
  for (const app of apps) {
    const appName = app.ui?.title ?? app.name;
    for (const f of app.flows ?? []) {
      const counterpart = f.counterpart ?? "—";
      const what = f.what ?? f.tech ?? "";
      if (f.direction === "in") {
        rows.push({ from: counterpart, to: appName, what });
      } else {
        rows.push({ from: appName, to: counterpart, what });
      }
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Схема: канонические узлы и нормализация свободного текста counterpart.
// ---------------------------------------------------------------------------

type NodeKind = "external" | "core" | "app" | "future";

interface DiagramNode {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: NodeKind;
}

const NODE_W = 190;
const NODE_H = 48;
const RIGHT_COL_X = 690;

/** Фиксированная раскладка известных узлов (hub-and-spoke, слева направо). */
const KNOWN_NODES: Omit<DiagramNode, "w" | "h">[] = [
  { id: "bitrix", label: "Bitrix24", x: 40, y: 262, kind: "external" },
  { id: "hub", label: "Hub", x: 340, y: 262, kind: "core" },
  { id: "cabinet", label: "Кабинет генерального", x: 340, y: 48, kind: "core" },
  { id: "cost", label: "Себестоимость и КП", x: RIGHT_COL_X, y: 36, kind: "app" },
  { id: "legal", label: "Юридический отдел", x: RIGHT_COL_X, y: 148, kind: "app" },
  { id: "team_cabinet", label: "Кабинет бригадира", x: RIGHT_COL_X, y: 262, kind: "app" },
  { id: "purchases", label: "Закупки", x: RIGHT_COL_X, y: 376, kind: "app" },
  { id: "warehouse", label: "Склад (в будущем)", x: RIGHT_COL_X, y: 488, kind: "future" },
];

/** Свободный текст из манифестов → id канонического узла (или null → новый узел). */
function normalizeNode(raw: string): string | null {
  const s = raw.toLowerCase();
  if (s.includes("bitrix") || s.includes("битрикс")) return "bitrix";
  if (s === "hub" || s.includes("хаб")) return "hub";
  if (s.includes("генеральн") || s.includes("gantt") || s.includes("гант")) return "cabinet";
  if (s.includes("смета") || s.includes("себестоимость") || s.includes("cost")) return "cost";
  if (s.includes("юр") || s.includes("legal")) return "legal";
  if (s.includes("бригад") || s.includes("team")) return "team_cabinet";
  if (s.includes("закуп") || s.includes("purchas")) return "purchases";
  if (s.includes("склад") || s.includes("warehouse")) return "warehouse";
  return null;
}

interface DiagramEdge {
  key: string;
  fromId: string;
  toId: string;
  flows: FlowRow[];
}

/** Точка на кубической кривой Безье при t. */
function bezierPoint(
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
): [number, number] {
  const u = 1 - t;
  const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
  const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
  return [x, y];
}

/** Геометрия стрелки между узлами: путь + точка для бейджа с числом потоков. */
function edgeGeometry(
  from: DiagramNode,
  to: DiagramNode,
  hasReverse: boolean,
  isReverse: boolean,
): { d: string; mid: [number, number] } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const off = hasReverse ? (isReverse ? 9 : -9) : 0;

  // Одна колонка (правый столбец приложений): дуга сбоку от колонки.
  if (Math.abs(dx) < 10) {
    const far = Math.abs(dy) > 160;
    if (far) {
      // Дальняя пара (напр. Себестоимость ↔ Закупки) — дуга справа от колонки.
      const bow = isReverse ? 78 : 46;
      const p0: [number, number] = [from.x + from.w, from.y + from.h / 2];
      const p3: [number, number] = [to.x + to.w, to.y + to.h / 2];
      const cx = from.x + from.w + bow;
      const p1: [number, number] = [cx, p0[1]];
      const p2: [number, number] = [cx, p3[1]];
      return {
        d: `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`,
        mid: bezierPoint(0.5, p0, p1, p2, p3),
      };
    }
    // Соседи по колонке — короткая дуга слева.
    const bow = isReverse ? 84 : 54;
    const p0: [number, number] = [from.x, from.y + from.h / 2];
    const p3: [number, number] = [to.x, to.y + to.h / 2];
    const cx = from.x - bow;
    const p1: [number, number] = [cx, p0[1]];
    const p2: [number, number] = [cx, p3[1]];
    return {
      d: `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`,
      mid: bezierPoint(0.5, p0, p1, p2, p3),
    };
  }

  // Одна строка (Bitrix ↔ Hub): почти прямая, парные — с вертикальным сдвигом.
  if (Math.abs(dy) < 10) {
    const leftToRight = dx > 0;
    const p0: [number, number] = leftToRight
      ? [from.x + from.w, from.y + from.h / 2 + off]
      : [from.x, from.y + from.h / 2 + off];
    const p3: [number, number] = leftToRight
      ? [to.x, to.y + to.h / 2 + off]
      : [to.x + to.w, to.y + to.h / 2 + off];
    return {
      d: `M ${p0[0]} ${p0[1]} L ${p3[0]} ${p3[1]}`,
      mid: [(p0[0] + p3[0]) / 2, p0[1]],
    };
  }

  // Одна колонка по x у пары hub/cabinet: вертикальная стрелка.
  if (Math.abs(dx) < NODE_W && Math.abs(dy) > 100 && from.x === to.x) {
    const goingUp = dy < 0;
    const p0: [number, number] = [
      from.x + from.w / 2 + off,
      goingUp ? from.y : from.y + from.h,
    ];
    const p3: [number, number] = [to.x + to.w / 2 + off, goingUp ? to.y + to.h : to.y];
    return {
      d: `M ${p0[0]} ${p0[1]} L ${p3[0]} ${p3[1]}`,
      mid: [p0[0], (p0[1] + p3[1]) / 2],
    };
  }

  // Общий случай: плавная кривая от края к краю.
  const leftToRight = dx > 0;
  const p0: [number, number] = leftToRight
    ? [from.x + from.w, from.y + from.h / 2 + off]
    : [from.x, from.y + from.h / 2 + off];
  const p3: [number, number] = leftToRight
    ? [to.x, to.y + to.h / 2 + off]
    : [to.x + to.w, to.y + to.h / 2 + off];
  const mx = (p0[0] + p3[0]) / 2;
  const p1: [number, number] = [mx, p0[1]];
  const p2: [number, number] = [mx, p3[1]];
  return {
    d: `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`,
    mid: bezierPoint(0.5, p0, p1, p2, p3),
  };
}

const NODE_STYLES: Record<NodeKind, { rect: string; text: string; dash?: string }> = {
  external: { rect: "fill-slate-100 stroke-slate-300", text: "fill-slate-700" },
  core: { rect: "fill-blue-50 stroke-blue-200", text: "fill-blue-900" },
  app: { rect: "fill-white stroke-slate-300", text: "fill-slate-800" },
  future: { rect: "fill-slate-50 stroke-slate-300", text: "fill-slate-400", dash: "6 4" },
};

type Selection = { type: "node"; id: string } | { type: "edge"; key: string } | null;

export default function IntegrationMap() {
  const [apps, setApps] = useState<AppUi[] | null>(null);
  const [error, setError] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);

  useEffect(() => {
    let cancelled = false;
    getAppsUi()
      .then((page) => {
        if (!cancelled) setApps(page.items);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const registryRows = apps ? flowsFromRegistry(apps) : [];
  const live = registryRows.length > 0;
  const rows = live ? [...CORE_FLOWS, ...registryRows] : FALLBACK_FLOWS;

  // Узлы и агрегированные стрелки схемы (незнакомые контрагенты — доп. узлы снизу).
  const { nodes, edges, rowEdgeKey } = useMemo(() => {
    const nodeMap = new Map<string, DiagramNode>();
    for (const n of KNOWN_NODES) nodeMap.set(n.id, { ...n, w: NODE_W, h: NODE_H });

    let extraY = 488 + 112;
    const idOf = (raw: string): string => {
      const known = normalizeNode(raw);
      if (known) return known;
      const dynId = `x_${raw}`;
      if (!nodeMap.has(dynId)) {
        nodeMap.set(dynId, {
          id: dynId,
          label: raw,
          x: RIGHT_COL_X,
          y: extraY,
          w: NODE_W,
          h: NODE_H,
          kind: "future",
        });
        extraY += 112;
      }
      return dynId;
    };

    const edgeMap = new Map<string, DiagramEdge>();
    const rowEdgeKey: string[] = [];
    for (const r of rows) {
      const fromId = idOf(r.from);
      const toId = idOf(r.to);
      const key = `${fromId}->${toId}`;
      rowEdgeKey.push(key);
      const e = edgeMap.get(key);
      if (e) e.flows.push(r);
      else edgeMap.set(key, { key, fromId, toId, flows: [r] });
    }
    return { nodes: [...nodeMap.values()], edges: [...edgeMap.values()], rowEdgeKey };
  }, [rows]);

  const viewH = Math.max(576, ...nodes.map((n) => n.y + n.h + 40));

  const edgeSelected = (e: DiagramEdge): boolean => {
    if (!selection) return false;
    if (selection.type === "edge") return selection.key === e.key;
    return e.fromId === selection.id || e.toId === selection.id;
  };
  const nodeSelected = (n: DiagramNode): boolean => {
    if (!selection) return false;
    if (selection.type === "node") return selection.id === n.id;
    const e = edges.find((x) => x.key === selection.key);
    return !!e && (e.fromId === n.id || e.toId === n.id);
  };

  // Подробный список ниже фильтруется по выбранному узлу/стрелке.
  const visibleRows = rows.filter((_, i) => {
    if (!selection) return true;
    const key = rowEdgeKey[i] ?? "";
    if (selection.type === "edge") return key === selection.key;
    return key.startsWith(`${selection.id}->`) || key.endsWith(`->${selection.id}`);
  });

  const selectionLabel = (): string | null => {
    if (!selection) return null;
    if (selection.type === "node") {
      return nodes.find((n) => n.id === selection.id)?.label ?? null;
    }
    const e = edges.find((x) => x.key === selection.key);
    if (!e) return null;
    const name = (id: string) => nodes.find((n) => n.id === id)?.label ?? id;
    return `${name(e.fromId)} → ${name(e.toId)}`;
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Карта интеграций</h1>
        <p className="text-sm text-muted-foreground">
          Кто что отдаёт и получает в экосистеме «Строители»
          {live
            ? " — по живому реестру Hub"
            : error
              ? " — реестр Hub недоступен, показан базовый список"
              : ""}
        </p>
      </header>

      <section className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
          <h3 className="text-sm font-semibold">Схема</h3>
          <p className="text-xs text-muted-foreground">
            Клик по блоку или стрелке — подробности ниже; число на стрелке — сколько потоков
          </p>
        </div>
        <div className="overflow-x-auto p-4">
          <svg
            viewBox={`0 0 940 ${viewH}`}
            className="mx-auto block h-auto w-full min-w-[820px] max-w-[1040px]"
            role="img"
            aria-label="Схема потоков данных экосистемы"
          >
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" className="fill-slate-400" />
              </marker>
              <marker
                id="arrow-active"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" className="fill-blue-600" />
              </marker>
            </defs>

            {/* Стрелки — под узлами */}
            {edges.map((e) => {
              const from = nodes.find((n) => n.id === e.fromId)!;
              const to = nodes.find((n) => n.id === e.toId)!;
              const hasReverse = edges.some(
                (x) => x.fromId === e.toId && x.toId === e.fromId,
              );
              const isReverse = hasReverse && e.fromId > e.toId;
              const { d, mid } = edgeGeometry(from, to, hasReverse, isReverse);
              const active = edgeSelected(e);
              return (
                <g
                  key={e.key}
                  className="cursor-pointer"
                  onClick={() =>
                    setSelection((s) =>
                      s?.type === "edge" && s.key === e.key ? null : { type: "edge", key: e.key },
                    )
                  }
                >
                  {/* невидимая широкая подложка — чтобы по стрелке было легко попасть */}
                  <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
                  <path
                    d={d}
                    fill="none"
                    strokeWidth={active ? 2.4 : 1.5}
                    markerEnd={active ? "url(#arrow-active)" : "url(#arrow)"}
                    className={cn(
                      "transition-colors",
                      active ? "stroke-blue-600" : "stroke-slate-300",
                      selection && !active && "opacity-40",
                    )}
                  />
                  {e.flows.length > 1 && (
                    <g>
                      <circle
                        cx={mid[0]}
                        cy={mid[1]}
                        r={9}
                        className={cn(
                          "stroke-1",
                          active
                            ? "fill-blue-600 stroke-blue-600"
                            : "fill-white stroke-slate-300",
                          selection && !active && "opacity-40",
                        )}
                      />
                      <text
                        x={mid[0]}
                        y={mid[1] + 3.5}
                        textAnchor="middle"
                        className={cn(
                          "text-[10px] font-semibold",
                          active ? "fill-white" : "fill-slate-500",
                        )}
                      >
                        {e.flows.length}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Узлы */}
            {nodes.map((n) => {
              const st = NODE_STYLES[n.kind];
              const active = nodeSelected(n);
              return (
                <g
                  key={n.id}
                  className="cursor-pointer"
                  onClick={() =>
                    setSelection((s) =>
                      s?.type === "node" && s.id === n.id ? null : { type: "node", id: n.id },
                    )
                  }
                >
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.w}
                    height={n.h}
                    rx={10}
                    strokeDasharray={st.dash}
                    strokeWidth={active ? 2.2 : 1.2}
                    className={cn(
                      "transition-colors",
                      st.rect,
                      active && "stroke-blue-600",
                      selection && !active && "opacity-50",
                    )}
                  />
                  <text
                    x={n.x + n.w / 2}
                    y={n.y + n.h / 2 + 4.5}
                    textAnchor="middle"
                    className={cn("text-[13px] font-medium", st.text)}
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t px-5 py-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded border border-slate-300 bg-slate-100" />
            внешняя система
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded border border-blue-200 bg-blue-50" />
            ядро (Hub, Кабинет)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded border border-slate-300 bg-white" />
            приложение
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded border border-dashed border-slate-300 bg-slate-50" />
            планируется
          </span>
        </div>
      </section>

      <section className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
          <h3 className="text-sm font-semibold">
            {selection ? `Потоки: ${selectionLabel()}` : "Все потоки данных"}
          </h3>
          {selection && (
            <button
              type="button"
              onClick={() => setSelection(null)}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Сбросить фильтр
            </button>
          )}
        </div>
        <ul className="divide-y">
          {visibleRows.map((f, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
              <span className="rounded-md bg-muted px-2 py-0.5 font-medium">{f.from}</span>
              <span className="text-muted-foreground">→</span>
              <span className="rounded-md bg-muted px-2 py-0.5 font-medium">{f.to}</span>
              <span className="text-muted-foreground">{f.what}</span>
            </li>
          ))}
        </ul>
      </section>

      {apps !== null && apps.length > 0 && (
        <section className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Приложения в реестре Hub</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {apps.map((a) => (
              <span
                key={a.app_id}
                className="rounded-md border px-2.5 py-1 text-sm text-muted-foreground"
              >
                {a.ui?.title ?? a.name}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
