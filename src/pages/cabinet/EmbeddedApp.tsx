import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { getToken } from "@/lib/auth";
import { getAppsUi, type AppUi } from "@/lib/hubApi";

/**
 * Встроенное приложение экосистемы (iframe). Используется для калькулятора cost:
 * Кабинет открывает фронт cost внутри себя и ПЕРЕДАЁТ ему текущий Hub-JWT через
 * postMessage (cost сам токен не хранит). Себестоимость видна только из Кабинета.
 */
export default function EmbeddedApp() {
  const { appId } = useParams<{ appId: string }>();
  const [apps, setApps] = useState<AppUi[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAppsUi()
      .then((page) => {
        if (!cancelled) setApps(page.items);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить реестр приложений");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const app = useMemo(() => apps?.find((a) => a.app_id === appId) ?? null, [apps, appId]);

  const src = useMemo(() => {
    if (!app?.ui?.ui_url) return null;
    const base = app.ui.ui_url.replace(/\/$/, "");
    const route = app.ui.route ?? "/";
    const sep = route.includes("?") ? "&" : "?";
    return `${base}${route}${sep}embed=1`;
  }, [app]);

  const childOrigin = useMemo(() => {
    if (!app?.ui?.ui_url) return null;
    try {
      return new URL(app.ui.ui_url).origin;
    } catch {
      return null;
    }
  }, [app]);

  // Отвечаем встроенному приложению текущим Hub-JWT по запросу (`${appId}:need-token`).
  // Префикс — сам app_id встроенного приложения, не захардкожен под конкретное ПО:
  // так работает и для cost ("cost:need-token"/"cost:token"), и для любого другого
  // приложения с "embed": "iframe" в манифесте (team_cabinet, purchases и т.д.).
  useEffect(() => {
    if (!childOrigin || !appId) return;
    const needTokenType = `${appId}:need-token`;
    const tokenType = `${appId}:token`;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== childOrigin) return; // только наш фрейм
      const data = event.data as { type?: string } | null;
      if (data?.type === needTokenType) {
        const token = getToken();
        iframeRef.current?.contentWindow?.postMessage(
          { type: tokenType, token: token ?? "" },
          childOrigin,
        );
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [childOrigin, appId]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }
  if (apps && !app) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Приложение не найдено в реестре или у него нет встраиваемого интерфейса.
      </div>
    );
  }
  if (!src) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <iframe
        ref={iframeRef}
        src={src}
        title={app?.ui?.title ?? app?.name ?? "Приложение"}
        className="h-full w-full rounded-xl border bg-card"
      />
    </div>
  );
}
