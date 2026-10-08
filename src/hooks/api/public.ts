"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { TrialBookingInput, TrialPersonInput } from "@/lib/schemas";
import type { PublicAvailability, TrialConfirmation } from "@/lib/types";
import { qk } from "./keys";

export interface PublicInfoResponse {
  whatsappPhone: string | null;
  address: string | null;
  maxPerClass: number;
  trialWindowDays: number;
}

export function usePublicInfo() {
  return useQuery({
    queryKey: qk.publicInfo,
    queryFn: ({ signal }) => api.get<PublicInfoResponse>("/api/public/info", undefined, signal),
    staleTime: 10 * 60_000,
  });
}

export function usePublicAvailability(enabled: boolean) {
  return useQuery({
    queryKey: qk.publicAvailability,
    queryFn: ({ signal }) => api.get<PublicAvailability>("/api/public/availability", undefined, signal),
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled ? 60_000 : false,
  });
}

export function useCheckTrialPerson() {
  return useMutation({
    mutationFn: (input: TrialPersonInput) => api.post<{ ok: true }>("/api/public/trial/check", input),
    meta: { silentError: true },
  });
}

export function useBookTrial() {
  return useMutation({
    mutationFn: (input: TrialBookingInput) => api.post<TrialConfirmation>("/api/public/trial", input),
    meta: { silentError: true },
  });
}
