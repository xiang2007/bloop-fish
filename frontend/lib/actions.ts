"use client";

// The old Server Actions, as plain functions that call the REST API. Names
// and signatures are unchanged, so forms use them exactly as before:
//   useActionState(saveFarm, …)  or  <form action={deleteFarm}>
// Routes are listed in docs/API.md.
import type { FormState } from "@fisheye/shared/forms";
import { safePath } from "@fisheye/shared/redirect";
import { go, invalidate, send } from "./api";

export type { FormState };

type Body = Record<string, string | string[]>;

// FormData -> JSON. Repeated names (the harvest size-grade rows) become arrays.
function toBody(formData: FormData): Body {
  const body: Body = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    body[key] = key in body ? [...[body[key]].flat(), value] : value;
  }
  return body;
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

// A form that shows its own errors: returns the API's FormState, or follows a redirect.
async function submit(method: string, path: string, body: unknown): Promise<FormState> {
  const reply = await send<FormState & { redirect?: string; error?: string }>(method, path, body);
  if (reply.data?.redirect) {
    invalidate();
    go(reply.data.redirect);
    return { status: "success" };
  }
  if (!reply.ok) {
    return reply.data?.status === "error"
      ? reply.data
      : { status: "error", message: reply.data?.error ?? "Something went wrong" };
  }
  invalidate();
  return reply.data;
}

// A button that just does something (delete, reopen). Failures surface as errors.
async function run(method: string, path: string) {
  const reply = await send<{ error?: string }>(method, path);
  if (!reply.ok) throw new Error(reply.data?.error ?? "Something went wrong");
  invalidate();
}

// Create when there is no id, update when there is.
const upsert = (resource: string) => (_prev: FormState, formData: FormData) => {
  const id = text(formData, "id");
  return submit(id ? "PATCH" : "POST", id ? `/${resource}/${id}` : `/${resource}`, toBody(formData));
};

// --- Daily log (worker or owner) ---------------------------------------------
export const saveDailyLog = (_prev: FormState, formData: FormData) => submit("POST", "/daily-logs", toBody(formData));
export const saveSampling = (_prev: FormState, formData: FormData) => submit("POST", "/samplings", toBody(formData));
export const deleteDailyLog = (formData: FormData) => run("DELETE", `/daily-logs/${text(formData, "id")}`);

// --- Ponds and cycles (owner) ------------------------------------------------
export const createPond = (_prev: FormState, formData: FormData) => submit("POST", "/ponds", toBody(formData));
export const updatePond = (_prev: FormState, formData: FormData) =>
  submit("PATCH", `/ponds/${text(formData, "id")}`, toBody(formData));
export const updatePondSpecs = (_prev: FormState, formData: FormData) =>
  submit("PATCH", `/ponds/${text(formData, "id")}/specs`, toBody(formData));
export const recordHarvest = (_prev: FormState, formData: FormData) =>
  submit("POST", `/ponds/${text(formData, "pondId")}/harvests`, toBody(formData));
export const closeCycle = (_prev: FormState, formData: FormData) =>
  submit("POST", `/ponds/${text(formData, "pondId")}/cycle/loss`, toBody(formData));
export const startCycle = (_prev: FormState, formData: FormData) =>
  submit("POST", `/ponds/${text(formData, "pondId")}/cycle/start`, toBody(formData));
export const reopenLastCycle = (formData: FormData) => run("POST", `/ponds/${text(formData, "pondId")}/cycle/reopen`);
export const deleteHarvest = (formData: FormData) => run("DELETE", `/harvests/${text(formData, "id")}`);
export const deleteSampling = (formData: FormData) => run("DELETE", `/samplings/${text(formData, "id")}`);

// --- Catalogues and settings (owner) -----------------------------------------
export const saveFarm = upsert("farms");
export const deleteFarm = (formData: FormData) => run("DELETE", `/farms/${text(formData, "id")}`);
export const saveSizeGrade = upsert("size-grades");
export const saveFeedType = upsert("feed-types");
export const saveBoxKg = (_prev: FormState, formData: FormData) => submit("PUT", "/settings/box-kg", toBody(formData));

// --- Feed stock and import (owner) -------------------------------------------
export const recordStockMovement = (_prev: FormState, formData: FormData) =>
  submit("POST", "/stock-movements", toBody(formData));
export const deleteStockMovement = (formData: FormData) => run("DELETE", `/stock-movements/${text(formData, "id")}`);
// The CSV file travels as multipart, so the form is sent as it is.
export const importSpreadsheet = (_prev: FormState, formData: FormData) => submit("POST", "/imports", formData);
export const deleteImportBatch = (formData: FormData) => run("DELETE", `/imports/${text(formData, "id")}`);

// --- Accounts (owner) --------------------------------------------------------
export const createUser = (_prev: FormState, formData: FormData) => submit("POST", "/users", toBody(formData));
export const saveUser = (_prev: FormState, formData: FormData) =>
  submit("PATCH", `/users/${text(formData, "id")}`, toBody(formData));

// --- Session, language, demo switch ------------------------------------------
// Signing in is a form on the sign-in screen, which shows its own error.
export async function signIn(_prev: FormState & { code?: string }, formData: FormData): Promise<FormState & { code?: string }> {
  const reply = await send<{ redirect?: string; error?: string; code?: string }>("POST", "/session", toBody(formData));
  if (!reply.ok) {
    return { status: "error", message: reply.data?.error ?? "Something went wrong", code: reply.data?.code };
  }
  invalidate();
  go(reply.data.redirect ?? "/");
  return { status: "success" };
}

export async function signOut() {
  const reply = await send<{ redirect: string }>("DELETE", "/session");
  invalidate();
  go(reply.data?.redirect ?? "/select-role");
}

// Ends this account's sessions on every device, including this one.
export async function signOutEverywhere() {
  const reply = await send<{ redirect: string }>("DELETE", "/session/all");
  invalidate();
  go(reply.data?.redirect ?? "/select-role");
}
export async function setLocale(formData: FormData) {
  await send("PUT", "/locale", { locale: text(formData, "locale") });
  // The page text comes from the root layout, which reads the language cookie.
  window.location.reload();
}

// Pond and farm ids differ between the real farm and the demo, so pages that
// show one of them go back to the section's top page.
export async function setScenario(formData: FormData) {
  await send("PUT", "/scenario", { scenario: text(formData, "scenario") });
  const from = text(formData, "from") || "/";
  invalidate();
  go(
    from.startsWith("/log")
      ? "/log"
      : from.startsWith("/farms/")
        ? "/farms"
        : from.startsWith("/ponds/") || !safePath(from)
          ? "/"
          : from,
  );
}
