import { Building2 } from "lucide-react";

/**
 * Шапка портала. Текст — на русском (директор не знает английского).
 */
export default function Header() {
  return (
    <header className="border-b bg-card">
      <div className="container flex h-16 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-semibold leading-tight">
            Хаб — кабинет руководителя
          </span>
          <span className="text-xs text-muted-foreground">
            Экосистема «Строители»
          </span>
        </div>
      </div>
    </header>
  );
}
