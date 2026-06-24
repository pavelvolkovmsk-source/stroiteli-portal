import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  MessagesSquare,
  Network,
  LayoutGrid,
  ShieldCheck,
  Users as UsersIcon,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { clearToken, decodeToken } from "@/lib/auth";

const NAV_COLLAPSED_KEY = "cabinet_nav_collapsed";

/**
 * Пункты левого бара кабинета генерального. Маршруты — в src/App.tsx.
 * Текст только на русском, без эмодзи — дизайн-канон экосистемы.
 */
const NAV_ITEMS: Array<{ to: string; label: string; icon: typeof LayoutDashboard; end?: boolean }> =
  [
    { to: "/", label: "Дашборд", icon: LayoutDashboard, end: true },
    { to: "/projects", label: "Проекты", icon: FolderKanban },
    { to: "/chat", label: "Чат сделки", icon: MessagesSquare },
    { to: "/map", label: "Карта интеграций", icon: Network },
    { to: "/apps", label: "Приложения", icon: LayoutGrid },
    { to: "/admin", label: "Доступы", icon: ShieldCheck },
    { to: "/users", label: "Пользователи", icon: UsersIcon },
  ];

/** Подпись роли пользователя для бейджа в подвале сайдбара. */
function roleLabel(): string {
  const p = decodeToken();
  if (!p) return "Гость";
  if (p.is_superadmin) return "Генеральный";
  const r = p.roles?.[0];
  const map: Record<string, string> = { admin: "Администратор", general: "Генеральный" };
  return (r && map[r]) ?? "Пользователь";
}

/**
 * Каркас кабинета: левый бар (сворачиваемый) + шапка + область контента.
 * Под каждым защищённым маршрутом рендерит <Outlet/>.
 */
export default function AppLayout() {
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(NAV_COLLAPSED_KEY) === "1",
  );
  const toggleNav = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  };

  const label = roleLabel();
  const initial = label.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "flex flex-col border-r bg-card transition-[width] duration-200",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b",
            collapsed ? "justify-center px-2" : "gap-2.5 px-5",
          )}
        >
          <span className="h-6 w-1.5 shrink-0 rounded-full bg-primary" />
          {!collapsed && (
            <span className="text-base font-semibold tracking-tight">Кабинет генерального</span>
          )}
          <button
            type="button"
            onClick={toggleNav}
            title={collapsed ? "Развернуть меню" : "Свернуть меню"}
            aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
            className={cn(
              "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              collapsed ? "" : "ml-auto",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map(({ to, label: itemLabel, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? itemLabel : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center rounded-md py-2 text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-2" : "gap-3 px-3",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && itemLabel}
            </NavLink>
          ))}
        </nav>

        <div className={cn("space-y-3 border-t", collapsed ? "p-2" : "p-4")}>
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-2.5")}>
            <span
              title={label}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
            >
              {initial}
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{label}</p>
                <p className="truncate text-xs text-muted-foreground">Экосистема «Строители»</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              clearToken();
              navigate("/login", { replace: true });
            }}
            title="Выйти"
            className={cn(
              "flex w-full items-center rounded-md py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              collapsed ? "justify-center px-2" : "gap-2 px-3",
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && "Выйти"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-w-0 flex-1 overflow-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
