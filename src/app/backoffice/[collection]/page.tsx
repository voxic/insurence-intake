import { BackofficeApp } from "@/components/backoffice-app";

export default async function BackofficeCollectionPage({ params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params;
  return <BackofficeApp collection={collection} />;
}
