# Хаб — кабинет руководителя (stroiteli-portal)

Единая точка входа в экосистему **«Строители»** (hub-and-spoke вокруг Bitrix24).

Генеральный директор открывает портал и видит **плитки** всех приложений
экосистемы. Клик по плитке открывает интерфейс модуля
(например, «Юр-блок» → его Gantt на `http://localhost:5173/gantt`).

Это **каркас** портала: шапка, базовый layout и заглушка главной страницы
«Кабинет руководителя». Плитки приложений добавит следующий агент.

## Стек

- **React 18** + **Vite 5** + **TypeScript** (strict)
- **Tailwind CSS 3** (`tailwindcss@^3.4`)
- **shadcn/ui** (компоненты вручную, не CLI): утилита `cn`, примитивы `button` и `card`,
  тема на CSS-переменных, `tailwindcss-animate`
- **react-router-dom 6**
- Менеджер пакетов — **pnpm**

Весь интерфейс и тексты — **только на русском** (директор не знает английского).

## Настройки (env)

Все настройки — через переменные окружения, без хардкода. Скопируйте
`.env.example` в `.env` и при необходимости поменяйте значения.

| Переменная     | Назначение                              | По умолчанию            |
| -------------- | --------------------------------------- | ----------------------- |
| `VITE_HUB_URL` | Адрес Hub (центральный API экосистемы)  | `http://localhost:8000` |

## Запуск

```bash
pnpm install          # установка зависимостей
pnpm dev              # dev-сервер на http://localhost:5174
```

Порт **5174** — порт 5173 занят Юр-блоком (`stroiteli-legal`).

## Команды

| Команда          | Описание                                       |
| ---------------- | ---------------------------------------------- |
| `pnpm dev`       | Dev-сервер (порт 5174)                         |
| `pnpm build`     | Сборка: проверка типов (`tsc -b`) + `vite build` |
| `pnpm preview`   | Локальный просмотр собранной версии            |
| `pnpm lint`      | ESLint                                         |
| `pnpm format`    | Prettier                                       |
| `pnpm typecheck` | Проверка типов без сборки                       |

## Структура проекта

```
stroiteli-portal/
├─ index.html              # lang=ru, title «Хаб — Строители»
├─ vite.config.ts          # порт 5174, alias @ → src
├─ tailwind.config.js      # тема shadcn/ui (CSS-переменные)
├─ components.json          # настройки shadcn/ui
├─ .env.example            # VITE_HUB_URL
└─ src/
   ├─ main.tsx             # точка входа (BrowserRouter)
   ├─ App.tsx              # роутинг + Layout, главная = Dashboard
   ├─ index.css            # Tailwind + CSS-переменные темы
   ├─ vite-env.d.ts        # типы import.meta.env
   ├─ lib/
   │  └─ utils.ts          # cn() — объединение классов
   ├─ components/
   │  ├─ ui/               # примитивы shadcn/ui (button, card)
   │  └─ layout/           # Header, Layout (каркас страницы)
   └─ pages/
      └─ Dashboard.tsx     # главная страница «Кабинет руководителя»
```

## Как добавить страницу

1. Создайте компонент в `src/pages/`, например `src/pages/Apps.tsx`
   (`export default function Apps() { ... }`).
2. Зарегистрируйте маршрут в `src/App.tsx` внутри `<Routes>`:

   ```tsx
   import Apps from "@/pages/Apps";
   // ...
   <Route path="/apps" element={<Apps />} />
   ```

3. Импорты — через alias `@` (`@/components/...`, `@/lib/...`).

## Как добавить компонент shadcn/ui

Компоненты лежат в `src/components/ui/`. Можно добавлять файлы вручную
по образцу `button.tsx` / `card.tsx` (стиль `default`, baseColor `slate`,
CSS-переменные). Утилита `cn` — из `@/lib/utils`.
