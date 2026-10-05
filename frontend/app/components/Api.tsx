"use client";

import { useEffect, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { go, useApi } from "@/lib/api";
import { useI18n } from "./I18nProvider";

// Loading placeholder shown while a page's data is on its way.
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="…">
      <div className="shimmer h-4 w-40 rounded" />
      <div className="shimmer mt-3 h-8 w-72 max-w-full rounded-lg" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-32 rounded-lg border border-line bg-surface p-5">
            <div className="shimmer h-3.5 w-24 rounded" />
            <div className="shimmer mt-4 h-7 w-32 rounded-md" />
            <div className="shimmer mt-3 h-3 w-20 rounded" />
          </div>
        ))}
      </div>
      <div className="mt-6 h-80 rounded-lg border border-line bg-surface p-5">
        <div className="shimmer h-4 w-36 rounded" />
        <div className="shimmer mt-6 h-56 rounded-lg" />
      </div>
    </div>
  );
}

// Fetches `path` from the API and renders the page once the data is there.
// 401 sends the user to sign in, 403 to the worker screen, 404 to Next's not-found page.
export function Api<T>({ path, children }: { path: string; children: (data: T) => ReactNode }) {
  const { data, error } = useApi<T>(path);
  const redirectTo =
    error?.status === 401 ? `/select-role?next=${encodeURIComponent(window.location.pathname)}` : error?.status === 403 ? "/log" : null;

  useEffect(() => {
    if (redirectTo) go(redirectTo);
  }, [redirectTo]);

  if (error?.status === 404) notFound();
  if (error && !redirectTo) return <ErrorNotice message={error.message} />;
  if (!data) return <PageSkeleton />;
  return <>{children(data)}</>;
}

function ErrorNotice({ message }: { message: string }) {
  const { t } = useI18n();
  return (
    <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
      {t("error.loadFailed")} {message}
    </p>
  );
}

// Sets the browser tab title, e.g. "Pond 1 · Fisheye" (`bare` leaves off the suffix).
export function useTitle(title: string | null | undefined, bare = false) {
  useEffect(() => {
    if (title) document.title = bare ? title : `${title} · Fisheye`;
  }, [title, bare]);
}
