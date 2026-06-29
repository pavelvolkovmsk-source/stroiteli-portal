import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { canManage } from "@/lib/auth";
import {
  createUser,
  getAllUsers,
  getPermApps,
  HubError,
  setUserRoles,
  updateUser,
  type CreateUserBody,
  type PermApp,
  type UserRoleGrant,
  type UserRow,
} from "@/lib/hubApi";

const roleKey = (appId: string, role: string) => `${appId}|${role}`;

/** Краткая подпись ролей пользователя для колонки таблицы. */
function rolesLabel(roles: UserRoleGrant[]): string {
  if (roles.length === 0) return "—";
  return roles.map((r) => `${r.app_id}:${r.role}`).join(", ");
}

/**
 * Экран «Пользователи и доступы» (только суперадмин). Список всех пользователей Hub,
 * создание пользователя, сброс пароля, вкл/выкл активности и редактирование ролей
 * (полная замена через PUT /users/{id}/roles). Стиль — как у «Управления доступами».
 */
export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [apps, setApps] = useState<PermApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // форма создания
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newSuper, setNewSuper] = useState(false);
  const [creating, setCreating] = useState(false);

  // редактор ролей: открытый пользователь + черновик его ролей
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [draftRoles, setDraftRoles] = useState<Set<string>>(new Set());
  const [savingRoles, setSavingRoles] = useState(false);

  // Управление пользователями доступно генеральному (general) и суперадмину.
  const isSuper = canManage();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [u, a] = await Promise.all([getAllUsers(), getPermApps()]);
        if (!alive) return;
        setUsers(u);
        setApps(a);
      } catch (e) {
        if (e instanceof HubError && e.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        if (alive) setError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  function on401(e: unknown): boolean {
    if (e instanceof HubError && e.status === 401) {
      navigate("/login", { replace: true });
      return true;
    }
    return false;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (!newLogin.trim() || !newPassword) {
      setNotice("Укажите логин и пароль");
      return;
    }
    const body: CreateUserBody = {
      login: newLogin.trim(),
      password: newPassword,
      is_superadmin: newSuper,
    };
    if (newFullName.trim()) body.full_name = newFullName.trim();

    setCreating(true);
    try {
      const created = await createUser(body);
      setUsers((prev) => [...prev, { ...created, roles: [] }]);
      setNewLogin("");
      setNewPassword("");
      setNewFullName("");
      setNewSuper(false);
      setNotice(`Пользователь «${created.login}» создан`);
    } catch (e) {
      if (on401(e)) return;
      setNotice(e instanceof Error ? `Не создан: ${e.message}` : "Не создан");
    } finally {
      setCreating(false);
    }
  }

  async function handleResetPassword(u: UserRow) {
    const pwd = window.prompt(`Новый пароль для «${u.login}»:`);
    if (pwd == null || pwd === "") return;
    setBusy(u.user_id);
    setNotice(null);
    try {
      await updateUser(u.user_id, { password: pwd });
      setNotice(`Пароль для «${u.login}» сброшен`);
    } catch (e) {
      if (on401(e)) return;
      setNotice(e instanceof Error ? `Не сохранено: ${e.message}` : "Не сохранено");
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleActive(u: UserRow) {
    setBusy(u.user_id);
    setNotice(null);
    try {
      const updated = await updateUser(u.user_id, { is_active: !u.is_active });
      setUsers((prev) =>
        prev.map((x) => (x.user_id === u.user_id ? { ...x, is_active: updated.is_active } : x)),
      );
    } catch (e) {
      if (on401(e)) return;
      setNotice(e instanceof Error ? `Не сохранено: ${e.message}` : "Не сохранено");
    } finally {
      setBusy(null);
    }
  }

  function openRolesEditor(u: UserRow) {
    setEditingUserId(u.user_id);
    setDraftRoles(new Set(u.roles.map((r) => roleKey(r.app_id, r.role))));
    setNotice(null);
  }

  function toggleDraftRole(appId: string, role: string) {
    const k = roleKey(appId, role);
    setDraftRoles((prev) => {
      const s = new Set(prev);
      if (s.has(k)) s.delete(k);
      else s.add(k);
      return s;
    });
  }

  async function handleSaveRoles() {
    if (!editingUserId) return;
    const grants: UserRoleGrant[] = [...draftRoles].map((k) => {
      const sep = k.indexOf("|");
      return { app_id: k.slice(0, sep), role: k.slice(sep + 1) };
    });
    setSavingRoles(true);
    setNotice(null);
    try {
      const res = await setUserRoles(editingUserId, grants);
      setUsers((prev) =>
        prev.map((x) => (x.user_id === editingUserId ? { ...x, roles: res.roles } : x)),
      );
      setEditingUserId(null);
      setNotice("Роли сохранены");
    } catch (e) {
      if (on401(e)) return;
      setNotice(e instanceof Error ? `Не сохранено: ${e.message}` : "Не сохранено");
    } finally {
      setSavingRoles(false);
    }
  }

  const editingUser = useMemo(
    () => users.find((u) => u.user_id === editingUserId) ?? null,
    [users, editingUserId],
  );

  if (loading) return <p className="text-muted-foreground">Загрузка пользователей…</p>;
  if (error) return <p className="text-destructive">{error}</p>;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Пользователи и доступы</h1>
        <p className="text-muted-foreground">
          Учётные записи Hub: создание, активность, сброс пароля и роли по приложениям
        </p>
      </header>

      {!isSuper && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Раздел доступен только суперадмину. Hub отклонит изменения, если у вас нет прав.
        </p>
      )}
      {notice && <p className="text-sm text-foreground">{notice}</p>}

      {/* создание пользователя */}
      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold">Создать пользователя</h2>
        <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Логин *</span>
            <input
              type="text"
              value={newLogin}
              onChange={(e) => setNewLogin(e.target.value)}
              autoComplete="off"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Пароль *</span>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">ФИО</span>
            <input
              type="text"
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer accent-primary"
              checked={newSuper}
              onChange={(e) => setNewSuper(e.target.checked)}
            />
            <span>Суперадмин</span>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? "Создаём…" : "Создать"}
            </button>
          </div>
        </form>
      </section>

      {/* таблица пользователей */}
      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold">Все пользователи</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Логин</th>
                <th className="px-3 py-2 font-medium">ФИО</th>
                <th className="px-3 py-2 text-center font-medium">Активен</th>
                <th className="px-3 py-2 text-center font-medium">Суперадмин</th>
                <th className="px-3 py-2 font-medium">Роли по ПО</th>
                <th className="px-3 py-2 text-right font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-4 font-medium">{u.login}</td>
                  <td className="px-3 py-2">{u.full_name ?? "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={
                        u.is_active
                          ? "inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700"
                          : "inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      }
                    >
                      {u.is_active ? "Да" : "Нет"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">{u.is_superadmin ? "Да" : "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {u.is_superadmin ? "Все (суперадмин)" : rolesLabel(u.roles)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        disabled={busy === u.user_id}
                        onClick={() => handleResetPassword(u)}
                        className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        Сбросить пароль
                      </button>
                      <button
                        type="button"
                        disabled={busy === u.user_id}
                        onClick={() => handleToggleActive(u)}
                        className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        {u.is_active ? "Выключить" : "Включить"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openRolesEditor(u)}
                        className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                      >
                        Роли
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-muted-foreground">
                    Пользователей нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* редактор ролей */}
      {editingUser && (
        <section className="space-y-4 rounded-lg border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                Роли: {editingUser.login}
                {editingUser.full_name ? ` · ${editingUser.full_name}` : ""}
              </h2>
              <p className="text-xs text-muted-foreground">
                Отметьте роли по каждому ПО. Сохранение заменяет роли пользователя полностью.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingUserId(null)}
              className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
            >
              Закрыть
            </button>
          </div>

          {editingUser.is_superadmin && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Это суперадмин — у него полный доступ независимо от назначенных ролей.
            </p>
          )}

          {apps.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Нет приложений с объявленными ролями (roles_hint в манифесте).
            </p>
          )}

          <div className="space-y-4">
            {apps.map((app) => (
              <div key={app.app_id} className="space-y-2">
                <h3 className="text-sm font-medium">
                  {app.name} <span className="text-muted-foreground">· {app.app_id}</span>
                </h3>
                {app.roles_hint.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    В манифесте нет roles_hint — нечего назначать.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-4">
                    {app.roles_hint.map((role) => {
                      const k = roleKey(app.app_id, role);
                      return (
                        <label key={k} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer accent-primary"
                            checked={draftRoles.has(k)}
                            onChange={() => toggleDraftRole(app.app_id, role)}
                          />
                          <span>{role}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={savingRoles}
              onClick={handleSaveRoles}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {savingRoles ? "Сохраняем…" : "Сохранить роли"}
            </button>
            <button
              type="button"
              onClick={() => setEditingUserId(null)}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Отмена
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
