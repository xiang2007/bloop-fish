// The app can show either the real farm or a demo scenario of 100 ponds
// across 7 farms (built by `npm run db:scenario` into its own schema).
export const SCENARIOS = ["real", "large"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const SCENARIO_COOKIE = "fisheye-scenario";
export const LARGE_SCENARIO_SCHEMA = "scenario_100";
