import { Building2, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { clearToken, isAuthed } from "@/lib/auth";

/**
 * Шапка портала. Текст — на русском (директор не знает английского).
 * Навигация: кабинет руководителя + управление доступами; выход — если выполнен вход.
 */
export default function Header() {
  const navigate = useNavigate();
  const authed = isAuthed();

  return (
    <header className="border-b bg-card">
      <div className="container flex h-16 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-semibold leading-tight">Хаб — кабинет руководителя</span>
          <span className="text-xs text-muted-foreground">Экосистема «Строители»</span>
        </div>

        <nav className="ml-6 flex items-center gap-4 text-sm">
          <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">
            Кабинет
          </Link>
          <Link to="/admin" className="text-muted-foreground transition-colors hover:text-foreground">
            Доступы
          </Link>
        </nav>

        {authed && (
          <button
            type="button"
            onClick={() => {
              clearToken();
              navigate("/login", { replace: true });
            }}
            className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        )}
      </div>
    </header>
  );
}
