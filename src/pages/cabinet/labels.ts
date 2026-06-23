/** Человекочитаемые подписи типов событий и источников — для генерального (без терминов). */

const EVENT_TYPE_LABELS: Record<string, string> = {
  "bitrix.deal.created": "Создана сделка",
  "bitrix.deal.stage.changed": "Смена стадии сделки",
  "bitrix.deal.payment.received": "Поступила оплата",
  "bitrix.deal.chat.message": "Сообщение в чате сделки",
  "cost.precontract.submitted": "Заявка на ПДП отправлена",
  "cost.kp.approved": "КП одобрено",
  "cost.kp.submitted": "КП отправлено клиенту",
  "legal.document.signed": "Документ подписан",
  "legal.task.completed": "Юрист закрыл задачу",
  "voronka.gate.reached": "Пройден этап воронки",
};

const SOURCE_LABELS: Record<string, string> = {
  cost: "Себестоимость",
  bitrix: "Bitrix24",
  legal: "Юр-блок",
  hub: "Hub",
  voronka: "Воронка",
};

export function eventTypeLabel(type: string): string {
  return EVENT_TYPE_LABELS[type] ?? type;
}

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

/** Время события в человекочитаемом виде (локаль ru). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
