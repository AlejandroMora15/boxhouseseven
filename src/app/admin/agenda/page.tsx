import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminAgendaView } from "@/components/agenda/admin-agenda-view";

export const metadata: Metadata = { title: "Agenda" };

export default function AdminAgendaPage() {
  return (
    <Suspense>
      <AdminAgendaView />
    </Suspense>
  );
}
