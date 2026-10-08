"use client";

import { AttendanceHistoryPanel } from "@/components/clients/attendance-history";
import { PageHeader } from "@/components/common/page-header";
import { useMyHistory } from "@/hooks/api/me";
import { useUrlState } from "@/hooks/use-url-state";
import { isISODate, startOfMonthISO, todayISO } from "@/lib/dates";

export function MyHistoryView() {
  const { get, set } = useUrlState();
  const current = startOfMonthISO(todayISO());
  const raw = get("mes");
  const month = raw && isISODate(`${raw}-01`) ? `${raw}-01` : current;
  const history = useMyHistory(month);

  return (
    <div className="space-y-5">
      <PageHeader title="Historial" description="Tu asistencia mes a mes, según lo registrado por el gimnasio." />
      <div className="rounded-2xl border bg-card p-4 sm:p-5">
        <AttendanceHistoryPanel
          month={month}
          onMonthChange={(m) => set({ mes: m === current ? null : m.slice(0, 7) })}
          query={history}
        />
      </div>
    </div>
  );
}
