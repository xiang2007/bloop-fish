# Refactor: frontend and backend split, REST API

Date: 2026-10-05 · Branch: `refactor/rest-api` · Goal: separate the front end and back end and connect them with a REST API, **keeping the UI and UX exactly as they were**, as simply as possible.

## Decisions

| Question | Choice | Why |
|---|---|---|
| How does the frontend get data? | Next.js, client-side `fetch` | Every component, class name and layout stays. Pages become client components that fetch from the API. |
| Backend framework | Hono on Node | Tiny, TypeScript-first, plain request/response handlers. The existing logic moved over almost unchanged. |
| Deployment and login | Same domain; `/api/*` is proxied to the backend | The role cookie stays same-origin. No CORS, no tokens, sign-in behaves as before. |

## Before and after

```
BEFORE  one Next.js app
        pages (server components) -> lib/queries -> Prisma -> Postgres
        forms -> Server Actions   -> Prisma

AFTER   frontend/ (Next.js, client-side)   --fetch /api/*-->   backend/ (Hono)  -> Prisma -> Postgres
                      \__________ shared/ (pure TypeScript used by both) ________/
```

```
backend/    Hono REST API, Prisma schema, migrations, seed, sample CSVs
  src/app.ts, src/server.ts          app and server entry
  src/routes/{session,read,write}.ts the endpoints (see API.md)
  src/lib/pages.ts                   what each screen needs, from the database
  src/lib/queries.ts                 Prisma reads (unchanged)
  src/lib/actions/{logs,owner}.ts    the old Server Actions: same validation, now plain functions
  src/lib/{prisma,session,i18n,...}  database client, cookies, validation messages
shared/     @fisheye/shared: dates, format, cycle, health, metrics, inventory, harvest,
            CSV parsing and import planning, translations. No database, no framework.
frontend/   Next.js app: every page and component, plus lib/api.ts and lib/actions.ts
```

## What changed, file by file

**Moved, not rewritten.** Pure logic (`dates`, `format`, `cycle`, `health`, `metrics`, `inventory`, `harvest`, `role`, `scenario`, `i18n/*`, CSV parser, import planner) moved to `shared/`. `prisma/`, `data/`, `lib/queries.ts`, `lib/prisma.ts`, `lib/import/commit.ts` moved to `backend/`. `lib/insights.ts`, `lib/farmMap.ts`, `lib/monthReport.ts` moved to `frontend/lib/` (only the UI uses them). Everything under `app/` moved to `frontend/app/`.

**Backend (new code).**
- `app.ts`, `server.ts`: Hono app, JSON error handler, request-context middleware.
- `lib/context.ts`: lets library code read the current request's cookies, replacing `next/headers`. `prisma.ts`, `session.ts`, `i18n.ts` use it.
- `lib/http.ts`: `HttpError` and `Fields`, a small stand-in for `FormData` (`get`/`getAll`) so the old validation code ran unchanged.
- `lib/pages.ts`: the data-loading block of each page, now one function per screen.
- `routes/*.ts`: thin handlers. Reads call `pages.ts`; writes call the old actions.
- The Server Actions: `FormData` became `Fields`, `redirect(url)` became `return { redirect: url }`, `revalidatePath` was removed. Validation and database code is untouched.
- CSV export moved from a Next route handler to `GET /api/ponds/:id/export`.

**Frontend (changed code).**
- `lib/api.ts`: `send()`, the `useApi(path)` hook, `invalidate()`, and the ISO-timestamp-to-`Date` reviver.
- `lib/actions.ts`: replaces `app/actions/*`. Same function names and signatures (`saveFarm(prev, formData)`, `deleteHarvest(formData)`, ...), so **no form needed rewriting**. Each one calls the REST API; writes call `invalidate()`, which refetches every mounted page (the old `revalidatePath`).
- `components/Api.tsx`: `<Api path="...">{(data) => ...}</Api>` shows the loading skeleton (the old `loading.tsx`), handles 401/403/404, and `useTitle` replaces `generateMetadata`.
- Pages: each server component became a client component. The data-loading `await Promise.all([...])` became a single API call; the rendering code is unchanged. `searchParams`/`params` became `useSearchParams`/`useParams`.
- Components that used `await getI18n()` now use the `useI18n()` hook.
- `OwnerNav`'s data (`layout.tsx`) comes from `GET /api/nav`.
- `proxy.ts` still redirects visitors without a role cookie, and now skips `/api/*` (the API checks the role itself).

**What stays server-side in the frontend:** only the root layout, which reads the language cookie to set `<html lang>` and pick the right translations for the first paint.

## Behaviour that is deliberately the same

Roles and permissions, all validation rules and messages (and the three languages), the cost snapshot at save time, the demo scenario switch, the import, the CSV export, and all screens.

## Small differences you may notice

- Pages show the loading skeleton while their data loads (as `loading.tsx` did before), then render in the browser instead of arriving as ready-made HTML.
- Changing the language reloads the page (it needs the root layout to re-read the cookie).
- After a save, the open page refetches its data instead of the server re-rendering it.
- The sign-in screen learns the last-used name from `GET /api/session` (the name cookie is HTTP-only).
- The browser tab title is set after the page's data arrives.

## Known follow-ups

- `docs/diagrams/*` and parts of `ARCHITECTURE.md` (sections 4, 6, 7.3) still describe the old Server Actions layout. The new routes are in `API.md`; the diagrams were not regenerated.
- `docs/2026-10-05-fisheye-product-requirements*.html` (the PRD) is unchanged and still accurate for behaviour.
- There is still no real authentication (cookie role only), now enforced by the API on every call.
- No automated tests exist for the API. It was checked by hand: typecheck, lint, production build, and calls to the main read and write routes.
