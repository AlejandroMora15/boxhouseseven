// Utilidades para Route Handlers: lectura/validación de entrada, respuestas
// JSON homogéneas y envoltorios con autenticación por rol.
import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import type { ApiErrorBody } from "@/lib/errors";
import type { Role, SessionUser } from "@/lib/types";
import { requireUser } from "./auth/current-user";
import { AppError, toAppError } from "./errors";

export function ok<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, init);
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function errorResponse(error: unknown): NextResponse<ApiErrorBody> {
  const appError = toAppError(error);
  return NextResponse.json(
    {
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.fields ? { fields: appError.fields } : {}),
        ...(appError.details !== undefined ? { details: appError.details } : {}),
      },
    },
    { status: appError.status },
  );
}

function zodFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_form";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export function validate<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields = zodFields(result.error);
    throw new AppError("VALIDATION", { fields, message: Object.values(fields)[0] });
  }
  return result.data;
}

export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError("VALIDATION", { message: "El cuerpo de la solicitud no es JSON válido." });
  }
  return validate(schema, body);
}

export function readQuery<S extends z.ZodType>(req: NextRequest, schema: S): z.output<S> {
  const params: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return validate(schema, params);
}

type RouteParams = Record<string, string | string[] | undefined>;
type RouteContextArg = { params: Promise<RouteParams> };

interface HandlerContext<P> {
  user: SessionUser;
  params: P;
}

/** Envuelve un handler exigiendo sesión válida (y rol, si se indica). */
export function withAuth<P extends RouteParams = RouteParams>(
  role: Role | "any",
  handler: (req: NextRequest, ctx: HandlerContext<P>) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: RouteContextArg): Promise<Response> => {
    try {
      const user = await requireUser(role === "any" ? undefined : role);
      const params = ((await ctx?.params) ?? {}) as P;
      return await handler(req, { user, params });
    } catch (error) {
      // Errores internos de Next.js (prerender, redirect…) deben propagarse.
      unstable_rethrow(error);
      return errorResponse(error);
    }
  };
}

/** Envuelve un handler público con manejo de errores homogéneo. */
export function publicRoute<P extends RouteParams = RouteParams>(
  handler: (req: NextRequest, ctx: { params: P }) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: RouteContextArg): Promise<Response> => {
    try {
      const params = ((await ctx?.params) ?? {}) as P;
      return await handler(req, { params });
    } catch (error) {
      unstable_rethrow(error);
      return errorResponse(error);
    }
  };
}

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}
