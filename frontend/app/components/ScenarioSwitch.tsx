"use client";

import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { setScenario } from "@/lib/actions";
import type { Scenario } from "@fisheye/shared/scenario";
import { useI18n } from "./I18nProvider";
import { cx } from "./ui";

// Two-way switch between the real farm and the 100-pond demo scenario.
export default function ScenarioSwitch({ scenario, className }: { scenario: Scenario; className?: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  return (
    <form action={setScenario} className={className}>
      <input type="hidden" name="from" value={pathname} />
      <Options scenario={scenario} labels={{ real: t("nav.scenarioReal"), large: t("nav.scenarioLarge") }} label={t("nav.scenario")} />
    </form>
  );
}

function Options({ scenario, labels, label }: { scenario: Scenario; labels: Record<Scenario, string>; label: string }) {
  const { pending, data } = useFormStatus();
  const shown = pending ? (data?.get("scenario") as Scenario) : scenario;
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-0.5 rounded-md bg-white/5 p-0.5">
      {(["real", "large"] as const).map((value) => (
        <button
          key={value}
          type="submit"
          name="scenario"
          value={value}
          aria-pressed={shown === value}
          disabled={pending}
          className={cx(
            "h-7 rounded px-2 text-xs font-medium whitespace-nowrap transition-colors",
            shown === value ? "bg-sidebar-active text-white" : "text-sidebar-muted hover:text-white",
            pending && "cursor-wait",
          )}
        >
          {labels[value]}
        </button>
      ))}
    </div>
  );
}
