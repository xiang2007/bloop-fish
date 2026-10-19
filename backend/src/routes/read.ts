import { Hono } from "hono";
import { isDayKey, todayKey } from "@fisheye/shared/dates";
import { HttpError } from "../lib/http";
import { requireOwner, requireSession } from "../lib/session";
import { dailyRecordsCsv } from "../lib/exportCsv";
import {
  farmMapData,
  harvestsData,
  importData,
  inventoryData,
  logDayData,
  logEntryData,
  navData,
  overviewData,
  pondPageData,
  settingsData,
} from "../lib/pages";

// Read-only screens. Owner screens need the owner role; the daily log
// screens are open to any signed-in user.
export const readRoutes = new Hono();

function idParam(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id)) throw new HttpError(404, "Not found");
  return id;
}

// A date from ?date=, never in the future.
function dayParam(value: string | undefined) {
  const today = todayKey();
  return value && isDayKey(value) && value <= today ? value : today;
}

readRoutes.get("/nav", async (c) => {
  await requireOwner();
  return c.json(await navData());
});
readRoutes.get("/overview", async (c) => {
  await requireOwner();
  return c.json(await overviewData());
});
readRoutes.get("/farm-map", async (c) => {
  await requireOwner();
  return c.json(await farmMapData());
});
readRoutes.get("/harvests", async (c) => {
  await requireOwner();
  return c.json(await harvestsData());
});
readRoutes.get("/inventory", async (c) => {
  await requireOwner();
  return c.json(await inventoryData());
});
readRoutes.get("/settings", async (c) => {
  const me = await requireOwner();
  return c.json(await settingsData(me.userId));
});
readRoutes.get("/import", async (c) => {
  await requireOwner();
  return c.json(await importData());
});

readRoutes.get("/ponds/:id", async (c) => {
  await requireOwner();
  const data = await pondPageData(idParam(c.req.param("id")));
  if (!data) throw new HttpError(404, "Pond not found");
  return c.json(data);
});

readRoutes.get("/ponds/:id/export", async (c) => {
  await requireOwner();
  const result = await dailyRecordsCsv(idParam(c.req.param("id")));
  if (!result) throw new HttpError(404, "Pond not found");
  return new Response(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
});

readRoutes.get("/log", async (c) => {
  await requireSession();
  const date = dayParam(c.req.query("date"));
  return c.json({ date, today: todayKey(), ...(await logDayData(date)) });
});

readRoutes.get("/log/ponds/:id", async (c) => {
  await requireSession();
  const date = dayParam(c.req.query("date"));
  const data = await logEntryData(idParam(c.req.param("id")), date);
  if (!data) throw new HttpError(404, "Pond not found");
  return c.json({ date, today: todayKey(), ...data });
});
