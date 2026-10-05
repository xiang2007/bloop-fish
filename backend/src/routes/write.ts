import { Hono, type Context } from "hono";
import type { ActionResult } from "@fisheye/shared/forms";
import { Fields } from "../lib/http";
import { deleteDailyLog, saveDailyLog, saveSampling } from "../lib/actions/logs";
import {
  closeCycle,
  createPond,
  deleteFarm,
  deleteHarvest,
  deleteImportBatch,
  deleteSampling,
  deleteStockMovement,
  importSpreadsheet,
  recordHarvest,
  recordStockMovement,
  reopenLastCycle,
  saveBoxKg,
  saveFarm,
  saveFeedType,
  saveSizeGrade,
  startCycle,
  updatePond,
  updatePondSpecs,
} from "../lib/actions/owner";

// Every change to the data. Each handler is the old Server Action, unchanged
// apart from how it receives its input: the JSON body becomes `Fields`, and
// the URL carries the ids. Answers are { status, message?, fieldErrors? },
// { redirect }, or { status: "success" } for deletes.
export const writeRoutes = new Hono();

type Body = Record<string, unknown>;

async function bodyOf(c: Context): Promise<Body> {
  return (await c.req.json().catch(() => ({}))) as Body;
}

// A validation problem is a 422 so the web app can tell it from a success.
function respond(c: Context, result: ActionResult | void) {
  if (!result) return c.json({ status: "success" });
  if ("status" in result && result.status === "error") return c.json(result, 422);
  return c.json(result);
}

// Body plus the ids from the URL (the URL wins).
async function fieldsOf(c: Context, ids: Body = {}) {
  return new Fields({ ...(await bodyOf(c)), ...ids });
}

// Daily records and samples (worker or owner)
writeRoutes.post("/daily-logs", async (c) => respond(c, await saveDailyLog(await fieldsOf(c))));
writeRoutes.delete("/daily-logs/:id", async (c) => respond(c, await deleteDailyLog(new Fields({ id: c.req.param("id") }))));
writeRoutes.post("/samplings", async (c) => respond(c, await saveSampling(await fieldsOf(c))));
writeRoutes.delete("/samplings/:id", async (c) => respond(c, await deleteSampling(new Fields({ id: c.req.param("id") }))));

// Ponds and their cycle (owner)
writeRoutes.post("/ponds", async (c) => respond(c, await createPond(await fieldsOf(c))));
writeRoutes.patch("/ponds/:id", async (c) => respond(c, await updatePond(await fieldsOf(c, { id: c.req.param("id") }))));
writeRoutes.patch("/ponds/:id/specs", async (c) => respond(c, await updatePondSpecs(await fieldsOf(c, { id: c.req.param("id") }))));
writeRoutes.post("/ponds/:id/harvests", async (c) => respond(c, await recordHarvest(await fieldsOf(c, { pondId: c.req.param("id") }))));
writeRoutes.post("/ponds/:id/cycle/loss", async (c) => respond(c, await closeCycle(await fieldsOf(c, { pondId: c.req.param("id") }))));
writeRoutes.post("/ponds/:id/cycle/start", async (c) => respond(c, await startCycle(await fieldsOf(c, { pondId: c.req.param("id") }))));
writeRoutes.post("/ponds/:id/cycle/reopen", async (c) => respond(c, await reopenLastCycle(new Fields({ pondId: c.req.param("id") }))));
writeRoutes.delete("/harvests/:id", async (c) => respond(c, await deleteHarvest(new Fields({ id: c.req.param("id") }))));

// Catalogues and settings (owner)
writeRoutes.post("/farms", async (c) => respond(c, await saveFarm(await fieldsOf(c))));
writeRoutes.patch("/farms/:id", async (c) => respond(c, await saveFarm(await fieldsOf(c, { id: c.req.param("id") }))));
writeRoutes.delete("/farms/:id", async (c) => respond(c, await deleteFarm(new Fields({ id: c.req.param("id") }))));
writeRoutes.post("/size-grades", async (c) => respond(c, await saveSizeGrade(await fieldsOf(c))));
writeRoutes.patch("/size-grades/:id", async (c) => respond(c, await saveSizeGrade(await fieldsOf(c, { id: c.req.param("id") }))));
writeRoutes.post("/feed-types", async (c) => respond(c, await saveFeedType(await fieldsOf(c))));
writeRoutes.patch("/feed-types/:id", async (c) => respond(c, await saveFeedType(await fieldsOf(c, { id: c.req.param("id") }))));
writeRoutes.put("/settings/box-kg", async (c) => respond(c, await saveBoxKg(await fieldsOf(c))));

// Feed stock (owner)
writeRoutes.post("/stock-movements", async (c) => respond(c, await recordStockMovement(await fieldsOf(c))));
writeRoutes.delete("/stock-movements/:id", async (c) => respond(c, await deleteStockMovement(new Fields({ id: c.req.param("id") }))));

// Spreadsheet import (owner). multipart/form-data, because it carries the CSV.
writeRoutes.post("/imports", async (c) => {
  const form = await c.req.parseBody();
  const file = form.file instanceof File ? form.file : null;
  return respond(c, await importSpreadsheet(new Fields(form), file));
});
writeRoutes.delete("/imports/:id", async (c) => respond(c, await deleteImportBatch(new Fields({ id: c.req.param("id") }))));
