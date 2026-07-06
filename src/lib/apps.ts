/**
 * Конфигурация приложений экосистемы «Строители» (hub-and-spoke вокруг Bitrix24).
 *
 * Это локальный «справочник по умолчанию»: портал обязан работать даже без
 * поднятого Hub. На маунте дашборд best-effort подмёрживает к этому списку
 * актуальные статусы/ui_url/embed из Hub (GET /api/v1/apps/ui, см. lib/hubApi.ts
 * getAppsUi — тот же авторизованный запрос, что уже использует сайдбар) по
 * app_id — см. mergeWithHub ниже.
 */

import type { AppUi } from "@/lib/hubApi";

/** Статус подключения модуля к экосистеме. */
export type AppStatus = "active" | "in_progress" | "planned";

/** Описание плитки приложения экосистемы. */
export interface AppTile {
  /** Машинный идентификатор приложения (ключ для мёржа с Hub). */
  app_id: string;
  /** Человекочитаемое название (на русском). */
  name: string;
  /** Краткое описание модуля (на русском). */
  description: string;
  /** Статус подключения. */
  status: AppStatus;
  /** Адрес интерфейса модуля; null — интерфейс ещё не подключён. */
  ui_url: string | null;
  /** Способ встраивания из манифеста ("iframe" — открыть внутри Кабинета,
   *  "external"/не задан — открыть в новой вкладке). */
  embed?: string;
  /** Эмодзи-иконка на плитку. */
  icon: string;
  /** Tailwind-классы акцентной плашки иконки. */
  accent: string;
}

/** Справочник приложений экосистемы по умолчанию. */
export const APPS: AppTile[] = [
  {
    app_id: "legal",
    name: "Юридический отдел",
    description: "Договоры, документы и сроки в наглядной диаграмме Ганта.",
    status: "active",
    ui_url: "http://localhost:5173/gantt",
    icon: "⚖️",
    accent: "bg-blue-100 text-blue-700",
  },
  {
    app_id: "cost",
    name: "Себестоимость и расчёт цены",
    description: "Сметы, себестоимость и расчёт цены коммерческих предложений.",
    status: "in_progress",
    ui_url: null,
    icon: "🧮",
    accent: "bg-emerald-100 text-emerald-700",
  },
  {
    app_id: "op_cabinet",
    name: "Кабинет отдела продаж",
    description: "Заявки, сделки и коммерческие предложения отдела продаж.",
    status: "in_progress",
    ui_url: null,
    icon: "📞",
    accent: "bg-violet-100 text-violet-700",
  },
  {
    app_id: "team_cabinet",
    name: "Кабинет бригадира",
    description: "Бригады, задачи на объектах и отчёты о выполненных работах.",
    status: "planned",
    ui_url: null,
    icon: "👷",
    accent: "bg-amber-100 text-amber-700",
  },
  {
    app_id: "purchases",
    name: "Закупки",
    description: "Заявки на закупку материалов, поставщики и согласования.",
    status: "planned",
    ui_url: null,
    icon: "🛒",
    accent: "bg-orange-100 text-orange-700",
  },
  {
    app_id: "warehouse",
    name: "Склады",
    description: "Остатки на складах, приёмка и выдача материалов.",
    status: "planned",
    ui_url: null,
    icon: "📦",
    accent: "bg-cyan-100 text-cyan-700",
  },
  {
    app_id: "logistics",
    name: "Логистика",
    description: "Доставки на объекты, маршруты и транспорт.",
    status: "planned",
    ui_url: null,
    icon: "🚚",
    accent: "bg-teal-100 text-teal-700",
  },
  {
    app_id: "analytics",
    name: "Аналитика и дашборды",
    description: "Сводные показатели и отчёты по всем модулям экосистемы.",
    status: "planned",
    ui_url: null,
    icon: "📊",
    accent: "bg-rose-100 text-rose-700",
  },
];

/** Русские подписи статусов для бейджа на плитке. */
export const STATUS_LABEL: Record<AppStatus, string> = {
  active: "Работает",
  in_progress: "В разработке",
  planned: "Запланировано",
};

/** Tailwind-классы цветного бейджа статуса. */
export const STATUS_BADGE: Record<AppStatus, string> = {
  active: "bg-green-100 text-green-700 ring-green-600/20",
  in_progress: "bg-amber-100 text-amber-700 ring-amber-600/20",
  planned: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

const KNOWN_STATUSES: readonly AppStatus[] = [
  "active",
  "in_progress",
  "planned",
];

function isAppStatus(value: unknown): value is AppStatus {
  return (
    typeof value === "string" && KNOWN_STATUSES.includes(value as AppStatus)
  );
}

/**
 * Подмёрживает данные Hub (`GET /api/v1/apps/ui`, см. `getAppsUi` в hubApi.ts —
 * тот же авторизованный запрос, что уже использует сайдбар) к локальному
 * справочнику по app_id. Обновляются только понятные нам поля
 * (name/status/ui_url/embed) и только для уже известных плиток — неизвестные
 * app_id из Hub игнорируем, чтобы не показывать «сырые» записи без
 * иконок/описаний. Возвращает НОВЫЙ массив.
 */
export function mergeWithHub(base: AppTile[], hubApps: AppUi[]): AppTile[] {
  if (!Array.isArray(hubApps) || hubApps.length === 0) return base;

  const byId = new Map<string, AppUi>();
  for (const item of hubApps) {
    if (item?.app_id) byId.set(item.app_id, item);
  }

  return base.map((tile) => {
    const hub = byId.get(tile.app_id);
    if (!hub) return tile;

    const merged: AppTile = { ...tile };
    if (typeof hub.name === "string" && hub.name.trim().length > 0) {
      merged.name = hub.name;
    }
    if (isAppStatus(hub.status)) {
      merged.status = hub.status;
    }
    const ui_url = hub.ui?.ui_url;
    if (typeof ui_url === "string" && ui_url.trim().length > 0) {
      merged.ui_url = ui_url;
    }
    if (typeof hub.ui?.embed === "string") {
      merged.embed = hub.ui.embed;
    }
    return merged;
  });
}
