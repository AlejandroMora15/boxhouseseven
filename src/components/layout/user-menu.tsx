"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { PersonAvatar } from "@/components/common/person-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "dark", label: "Oscuro", icon: MoonIcon },
  { value: "system", label: "Sistema", icon: MonitorIcon },
] as const;

export function useLogout() {
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      qc.clear();
      // Recarga completa a propósito: limpia todo el estado en memoria de la sesión.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    }
  }
  return { logout, pending };
}

export function UserMenu({
  user,
  variant = "compact",
  className,
}: {
  user: SessionUser;
  variant?: "compact" | "sidebar";
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const { logout, pending } = useLogout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2.5 rounded-lg text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
          variant === "sidebar" ? "w-full p-2 hover:bg-sidebar-accent" : "rounded-full",
          className,
        )}
        aria-label="Menú de usuario"
      >
        <PersonAvatar name={user.name} size={variant === "sidebar" ? "md" : "sm"} />
        {variant === "sidebar" && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{user.name}</span>
              <span className="block truncate text-xs text-sidebar-foreground/60">{user.email}</span>
            </span>
            <ChevronsUpDownIcon className="size-4 text-sidebar-foreground/50" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={variant === "sidebar" ? "top" : "bottom"} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate font-semibold">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">Tema</DropdownMenuLabel>
          {THEMES.map(({ value, label, icon: Icon }) => (
            <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
              <Icon /> {label}
              {theme === value && <CheckIcon className="ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} onSelect={() => void logout()}>
          <LogOutIcon /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
