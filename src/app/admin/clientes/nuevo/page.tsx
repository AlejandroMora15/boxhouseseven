import type { Metadata } from "next";
import { NewClientView } from "@/components/clients/client-editor-views";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default function NewClientPage() {
  return <NewClientView />;
}
