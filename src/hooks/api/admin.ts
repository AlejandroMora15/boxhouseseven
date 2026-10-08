"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  AdminTrialInput,
  ClientInput,
  ClientListQuery,
  ClosedDaysInput,
  ConvertTrialInput,
  SettingsInput,
  SlotInput,
  TrialListQuery,
  TrialUpdateInput,
} from "@/lib/schemas";
import type {
  AgendaDay,
  AgendaWeek,
  AttendanceHistory,
  AttendanceStatus,
  ClassPlan,
  ClientDetail,
  ClientListItem,
  ClientSearchResult,
  ClosedDay,
  Paginated,
  Settings,
  TimeSlot,
  TimeSlotWithUsage,
  TrialItem,
} from "@/lib/types";
import { qk } from "./keys";

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

export function useAgendaDay(date: string) {
  return useQuery({
    queryKey: qk.agendaDay(date),
    queryFn: ({ signal }) => api.get<AgendaDay>("/api/admin/agenda/day", { date }, signal),
    placeholderData: keepPreviousData,
  });
}

export function usePrefetchAgendaDay() {
  const qc = useQueryClient();
  return (date: string) =>
    qc.prefetchQuery({
      queryKey: qk.agendaDay(date),
      queryFn: ({ signal }) => api.get<AgendaDay>("/api/admin/agenda/day", { date }, signal),
      staleTime: 30_000,
    });
}

export function useAgendaWeek(weekStart: string, enabled = true) {
  return useQuery({
    queryKey: qk.agendaWeek(weekStart),
    queryFn: ({ signal }) => api.get<AgendaWeek>("/api/admin/agenda/week", { date: weekStart }, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

interface AttendanceVars {
  date: string;
  slotId: number;
  clientId?: string;
  trialId?: string;
  status: AttendanceStatus | null;
}

/** Marca asistencia con actualización optimista de la agenda del día. */
export function useSetAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: AttendanceVars) => api.post("/api/admin/classes/attendance", vars),
    onMutate: async (vars) => {
      const key = qk.agendaDay(vars.date);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<AgendaDay>(key);
      if (previous) {
        qc.setQueryData<AgendaDay>(key, {
          ...previous,
          classes: previous.classes.map((c) =>
            c.slotId !== vars.slotId
              ? c
              : {
                  ...c,
                  attendees: c.attendees.map((a) =>
                    a.id === (vars.clientId ?? vars.trialId) ? { ...a, attendance: vars.status } : a,
                  ),
                },
          ),
        });
      }
      return { previous };
    },
    onError: (_error, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.agendaDay(vars.date), ctx.previous);
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: qk.agendaDay(vars.date) });
      qc.invalidateQueries({ queryKey: qk.clients });
      qc.invalidateQueries({ queryKey: qk.trials });
    },
  });
}

function useAgendaMutation<V extends { date: string }>(url: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: V) => api.post<unknown>(url, vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.agenda });
      qc.invalidateQueries({ queryKey: qk.clients });
      qc.invalidateQueries({ queryKey: qk.trials });
    },
  });
}

export const useSetClassAttendance = () =>
  useAgendaMutation<{ date: string; slotId: number; status: AttendanceStatus }>("/api/admin/classes/attendance-all");
export const useAddToClass = () =>
  useAgendaMutation<{ date: string; slotId: number; clientId: string; markPresent: boolean }>(
    "/api/admin/classes/add",
  );
export const useRemoveFromClass = () =>
  useAgendaMutation<{ date: string; slotId: number; clientId: string }>("/api/admin/classes/remove");

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export function useClients(query: Partial<ClientListQuery>) {
  return useQuery({
    queryKey: qk.clientList(query),
    queryFn: ({ signal }) => api.get<Paginated<ClientListItem>>("/api/admin/clients", query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useClientSearch(q: string) {
  return useQuery<ClientSearchResult[]>({
    queryKey: qk.clientSearch(q),
    queryFn: async ({ signal }) => {
      const res = await api.get<{ items: ClientSearchResult[] }>("/api/admin/clients/search", { q }, signal);
      return res.items;
    },
    enabled: q.trim().length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: qk.client(id),
    queryFn: ({ signal }) => api.get<ClientDetail>(`/api/admin/clients/${id}`, undefined, signal),
  });
}

export function useClientHistory(id: string, month: string) {
  return useQuery({
    queryKey: qk.clientHistory(id, month),
    queryFn: ({ signal }) =>
      api.get<AttendanceHistory>(`/api/admin/clients/${id}/history`, { month }, signal),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateClients() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.clients });
    qc.invalidateQueries({ queryKey: qk.agenda });
    qc.invalidateQueries({ queryKey: qk.slots });
    qc.invalidateQueries({ queryKey: qk.trials });
  };
}

export function useCreateClient() {
  const invalidate = useInvalidateClients();
  return useMutation({
    meta: { silentError: true },
    mutationFn: (input: ClientInput) => api.post<{ id: string }>("/api/admin/clients", input),
    onSuccess: invalidate,
  });
}

export function useUpdateClient(id: string) {
  const invalidate = useInvalidateClients();
  return useMutation({
    meta: { silentError: true },
    mutationFn: (input: ClientInput) => api.put<ClientDetail>(`/api/admin/clients/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useSetClientStatus() {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/admin/clients/${id}/status`, { isActive }),
    onSuccess: invalidate,
  });
}

export function useDeleteClient() {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/clients/${id}`),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Clases de prueba
// ---------------------------------------------------------------------------

export function useTrials(query: Partial<TrialListQuery>) {
  return useQuery({
    queryKey: qk.trialList(query),
    queryFn: ({ signal }) => api.get<Paginated<TrialItem>>("/api/admin/trials", query, signal),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateTrials() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.trials });
    qc.invalidateQueries({ queryKey: qk.agenda });
    qc.invalidateQueries({ queryKey: qk.clients });
  };
}

export function useCreateTrial() {
  const invalidate = useInvalidateTrials();
  return useMutation({
    meta: { silentError: true },
    mutationFn: (input: AdminTrialInput) => api.post<TrialItem>("/api/admin/trials", input),
    onSuccess: invalidate,
  });
}

export function useUpdateTrial() {
  const invalidate = useInvalidateTrials();
  return useMutation({
    meta: { silentError: true },
    mutationFn: ({ id, input }: { id: string; input: TrialUpdateInput }) =>
      api.put<TrialItem>(`/api/admin/trials/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteTrial() {
  const invalidate = useInvalidateTrials();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/trials/${id}`),
    onSuccess: invalidate,
  });
}

export function useConvertTrial() {
  const invalidate = useInvalidateTrials();
  return useMutation({
    meta: { silentError: true },
    mutationFn: ({ id, input }: { id: string; input: ConvertTrialInput }) =>
      api.post<{ clientId: string }>(`/api/admin/trials/${id}/convert`, input),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Planificación
// ---------------------------------------------------------------------------

export function usePlans(from: string, to: string) {
  return useQuery<ClassPlan[]>({
    queryKey: qk.planRange(from, to),
    queryFn: async ({ signal }) =>
      (await api.get<{ items: ClassPlan[] }>("/api/admin/plans", { from, to }, signal)).items,
    placeholderData: keepPreviousData,
  });
}

export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, content }: { date: string; content: string }) =>
      api.put<{ plan: ClassPlan | null }>(`/api/admin/plans/${date}`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.plans });
      qc.invalidateQueries({ queryKey: qk.agenda });
    },
  });
}

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

export function useSettings() {
  return useQuery({
    queryKey: qk.settings,
    queryFn: ({ signal }) => api.get<Settings>("/api/admin/settings", undefined, signal),
    staleTime: 5 * 60_000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silentError: true },
    mutationFn: (input: SettingsInput) => api.put<Settings>("/api/admin/settings", input),
    onSuccess: (data) => {
      qc.setQueryData(qk.settings, data);
      qc.invalidateQueries({ queryKey: qk.agenda });
    },
  });
}

export function useSlots() {
  return useQuery<TimeSlotWithUsage[]>({
    queryKey: qk.slots,
    queryFn: async ({ signal }) =>
      (await api.get<{ items: TimeSlotWithUsage[] }>("/api/admin/slots", undefined, signal)).items,
    staleTime: 60_000,
  });
}

function useInvalidateSlots() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.slots });
    qc.invalidateQueries({ queryKey: qk.agenda });
  };
}

export function useSaveSlot() {
  const invalidate = useInvalidateSlots();
  return useMutation({
    meta: { silentError: true },
    mutationFn: ({ id, input }: { id?: number; input: SlotInput }) =>
      id ? api.put<TimeSlot>(`/api/admin/slots/${id}`, input) : api.post<TimeSlot>("/api/admin/slots", input),
    onSuccess: invalidate,
  });
}

export function useDeleteSlot() {
  const invalidate = useInvalidateSlots();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ archived: boolean }>(`/api/admin/slots/${id}`),
    onSuccess: invalidate,
  });
}

export function useClosedDays(from: string, to: string) {
  return useQuery<ClosedDay[]>({
    queryKey: qk.closedDayRange(from, to),
    queryFn: async ({ signal }) =>
      (await api.get<{ items: ClosedDay[] }>("/api/admin/closed-days", { from, to }, signal)).items,
  });
}

export function useAddClosedDays() {
  const qc = useQueryClient();
  return useMutation({
    meta: { silentError: true },
    mutationFn: (input: ClosedDaysInput) =>
      api.post<{ added: ClosedDay[]; skipped: number; affected: number }>("/api/admin/closed-days", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.closedDays });
      qc.invalidateQueries({ queryKey: qk.agenda });
    },
  });
}

export function useRemoveClosedDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (day: string) => api.delete(`/api/admin/closed-days/${day}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.closedDays });
      qc.invalidateQueries({ queryKey: qk.agenda });
    },
  });
}
