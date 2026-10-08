"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { RescheduleInput } from "@/lib/schemas";
import type { AttendanceHistory, ClientAgendaWeek, ClientProfile, RescheduleOptions } from "@/lib/types";
import { qk } from "./keys";

export function useMyAgenda(weekStart: string) {
  return useQuery({
    queryKey: qk.myAgenda(weekStart),
    queryFn: ({ signal }) => api.get<ClientAgendaWeek>("/api/me/agenda", { date: weekStart }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useRescheduleOptions(date: string, slotId: number, enabled: boolean) {
  return useQuery({
    queryKey: qk.myRescheduleOptions(date, slotId),
    queryFn: ({ signal }) =>
      api.get<RescheduleOptions>("/api/me/reschedule-options", { date, slotId }, signal),
    enabled,
    staleTime: 0,
  });
}

export function useReschedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RescheduleInput) => api.post("/api/me/reschedule", input),
    meta: { silentError: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}

export function useMyProfile() {
  return useQuery({
    queryKey: qk.myProfile,
    queryFn: ({ signal }) => api.get<ClientProfile>("/api/me/profile", undefined, signal),
    staleTime: 5 * 60_000,
  });
}

export function useMyHistory(month: string) {
  return useQuery({
    queryKey: qk.myHistory(month),
    queryFn: ({ signal }) => api.get<AttendanceHistory>("/api/me/history", { month }, signal),
    placeholderData: keepPreviousData,
  });
}
