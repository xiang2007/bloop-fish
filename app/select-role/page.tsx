import type { Metadata } from "next";
import { signIn } from "../actions/session";
import { ArrowRightIcon, BrandMark, ChartIcon, ClipboardIcon, FileIcon, UserIcon } from "../components/icons";
import { buttonClass, inputClass } from "../components/ui";
import { getI18n } from "@/lib/i18n/server";
import LanguageSwitcher from "../components/LanguageSwitcher";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("signin.title") };
}

export default async function SelectRolePage({ searchParams }: PageProps<"/select-role">) {
  const { next, error } = await searchParams;
  const { t } = await getI18n();
  const nextPath = typeof next === "string" ? next : "";
  const errorMessage =
    error === "invalid" ? t("signin.invalid") : error === "locked" ? t("signin.locked") : null;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(900px 500px at 10% 110%, rgba(20,163,173,0.35), transparent 60%), radial-gradient(700px 400px at 100% 0%, rgba(11,110,121,0.35), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <BrandMark className="size-9" />
          <span className="text-lg font-semibold tracking-tight">Fisheye</span>
        </div>

        <div className="relative max-w-xl">
          <p className="mb-4 text-sm font-medium text-[#9fc9cd]">{t("signin.eyebrow")}</p>
          <h1 className="text-balance text-[44px] leading-[1.1] font-semibold tracking-tight">
            {t("signin.headline")}
          </h1>
          <p className="mt-5 max-w-lg text-pretty text-base leading-7 text-sidebar-ink/75">
            {t("signin.intro")}
          </p>

          <ul className="mt-10 grid gap-4 text-sm text-sidebar-ink/85 sm:grid-cols-3">
            <HeroPoint icon={<FileIcon className="size-4" />} title={t("signin.point1Title")}>
              {t("signin.point1")}
            </HeroPoint>
            <HeroPoint icon={<ClipboardIcon className="size-4" />} title={t("signin.point2Title")}>
              {t("signin.point2")}
            </HeroPoint>
            <HeroPoint icon={<ChartIcon className="size-4" />} title={t("signin.point3Title")}>
              {t("signin.point3")}
            </HeroPoint>
          </ul>
        </div>

        <p className="relative text-xs text-sidebar-muted">{t("signin.phase")}</p>
      </section>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <BrandMark className="size-9" />
            <span className="text-lg font-semibold tracking-tight text-ink">Fisheye</span>
          </div>

          <h2 className="text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {t("signin.heading")}
          </h2>
          <p className="mt-2 text-pretty text-sm leading-6 text-ink-2">{t("signin.headingHelp")}</p>
          <LanguageSwitcher className="mt-4" />

          <form action={signIn} className="mt-8 rounded-lg border border-line bg-surface p-5">
            <input type="hidden" name="next" value={nextPath} />
            <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-ink-2">
              {t("signin.username")}
            </label>
            <div className="relative">
              <UserIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
              <input
                id="username"
                name="username"
                required
                maxLength={40}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className={`${inputClass} h-11 pl-9 text-base`}
              />
            </div>
            <label htmlFor="password" className="mt-3 mb-1.5 block text-sm font-medium text-ink-2">
              {t("signin.password")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={`${inputClass} h-11 text-base`}
            />
            {errorMessage && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {errorMessage}
              </p>
            )}
            <button type="submit" className={`${buttonClass("primary", "md")} mt-4 w-full`}>
              {t("signin.submit")}
              <ArrowRightIcon className="size-4" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

function HeroPoint({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-white/10 bg-white/5 p-4">
      <span className="mb-3 flex size-7 items-center justify-center rounded-md bg-white/10 text-[#9fc9cd]">{icon}</span>
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-sidebar-ink/70">{children}</p>
    </li>
  );
}
