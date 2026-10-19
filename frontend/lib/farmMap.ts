import { estimateBoxes } from "@fisheye/shared/harvest";
import type { PondWithMetrics } from "@backend/lib/queries";

// Past this many ponds, screens switch from showing every pond to a card
// per farm (the sidebar, overview, farm map and daily log all follow it).
export const MANY_PONDS = 12;

// Ponds grouped under their farm for the farm map; ponds without a farm go
// last under `unassignedName`.
export function buildFarmGroups(
  ponds: PondWithMetrics[],
  farms: { id: number; name: string }[],
  boxKg: number,
  unassignedName: string,
) {
  const toMapPond = (entry: PondWithMetrics) => ({
    pond: entry.pond,
    cycle: entry.cycle,
    harvestability: entry.harvestability,
    health: entry.health,
    timing: entry.timing,
    estimatedKg: entry.metrics.estimatedHarvestKg,
    boxes: estimateBoxes(entry.metrics.estimatedHarvestKg, boxKg),
  });
  const groups = farms.map((farm) => ({
    id: farm.id as number | null,
    name: farm.name,
    ponds: ponds.filter((entry) => entry.farm?.id === farm.id).map(toMapPond),
  }));
  const unassigned = ponds.filter((entry) => !entry.farm);
  if (unassigned.length > 0) groups.push({ id: null, name: unassignedName, ponds: unassigned.map(toMapPond) });
  return groups;
}
