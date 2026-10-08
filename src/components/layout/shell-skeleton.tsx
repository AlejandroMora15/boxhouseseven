import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto mientras se valida la sesión y se arma el layout. */
export function AdminShellSkeleton() {
  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-sidebar lg:block" />
      <div className="h-14 border-b lg:hidden" />
      <div className="mx-auto max-w-6xl space-y-4 px-4 pt-6 sm:px-6 lg:px-10 lg:pt-9">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  );
}

export function ClientShellSkeleton() {
  return (
    <div className="min-h-dvh">
      <div className="h-14 border-b sm:h-16" />
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
