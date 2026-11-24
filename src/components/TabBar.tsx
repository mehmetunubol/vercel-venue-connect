"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, House, UserRound } from "lucide-react";

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/matches", label: "Matches", icon: Heart },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export default function TabBar() {
  const pathname = usePathname();
  // Chat and sign-in screens have their own bottom controls.
  if (pathname.startsWith("/chat/") || pathname.startsWith("/login")) return null;

  return (
    <nav className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4">
      <div className="glass-strong pointer-events-auto flex gap-1 rounded-full p-1.5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" || pathname.startsWith("/v/") : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                active ? "bg-mine text-mine-ink" : "text-muted hover:text-ink"
              }`}
            >
              <Icon size={18} strokeWidth={2} />
              <span className={active ? "" : "sr-only"}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
