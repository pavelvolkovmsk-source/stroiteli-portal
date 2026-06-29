import { isSuperadmin } from "@/lib/auth";

/**
 * «API» — технические настройки интеграций (API-ключи, UF-поля Bitrix, токены).
 * Эксклюзив СУПЕРАДМИНА: генеральному (роль general) недоступно. Гейт — на фронте
 * (показываем заглушку) и должен дублироваться на бэке у соответствующих эндпоинтов.
 */
export default function Api() {
  if (!isSuperadmin()) {
    return (
      <div className="space-y-4">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">API</h1>
        </header>
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Доступ только для суперадмина.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">API</h1>
        <p className="text-muted-foreground">
          Технические настройки интеграций: API-ключи, UF-поля Bitrix, токены вебхуков
        </p>
      </header>
      <section className="rounded-lg border bg-card p-5">
        <p className="text-sm text-muted-foreground">Раздел в разработке.</p>
      </section>
    </div>
  );
}
