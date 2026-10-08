"use client";

import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/hooks/api/admin";
import { ClosedDaysManager } from "./closed-days-manager";
import { GeneralSettingsForm } from "./general-settings-form";
import { SlotsManager } from "./slots-manager";

export function SettingsView() {
  const settings = useSettings();

  return (
    <div className="space-y-5">
      <PageHeader title="Configuración" description="Horarios, cupos, precios y días sin clases." />
      {settings.isError ? (
        <ErrorState error={settings.error} onRetry={() => settings.refetch()} />
      ) : !settings.data ? (
        <div className="space-y-4">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="space-y-5">
            <SlotsManager capacity={settings.data.maxPerClass} />
            <ClosedDaysManager />
          </div>
          <GeneralSettingsForm settings={settings.data} />
        </div>
      )}
    </div>
  );
}
