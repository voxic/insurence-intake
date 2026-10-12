import path from "node:path";
import { INSURANCE_MANIFEST, SUPPORT_MANIFEST } from "./manifests";
import type { SeedManifest } from "./types";

export type SeedDefinition = SeedManifest & { file: string };

// Register a third seed here and point `file` at its JSON. The backoffice, phone
// defaults, and catalog/lookup voice tools read this list; they do not special-case ids.
export const SEEDS: SeedDefinition[] = [
  { ...INSURANCE_MANIFEST, file: path.join("data", "backoffice", "seed.json") },
  { ...SUPPORT_MANIFEST, file: path.join("data", "seeds", "support.json") },
];

export function listSeeds() {
  return SEEDS;
}

export function getSeedDefinition(id: string) {
  return SEEDS.find((seed) => seed.id === id);
}
