import type { Metadata } from "next";
import { Suspense } from "react";
import { EditClientView } from "@/components/clients/client-editor-views";

export const metadata: Metadata = { title: "Editar cliente" };

export default function EditClientPage({ params }: PageProps<"/admin/clientes/[id]/editar">) {
  return (
    <Suspense>
      <EditClientParams params={params} />
    </Suspense>
  );
}

async function EditClientParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditClientView id={id} />;
}
