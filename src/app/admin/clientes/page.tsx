import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientsListView } from "@/components/clients/clients-list-view";

export const metadata: Metadata = { title: "Clientes" };

export default function ClientsPage() {
  return (
    <Suspense>
      <ClientsListView />
    </Suspense>
  );
}
