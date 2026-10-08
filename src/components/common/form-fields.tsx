"use client";

import type { ReactNode } from "react";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type InputProps = Omit<React.ComponentProps<typeof Input>, "name" | "value" | "onChange" | "onBlur">;

/** Campo de texto conectado a react-hook-form con etiqueta y error. */
export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  addon,
  ...inputProps
}: InputProps & {
  control: Control<T>;
  name: FieldPath<T>;
  label: ReactNode;
  description?: ReactNode;
  addon?: ReactNode;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <div className="relative">
            <Input
              {...inputProps}
              id={name}
              name={field.name}
              ref={field.ref}
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={fieldState.invalid}
              className={cn(addon && "pr-11")}
            />
            {addon && <div className="absolute inset-y-0 right-1 flex items-center">{addon}</div>}
          </div>
          {description && !fieldState.invalid && <FieldDescription>{description}</FieldDescription>}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Textarea>, "name" | "value" | "onChange" | "onBlur"> & {
  control: Control<T>;
  name: FieldPath<T>;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Textarea
            {...props}
            id={name}
            name={field.name}
            ref={field.ref}
            value={field.value ?? ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
            aria-invalid={fieldState.invalid}
          />
          {description && !fieldState.invalid && <FieldDescription>{description}</FieldDescription>}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}

/** Aplica al formulario los errores por campo que devuelve la API. */
export function applyServerFieldErrors(
  fields: Record<string, string> | undefined,
  setError: (name: never, error: { type: string; message: string }) => void,
  known: readonly string[],
): boolean {
  if (!fields) return false;
  let applied = false;
  for (const [key, message] of Object.entries(fields)) {
    const root = key.split(".")[0];
    if (known.includes(root)) {
      setError(root as never, { type: "server", message });
      applied = true;
    }
  }
  return applied;
}
