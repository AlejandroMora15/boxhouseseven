import type { Metadata } from "next";
import { Suspense } from "react";
import { PlansView } from "@/components/plans/plans-view";

export const metadata: Metadata = { title: "Planificación" };

export default function PlansPage() {
  return (
    <Suspense>
      <PlansView />
    </Suspense>
  );
}
