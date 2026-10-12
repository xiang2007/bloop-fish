import { getScenario, isLargeScenarioAvailable } from "@/lib/prisma";
import { getPondsWithMetrics } from "@/lib/queries";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import OwnerNav from "./OwnerNav";

export default async function OwnerLayout({ children }: LayoutProps<"/">) {
  // The proxy only reads the cookie; this re-checks the account in the database.
  const current = await getSession();
  if (!current) redirect("/select-role");
  if (current.role !== "owner") redirect("/log");

  const [entries, session, scenario, canSwitch] = await Promise.all([
    getPondsWithMetrics(),
    getSession(),
    getScenario(),
    isLargeScenarioAvailable(),
  ]);

  const ponds = entries.map(({ pond, farm }) => ({ id: pond.id, name: pond.name, farm }));
  const readyPonds = entries
    .filter((entry) => entry.harvestability === "ready")
    .map(({ pond, farm, metrics, cycle }) => ({
      id: pond.id,
      name: pond.name,
      farm: farm?.name ?? null,
      kg: metrics.estimatedHarvestKg,
      daysPast: cycle.state === "ready" && cycle.daysToHarvest < 0 ? -cycle.daysToHarvest : 0,
    }));

  return (
    <div className="min-h-dvh lg:pl-64">
      <OwnerNav
        ponds={ponds}
        readyPonds={readyPonds}
        userName={session?.name ?? null}
        scenario={canSwitch ? scenario : null}
      />
      <main className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
    </div>
  );
}
