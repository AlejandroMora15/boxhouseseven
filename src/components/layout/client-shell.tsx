"use client";

import { CalendarDaysIcon, HistoryIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { InactiveWatcher } from "@/components/auth/inactive-watcher";
import { SessionKeeper } from "@/components/auth/session-keeper";
import { Logo } from "@/components/brand/logo";
import type { SessionUser } from "@/lib/types";
import { BottomNav, TopTabs, type NavItem } from "./nav";
import { UserMenu } from "./user-menu";

const CLIENT_NAV: NavItem[] = [
  { href: "/agenda", label: "Mi agenda", shortLabel: "Agenda", icon: CalendarDaysIcon },
  { href: "/historial", label: "Historial", icon: HistoryIcon },
  { href: "/perfil", label: "Perfil", icon: UserRoundIcon },
];

export function ClientShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4 sm:h-16">
          <Link href="/agenda" aria-label="Ir a mi agenda">
            <Logo markClassName="h-5 sm:h-6" className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
          </Link>
          <div className="hidden sm:block">
            <TopTabs items={CLIENT_NAV} />
          </div>
          <UserMenu user={user} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-28 sm:pt-8 sm:pb-12">{children}</main>
      <BottomNav items={CLIENT_NAV} className="sm:hidden" />
      <SessionKeeper />
      <InactiveWatcher />
    </div>
  );
}
