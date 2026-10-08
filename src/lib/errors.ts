// Códigos de error de la API y su mensaje para el usuario. Se comparten entre
// servidor (respuestas) y cliente (fallback cuando la respuesta no trae texto).

export const ERRORS = {
  // Genéricos
  VALIDATION: { status: 422, message: "Revisa los datos ingresados." },
  NOT_FOUND: { status: 404, message: "No encontramos lo que buscas." },
  INTERNAL: { status: 500, message: "Ocurrió un error inesperado. Intenta de nuevo." },
  RATE_LIMITED: { status: 429, message: "Demasiados intentos. Espera unos minutos e intenta de nuevo." },
  FORBIDDEN_ORIGIN: { status: 403, message: "Solicitud no permitida." },

  // Autenticación
  UNAUTHENTICATED: { status: 401, message: "Tu sesión expiró. Inicia sesión de nuevo." },
  FORBIDDEN: { status: 403, message: "No tienes permiso para realizar esta acción." },
  INVALID_CREDENTIALS: { status: 401, message: "Correo o contraseña incorrectos." },
  ACCOUNT_INACTIVE: {
    status: 403,
    message: "Tu cuenta está inactiva. Comunícate con el administrador para reactivarla.",
  },
  SESSION_INVALID: { status: 401, message: "Tu sesión ya no es válida. Inicia sesión de nuevo." },

  // Clases y cupos
  CLASS_FULL: { status: 409, message: "Esta clase ya no tiene cupos disponibles. Elige otro horario." },
  CLASS_TOO_SOON: { status: 409, message: "Esta clase empieza muy pronto para agendarla. Elige otro horario." },
  OUT_OF_WINDOW: { status: 409, message: "Esa fecha todavía no está habilitada para agendar." },
  INVALID_CLASS: { status: 422, message: "No hay clase en ese día y horario." },
  DAY_CLOSED: { status: 409, message: "El gimnasio está cerrado ese día." },
  CLASS_NOT_FOUND: { status: 404, message: "No encontramos esa clase en tu agenda." },
  SAME_CLASS: { status: 422, message: "Elige un horario diferente al actual." },
  DIFFERENT_WEEK: { status: 422, message: "Solo puedes reagendar dentro de la misma semana." },
  FROM_TOO_LATE: { status: 409, message: "Ya no es posible reagendar esta clase: está por empezar o ya pasó." },
  TO_TOO_LATE: { status: 409, message: "Ese horario ya pasó o empieza muy pronto." },
  ALREADY_HAS_CLASS_THAT_DAY: { status: 409, message: "Ya tienes una clase ese día." },
  ATTENDANCE_ALREADY_MARKED: { status: 409, message: "La asistencia de esta clase ya fue registrada." },
  ALREADY_IN_CLASS: { status: 409, message: "El cliente ya está inscrito en esta clase." },
  NOT_IN_CLASS: { status: 409, message: "El cliente no está inscrito en esta clase." },
  FUTURE_ATTENDANCE: { status: 409, message: "Solo puedes marcar asistencia de clases de hoy o anteriores." },

  // Clientes y pruebas
  ALREADY_REGISTERED: { status: 409, message: "Ya existe un registro con este documento o correo." },
  ALREADY_CLIENT: {
    status: 409,
    message: "Ya eres cliente de Boxhouseseven. Inicia sesión para ver tu agenda.",
  },
  ALREADY_TRIAL: {
    status: 409,
    message: "Ya agendaste una clase de prueba con este documento o correo. ¡Te esperamos!",
  },
  CLIENT_NOT_FOUND: { status: 404, message: "El cliente no existe." },
  CLIENT_INACTIVE: { status: 409, message: "El cliente está inactivo." },
  DOCUMENT_TAKEN: { status: 409, message: "Ya existe un cliente con ese documento." },
  EMAIL_TAKEN: { status: 409, message: "Ya existe un usuario con ese correo." },
  TRIAL_NOT_FOUND: { status: 404, message: "La clase de prueba no existe." },
  TRIAL_ALREADY_CONVERTED: { status: 409, message: "Esta persona ya fue convertida en cliente." },
  INVALID_SCHEDULE: { status: 422, message: "El horario no es válido para el plan seleccionado." },

  // Configuración
  SLOT_OVERLAP: { status: 409, message: "El horario se cruza con otra franja existente." },
  SLOT_IN_USE: { status: 409, message: "Esta franja está en uso y no se puede modificar así." },
  SLOT_NOT_FOUND: { status: 404, message: "La franja horaria no existe." },
  DAY_ALREADY_CLOSED: { status: 409, message: "Ese día ya está marcado como cerrado." },
} as const satisfies Record<string, { status: number; message: string }>;

export type ErrorCode = keyof typeof ERRORS;

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && value in ERRORS;
}

export function errorMessage(code: string | undefined, fallback?: string): string {
  if (code && isErrorCode(code)) return ERRORS[code].message;
  return fallback ?? ERRORS.INTERNAL.message;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string>;
    details?: unknown;
  };
}
