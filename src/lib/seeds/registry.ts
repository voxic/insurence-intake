import path from "node:path";
import { CLINIC_MANIFEST, INSURANCE_MANIFEST, PROPERTY_MANIFEST, SUPPORT_MANIFEST } from "./manifests";
import type { SeedManifest } from "./types";

export type SeedDefinition = SeedManifest & { file: string };

// `file` is relative to the data directory. A further seed is another entry here
// plus a JSON file. The backoffice, phone defaults, and catalog/lookup voice
// tools read this list; they do not special-case ids.
export const SEEDS: SeedDefinition[] = [
  { ...INSURANCE_MANIFEST, file: path.join("backoffice", "seed.json") },
  { ...SUPPORT_MANIFEST, file: path.join("seeds", "support.json") },
  { ...PROPERTY_MANIFEST, file: path.join("seeds", "property.json") },
  { ...CLINIC_MANIFEST, file: path.join("seeds", "clinic.json") },
];

export function listSeeds() {
  return SEEDS;
}

export function getSeedDefinition(id: string) {
  return SEEDS.find((seed) => seed.id === id);
}
