import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn — утилита shadcn/ui: объединяет классы (clsx) и разрешает
 * конфликты Tailwind-классов (tailwind-merge).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
