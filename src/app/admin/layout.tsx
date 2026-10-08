import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { AdminShellSkeleton } from "@/components/layout/shell-skeleton";
import { getCurrentSession } from "@/server/auth/current-user";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<AdminShellSkeleton />}>
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  );
}

async function AdminFrame({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/admin/agenda");
  if (session.user.role !== "admin") redirect("/agenda");
  return <AdminShell user={session.user}>{children}</AdminShell>;
}
