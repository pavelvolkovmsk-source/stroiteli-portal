import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { setToken } from "@/lib/auth";
import { login } from "@/lib/hubApi";

/**
 * Вход в админку доступов. Логин/пароль → Hub /auth/user-login → токен в localStorage.
 * Своего пользовательского хранилища у портала нет — аккаунты в Hub.
 */
export default function Login() {
  const navigate = useNavigate();
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const token = await login(loginName.trim(), password);
      setToken(token);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Вход в управление доступами</h1>
        <p className="text-sm text-muted-foreground">Аккаунт Hub (логин и пароль)</p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="login" className="text-sm font-medium">
            Логин
          </label>
          <input
            id="login"
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
            autoComplete="username"
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Пароль
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Вход…" : "Войти"}
        </Button>
      </form>
    </div>
  );
}
