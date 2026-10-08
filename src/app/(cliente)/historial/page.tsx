import type { Metadata } from "next";
import { Suspense } from "react";
import { MyHistoryView } from "@/components/me/my-history-view";

export const metadata: Metadata = { title: "Historial" };

export default function MyHistoryPage() {
  return (
    <Suspense>
      <MyHistoryView />
    </Suspense>
  );
}
