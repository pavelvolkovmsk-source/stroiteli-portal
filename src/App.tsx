import { type ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "@/components/layout/AppLayout";
import { isAuthed } from "@/lib/auth";
import Admin from "@/pages/Admin";
import Apps from "@/pages/Dashboard";
import Login from "@/pages/Login";
import Users from "@/pages/Users";
import Chat from "@/pages/cabinet/Chat";
import EmbeddedApp from "@/pages/cabinet/EmbeddedApp";
import IntegrationMap from "@/pages/cabinet/Map";
import Overview from "@/pages/cabinet/Overview";
import Projects from "@/pages/cabinet/Projects";

/** Гард: пускает на защищённый маршрут только при наличии валидного токена. */
function RequireAuth({ children }: { children: ReactElement }) {
  return isAuthed() ? children : <Navigate to="/login" replace />;
}

/**
 * Кабинет генерального (центр экосистемы «Строители», поверх Hub).
 *  /login    — вход (аккаунт Hub, user-login)
 *  /         — Дашборд (сводка по событиям)
 *  /projects — Проекты (карта со сквозными фильтрами)
 *  /chat     — Чат сделки (из Bitrix)
 *  /map      — Карта интеграций
 *  /apps     — Приложения экосистемы (плитки)
 *  /admin    — Доступы (матрица прав)
 *  /users    — Пользователи и доступы (суперадмин)
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Overview />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/map" element={<IntegrationMap />} />
        <Route path="/apps" element={<Apps />} />
        <Route path="/app/:appId" element={<EmbeddedApp />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/users" element={<Users />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
