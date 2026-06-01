import type { ReactNode } from "react";

import Header from "@/components/layout/Header";

/**
 * Базовый каркас страницы: шапка + основная область контента.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <Header />
      <main className="container flex-1 py-8">{children}</main>
    </div>
  );
}
