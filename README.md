# Student Productivity

Foundation only for a local-first, mobile-first React PWA. No backend, authentication, remote data, seed records, timer, recurrence engine, or attendance features.

## Development

Requires Node.js 22.12+ (Node 24 recommended) and npm.

```sh
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

Development serves source code; use the production preview to check service-worker caching and offline navigation. A deployed PWA requires HTTPS (localhost is supported for testing). On iPhone, open the deployed site in Safari and choose Share → Add to Home Screen. This project has not been deployed.

## Structure

```text
public/                      Temporary PNG PWA and Apple icons
src/
  app/                       App.tsx and router.tsx
  components/
    layout/                  app-shell.tsx
    navigation/              bottom-nav.tsx
    ui/                      Empty; ready for your shadcn components
  pages/                     Today, Sessions, Schedule, Insights, Settings
  db/                        db.ts, schema.ts, types.ts
  lib/                       utils.ts, dates.ts, ids.ts
  hooks/                     Empty; ready for hooks
  styles/globals.css         Tailwind integration and shadcn tokens
  main.tsx                   Local DB initialization and PWA registration
```

## Theme and components

Replace the `:root` token block in `src/styles/globals.css` with your generated shadcn theme. Add its `.dark` block immediately after it if included. Keep the imports, `@custom-variant`, `@theme inline` mappings, and base layer; merge additional mappings from your theme if it introduces more tokens. There is no dark-mode switching logic.

`components.json`, Vite, and TypeScript all use `@/*` → `src/*`. No individual shadcn components are installed. You can now manually add your preferred components, for example:

```sh
npx shadcn@latest add button
```

PWA theme/background colors are independent browser metadata: update them in `vite.config.ts` and the theme-color in `index.html` when changing your theme. Replace the temporary icons in `public/` when ready.

## Local data conventions

One Dexie instance opens `StudentProductivityDB`, schema version 1, before rendering. Tables: semesters, modules, scheduleRules, classOccurrences, workSessions, settings. Records start empty. No foreign-key enforcement or business-level validation is introduced yet. `dexie-react-hooks` is installed for future live queries.

- Calendar dates: `YYYY-MM-DD`, interpreted locally; never parse with `new Date(dateString)` or serialize date-only values to UTC.
- Local times: `HH:mm`, 24-hour clock.
- Timestamps: ISO 8601 instants; helpers serialize to UTC.
- Weekdays: Sunday = 0 through Saturday = 6.
- Repeat interval: 1 = weekly, 2 = alternate weeks; anchorDate is a date in a known occurrence week. Recurrence is not implemented.
- A work session without endedAt is active. Missing values are not indexed; future active-session queries should filter records rather than query an undefined index key.
- Settings use recursively JSON-compatible values. Zod date/time validators are provided; database writes are not automatically validated.

IndexedDB stays in the browser on the device. Clearing site data removes it. No persistence/backup feature is implemented.

## Routing and offline behavior

Routes: `/`, `/sessions`, `/schedule`, `/insights`, `/settings`. Settings is reached from the header; the other four routes share the bottom navigation. The 28rem shell includes safe-area padding and navigation in document flow.

The production service worker precaches the application shell and falls back to index.html for navigation, enabling offline routes after the first successful load and service-worker activation. Updates activate automatically when detected, following the [Vite PWA auto-update strategy](https://vite-pwa-org.netlify.app/guide/auto-update). Revisit this policy when adding unsaved form state.

`vercel.json` rewrites extensionless SPA routes to index.html while preserving static asset requests. No deployment was performed.

The latest Vite React TypeScript starter uses Oxlint; `npm run lint` retains that current starter tool rather than introducing ESLint. Tailwind uses its current Vite plugin; shadcn is manually configured following the [official Vite setup](https://ui.shadcn.com/docs/installation/vite) to avoid adding UI components.

## Verification performed

Production TypeScript/build and Oxlint passed. Headless Chromium checks passed for all five direct routes in development and production, all four bottom navigation links and active states, six empty IndexedDB stores, generated manifest/service-worker control, all five production routes and navigation while offline, mobile horizontal overflow, and absence of browser console/runtime errors. Actual iPhone Home Screen installation and hosted Vercel rewrites still require device/deployment verification.
