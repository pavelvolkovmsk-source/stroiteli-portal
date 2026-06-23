import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { decodeToken } from "@/lib/auth";
import {
  getGrants,
  getPermApps,
  HubError,
  putGrants,
  type PermApp,
  type PermModule,
} from "@/lib/hubApi";

const ACTION_LABEL: Record<string, string> = {
  view: "Просмотр",
  edit: "Изменение",
  add: "Добавление",
  delete: "Удаление",
};

const key = (subject: string, capability: string) => `${subject}|${capability}`;
const capOf = (appId: string, moduleId: string, action: string) => `${appId}.${moduleId}.${action}`;

function moduleCaps(appId: string, m: PermModule): string[] {
  return m.actions.map((a) => capOf(appId, m.id, a));
}
function appCaps(app: PermApp): string[] {
  return app.modules.flatMap((m) => moduleCaps(app.app_id, m));
}

/**
 * Экран управления доступами («хаб админ-вкладка»): матрица «роль × действие» по каждому
 * модулю каждого ПО. Чекбокс пишет PUT /permissions/grants (с делегированием на стороне Hub).
 * Субъект строки — role:<app_id>:<role>.
 */
export default function Admin() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<PermApp[]>([]);
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSuper = decodeToken()?.is_superadmin === true;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [a, g] = await Promise.all([getPermApps(), getGrants()]);
        if (!alive) return;
        setApps(a);
        setGranted(new Set(g.map((x) => key(x.subject, x.capability))));
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

  async function toggle(app: PermApp, subject: string, cap: string) {
    const k = key(subject, cap);
    const checked = granted.has(k);
    const current = appCaps(app).filter((c) => granted.has(key(subject, c)));
    const next = checked ? current.filter((c) => c !== cap) : [...current, cap];

    setSaving(k);
    setNotice(null);
    try {
      await putGrants(subject, next);
      setGranted((prev) => {
        const s = new Set(prev);
        appCaps(app).forEach((c) => s.delete(key(subject, c)));
        next.forEach((c) => s.add(key(subject, c)));
        return s;
      });
    } catch (e) {
      if (e instanceof HubError && e.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      setNotice(e instanceof Error ? `Не сохранено: ${e.message}` : "Не сохранено");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <p className="text-muted-foreground">Загрузка прав…</p>;
  if (error) return <p className="text-destructive">{error}</p>;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Управление доступами</h1>
        <p className="text-muted-foreground">
          Раздача прав по ролям для каждого модуля приложений экосистемы
        </p>
      </header>

      {!isSuper && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Вы не суперадмин — изменять можно только доступы в своих блоках; остальное Hub отклонит.
        </p>
      )}
      {notice && <p className="text-sm text-destructive">{notice}</p>}

      {apps.length === 0 && (
        <p className="text-muted-foreground">
          Нет приложений с объявленными правами. Зарегистрируйте манифест с блоком permissions.
        </p>
      )}

      {apps.map((app) => {
        const subjects = app.roles_hint.map((r) => ({ role: r, subject: `role:${app.app_id}:${r}` }));
        return (
          <section key={app.app_id} className="space-y-4 rounded-lg border bg-card p-5">
            <div>
              <h2 className="text-lg font-semibold">{app.name}</h2>
              <p className="text-xs text-muted-foreground">{app.app_id}</p>
            </div>

            {app.modules.length === 0 && (
              <p className="text-sm text-muted-foreground">У приложения нет модулей в permissions.</p>
            )}
            {subjects.length === 0 && app.modules.length > 0 && (
              <p className="text-sm text-muted-foreground">
                В манифесте нет roles_hint — некому назначать (добавьте роли в манифест).
              </p>
            )}

            {app.modules.map((m) => (
              <div key={m.id} className="space-y-2">
                <h3 className="text-sm font-medium">
                  {m.label ?? m.id} <span className="text-muted-foreground">· {m.id}</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Роль</th>
                        {m.actions.map((a) => (
                          <th key={a} className="px-3 py-2 text-center font-medium">
                            {ACTION_LABEL[a] ?? a}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map(({ role, subject }) => (
                        <tr key={subject} className="border-b last:border-0">
                          <td className="py-2 pr-4">{role}</td>
                          {m.actions.map((a) => {
                            const cap = capOf(app.app_id, m.id, a);
                            const k = key(subject, cap);
                            return (
                              <td key={a} className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 cursor-pointer accent-primary"
                                  checked={granted.has(k)}
                                  disabled={saving === k}
                                  onChange={() => toggle(app, subject, cap)}
                                  aria-label={`${role}: ${ACTION_LABEL[a] ?? a}`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
