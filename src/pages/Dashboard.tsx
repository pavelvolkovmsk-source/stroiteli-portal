import { useEffect, useState } from "react";

import AppCard from "@/components/AppCard";
import { APPS, mergeWithHub, type AppTile } from "@/lib/apps";
import { getAppsUi } from "@/lib/hubApi";

/**
 * Главная страница портала — «Кабинет руководителя».
 *
 * Показывает сетку плиток всех модулей экосистемы «Строители».
 * На маунте best-effort пытается обогатить статусы/ui_url/embed данными из Hub
 * (авторизованный `getAppsUi()` — та же функция, что уже использует сайдбар для
 * встраиваемых вкладок). Если Hub недоступен/токена нет — молча используем
 * локальный справочник: портал работает и без Hub.
 */
export default function Dashboard() {
  const [apps, setApps] = useState<AppTile[]>(APPS);

  useEffect(() => {
    let cancelled = false;
    getAppsUi()
      .then((page) => {
        if (!cancelled) setApps(mergeWithHub(APPS, page.items));
      })
      .catch(() => {
        // Hub недоступен / нет токена — остаёмся на локальном справочнике
      });
    return () => {
      cancelled = true;
    };
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
