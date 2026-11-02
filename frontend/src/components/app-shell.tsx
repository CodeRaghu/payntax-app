"use client";

import { ChevronRight, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useLogout, useSession } from "@/api/hooks/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-slate-500">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
          {item.href ? (
            <Link href={item.href} className="hover:text-slate-900 hover:underline">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="text-slate-900">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

const NAV = [
  { href: "/clients", label: "Clients" },
  { href: "/settings", label: "Firm settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const logout = useLogout();
  const router = useRouter();
  const pathname = usePathname();
  const isOwner = session?.user?.role === "owner";

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link href="/clients" className="font-semibold text-blue-800">
            PayNTax
          </Link>
          <nav aria-label="Main" className="flex gap-1">
            {[...NAV, ...(isOwner ? [{ href: "/settings/audit", label: "Audit log" }] : [])].map((item) => {
              const active = item.href === "/settings" ? pathname === "/settings" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100",
                    active && "bg-slate-100 font-medium text-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">
              {session?.user?.full_name || session?.user?.email} · {session?.firm?.name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              loading={logout.isPending}
              onClick={() => logout.mutate(undefined, { onSettled: () => router.replace("/login") })}
            >
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-lg font-semibold text-blue-800">PayNTax</p>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
