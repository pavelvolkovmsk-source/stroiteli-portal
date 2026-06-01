import { cn } from "@/lib/utils";
import { STATUS_BADGE, STATUS_LABEL, type AppStatus } from "@/lib/apps";

/**
 * Цветной бейдж статуса модуля (Работает / В разработке / Запланировано).
 */
export default function StatusBadge({ status }: { status: AppStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        STATUS_BADGE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
