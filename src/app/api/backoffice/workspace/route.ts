import { NextResponse } from "next/server";
import { getActiveManifest, getActiveSeedId, getCollections } from "@/lib/backoffice/repository";
import { collectionPath, renderStats } from "@/lib/seeds/stats";

export async function GET() {
  const manifest = getActiveManifest();
  const collections = getCollections();
  return NextResponse.json({
    seedId: getActiveSeedId(),
    label: manifest.label,
    overviewTitle: manifest.overviewTitle,
    stats: renderStats(manifest, collections),
    collections: manifest.collections.map((collection) => ({
      ...collection,
      href: collectionPath(collection),
      rows: collections[collection.id] ?? [],
    })),
  });
}
