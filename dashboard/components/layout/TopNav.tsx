"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/doctors", label: "Врачи" },
  { href: "/svod", label: "Свод" },
  { href: "/mips", label: "MIPS" },
  { href: "/studies", label: "Исследования" },
  { href: "/methodology", label: "Методология" },
];

export function TopNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function isActive(href: string) {
    return pathname.startsWith(href);
  }

  function resolveHref(href: string) {
    // When on a study detail page, restore filters from ?back= param
    if (href === "/studies" && pathname.startsWith("/studies/")) {
      const back = searchParams.get("back");
      if (back) return `/studies?${decodeURIComponent(back)}`;
    }
    return href;
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight">xAID Internal QA</span>
        </div>

        <div className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={resolveHref(link.href)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "bg-slate-100 text-foreground"
                  : "text-muted-foreground hover:bg-slate-50 hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
