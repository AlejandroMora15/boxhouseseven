"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Navegación vertical de la barra lateral (escritorio). */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const isActive = useIsActive();
  return (
    <nav className="flex flex-col gap-1 px-3" aria-label="Principal">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-11 items-center gap-3 rounded-lg px-3 text-[0.95rem] font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <span
              className={cn(
                "absolute top-2 bottom-2 left-0 w-1 rounded-r-full bg-sidebar-primary transition-opacity",
                active ? "opacity-100" : "opacity-0",
              )}
            />
            <Icon className={cn("size-5", active ? "text-sidebar-primary" : "")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barra de pestañas inferior (móvil). */
export function BottomNav({ items, className }: { items: NavItem[]; className?: string }) {
  const isActive = useIsActive();
  return (
    <nav
      aria-label="Principal"
      className={cn(
        "safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 shadow-[0_-4px_20px_-12px_rgb(0_0_0/0.25)] backdrop-blur",
        className,
      )}
    >
      <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ href, label, shortLabel, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium transition-colors active:scale-95",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "absolute top-0 h-0.5 w-8 rounded-full bg-brand transition-all",
                  active ? "opacity-100" : "opacity-0",
                )}
              />
              <Icon className={cn("size-5 transition-transform", active && "scale-110 text-brand")} />
              {shortLabel ?? label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Pestañas horizontales (escritorio, portal del cliente). */
export function TopTabs({ items }: { items: NavItem[] }) {
  const isActive = useIsActive();
  return (
    <nav className="flex items-center gap-1" aria-label="Principal">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
              active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
