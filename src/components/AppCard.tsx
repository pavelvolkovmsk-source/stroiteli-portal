import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import type { AppTile } from "@/lib/apps";

/**
 * Плитка одного модуля экосистемы: иконка, название, описание, статус
 * и кнопка «Открыть». Если интерфейс ещё не подключён (ui_url === null),
 * кнопка неактивна и показывается подпись «Интерфейс подключается».
 */
export default function AppCard({ app }: { app: AppTile }) {
  const hasUi = app.ui_url !== null;

  const open = () => {
    if (app.ui_url) {
      window.open(app.ui_url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Card className="flex flex-col transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-lg text-2xl",
              app.accent,
            )}
            aria-hidden
          >
            {app.icon}
          </div>
          <StatusBadge status={app.status} />
        </div>
        <CardTitle className="mt-3 text-lg">{app.name}</CardTitle>
      </CardHeader>

      <CardContent className="flex-1">
        <CardDescription>{app.description}</CardDescription>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-2">
        <Button onClick={open} disabled={!hasUi} className="w-full">
          {hasUi && <ExternalLink className="h-4 w-4" />}
          Открыть
        </Button>
        {!hasUi && (
          <p className="text-center text-xs text-muted-foreground">
            Интерфейс подключается
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
