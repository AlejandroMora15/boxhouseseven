import { ERRORS, isErrorCode, type ErrorCode } from "@/lib/errors";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    opts: { message?: string; fields?: Record<string, string>; details?: unknown; status?: number } = {},
  ) {
    super(opts.message ?? ERRORS[code].message);
    this.name = "AppError";
    this.code = code;
    this.status = opts.status ?? ERRORS[code].status;
    this.fields = opts.fields;
    this.details = opts.details;
  }
}

interface PgErrorLike {
  code?: string;
  message?: string;
  constraint_name?: string;
}

const UNIQUE_CONSTRAINTS: Record<string, { code: ErrorCode; field?: string }> = {
  users_email_key: { code: "EMAIL_TAKEN", field: "email" },
  clients_document_key: { code: "DOCUMENT_TAKEN", field: "document" },
  trials_document_key: { code: "ALREADY_REGISTERED", field: "document" },
  trials_email_key: { code: "ALREADY_REGISTERED", field: "email" },
  closed_days_pkey: { code: "DAY_ALREADY_CLOSED", field: "day" },
  schedule_exceptions_class_key: { code: "ALREADY_IN_CLASS" },
};

/** Traduce errores de Postgres (y desconocidos) a AppError. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const pg = error as PgErrorLike;
  if (pg && typeof pg === "object" && typeof pg.code === "string") {
    // Errores de negocio lanzados con RAISE EXCEPTION 'CODIGO'.
    if (pg.code === "P0001" && isErrorCode(pg.message)) {
      return new AppError(pg.message);
    }
    if (pg.code === "23505") {
      const known = pg.constraint_name ? UNIQUE_CONSTRAINTS[pg.constraint_name] : undefined;
      if (known) {
        return new AppError(known.code, {
          fields: known.field ? { [known.field]: ERRORS[known.code].message } : undefined,
        });
      }
    }
    if (pg.code === "23503") return new AppError("SLOT_IN_USE");
    if (pg.code === "23514" || pg.code === "22P02" || pg.code === "22007" || pg.code === "22008") {
      return new AppError("VALIDATION");
    }
  }

  console.error("[api] Error no controlado:", error);
  return new AppError("INTERNAL");
}
