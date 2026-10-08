"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon, EyeIcon, EyeOffIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { LogoMark } from "@/components/brand/logo";
import { TextField } from "@/components/common/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api-client";
import { loginSchema, type LoginInput } from "@/lib/schemas";
import type { SessionUser } from "@/lib/types";
import { InactiveAccountDialog } from "./inactive-dialog";

function safeNext(next: string | null, role: SessionUser["role"]): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  if (role === "admin") return next.startsWith("/admin") ? next : null;
  return /^\/(agenda|historial|perfil)(\/|\?|$)/.test(next) ? next : null;
}

export function LoginView() {
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [inactiveOpen, setInactiveOpen] = useState(searchParams.get("motivo") === "inactiva");
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const form = useForm<LoginInput, unknown, z.output<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (!inactiveOpen || whatsapp) return;
    api
      .get<{ whatsappPhone: string | null }>("/api/public/info")
      .then((info) => setWhatsapp(info.whatsappPhone))
      .catch(() => {});
  }, [inactiveOpen, whatsapp]);

  async function onSubmit(values: z.output<typeof loginSchema>) {
    setFormError(null);
    try {
      const res = await api.post<{ user: SessionUser; redirectTo: string }>("/api/auth/login", values);
      setRedirecting(true);
      const target = safeNext(searchParams.get("next"), res.user.role) ?? res.redirectTo;
      window.location.assign(target);
    } catch (error) {
      if (error instanceof ApiError && error.code === "ACCOUNT_INACTIVE") {
        const details = error.details as { whatsappPhone?: string | null } | undefined;
        setWhatsapp(details?.whatsappPhone ?? null);
        setInactiveOpen(true);
        return;
      }
      setFormError(error instanceof ApiError ? error.message : "No fue posible iniciar sesión.");
      form.setFocus("password");
    }
  }

  const pending = form.formState.isSubmitting || redirecting;

  return (
    <div className="grid grid-cols-1 min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca */}
      <section className="relative hidden overflow-hidden bg-sidebar text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -bottom-24 opacity-[0.07]"
        >
          <LogoMark className="h-[34rem] text-white" />
        </div>
        <div className="flex items-center gap-3">
          <LogoMark className="h-8 text-white" />
          <span className="text-sm font-medium tracking-[0.3em]">BOXHOUSESEVEN</span>
        </div>
        <div className="relative max-w-md">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase">
            <span className="size-1.5 rounded-full bg-brand" /> Cartago · Valle del Cauca
          </p>
          <h1 className="text-display text-6xl leading-[0.95]">
            Entrena duro.
            <br />
            <span className="text-brand">Llega a tiempo.</span>
          </h1>
          <p className="mt-5 text-lg text-white/70">
            Clases de boxeo de una hora, máximo 7 personas. Consulta tu agenda, reagenda tus clases y lleva tu
            asistencia en un solo lugar.
          </p>
        </div>
        <p className="relative text-sm text-white/40">© {new Date().getFullYear()} Boxhouseseven</p>
      </section>

      {/* Formulario */}
      <section className="flex flex-col items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-foreground text-background shadow-lg">
              <LogoMark className="h-8" />
            </div>
            <span className="text-sm font-medium tracking-[0.3em]">BOXHOUSESEVEN</span>
          </div>

          <h2 className="text-display text-4xl">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ingresa con tu correo y contraseña.</p>

          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-7" noValidate>
            <FieldGroup>
              {formError && (
                <Alert variant="destructive" className="animate-fade-up">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
              <TextField
                control={form.control}
                name="email"
                label="Correo electrónico"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="tucorreo@ejemplo.com"
                autoFocus
              />
              <TextField
                control={form.control}
                name="password"
                label="Contraseña"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                addon={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </Button>
                }
              />
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? <Spinner /> : null}
                {redirecting ? "Entrando…" : "Entrar"}
                {!pending && <ArrowRightIcon />}
              </Button>
            </FieldGroup>
          </form>

          <div className="mt-8 rounded-xl border border-dashed p-4 text-center">
            <p className="text-sm text-muted-foreground">¿Aún no entrenas con nosotros?</p>
            <Button variant="link" asChild className="mt-1 h-auto p-0 font-semibold text-brand">
              <Link href="/clase-de-prueba">
                <SparklesIcon /> Agenda tu clase de prueba gratis
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <InactiveAccountDialog open={inactiveOpen} onOpenChange={setInactiveOpen} whatsappPhone={whatsapp} />
    </div>
  );
}
