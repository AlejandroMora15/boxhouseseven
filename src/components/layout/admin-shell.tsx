"use client";

import { CalendarDaysIcon, ClipboardListIcon, SettingsIcon, SparklesIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { InactiveWatcher } from "@/components/auth/inactive-watcher";
import { SessionKeeper } from "@/components/auth/session-keeper";
import { Logo } from "@/components/brand/logo";
import type { SessionUser } from "@/lib/types";
import { BottomNav, SidebarNav, type NavItem } from "./nav";
import { UserMenu } from "./user-menu";

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDaysIcon },
  { href: "/admin/clientes", label: "Clientes", icon: UsersIcon },
  { href: "/admin/pruebas", label: "Clases de prueba", shortLabel: "Pruebas", icon: SparklesIcon },
  { href: "/admin/clases", label: "Planificación", shortLabel: "Clases", icon: ClipboardListIcon },
  { href: "/admin/configuracion", label: "Configuración", shortLabel: "Ajustes", icon: SettingsIcon },
];

export function AdminShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <Link href="/admin/agenda" className="flex h-20 items-center px-6">
          <Logo markClassName="h-6 text-white" className="text-white" />
        </Link>
        <div className="px-6 pb-3 text-[0.68rem] font-semibold tracking-[0.18em] text-sidebar-foreground/40 uppercase">
          Administración
        </div>
        <SidebarNav items={ADMIN_NAV} />
        <div className="mt-auto border-t border-sidebar-border p-3">
          <UserMenu user={user} variant="sidebar" />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur lg:hidden">
        <Link href="/admin/agenda" aria-label="Ir a la agenda">
          <Logo markClassName="h-5" className="[&>span:last-child]:text-[0.7rem]" />
        </Link>
        <UserMenu user={user} />
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-9 lg:pb-12">{children}</main>

      <BottomNav items={ADMIN_NAV} className="lg:hidden" />
      <SessionKeeper />
      <InactiveWatcher />
    </div>
  );
}
