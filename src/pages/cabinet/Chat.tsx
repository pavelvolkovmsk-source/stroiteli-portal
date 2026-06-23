import { useEffect, useState } from "react";

import { getEvents, HubError, type EventItem } from "@/lib/hubApi";
import { formatDateTime } from "./labels";

/**
 * Чат сделки: сквозной чат из Bitrix, который генеральный читает в центре.
 * Полноценный приём сообщений требует бота type=personal в Hub (imbot.v2) —
 * пока показываем уже долетевшие в журнал события чата, если они есть,
 * иначе явный статус подключения.
 */
export default function Chat() {
  const [messages, setMessages] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getEvents({ event_type: "bitrix.deal.chat.message", limit: 50 })
      .then((page) => {
        if (!cancelled) setMessages(page.items);
      })
      .catch((e: unknown) => {
        // 404/нет данных — оставляем пустой список (покажем статус подключения)
        if (e instanceof HubError) return;
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Чат сделки</h1>
        <p className="text-sm text-muted-foreground">
          Сквозной чат сделки из Bitrix — для чтения генеральным
        </p>
      </header>

      {!loading && messages.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Чат подключается</p>
          <p className="mt-2">
            Приём сообщений из Bitrix требует бота на стороне Hub (imbot.v2). Как только бот
            будет настроен на коробке, сообщения сделок начнут долетать сюда автоматически
            (событие <code>bitrix.deal.chat.message</code>).
          </p>
        </div>
      )}

      {messages.length > 0 && (
        <section className="space-y-3">
          {messages.map((m) => (
            <div key={m.event_id} className="rounded-lg border bg-card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">
                  Сделка №{(m.payload?.bitrix_deal_id as number | undefined) ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(m.created_at)}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {(m.payload?.text as string | undefined) ?? "(текст сообщения хранится в Bitrix)"}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
