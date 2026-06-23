import { useEffect, useState } from "react";

import AppCard from "@/components/AppCard";
import { APPS, mergeWithHub, type AppTile } from "@/lib/apps";

/**
 * Главная страница портала — «Кабинет руководителя».
 *
 * Показывает сетку плиток всех модулей экосистемы «Строители».
 * На маунте best-effort пытается обогатить статусы/имена данными из Hub
 * (GET ${VITE_HUB_URL}/api/v1/apps). Если Hub недоступен или вернул ошибку —
 * молча используем локальный справочник: портал работает и без Hub.
 */
export default function Dashboard() {
  const [apps, setApps] = useState<AppTile[]>(APPS);

  useEffect(() => {
    const controller = new AbortController();

    async function enrichFromHub() {
      try {
        const base = import.meta.env.VITE_HUB_URL ?? "http://localhost:8000";
        const res = await fetch(`${base}/api/v1/apps`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return; // 401 / 404 / 5xx — тихо игнорируем
        const data: unknown = await res.json();
        setApps(mergeWithHub(APPS, data));
      } catch {
        // Hub недоступен / CORS / abort — остаёмся на локальном конфиге
      }
    }

    void enrichFromHub();
    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Приложения экосистемы</h1>
        <p className="text-sm text-muted-foreground">Все модули «Строителей»</p>
      </header>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {apps.map((app) => (
          <AppCard key={app.app_id} app={app} />
        ))}
      </section>

      <footer className="border-t pt-6">
        <p className="text-center text-xs text-muted-foreground">
          Список модулей растёт по мере подключения приложений к Хабу.
        </p>
      </footer>
    </div>
  );
}
