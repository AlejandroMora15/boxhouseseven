// Tipos de datos (DTO) que intercambian la API y la interfaz.
import type { Plan } from "./constants";

export type Role = "admin" | "client";
export type AttendanceStatus = "present" | "absent";
export type EntryOrigin = "schedule" | "reschedule" | "admin" | "attendance" | "trial";
export type TrialStatus = "scheduled" | "converted" | "cancelled";

export interface SessionUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface TimeSlot {
  id: number;
  startTime: string; // "HH:MM"
  endTime: string;
  weekdays: number[];
  isActive: boolean;
}

export interface TimeSlotWithUsage extends TimeSlot {
  /** Clientes con esta franja en su horario semanal, por día ISO. */
  clientsByWeekday: Record<number, number>;
  totalClients: number;
}

export interface Settings {
  maxPerClass: number;
  priceThreeDays: number;
  priceDaily: number;
  bookingCutoffMinutes: number;
  trialWindowDays: number;
  whatsappPhone: string | null;
  address: string | null;
}

export interface PublicInfo {
  whatsappPhone: string | null;
  address: string | null;
  maxPerClass: number;
}

export interface ClosedDay {
  day: string;
  reason: string;
}

export interface ScheduleEntry {
  weekday: number;
  slotId: number;
  startTime: string;
  endTime: string;
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

export interface GridClass {
  date: string;
  slotId: number;
  startTime: string;
  endTime: string;
  startsAt: string; // ISO UTC
  closedReason: string | null;
  booked: number;
  trials: number;
  capacity: number;
}

export interface RosterEntry {
  type: "client" | "trial";
  id: string;
  fullName: string;
  phone: string;
  email: string;
  document: string;
  plan: Plan | null;
  isActive: boolean;
  origin: EntryOrigin;
  attendance: AttendanceStatus | null;
  trialStatus: TrialStatus | null;
  movedFrom: { date: string; startTime: string } | null;
}

export interface AgendaClass extends GridClass {
  attendees: RosterEntry[];
}

export interface AgendaDay {
  date: string;
  closedReason: string | null;
  capacity: number;
  plan: { content: string; updatedAt: string } | null;
  classes: AgendaClass[];
}

export interface AgendaWeek {
  weekStart: string;
  capacity: number;
  slots: TimeSlot[];
  days: Array<{
    date: string;
    closedReason: string | null;
    hasPlan: boolean;
    classes: GridClass[];
  }>;
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export interface ClientListItem {
  id: string;
  fullName: string;
  email: string;
  document: string;
  phone: string;
  plan: Plan;
  monthlyFee: number;
  isActive: boolean;
  startDate: string;
  schedule: ScheduleEntry[];
}

export interface ClientDetail extends ClientListItem {
  notes: string | null;
  createdAt: string;
  trial: { id: string; classDate: string } | null;
  stats: {
    monthPresent: number;
    monthAbsent: number;
    lastAttendance: string | null;
  };
  upcoming: ClientClass[];
}

export interface ClientSearchResult {
  id: string;
  fullName: string;
  document: string;
  plan: Plan;
  isActive: boolean;
}

/** Una clase en la agenda personal de un cliente. */
export interface ClientClass {
  date: string;
  slotId: number;
  startTime: string;
  endTime: string;
  startsAt: string;
  origin: Exclude<EntryOrigin, "trial">;
  attendance: AttendanceStatus | null;
  closedReason: string | null;
  movedFrom: { date: string; startTime: string } | null;
  canReschedule: boolean;
}

export interface ClientAgendaWeek {
  weekStart: string;
  plan: Plan;
  daysPerWeek: number;
  classes: ClientClass[];
  cutoffMinutes: number;
}

export interface AttendanceHistory {
  month: string; // YYYY-MM-01
  items: Array<{
    date: string;
    slotId: number;
    startTime: string;
    endTime: string;
    status: AttendanceStatus;
  }>;
  summary: { present: number; absent: number; rate: number | null };
}

export interface RescheduleOptions {
  from: { date: string; slotId: number; startTime: string; endTime: string };
  days: Array<{
    date: string;
    closedReason: string | null;
    blockedReason: string | null;
    options: Array<{
      slotId: number;
      startTime: string;
      endTime: string;
      available: number;
      status: "available" | "full" | "past" | "current";
    }>;
  }>;
}

export interface ClientProfile {
  id: string;
  fullName: string;
  document: string;
  phone: string;
  email: string;
  plan: Plan;
  monthlyFee: number;
  startDate: string;
  schedule: ScheduleEntry[];
  contact: { whatsappPhone: string | null; address: string | null };
}

// ---------------------------------------------------------------------------
// Clases de prueba
// ---------------------------------------------------------------------------

export interface TrialItem {
  id: string;
  fullName: string;
  document: string;
  phone: string;
  email: string;
  classDate: string;
  slotId: number;
  startTime: string;
  endTime: string;
  status: TrialStatus;
  attendance: AttendanceStatus | null;
  source: "web" | "admin";
  notes: string | null;
  convertedClientId: string | null;
  createdAt: string;
}

export interface PublicAvailability {
  today: string;
  capacity: number;
  days: Array<{
    date: string;
    closedReason: string | null;
    slots: Array<{
      slotId: number;
      startTime: string;
      endTime: string;
      available: number;
      bookable: boolean;
      status: "available" | "full" | "past" | "closed";
    }>;
  }>;
}

export interface TrialConfirmation {
  id: string;
  fullName: string;
  classDate: string;
  startTime: string;
  endTime: string;
  address: string | null;
  whatsappPhone: string | null;
}

// ---------------------------------------------------------------------------
// Planificación
// ---------------------------------------------------------------------------

export interface ClassPlan {
  date: string;
  content: string;
  updatedAt: string;
}
