import type { Metadata } from "next";
import { Suspense } from "react";
import { TrialsView } from "@/components/trials/trials-view";

export const metadata: Metadata = { title: "Clases de prueba" };

export default function TrialsPage() {
  return (
    <Suspense>
      <TrialsView />
    </Suspense>
  );
}
