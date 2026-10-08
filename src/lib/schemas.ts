// Esquemas de validación compartidos (formularios del cliente y API).
import { z } from "zod";
import { TRAINING_WEEKDAYS } from "./constants";
import { isISODate } from "./dates";
import { normalizeDocument, normalizeEmail, normalizeName, normalizePhone } from "./normalize";

// ---------------------------------------------------------------------------
// Campos base
// ---------------------------------------------------------------------------

export const isoDateSchema = z
  .string({ error: "Selecciona una fecha." })
  .refine(isISODate, "Fecha inválida.");

export const timeSchema = z
  .string({ error: "Ingresa una hora." })
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, "Hora inválida.")
  .transform((v) => v.slice(0, 5));

export const uuidSchema = z.uuid({ error: "Identificador inválido." });

export const fullNameSchema = z
  .string({ error: "Ingresa el nombre completo." })
  .transform(normalizeName)
  .pipe(
    z
      .string()
      .min(3, "Ingresa el nombre completo.")
      .max(120, "El nombre es demasiado largo.")
      .regex(/^[\p{L}][\p{L}\s.'-]*$/u, "El nombre solo puede contener letras."),
  );

export const documentSchema = z
  .string({ error: "Ingresa el documento." })
  .transform(normalizeDocument)
  .pipe(
    z
      .string()
      .min(4, "Ingresa un documento válido.")
      .max(20, "El documento es demasiado largo."),
  );

export const phoneSchema = z
  .string({ error: "Ingresa el celular." })
  .transform(normalizePhone)
  .pipe(
    z
      .string()
      .min(1, "Ingresa el celular.")
      .regex(/^(3\d{9}|\+\d{8,15})$/, "Ingresa un celular válido de 10 dígitos (ej. 300 123 4567)."),
  );

export const emailSchema = z
  .string({ error: "Ingresa el correo." })
  .transform(normalizeEmail)
  .pipe(z.email("Ingresa un correo válido.").max(160, "El correo es demasiado largo."));

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Máximo ${max} caracteres.`)
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : null));

export const planSchema = z.enum(["three_days", "daily"], { error: "Selecciona un plan." });
export const attendanceStatusSchema = z.enum(["present", "absent"]);

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Ingresa tu contraseña." }).min(1, "Ingresa tu contraseña.").max(100),
});
export type LoginInput = z.input<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Horario semanal de un cliente
// ---------------------------------------------------------------------------

export const scheduleEntrySchema = z.object({
  weekday: z.number().int().min(1).max(7),
  slotId: z.number({ error: "Selecciona un horario." }).int().positive("Selecciona un horario."),
});
export type ScheduleEntryInput = z.infer<typeof scheduleEntrySchema>;

function validateSchedule(
  plan: "three_days" | "daily",
  schedule: ScheduleEntryInput[],
  ctx: z.RefinementCtx,
) {
  const days = schedule.map((s) => s.weekday);
  const unique = new Set(days);
  if (unique.size !== days.length) {
    ctx.addIssue({ code: "custom", path: ["schedule"], message: "Hay días repetidos en el horario." });
    return;
  }
  if (days.some((d) => !(TRAINING_WEEKDAYS as readonly number[]).includes(d))) {
    ctx.addIssue({ code: "custom", path: ["schedule"], message: "Solo se entrena de lunes a viernes." });
    return;
  }
  if (plan === "three_days" && days.length !== 3) {
    ctx.addIssue({ code: "custom", path: ["schedule"], message: "Selecciona exactamente 3 días de asistencia." });
  }
  if (plan === "daily" && days.length !== TRAINING_WEEKDAYS.length) {
    ctx.addIssue({ code: "custom", path: ["schedule"], message: "El plan diario incluye de lunes a viernes." });
  }
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

const membershipFields = {
  plan: planSchema,
  monthlyFee: z.coerce
    .number({ error: "Ingresa el valor de la mensualidad." })
    .int("Ingresa un valor sin decimales.")
    .min(0, "El valor no puede ser negativo.")
    .max(10_000_000, "El valor es demasiado alto."),
  startDate: isoDateSchema,
  schedule: z.array(scheduleEntrySchema),
};

export const clientInputSchema = z
  .object({
    fullName: fullNameSchema,
    document: documentSchema,
    phone: phoneSchema,
    email: emailSchema,
    isActive: z.boolean(),
    notes: optionalText(1000),
    ...membershipFields,
  })
  .superRefine((v, ctx) => validateSchedule(v.plan, v.schedule, ctx));
export type ClientInput = z.input<typeof clientInputSchema>;
export type ClientData = z.output<typeof clientInputSchema>;

export const clientStatusSchema = z.object({ isActive: z.boolean() });

export const clientListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  status: z.enum(["all", "active", "inactive"]).optional().default("all"),
  plan: z.enum(["all", "three_days", "daily"]).optional().default("all"),
  sort: z.enum(["name", "recent"]).optional().default("name"),
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).optional().default(10),
});
export type ClientListQuery = z.output<typeof clientListQuerySchema>;

// ---------------------------------------------------------------------------
// Clases de prueba
// ---------------------------------------------------------------------------

export const trialPersonSchema = z.object({
  fullName: fullNameSchema,
  document: documentSchema,
  phone: phoneSchema,
  email: emailSchema,
  // Campo trampa anti-bots: debe llegar vacío.
  website: z.string().max(0).optional(),
});
export type TrialPersonInput = z.input<typeof trialPersonSchema>;

export const trialBookingSchema = trialPersonSchema.extend({
  classDate: isoDateSchema,
  slotId: z.number().int().positive(),
});
export type TrialBookingInput = z.input<typeof trialBookingSchema>;
export type TrialBookingData = z.output<typeof trialBookingSchema>;

export const adminTrialSchema = z.object({
  fullName: fullNameSchema,
  document: documentSchema,
  phone: phoneSchema,
  email: emailSchema,
  classDate: isoDateSchema,
  slotId: z.number({ error: "Selecciona un horario." }).int().positive("Selecciona un horario."),
  notes: optionalText(1000),
});
export type AdminTrialInput = z.input<typeof adminTrialSchema>;
export type AdminTrialData = z.output<typeof adminTrialSchema>;

export const trialUpdateSchema = adminTrialSchema.extend({
  status: z.enum(["scheduled", "cancelled"]),
  attendance: attendanceStatusSchema.nullable(),
});
export type TrialUpdateInput = z.input<typeof trialUpdateSchema>;
export type TrialUpdateData = z.output<typeof trialUpdateSchema>;

export const trialListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  status: z
    .enum(["all", "scheduled", "attended", "no_show", "converted", "cancelled"])
    .optional()
    .default("all"),
  when: z.enum(["all", "upcoming", "past"]).optional().default("all"),
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).optional().default(10),
});
export type TrialListQuery = z.output<typeof trialListQuerySchema>;

export const convertTrialSchema = z
  .object({
    fullName: fullNameSchema,
    document: documentSchema,
    phone: phoneSchema,
    email: emailSchema,
    notes: optionalText(1000),
    ...membershipFields,
  })
  .superRefine((v, ctx) => validateSchedule(v.plan, v.schedule, ctx));
export type ConvertTrialInput = z.input<typeof convertTrialSchema>;
export type ConvertTrialData = z.output<typeof convertTrialSchema>;

// ---------------------------------------------------------------------------
// Agenda (admin)
// ---------------------------------------------------------------------------

export const classRefSchema = z.object({
  date: isoDateSchema,
  slotId: z.number().int().positive(),
});

export const attendanceInputSchema = classRefSchema
  .extend({
    clientId: uuidSchema.optional(),
    trialId: uuidSchema.optional(),
    status: attendanceStatusSchema.nullable(),
  })
  .refine((v) => Boolean(v.clientId) !== Boolean(v.trialId), "Indica un cliente o una clase de prueba.");

export const classAttendanceSchema = classRefSchema.extend({ status: attendanceStatusSchema });

export const addToClassSchema = classRefSchema.extend({
  clientId: uuidSchema,
  markPresent: z.boolean().default(false),
});

export const removeFromClassSchema = classRefSchema.extend({ clientId: uuidSchema });

// ---------------------------------------------------------------------------
// Cliente: reagendar
// ---------------------------------------------------------------------------

export const rescheduleSchema = z.object({
  fromDate: isoDateSchema,
  fromSlotId: z.number().int().positive(),
  toDate: isoDateSchema,
  toSlotId: z.number().int().positive(),
});
export type RescheduleInput = z.infer<typeof rescheduleSchema>;

// ---------------------------------------------------------------------------
// Planificación y configuración
// ---------------------------------------------------------------------------

export const classPlanSchema = z.object({
  content: z.string().max(5000, "Máximo 5000 caracteres."),
});

export const slotInputSchema = z
  .object({
    startTime: timeSchema,
    endTime: timeSchema,
    weekdays: z
      .array(z.number().int().min(1).max(7))
      .min(1, "Selecciona al menos un día.")
      .transform((days) => [...new Set(days)].sort()),
  })
  .refine((v) => v.endTime > v.startTime, {
    path: ["endTime"],
    message: "La hora de fin debe ser posterior a la de inicio.",
  });
export type SlotInput = z.input<typeof slotInputSchema>;
export type SlotData = z.output<typeof slotInputSchema>;

export const settingsSchema = z.object({
  maxPerClass: z.coerce.number().int("Ingresa un número entero.").min(1, "Mínimo 1.").max(100, "Máximo 100."),
  priceThreeDays: z.coerce.number().int("Sin decimales.").min(0, "No puede ser negativo.").max(10_000_000),
  priceDaily: z.coerce.number().int("Sin decimales.").min(0, "No puede ser negativo.").max(10_000_000),
  bookingCutoffMinutes: z.coerce.number().int().min(0, "Mínimo 0.").max(1440, "Máximo 1440 (24 h)."),
  trialWindowDays: z.coerce.number().int().min(1, "Mínimo 1 día.").max(90, "Máximo 90 días."),
  whatsappPhone: z
    .string()
    .nullish()
    .transform((v) => (v && v.trim() ? normalizePhone(v) : null))
    .refine((v) => v === null || /^\+?\d{7,15}$/.test(v), "Número inválido."),
  address: optionalText(200),
});
export type SettingsInput = z.input<typeof settingsSchema>;
export type SettingsData = z.output<typeof settingsSchema>;

export const closedDaysSchema = z.object({
  days: z
    .array(
      z.object({
        day: isoDateSchema,
        reason: z.string().trim().min(2, "Indica el motivo.").max(120, "Máximo 120 caracteres."),
      }),
    )
    .min(1)
    .max(60),
});
export type ClosedDaysInput = z.input<typeof closedDaysSchema>;
export type ClosedDaysData = z.output<typeof closedDaysSchema>;

export const dateRangeQuerySchema = z
  .object({ from: isoDateSchema, to: isoDateSchema })
  .refine((v) => v.from <= v.to, "Rango inválido.");
