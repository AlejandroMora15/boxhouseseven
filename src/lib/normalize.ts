/** Documento: sin puntos, espacios ni guiones; letras en mayúscula. */
export function normalizeDocument(value: string): string {
  return value.replace(/[^0-9a-z]/gi, "").toUpperCase();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Celular: solo dígitos (conserva un "+" inicial). */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/\D/g, "");
}

/** Nombre: espacios colapsados. */
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Texto para búsqueda: minúsculas y sin tildes. */
export function toSearchText(...parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
