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

// Русские подписи ролей. Коды приходят из манифестов ПО (roles_hint); если код
// незнаком — показываем как есть.
const ROLE_LABELS: Record<string, string> = {
  general: "Генеральный",
  owner: "Владелец",
  admin: "Администратор",
  manager: "Менеджер",
  agent: "Агент",
  head: "Руководитель",
  lawyer: "Юрист",
  jurist: "Юрист",
  accountant: "Бухгалтерия",
  foreman: "Прораб",
  contractor: "Подрядчик",
  kadastr: "Кадастровый инженер",
};
const roleLabel = (code: string) => ROLE_LABELS[code] ?? code;

/** Краткая подпись ролей пользователя для колонки таблицы (роли — по-русски). */
function rolesLabel(roles: UserRoleGrant[]): string {
  if (roles.length === 0) return "—";
  return roles.map((r) => `${r.app_id}: ${roleLabel(r.role)}`).join(", ");
}

function grantsFromKeys(keys: Iterable<string>): UserRoleGrant[] {
  return [...keys].map((k) => {
    const sep = k.indexOf("|");
    return { app_id: k.slice(0, sep), role: k.slice(sep + 1) };
  });
}

/**
 * Экран «Пользователи и доступы» (генеральный/суперадмин). Список пользователей Hub,
 * создание пользователя СРАЗУ с ролями по ПО, и карточка сотрудника (провалиться →
 * логин, задать новый пароль, роли). Роли — по-русски. Старый пароль показать нельзя
 * (хранится хешем) — можно только задать новый.
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
  const [newRoles, setNewRoles] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  // карточка сотрудника: открытый пользователь + черновик ролей + новый пароль
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [draftRoles, setDraftRoles] = useState<Set<string>>(new Set());
  const [savingRoles, setSavingRoles] = useState(false);
  const [editorPwd, setEditorPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  // Управление пользователями доступно генеральному (general) и суперадмину.
  const isSuper = canManage();
  // Есть ли вообще роли для назначения (по манифестам ПО).
  const hasAssignableRoles = apps.some((a) => a.roles_hint.length > 0);

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

  function toggleNewRole(appId: string, role: string) {
    const k = roleKey(appId, role);
    setNewRoles((prev) => {
      const s = new Set(prev);
      if (s.has(k)) s.delete(k);
      else s.add(k);
      return s;
    });
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
      // Назначаем выбранные роли сразу после создания (если не суперадмин — у него
      // и так полный доступ).
      let roles: UserRoleGrant[] = [];
      if (!newSuper && newRoles.size > 0) {
        const res = await setUserRoles(created.user_id, grantsFromKeys(newRoles));
        roles = res.roles;
      }
      setUsers((prev) => [...prev, { ...created, roles }]);
      setNewLogin("");
      setNewPassword("");
      setNewFullName("");
      setNewSuper(false);
      setNewRoles(new Set());
      setNotice(`Пользователь «${created.login}» создан`);
    } catch (e) {
      if (on401(e)) return;
      setNotice(e instanceof Error ? `Не создан: ${e.message}` : "Не создан");
    } finally {
      setCreating(false);
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

  function openEditor(u: UserRow) {
    setEditingUserId(u.user_id);
    setDraftRoles(new Set(u.roles.map((r) => roleKey(r.app_id, r.role))));
    setEditorPwd("");
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
    setSavingRoles(true);
    setNotice(null);
    try {
      const res = await setUserRoles(editingUserId, grantsFromKeys(draftRoles));
      setUsers((prev) =>
        prev.map((x) => (x.user_id === editingUserId ? { ...x, roles: res.roles } : x)),
      );
      setNotice("Роли сохранены");
    } catch (e) {
      if (on401(e)) return;
      setNotice(e instanceof Error ? `Не сохранено: ${e.message}` : "Не сохранено");
    } finally {
      setSavingRoles(false);
    }
  }

  async function handleSavePassword() {
    if (!editingUserId || !editorPwd) return;
    setSavingPwd(true);
    setNotice(null);
    try {
      await updateUser(editingUserId, { password: editorPwd });
      setNotice(`Пароль для «${editingUser?.login ?? ""}» сохранён`);
      setEditorPwd("");
    } catch (e) {
      if (on401(e)) return;
      setNotice(e instanceof Error ? `Не сохранено: ${e.message}` : "Не сохранено");
    } finally {
      setSavingPwd(false);
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
          Учётные записи Hub: создание с ролями по ПО, активность, смена пароля
        </p>
      </header>

      {!isSuper && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Раздел доступен только генеральному и суперадмину. Hub отклонит изменения, если у вас нет прав.
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
            <span>Суперадмин (полный доступ ко всем ПО, роли не нужны)</span>
          </label>

          {/* роли по ПО прямо при создании */}
          {!newSuper && (
            <div className="space-y-3 sm:col-span-2 rounded-md border bg-background/50 p-3">
              <p className="text-sm font-medium">Роли по ПО</p>
              {!hasAssignableRoles && (
                <p className="text-xs text-muted-foreground">
                  Нет приложений с объявленными ролями (roles_hint в манифесте).
                </p>
              )}
              {apps.map((app) =>
                app.roles_hint.length === 0 ? null : (
                  <div key={app.app_id} className="space-y-1.5">
                    <h3 className="text-sm">
                      {app.name} <span className="text-muted-foreground">· {app.app_id}</span>
                    </h3>
                    <div className="flex flex-wrap gap-4">
                      {app.roles_hint.map((role) => {
                        const k = roleKey(app.app_id, role);
                        return (
                          <label key={k} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="h-4 w-4 cursor-pointer accent-primary"
                              checked={newRoles.has(k)}
                              onChange={() => toggleNewRole(app.app_id, role)}
                            />
                            <span>{roleLabel(role)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

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
                        onClick={() => handleToggleActive(u)}
                        className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        {u.is_active ? "Выключить" : "Включить"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditor(u)}
                        className="rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                      >
                        Открыть
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

      {/* карточка сотрудника: логин + смена пароля + роли */}
      {editingUser && (
        <section className="space-y-5 rounded-lg border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                Сотрудник: {editingUser.login}
                {editingUser.full_name ? ` · ${editingUser.full_name}` : ""}
              </h2>
              <p className="text-xs text-muted-foreground">
                Логин и роли пользователя. Старый пароль показать нельзя (хранится в
                зашифрованном виде) — можно задать новый.
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

          {/* логин (только просмотр) + новый пароль */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Логин</span>
              <input
                type="text"
                value={editingUser.login}
                readOnly
                className="w-full rounded-md border bg-muted px-3 py-2 text-sm outline-none"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Новый пароль</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editorPwd}
                  onChange={(e) => setEditorPwd(e.target.value)}
                  placeholder="задать новый пароль"
                  autoComplete="new-password"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  disabled={savingPwd || !editorPwd}
                  onClick={handleSavePassword}
                  className="whitespace-nowrap rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingPwd ? "Сохраняем…" : "Сохранить пароль"}
                </button>
              </div>
            </label>
          </div>

          {editingUser.is_superadmin && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Это суперадмин — у него полный доступ независимо от назначенных ролей.
            </p>
          )}

          {!editingUser.is_superadmin && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Роли по ПО</p>
              {!hasAssignableRoles && (
                <p className="text-sm text-muted-foreground">
                  Нет приложений с объявленными ролями (roles_hint в манифесте).
                </p>
              )}
              {apps.map((app) =>
                app.roles_hint.length === 0 ? null : (
                  <div key={app.app_id} className="space-y-2">
                    <h3 className="text-sm font-medium">
                      {app.name} <span className="text-muted-foreground">· {app.app_id}</span>
                    </h3>
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
                            <span>{roleLabel(role)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ),
              )}
              <div className="flex items-center gap-3 pt-1">
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
                  Закрыть
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
