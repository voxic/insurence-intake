export const ACCENTS = ["teal", "amber", "coral", "indigo"] as const;
export type AccentId = (typeof ACCENTS)[number];

export type FieldType = "text" | "number" | "date" | "select" | "checkbox" | "text-list" | "number-list";

export type FieldDef = {
  key: string;
  label: string;
  type?: FieldType;
  options?: string[];
  /** Claim status may only move forward. */
  flow?: "claim";
  list?: boolean;
  edit?: boolean;
  primary?: boolean;
  badge?: boolean;
  format?: "money";
  lookup?: { collection: string; labelKey: string };
};

export type StatDef = {
  label: string;
  collection: string;
  where?: { field: string; equals: string | number | boolean };
  whereNot?: { field: string; equals: string | number | boolean };
  sum?: string;
  format?: "money";
};

export type CollectionDef = {
  id: string;
  label: string;
  /** URL segment. Defaults to id. */
  slug?: string;
  singular: string;
  /** catalog feeds topic/product search; lookup feeds policy/ticket numbers. */
  role?: "catalog" | "lookup" | "customers";
  fields: FieldDef[];
};

export type PhoneDefaults = {
  displayName: string;
  subtitle: string;
  accent: AccentId;
};

export type SeedChoice = {
  id: string;
  label: string;
  summary: string;
  /** What the backoffice lists for this seed, without the "Backoffice:" prefix. */
  backoffice: string;
};

export type SeedManifest = {
  id: string;
  label: string;
  /** One line shown next to the seed switch. */
  summary: string;
  backoffice: string;
  overviewTitle: string;
  /** When true, the next call still appends the insurance claim protocol. */
  claimProtocol?: boolean;
  agentPrompt: string;
  phone: PhoneDefaults;
  collections: CollectionDef[];
  stats: StatDef[];
};

export type DemoProfile = {
  seedId: string;
  label: string;
  agentPrompt: string;
  claimProtocol: boolean;
  phone: PhoneDefaults;
  seeds: SeedChoice[];
};

export type DemoRow = Record<string, unknown> & { id: string };
