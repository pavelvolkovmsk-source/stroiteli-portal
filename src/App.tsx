import { Route, Routes } from "react-router-dom";

import Layout from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";

/**
 * Корневой компонент портала «Хаб — кабинет руководителя».
 * Маршрутизация: главная страница — кабинет руководителя (плитки приложений).
 */
export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </Layout>
  );
}
