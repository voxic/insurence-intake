import type { DemoRow, SeedManifest } from "./types";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function matches(row: DemoRow, clause: { field: string; equals: string | number | boolean } | undefined, negate: boolean) {
  if (!clause) return true;
  const same = row[clause.field] === clause.equals;
  return negate ? !same : same;
}

export function collectionPath(collection: { id: string; slug?: string }) {
  return `/backoffice/${collection.slug ?? collection.id}`;
}

export function renderStats(manifest: SeedManifest, collections: Record<string, DemoRow[]>) {
  return manifest.stats.map((stat) => {
    const rows = (collections[stat.collection] ?? []).filter(
      (row) => matches(row, stat.where, false) && matches(row, stat.whereNot, true),
    );
    const amount = stat.sum ? rows.reduce((sum, row) => sum + Number(row[stat.sum!] || 0), 0) : rows.length;
    const slug = manifest.collections.find((collection) => collection.id === stat.collection);
    return {
      label: stat.label,
      value: stat.format === "money" ? money.format(amount) : String(amount),
      href: slug ? collectionPath(slug) : "/backoffice",
    };
  });
}
