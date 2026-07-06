/**
 * Карта интеграций «простым языком»: кто что отдаёт и получает в экосистеме.
 *
 * ЖИВАЯ: строится из блоков `flows` манифестов приложений, зарегистрированных
 * в Hub (`GET /api/v1/apps/ui`, авторизованный запрос — тот же, что и сайдбар).
 * Направление берётся из `direction`: out = приложение → counterpart,
 * in = counterpart → приложение. Пока реестр недоступен/пуст — показываем
 * статичный базовый список (Bitrix↔Hub↔cost↔legal), чтобы карта не пустела.
 */
import { useEffect, useState } from "react";

import { getAppsUi, type AppUi } from "@/lib/hubApi";

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

export default function IntegrationMap() {
  const [apps, setApps] = useState<AppUi[] | null>(null);
  const [error, setError] = useState(false);

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
        <div className="border-b px-5 py-4">
          <h3 className="text-sm font-semibold">Потоки данных</h3>
        </div>
        <ul className="divide-y">
          {rows.map((f, i) => (
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
