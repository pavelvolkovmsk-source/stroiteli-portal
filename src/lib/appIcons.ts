import {
  BarChart3,
  Calculator,
  HardHat,
  LayoutGrid,
  type LucideIcon,
  Package,
  Phone,
  Scale,
  ShoppingCart,
  Truck,
} from "lucide-react";

/**
 * Иконки модулей экосистемы (lucide) — без эмодзи, по дизайн-канону.
 * Единый источник для плиток каталога (AppCard) и вкладок сайдбара (AppLayout).
 */
export const APP_ICONS: Record<string, LucideIcon> = {
  legal: Scale,
  cost: Calculator,
  op_cabinet: Phone,
  team_cabinet: HardHat,
  purchases: ShoppingCart,
  warehouse: Package,
  logistics: Truck,
  analytics: BarChart3,
};

/** Иконка приложения по app_id с фолбэком для незнакомых модулей. */
export function appIcon(appId: string): LucideIcon {
  return APP_ICONS[appId] ?? LayoutGrid;
}
