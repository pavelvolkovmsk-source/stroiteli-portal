/**
 * Конфигурация приложений экосистемы «Строители» (hub-and-spoke вокруг Bitrix24).
 *
 * Это локальный «справочник по умолчанию»: портал обязан работать даже без
 * поднятого Hub. На маунте дашборд best-effort подмёрживает к этому списку
 * актуальные статусы/имена из Hub (GET ${VITE_HUB_URL}/api/v1/apps) по app_id —
 * см. mergeWithHub ниже.
 */

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

/** Сырой элемент ответа Hub `GET /api/v1/apps` (поля могут отсутствовать). */
interface HubApp {
  app_id?: unknown;
  id?: unknown;
  name?: unknown;
  status?: unknown;
  ui_url?: unknown;
}

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
 * Подмёрживает данные Hub к локальному справочнику по app_id.
 * Обновляются только понятные нам поля (name/status/ui_url) и только для
 * уже известных плиток — неизвестные app_id из Hub игнорируем, чтобы не
 * показывать «сырые» записи без иконок/описаний. Возвращает НОВЫЙ массив.
 */
export function mergeWithHub(base: AppTile[], hubData: unknown): AppTile[] {
  if (!Array.isArray(hubData)) return base;

  const byId = new Map<string, HubApp>();
  for (const raw of hubData) {
    if (typeof raw !== "object" || raw === null) continue;
    const item = raw as HubApp;
    const key = item.app_id ?? item.id;
    if (typeof key === "string" && key.length > 0) {
      byId.set(key, item);
    }
  }

  if (byId.size === 0) return base;

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
    if (typeof hub.ui_url === "string" && hub.ui_url.trim().length > 0) {
      merged.ui_url = hub.ui_url;
    } else if (hub.ui_url === null) {
      merged.ui_url = null;
    }
    return merged;
  });
}
