/**
 * Хранение и разбор токена админ-входа портала.
 * Токен выдаёт Hub (POST /api/v1/auth/user-login). Декод — ТОЛЬКО для UI-условий
 * (показать/скрыть); настоящая авторизация — на стороне Hub по подписи JWT.
 */

const TOKEN_KEY = "hub_admin_token";

export interface TokenPayload {
  user_id?: string;
  is_superadmin?: boolean;
  roles?: string[];
  scopes?: string[];
  app_id?: string | null;
  exp?: number;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function decodeToken(token: string | null = getToken()): TokenPayload | null {
  if (!token) return null;
  const payloadPart = token.split(".")[1];
  if (!payloadPart) return null;
  try {
    const json = decodeURIComponent(
      escape(atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/"))),
    );
    return JSON.parse(json) as TokenPayload;
  } catch {
    return null;
  }
}

export function isAuthed(): boolean {
  const payload = decodeToken();
  if (!payload) return false;
  if (payload.exp && payload.exp * 1000 < Date.now()) return false;
  return true;
}

/** Суперадмин Hub (глобальный root). Эксклюзив — вкладка «API». */
export function isSuperadmin(): boolean {
  return decodeToken()?.is_superadmin === true;
}

/**
 * Полный доступ к управлению (Доступы, Пользователи и пр.): суперадмин ИЛИ
 * генеральный (роль general — владелец компании). Генеральному доступно всё,
 * кроме вкладки «API» (только суперадмин).
 */
export function canManage(): boolean {
  const p = decodeToken();
  return Boolean(p?.is_superadmin) || (p?.roles ?? []).includes("general");
}
