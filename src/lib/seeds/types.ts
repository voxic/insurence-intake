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

export type SeedManifest = {
  id: string;
  label: string;
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
  seeds: { id: string; label: string }[];
};

export type DemoRow = Record<string, unknown> & { id: string };
