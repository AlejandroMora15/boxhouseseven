"use client";

import { AlertTriangleIcon, RotateCcwIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Empty className={cn("rounded-xl border border-dashed bg-card/50 py-10", className)}>
      <EmptyHeader>
        {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const message = error instanceof ApiError ? error.message : "No pudimos cargar la información.";
  return (
    <EmptyState
      className={className}
      icon={<AlertTriangleIcon />}
      title="Algo salió mal"
      description={message}
      action={
        onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RotateCcwIcon /> Reintentar
          </Button>
        )
      }
    />
  );
}
