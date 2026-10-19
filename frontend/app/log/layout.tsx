"use client";

import Link from "next/link";
import { signOut } from "@/lib/actions";
import { useApi } from "@/lib/api";
import type { Session } from "@backend/lib/session";
import { ArrowLeftIcon, BrandMark, LogoutIcon, UserIcon } from "../components/icons";
import { useI18n } from "../components/I18nProvider";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const session = useApi<{ session: Session | null }>("/session").data?.session ?? null;
  const { t } = useI18n();

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4">
          <Link href="/log" className="flex items-center gap-2.5">
            <BrandMark className="size-8" />
            <span className="hidden font-semibold tracking-tight text-ink min-[380px]:inline">Fisheye</span>
            <span className="hidden rounded-md bg-surface-3 px-1.5 py-0.5 text-xs font-medium text-ink-2 sm:inline">
              {t("nav.dailyLog")}
            </span>
          </Link>
          <div className="flex min-w-0 items-center gap-1">
            <LanguageSwitcher />
            {session?.role === "owner" ? (
              <Link
                href="/"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-ink-2 hover:bg-surface-3"
                aria-label={t("log.dashboard")}
                title={t("log.dashboard")}
              >
                <ArrowLeftIcon className="size-4" />
                <span className="hidden sm:inline">{t("log.dashboard")}</span>
              </Link>
            ) : (
              session?.name && (
                <span className="inline-flex h-9 max-w-28 items-center gap-1.5 px-2 text-sm text-ink-2 sm:max-w-none">
                  <UserIcon className="size-4 shrink-0" />
                  <span className="truncate">{session.name}</span>
                </span>
              )
            )}
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex size-9 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink"
                aria-label={t("log.switchUser")}
                title={t("log.switchUser")}
              >
                <LogoutIcon className="size-4.5" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-28">{children}</main>
    </div>
  );
}
