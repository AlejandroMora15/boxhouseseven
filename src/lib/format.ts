const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCOP(value: number): string {
  return copFormatter.format(value).replace(/\s/g, " ");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] ?? "");
  return (first + last).toUpperCase();
}

/** "3001234567" → "300 123 4567" */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return phone;
}

/** Enlace de WhatsApp; asume Colombia (+57) para celulares de 10 dígitos. */
export function whatsappLink(phone: string, text?: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) digits = `57${digits}`;
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${query}`;
}

/** "1234567890" → "1.234.567.890" (solo si es numérico) */
export function formatDocument(document: string): string {
  if (!/^\d+$/.test(document)) return document;
  return document.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
