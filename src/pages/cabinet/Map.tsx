/**
 * Карта интеграций «простым языком»: кто что отдаёт и получает в экосистеме.
 * Полная интерактивная карта (ReactFlow) переносится из stroiteli-schema
 * отдельным шагом. Пока — текстовая карта связок по живому реестру Hub.
 */
import { useEffect, useState } from "react";

const FLOWS: Array<{ from: string; to: string; what: string }> = [
  { from: "Bitrix24", to: "Hub", what: "создание и смена стадии сделки, оплаты" },
  { from: "Себестоимость", to: "Hub", what: "заявка на ПДП, одобрение КП" },
  { from: "Hub", to: "Юр-блок", what: "сигнал «чек-лист ОП заполнен» по сделке" },
  { from: "Hub", to: "Bitrix24", what: "запись результатов в поля сделки (цена, готовность)" },
  { from: "Hub", to: "Кабинет генерального", what: "журнал событий для дашборда и проектов" },
];

export default function IntegrationMap() {
  const [apps, setApps] = useState<string[]>([]);

  useEffect(() => {
    const base = import.meta.env.VITE_HUB_URL ?? "http://localhost:8000";
    fetch(`${base}/api/v1/apps`, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: unknown) => {
        const data = (body as { data?: { items?: Array<{ name?: string }> } } | null)?.data;
        const names = (data?.items ?? [])
          .map((a) => a.name)
          .filter((n): n is string => !!n);
        if (names.length) setApps(names);
      })
      .catch(() => {
        /* реестр недоступен — карта связок ниже всё равно полезна */
      });
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Карта интеграций</h1>
        <p className="text-sm text-muted-foreground">
          Кто что отдаёт и получает в экосистеме «Строители»
        </p>
      </header>

      <section className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h3 className="text-sm font-semibold">Потоки данных</h3>
        </div>
        <ul className="divide-y">
          {FLOWS.map((f, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
              <span className="rounded-md bg-muted px-2 py-0.5 font-medium">{f.from}</span>
              <span className="text-muted-foreground">→</span>
              <span className="rounded-md bg-muted px-2 py-0.5 font-medium">{f.to}</span>
              <span className="text-muted-foreground">{f.what}</span>
            </li>
          ))}
        </ul>
      </section>

      {apps.length > 0 && (
        <section className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Приложения в реестре Hub</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {apps.map((a) => (
              <span key={a} className="rounded-md border px-2.5 py-1 text-sm text-muted-foreground">
                {a}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
