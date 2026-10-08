import type { Metadata } from "next";
import { TrialBookingView } from "@/components/public/trial-booking-view";

export const metadata: Metadata = {
  title: "Clase de prueba gratis",
  description:
    "Agenda tu clase de prueba gratis de boxeo en Boxhouseseven, Cartago. Clases de 1 hora con máximo 7 personas.",
};

export default function TrialPage() {
  return <TrialBookingView />;
}
