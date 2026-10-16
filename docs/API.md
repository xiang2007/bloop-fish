# Fisheye REST API

The backend (`backend/`, Hono on Node) serves everything under `/api`. The web app never calls it directly from another origin: Next.js forwards `/api/*` to the backend (`frontend/next.config.ts`, `BACKEND_URL`, default `http://localhost:4000`), so cookies stay same-origin and there is no CORS.

## Conventions

- **Format.** JSON in, JSON out. The one exception is `POST /api/imports` (multipart, because it carries the CSV) and `GET /api/ponds/:id/export` (CSV).
- **Dates.** Timestamps are ISO strings (`2026-10-05T00:00:00.000Z`). The web app turns them back into `Date` objects (`frontend/lib/api.ts`). Calendar days are plain `YYYY-MM-DD` strings (Asia/Kuala_Lumpur).
- **Sign-in.** Cookies `fisheye_role` (`owner` | `worker`) and `fisheye_name`. There is no password: the role is chosen on the sign-in screen. See "Known gaps" in `ARCHITECTURE.md`.
- **Language and demo switch.** Cookies `fisheye_lang` (`en`, `zh`, `ms`) and `fisheye-scenario` (`real`, `large`) are read on every request. Validation messages come back in the user's language.
- **Errors.** `{ "error": "message" }` with 400, 401 (not signed in), 403 (wrong role), 404 or 500.
- **Writes.** A form-style write answers one of:
  - `200 { "status": "success", "message"? }`
  - `200 { "redirect": "/ponds/3" }` (the web app navigates there)
  - `422 { "status": "error", "message", "fieldErrors": { field: message } }` (validation problem; nothing saved)
  The request body is a flat JSON object of the form fields (all values strings). Repeated fields are arrays (`gradeId`, `lineKg`, `lineFish` on a harvest). Ids in the URL override any `id` in the body.

## Session, language, demo switch (no role needed)

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/api/session` | | `{ session: { userId, role, name } \| null }` |
| POST | `/api/session` | `username`, `password`, `next?` | Signs in with an account; sets the signed session cookie. `{ redirect }` (workers always land under `/log`). 401 `code: invalid` for a wrong login, 429 `code: locked` when throttled |
| DELETE | `/api/session` | | Signs out. `{ redirect: "/select-role" }` |
| DELETE | `/api/session/all` | | Signs out of every device (bumps the account's `sessionVersion`) |
| POST | `/api/users` | `name`, `username`, `password`, `role` | Owner only: add an account |
| PATCH | `/api/users/:id` | `role`, `active`, `password?` | Owner only: change role, deactivate, reset password |
| PUT | `/api/locale` | `locale` | Sets the language cookie |
| PUT | `/api/scenario` | `scenario` | Switches real farm / 100-pond demo |
| GET | `/api/health` | | `{ ok: true }` |

## Reading (one call per screen)

Each returns exactly what the matching screen needs, assembled in `backend/src/lib/pages.ts`.

| Path | Role | Screen | Response |
|---|---|---|---|
| `GET /api/nav` | owner | sidebar | `{ ponds, readyPonds, userName, scenario }` |
| `GET /api/overview` | owner | `/` | `{ today, ponds, stock, batches, activity, farms, boxKg, monthCost }` |
| `GET /api/farm-map` | owner | `/farms`, `/farms/[id]` | `{ today, ponds, farms, boxKg }` |
| `GET /api/harvests` | owner | `/harvests` | `{ harvests, ponds, cycles }` |
| `GET /api/inventory` | owner | `/inventory` | `{ stock: { horizon, levels }, movements }` |
| `GET /api/settings` | owner | `/settings` | `{ ponds, feedTypes, farms, grades, boxKg }` |
| `GET /api/import` | owner | `/import` | `{ ponds, feedTypes }` |
| `GET /api/ponds/:id` | owner | `/ponds/[id]` (all tabs) | `{ today, detail, feedTypes, boxKg, grades, farms, suggestion }`; 404 for an unknown pond |
| `GET /api/ponds/:id/export` | owner | CSV button | `text/csv` attachment |
| `GET /api/log?date=` | any | `/log` | `{ date, today, ponds, session }` |
| `GET /api/log/ponds/:id?date=` | any | `/log/[pondId]` | `{ date, today, pond, feedTypes, session, previous }` |

`date` defaults to today and is never later than today.

## Writing

| Method | Path | Role | What it does | Fields |
|---|---|---|---|---|
| POST | `/api/daily-logs` | any | Save a day (updates if that pond and day exist) | `pondId, date, feedTypeId, bags, deadCount, note, returnTo` |
| DELETE | `/api/daily-logs/:id` | any (worker: own, last 7 days) | Remove a day | |
| POST | `/api/samplings` | any | Record a sample weighing | `pondId, date, fishCount, totalWeightKg` |
| DELETE | `/api/samplings/:id` | owner | Remove a sample | |
| POST | `/api/ponds` | owner | Add a pond | `name, species, stockedAt, farmId` |
| PATCH | `/api/ponds/:id` | owner | Edit pond and running cycle | `name, species, stockedAt, stockedCount, assumedFcr, cycleMonths, targetWeightKg, farmId, active` |
| PATCH | `/api/ponds/:id/specs` | owner | Physical specs and water status | `areaM2, depthM, aerators, pondType, waterSource, waterStatus, waterNote, waterCheckedAt` |
| POST | `/api/ponds/:id/harvests` | owner | Record a harvest; `isFinal=on` closes the cycle | `date, boxes, fishCount, note, isFinal, gradeId[], lineKg[], lineFish[]` |
| DELETE | `/api/harvests/:id` | owner | Remove a harvest of the running cycle | |
| POST | `/api/ponds/:id/cycle/loss` | owner | Close the cycle as a total loss | `endedAt, fishCount, cause, note` |
| POST | `/api/ponds/:id/cycle/start` | owner | Restock an empty pond | `stockedAt, stockedCount` |
| POST | `/api/ponds/:id/cycle/reopen` | owner | Undo the last close | |
| POST / PATCH | `/api/farms`, `/api/farms/:id` | owner | Add / rename a farm | `name` |
| DELETE | `/api/farms/:id` | owner | Delete a farm (its ponds stay) | |
| POST / PATCH | `/api/size-grades`, `/api/size-grades/:id` | owner | Add / edit a size grade | `label, minKg, maxKg, sortOrder, active` |
| POST / PATCH | `/api/feed-types`, `/api/feed-types/:id` | owner | Add / edit a feed | `code, packSizeKg, pricePerKg, active` |
| PUT | `/api/settings/box-kg` | owner | Box weight | `boxKg` |
| POST | `/api/stock-movements` | owner | Stocktake or delivery | `feedTypeId, kind, date, bags, note` |
| DELETE | `/api/stock-movements/:id` | owner | Remove a movement | |
| POST | `/api/imports` | owner | Import a Pond report CSV (multipart) | `file, target, newPondName, species` |
| DELETE | `/api/imports/:id` | owner | Roll back an import | |

Validation rules for each write are unchanged from the old Server Actions; they live in `backend/src/lib/actions/`.
