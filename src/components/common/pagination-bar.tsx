"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_SIZE_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

function pageWindow(page: number, pageCount: number): Array<number | "…"> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const result: Array<number | "…"> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("…");
    result.push(sorted[i]);
  }
  return result;
}

export function PaginationBar({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  className,
  itemLabel = "registros",
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
  itemLabel?: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav
      aria-label="Paginación"
      className={cn("flex flex-wrap items-center justify-between gap-3 text-sm", className)}
    >
      <div className="flex items-center gap-3 text-muted-foreground">
        <span>
          {from}–{to} de <strong className="text-foreground">{total}</strong> {itemLabel}
        </span>
        {onPageSizeChange && (
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger size="sm" className="w-[4.5rem]" aria-label="Registros por página">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeftIcon />
        </Button>
        <div className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, pageCount).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "default" : "ghost"}
                size="icon"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </Button>
            ),
          )}
        </div>
        <span className="px-2 text-muted-foreground sm:hidden">
          {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Página siguiente"
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </nav>
  );
}
