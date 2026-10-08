import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ClientShell } from "@/components/layout/client-shell";
import { ClientShellSkeleton } from "@/components/layout/shell-skeleton";
import { getCurrentSession } from "@/server/auth/current-user";

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ClientShellSkeleton />}>
      <ClientFrame>{children}</ClientFrame>
    </Suspense>
  );
}

async function ClientFrame({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role !== "client") redirect("/admin/agenda");
  return <ClientShell user={session.user}>{children}</ClientShell>;
}
