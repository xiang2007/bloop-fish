"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { signOut } from "@/lib/actions";
import type { MessageKey } from "@fisheye/shared/i18n/messages/en";
import { useI18n } from "../components/I18nProvider";
import LanguageSwitcher from "../components/LanguageSwitcher";
import ScenarioSwitch from "../components/ScenarioSwitch";
import { MANY_PONDS } from "@/lib/farmMap";
import type { Scenario } from "@fisheye/shared/scenario";
import {
  BrandMark,
  ChevronDownIcon,
  ClipboardIcon,
  GridIcon,
  HarvestIcon,
  LogoutIcon,
  MapIcon,
  MenuIcon,
  PackageIcon,
  SettingsIcon,
  UploadIcon,
  WavesIcon,
  XIcon,
} from "../components/icons";
import { SPRING } from "../components/motion";
import { cx } from "../components/ui";


// The first TOP_ITEMS sit above the pond list; the rest are operations.
const TOP_ITEMS = 3;
const NAV: { href: string; label: MessageKey; icon: typeof GridIcon }[] = [
  { href: "/", label: "nav.overview", icon: GridIcon },
  { href: "/farms", label: "nav.farmMap", icon: MapIcon },
  { href: "/harvests", label: "nav.harvests", icon: HarvestIcon },
  { href: "/log", label: "nav.dailyLog", icon: ClipboardIcon },
  { href: "/inventory", label: "nav.feedStock", icon: PackageIcon },
  { href: "/import", label: "nav.import", icon: UploadIcon },
  { href: "/settings", label: "nav.settings", icon: SettingsIcon },
];

function isActive(pathname: string, href: string) {
  // The farm map's own farm pages (/farms/3) are sidebar items of their own.
  return href === "/" || href === "/farms" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export default function OwnerNav({
  ponds,
  readyPonds,
  userName,
  scenario,
}: {
  ponds: { id: number; name: string; farm: { id: number; name: string } | null }[];
  readyPonds: ReadyPond[];
  userName: string | null;
  /** Null when the demo scenario hasn't been built, which hides the switch. */
  scenario: Scenario | null;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const pondItem = (pond: (typeof ponds)[number]) => (
    <NavItem
      key={pond.id}
      href={`/ponds/${pond.id}`}
      label={pond.name}
      icon={WavesIcon}
      active={isActive(pathname, `/ponds/${pond.id}`)}
    />
  );

  // With many ponds the list is grouped by farm. Each farm opens its own map,
  // and its ponds fold out under it; the farm being viewed starts open.
  const grouped = ponds.length > MANY_PONDS;
  const farms = new Map<number, { id: number; name: string; ponds: typeof ponds }>();
  for (const pond of ponds) {
    if (!pond.farm) continue;
    const farm = farms.get(pond.farm.id) ?? { ...pond.farm, ponds: [] };
    farm.ponds.push(pond);
    farms.set(pond.farm.id, farm);
  }
  const unassigned = ponds.filter((pond) => !pond.farm);
  const viewingFarm = (farm: { id: number; ponds: typeof ponds }) =>
    isActive(pathname, `/farms/${farm.id}`) || farm.ponds.some((pond) => isActive(pathname, `/ponds/${pond.id}`));
  const [toggled, setToggled] = useState<Record<number, boolean>>({});
  const farmOpen = (farm: { id: number; ponds: typeof ponds }) => toggled[farm.id] ?? viewingFarm(farm);

  const [open, setOpen] = useState(false);
  // Close the phone drawer after navigating.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const body = (
    <>
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label={t("nav.main")}>
        <ul className="space-y-0.5">
          {NAV.slice(0, TOP_ITEMS).map((item) => (
            <NavItem key={item.href} {...item} label={t(item.label)} active={isActive(pathname, item.href)} />
          ))}
        </ul>

        <p className="mt-6 mb-2 px-3 text-[11px] font-semibold tracking-wider text-sidebar-muted uppercase">
          {grouped ? t("nav.farms") : t("nav.ponds")}
        </p>
        {grouped ? (
          <ul className="space-y-0.5">
            {[...farms.values()].map((farm) => {
              const expanded = farmOpen(farm);
              return (
                <li key={farm.id}>
                  <div className="flex items-center gap-0.5">
                    <ul className="min-w-0 flex-1">
                      <NavItem
                        href={`/farms/${farm.id}`}
                        label={farm.name}
                        icon={MapIcon}
                        count={farm.ponds.length}
                        active={isActive(pathname, `/farms/${farm.id}`)}
                      />
                    </ul>
                    <button
                      type="button"
                      onClick={() => setToggled((state) => ({ ...state, [farm.id]: !expanded }))}
                      aria-expanded={expanded}
                      aria-label={t("nav.farmPonds", { count: farm.ponds.length })}
                      className="flex size-9 shrink-0 items-center justify-center rounded-md text-sidebar-muted hover:bg-white/5 hover:text-white"
                    >
                      <ChevronDownIcon className={cx("size-4 transition-transform", expanded && "rotate-180")} />
                    </button>
                  </div>
                  {expanded && (
                    <ul className="my-1 ml-5 space-y-0.5 border-l border-white/10 pl-2">{farm.ponds.map(pondItem)}</ul>
                  )}
                </li>
              );
            })}
            {unassigned.map(pondItem)}
          </ul>
        ) : (
          <ul className="space-y-0.5">{ponds.map(pondItem)}</ul>
        )}

        <p className="mt-6 mb-2 px-3 text-[11px] font-semibold tracking-wider text-sidebar-muted uppercase">
          {t("nav.operations")}
        </p>
        <ul className="space-y-0.5">
          {NAV.slice(TOP_ITEMS).map((item) => (
            <NavItem key={item.href} {...item} label={t(item.label)} active={isActive(pathname, item.href)} />
          ))}
        </ul>
      </nav>

      <div className="border-t border-white/10 p-3">
        {scenario && <ScenarioSwitch scenario={scenario} className="mb-2" />}
        <LanguageSwitcher tone="dark" className="mb-2 w-full [&>select]:w-full" />
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
            {(userName ?? "Owner").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{userName ?? t("nav.farmOwner")}</p>
            <p className="text-xs text-sidebar-muted">{t("nav.ownerWorkspace")}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex size-8 items-center justify-center rounded-md text-sidebar-muted hover:bg-white/10 hover:text-white"
              aria-label={t("nav.switchRole")}
              title={t("nav.switchRole")}
            >
              <LogoutIcon className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar text-sidebar-ink lg:flex">
        <Link href="/" className="flex h-16 items-center gap-3 px-5">
          <BrandMark className="size-8" />
          <span className="text-[17px] font-semibold tracking-tight text-white">Fisheye</span>
        </Link>
        {body}
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-white/10 bg-sidebar px-3 text-sidebar-ink lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex size-10 items-center justify-center rounded-md text-sidebar-ink hover:bg-white/10"
          aria-label={t("nav.openMenu")}
          aria-expanded={open}
        >
          <MenuIcon className="size-5" />
        </button>
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark className="size-7" />
          <span className="font-semibold tracking-tight text-white">Fisheye</span>
        </Link>
      </header>

      <div className={cx("fixed inset-0 z-50 lg:hidden", !open && "pointer-events-none")} aria-hidden={!open}>
        <div
          onClick={() => setOpen(false)}
          className={cx("absolute inset-0 bg-black/50 transition-opacity duration-200", open ? "opacity-100" : "opacity-0")}
        />
        <aside
          inert={!open}
          className={cx(
            "absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-ink shadow-xl transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-14 items-center justify-between pr-2 pl-5">
            <Link href="/" className="flex items-center gap-3">
              <BrandMark className="size-7" />
              <span className="font-semibold tracking-tight text-white">Fisheye</span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex size-10 items-center justify-center rounded-md text-sidebar-muted hover:bg-white/10 hover:text-white"
              aria-label={t("nav.closeMenu")}
            >
              <XIcon className="size-5" />
            </button>
          </div>
          {body}
        </aside>
      </div>

      <HarvestBubble ready={readyPonds} />
    </>
  );
}

type ReadyPond = { id: number; name: string; farm: string | null; kg: number; daysPast: number };

// Phone-only floating bubble: the count of ponds ready to harvest, which
// opens a small popup listing them.
function HarvestBubble({ ready }: { ready: ReadyPond[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  if (ready.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2 lg:hidden">
      {open && (
        <div
          role="dialog"
          aria-label={t("overview.readyTitle")}
          className="flex max-h-[60dvh] w-72 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
        >
          <p className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
            {t("overview.readyTitleCount", { n: ready.length })}
          </p>
          <ul className="divide-y divide-line overflow-y-auto">
            {ready.map((pond) => (
              <li key={pond.id}>
                <Link href={`/ponds/${pond.id}?view=cycle`} className="block px-4 py-2.5 hover:bg-surface-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium text-ink">{pond.name}</span>
                    <span className="shrink-0 font-mono text-xs text-ink-2 tabular-nums">~{Math.round(pond.kg)} kg</span>
                  </div>
                  <p className="truncate text-xs text-ink-3">
                    {[pond.farm, pond.daysPast > 0 ? t("cycle.readyPast", { n: pond.daysPast }) : t("cycle.harvestToday")]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={t("overview.readyTitleCount", { n: ready.length })}
        className="relative flex size-12 items-center justify-center rounded-full text-white shadow-lg"
        style={{ backgroundColor: "var(--stage-5)" }}
      >
        {open ? <XIcon className="size-5" /> : <HarvestIcon className="size-6" />}
        {!open && (
          <span className="absolute -top-1 -left-1 flex min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-semibold text-surface">
            {ready.length}
          </span>
        )}
      </button>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  count,
}: {
  href: string;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactNode;
  active: boolean;
  count?: number;
}) {
  return (
    <li className="relative">
      {active && <ActivePill layoutId="sidebar-active" />}
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cx(
          "relative flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
          active ? "text-white" : "text-sidebar-ink/80 hover:bg-white/5 hover:text-white",
        )}
      >
        <Icon className={cx("size-4.5", active ? "text-white" : "text-sidebar-muted")} />
        <span className="flex-1 truncate">{label}</span>
        {count !== undefined && <span className="font-mono text-[11px] text-sidebar-muted tabular-nums">{count}</span>}
      </Link>
    </li>
  );
}

// The active item's highlight, which slides between items on navigation
// (the shared-layout pattern from SmoothUI's animated-tabs).
function ActivePill({ layoutId }: { layoutId: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.span
      layoutId={layoutId}
      transition={reduceMotion ? { duration: 0 } : SPRING}
      className="absolute inset-0 rounded-md bg-sidebar-active"
    />
  );
}
