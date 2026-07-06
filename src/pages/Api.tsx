import { useEffect, useState } from "react";

import { isSuperadmin } from "@/lib/auth";
import { getApps, type AppFull } from "@/lib/hubApi";
import { cn } from "@/lib/utils";

/**
 * «API» — живая матрица интеграций экосистемы: какие сквозные поля Bitrix
 * читает/пишет каждое приложение, какие события шины публикует/на какие
 * подписано, и какие права/действия у него есть по модулям. Источник данных —
 * `GET /api/v1/apps` (Hub, полный реестр манифестов). Эксклюзив суперадмина
 * (гейт дублируется на бэке — `_service_or_admin_or_super`).
 */

type FieldMode = "reads" | "writes" | "both";
type EventMode = "publishes" | "subscribes" | "both";

function buildFieldMatrix(apps: AppFull[]): { fields: string[]; cell: Map<string, FieldMode> } {
  const fields = new Set<string>();
  const cell = new Map<string, FieldMode>();
  for (const app of apps) {
    for (const f of app.reads_bitrix_fields ?? []) {
      fields.add(f);
      const key = `${f}::${app.app_id}`;
      const prev = cell.get(key);
      cell.set(key, prev === "writes" ? "both" : "reads");
    }
    for (const f of app.writes_bitrix_fields ?? []) {
      fields.add(f);
      const key = `${f}::${app.app_id}`;
      const prev = cell.get(key);
      cell.set(key, prev === "reads" ? "both" : "writes");
    }
  }
  return { fields: [...fields].sort(), cell };
}

function buildEventMatrix(apps: AppFull[]): { events: string[]; cell: Map<string, EventMode> } {
  const events = new Set<string>();
  const cell = new Map<string, EventMode>();
  for (const app of apps) {
    for (const e of app.publishes ?? []) {
      events.add(e);
      const key = `${e}::${app.app_id}`;
      const prev = cell.get(key);
      cell.set(key, prev === "subscribes" ? "both" : "publishes");
    }
    for (const e of app.subscribes_to ?? []) {
      events.add(e);
      const key = `${e}::${app.app_id}`;
      const prev = cell.get(key);
      cell.set(key, prev === "publishes" ? "both" : "subscribes");
    }
  }
  return { events: [...events].sort(), cell };
}

const FIELD_LABEL: Record<FieldMode, string> = { reads: "читает", writes: "пишет", both: "читает+пишет" };
const FIELD_CLASS: Record<FieldMode, string> = {
  reads: "bg-blue-50 text-blue-700",
  writes: "bg-amber-50 text-amber-700",
  both: "bg-violet-50 text-violet-700",
};
const EVENT_LABEL: Record<EventMode, string> = {
  publishes: "публикует",
  subscribes: "подписан",
  both: "публикует+подписан",
};
const EVENT_CLASS: Record<EventMode, string> = {
  publishes: "bg-emerald-50 text-emerald-700",
  subscribes: "bg-slate-100 text-slate-700",
  both: "bg-violet-50 text-violet-700",
};

/** Модуль прав, привязанный к конкретному приложению (для таблицы «Права»). */
interface ModuleRow {
  key: string;
  label: string;
  appId: string;
  actions: string[];
}

function buildModuleRows(apps: AppFull[]): ModuleRow[] {
  const rows: ModuleRow[] = [];
  for (const app of apps) {
    for (const m of app.permissions?.modules ?? []) {
      rows.push({
        key: `${app.app_id}.${m.id}`,
        label: m.label ?? m.id,
        appId: app.app_id,
        actions: m.actions ?? [],
      });
    }
  }
  return rows;
}

const ACTION_LABEL: Record<string, string> = {
  view: "смотреть",
  add: "добавлять",
  edit: "менять",
  delete: "удалять",
};

function ScrollTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-max border-collapse text-sm">{children}</table>
    </div>
  );
}

const TH = "sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-muted-foreground";
const TH_COL = "px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap border-l";
const TD = "sticky left-0 z-10 bg-card px-3 py-2 font-medium";
const TD_COL = "px-3 py-2 border-l text-center";

export default function Api() {
  const [apps, setApps] = useState<AppFull[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperadmin()) return;
    let cancelled = false;
    getApps()
      .then((page) => {
        if (!cancelled) setApps(page.items);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить реестр приложений из Hub");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isSuperadmin()) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">API</h1>
        </header>
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Доступ только для суперадмина.
        </p>
      </div>
    );
  }

  const appList = apps ?? [];
  const { fields, cell: fieldCell } = buildFieldMatrix(appList);
  const { events, cell: eventCell } = buildEventMatrix(appList);
  const moduleRows = buildModuleRows(appList);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">API</h1>
        <p className="text-muted-foreground">
          Живая матрица интеграций: сквозные поля Bitrix, события шины и права по каждому
          зарегистрированному в Hub приложению.
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!error && apps === null && (
        <p className="text-sm text-muted-foreground">Загрузка реестра приложений…</p>
      )}

      {!error && apps !== null && appList.length === 0 && (
        <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          В реестре Hub пока нет ни одного приложения.
        </p>
      )}

      {appList.length > 0 && (
        <>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Сквозные поля Bitrix</h2>
            <p className="text-xs text-muted-foreground">
              Строки — поля <code>UF_CRM_*</code>, столбцы — приложения. Ячейка — что приложение
              делает с полем.
            </p>
            <ScrollTable>
              <thead>
                <tr className="border-b">
                  <th className={TH}>Поле</th>
                  {appList.map((a) => (
                    <th key={a.app_id} className={TH_COL}>
                      {a.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.length === 0 ? (
                  <tr>
                    <td className={TD} colSpan={appList.length + 1}>
                      Ни одно приложение не объявило сквозных полей Bitrix.
                    </td>
                  </tr>
                ) : (
                  fields.map((field) => (
                    <tr key={field} className="border-b last:border-0">
                      <td className={cn(TD, "font-mono text-xs")}>{field}</td>
                      {appList.map((a) => {
                        const mode = fieldCell.get(`${field}::${a.app_id}`);
                        return (
                          <td key={a.app_id} className={TD_COL}>
                            {mode && (
                              <span
                                className={cn(
                                  "rounded px-2 py-0.5 text-xs font-medium",
                                  FIELD_CLASS[mode],
                                )}
                              >
                                {FIELD_LABEL[mode]}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </ScrollTable>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">События шины</h2>
            <p className="text-xs text-muted-foreground">
              Строки — события <code>hub.events</code>, столбцы — приложения. Ячейка — публикует
              приложение это событие или подписано на него.
            </p>
            <ScrollTable>
              <thead>
                <tr className="border-b">
                  <th className={TH}>Событие</th>
                  {appList.map((a) => (
                    <th key={a.app_id} className={TH_COL}>
                      {a.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td className={TD} colSpan={appList.length + 1}>
                      Ни одно приложение не публикует и не подписано ни на одно событие.
                    </td>
                  </tr>
                ) : (
                  events.map((event) => (
                    <tr key={event} className="border-b last:border-0">
                      <td className={cn(TD, "font-mono text-xs")}>{event}</td>
                      {appList.map((a) => {
                        const mode = eventCell.get(`${event}::${a.app_id}`);
                        return (
                          <td key={a.app_id} className={TD_COL}>
                            {mode && (
                              <span
                                className={cn(
                                  "rounded px-2 py-0.5 text-xs font-medium",
                                  EVENT_CLASS[mode],
                                )}
                              >
                                {EVENT_LABEL[mode]}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </ScrollTable>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Права и действия</h2>
            <p className="text-xs text-muted-foreground">
              Модули прав каждого приложения (блок <code>permissions</code> манифеста) и доступные
              над ними действия — что можно смотреть/добавлять/менять/удалять.
            </p>
            <ScrollTable>
              <thead>
                <tr className="border-b">
                  <th className={TH}>Модуль</th>
                  <th className={TH_COL}>Приложение</th>
                  <th className={TH_COL}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {moduleRows.length === 0 ? (
                  <tr>
                    <td className={TD} colSpan={3}>
                      Ни одно приложение не объявило модулей прав.
                    </td>
                  </tr>
                ) : (
                  moduleRows.map((row) => (
                    <tr key={row.key} className="border-b last:border-0">
                      <td className={TD}>{row.label}</td>
                      <td className={cn(TD_COL, "text-left")}>
                        {appList.find((a) => a.app_id === row.appId)?.name ?? row.appId}
                      </td>
                      <td className={cn(TD_COL, "text-left")}>
                        <div className="flex flex-wrap gap-1">
                          {row.actions.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            row.actions.map((action) => (
                              <span
                                key={action}
                                className="rounded bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-700"
                              >
                                {ACTION_LABEL[action] ?? action}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </ScrollTable>
          </section>
        </>
      )}
    </div>
  );
}
