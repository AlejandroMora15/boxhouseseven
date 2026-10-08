import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientDetailView } from "@/components/clients/client-detail-view";

export const metadata: Metadata = { title: "Cliente" };

export default function ClientPage({ params }: PageProps<"/admin/clientes/[id]">) {
  return (
    <Suspense>
      <ClientDetailParams params={params} />
    </Suspense>
  );
}

async function ClientDetailParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientDetailView id={id} />;
}
