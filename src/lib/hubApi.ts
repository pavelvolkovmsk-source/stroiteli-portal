/**
 * Клиент к Hub API для экрана доступов. Все ответы — в конверте STANDARDS {ok, data} | {ok, error}.
 * Токен (если есть) подставляется в Authorization: Bearer.
 */

import { clearToken, getToken } from "@/lib/auth";

const BASE: string = import.meta.env.VITE_HUB_URL ?? "http://localhost:8000";

// app_id при логине: Hub кладёт роли пользователя ИМЕННО этого приложения в JWT
// (без app_id роли пустые). Кабинет встраивает cost, и его роли (в т.ч. `general`
// для генерального) нужны и Кабинету, и cost-iframe. Единственное приложение в
// реестре сейчас — cost. is_superadmin (супер-админ) работает независимо от app_id.
const LOGIN_APP_ID: string = import.meta.env.VITE_LOGIN_APP_ID ?? "cost";

export class HubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "HubError";
    this.status = status;
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const body: unknown = await res.json().catch(() => null);
  const env = body as { ok?: boolean; data?: T; error?: { message?: string } } | null;

  if (!res.ok || (env && env.ok === false)) {
    if (res.status === 401) clearToken();
    throw new HubError(env?.error?.message ?? `Ошибка Hub (HTTP ${res.status})`, res.status);
  }
  return (env?.data ?? (body as T)) as T;
}

// ── auth ──────────────────────────────────────────────────────────────────────
export async function login(loginName: string, password: string): Promise<string> {
  const data = await req<{ access_token: string }>("/api/v1/auth/user-login", {
    method: "POST",
    body: JSON.stringify({ login: loginName, password, app_id: LOGIN_APP_ID }),
  });
  return data.access_token;
}

// ── права ─────────────────────────────────────────────────────────────────────
export interface PermModule {
  id: string;
  label?: string;
  actions: string[];
  subgroups?: string[];
}

export interface PermApp {
  app_id: string;
  name: string;
  roles_hint: string[];
  modules: PermModule[];
}

export interface Grant {
  subject: string;
  capability: string;
  granted_at: string;
}

export const getPermApps = () => req<PermApp[]>("/api/v1/permissions/apps");
export const getGrants = () => req<Grant[]>("/api/v1/permissions/grants");
export const putGrants = (subject: string, capabilities: string[]) =>
  req<{ subject: string; capabilities: string[] }>("/api/v1/permissions/grants", {
    method: "PUT",
    body: JSON.stringify({ subject, capabilities }),
  });

// ── пользователи и доступы (суперадмин) ─────────────────────────────────────────
export interface UserRoleGrant {
  app_id: string;
  role: string;
}

export interface UserRow {
  user_id: string;
  login: string;
  full_name: string | null;
  is_active: boolean;
  is_superadmin: boolean;
  roles: UserRoleGrant[];
}

/** Пользователь без ролей — ответ create/update/PATCH. */
export type UserBase = Omit<UserRow, "roles">;

export interface CreateUserBody {
  login: string;
  password: string;
  full_name?: string;
  is_superadmin?: boolean;
}

export interface UpdateUserBody {
  full_name?: string;
  is_active?: boolean;
  password?: string;
}

export const getAllUsers = () => req<UserRow[]>("/api/v1/users/all");

export const createUser = (body: CreateUserBody) =>
  req<UserBase>("/api/v1/users", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateUser = (userId: string, body: UpdateUserBody) =>
  req<UserBase>(`/api/v1/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const setUserRoles = (userId: string, grants: UserRoleGrant[]) =>
  req<{ user_id: string; roles: UserRoleGrant[] }>(
    `/api/v1/users/${encodeURIComponent(userId)}/roles`,
    {
      method: "PUT",
      body: JSON.stringify({ grants }),
    },
  );

// ── события шины (дашборд кабинета) ────────────────────────────────────────────
export interface EventItem {
  event_id: string;
  event_type: string;
  source: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface EventsPage {
  items: EventItem[];
  total: number;
  skip: number;
  limit: number;
}

export interface EventsSummary {
  total: number;
  by_event_type: Array<{ event_type: string; count: number }>;
  by_source: Array<{ source: string; count: number }>;
  timeline: Array<{ day: string; count: number }>;
}

export interface EventsQuery {
  event_type?: string;
  source?: string;
  project_id?: number;
  start_date?: string;
  end_date?: string;
  skip?: number;
  limit?: number;
}

function qs(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export const getEvents = (q: EventsQuery = {}) =>
  req<EventsPage>(`/api/v1/events${qs({ ...q })}`);

export const getEventsSummary = (q: Pick<EventsQuery, "start_date" | "end_date"> = {}) =>
  req<EventsSummary>(`/api/v1/events/summary${qs({ ...q })}`);

// ── проекты (события + обогащение из Bitrix) ────────────────────────────────────
export interface ProjectRow {
  bitrix_deal_id: number;
  title: string | null;
  stage_id: string | null;
  stage_name: string | null;
  department: string | null;
  manager: string | null;
  opportunity: number | null;
  last_event_type: string | null;
  last_event_at: string | null;
  // Себестоимость/маржа по сделке (только генеральному; может отсутствовать). Деньги — строки.
  cost?: string | null;
  margin?: string | null;
}

export interface ProjectsPage {
  items: ProjectRow[];
  total: number;
}

export const getProjects = () => req<ProjectsPage>("/api/v1/projects");

// ── сводка себестоимости/маржи (только генеральному) ────────────────────────────
// Деньги приходят строками ("12345.67"), чтобы не терять точность. Форматировать
// через Number(v).toLocaleString("ru-RU").
export interface MoneyTotals {
  revenue: string;
  cost: string;
  margin: string;
  margin_pct: number | null;
  orders_count: number;
}

export interface StatusBreakdownItem extends MoneyTotals {
  status: string;
}

export interface TimelineItem extends MoneyTotals {
  period: string;
}

export interface OrderLine {
  order_id: number;
  bitrix_deal_id: number | null;
  project_id: number;
  status: string;
  created_at: string;
  revenue: string;
  cost: string;
  margin: string;
}

export interface CostSummary {
  totals: MoneyTotals;
  by_status: StatusBreakdownItem[];
  timeline?: TimelineItem[] | null;
  orders?: OrderLine[] | null;
  filters_applied: Record<string, unknown>;
}

export interface CostSummaryQuery {
  status?: string;
  project_id?: number;
  start_date?: string;
  end_date?: string;
  timeline?: boolean;
  orders?: boolean;
}

export const getCostSummary = (q: CostSummaryQuery = {}) =>
  req<CostSummary>(
    `/api/v1/cabinet/cost-summary${qs({
      status: q.status,
      project_id: q.project_id,
      start_date: q.start_date,
      end_date: q.end_date,
      timeline: q.timeline ? "true" : undefined,
      orders: q.orders ? "true" : undefined,
    })}`,
  );

// ── реестр UI приложений (динамические вкладки + встраивание iframe) ─────────────
export interface AppUiBlock {
  title?: string;
  icon?: string;
  route?: string;
  ui_url?: string;
  category?: string;
  order?: number;
  visible_to_roles?: string[];
  embed?: string;
}

export interface AppUi {
  app_id: string;
  name: string;
  ui: AppUiBlock;
  status: string;
}

export const getAppsUi = () =>
  req<{ items: AppUi[]; total: number }>("/api/v1/apps/ui");
