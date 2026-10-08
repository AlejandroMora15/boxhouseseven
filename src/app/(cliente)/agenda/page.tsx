import type { Metadata } from "next";
import { Suspense } from "react";
import { MyAgendaView } from "@/components/me/my-agenda-view";

export const metadata: Metadata = { title: "Mi agenda" };

export default function MyAgendaPage() {
  return (
    <Suspense>
      <MyAgendaView />
    </Suspense>
  );
}
