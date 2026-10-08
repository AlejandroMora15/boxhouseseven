import { describe, expect, it } from "vitest";
import { formatCOP, formatDocument, formatPhone, initials, whatsappLink } from "@/lib/format";
import { normalizeDocument, normalizePhone, toSearchText } from "@/lib/normalize";
import { AppError, toAppError } from "@/server/errors";

describe("formato", () => {
  it("pesos colombianos sin decimales", () => {
    expect(formatCOP(130000)).toMatch(/^\$\s?130\.000$/);
  });
  it("iniciales, teléfono y documento", () => {
    expect(initials("Ana María López")).toBe("AL");
    expect(initials("Carlos")).toBe("CA");
    expect(formatPhone("3001234567")).toBe("300 123 4567");
    expect(formatDocument("1094887123")).toBe("1.094.887.123");
    expect(formatDocument("AB12345")).toBe("AB12345");
  });
  it("enlace de WhatsApp agrega el indicativo de Colombia", () => {
    expect(whatsappLink("3001234567")).toBe("https://wa.me/573001234567");
    expect(whatsappLink("+1 305 555 1234", "Hola")).toBe("https://wa.me/13055551234?text=Hola");
  });
});

describe("normalización", () => {
  it("documento y celular", () => {
    expect(normalizeDocument(" 1.094-887 123 ")).toBe("1094887123");
    expect(normalizeDocument("pa-12345")).toBe("PA12345");
    expect(normalizePhone("+57 300-123-4567")).toBe("+573001234567");
  });
  it("búsqueda sin tildes ni mayúsculas", () => {
    expect(toSearchText("José ÁLVAREZ", "Muñoz", null)).toBe("jose alvarez munoz");
  });
});

describe("traducción de errores de Postgres", () => {
  it("errores de negocio (RAISE EXCEPTION)", () => {
    const e = toAppError({ code: "P0001", message: "CLASS_FULL" });
    expect(e).toBeInstanceOf(AppError);
    expect(e.code).toBe("CLASS_FULL");
    expect(e.status).toBe(409);
  });
  it("restricciones únicas conocidas", () => {
    expect(toAppError({ code: "23505", constraint_name: "clients_document_key" }).code).toBe("DOCUMENT_TAKEN");
    expect(toAppError({ code: "23505", constraint_name: "users_email_key" }).fields).toHaveProperty("email");
  });
  it("errores desconocidos se vuelven INTERNAL", () => {
    const original = console.error;
    console.error = () => {};
    expect(toAppError(new Error("boom")).code).toBe("INTERNAL");
    console.error = original;
  });
});
