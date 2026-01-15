"use client";
import Link from "next/link";
import { Shield } from "lucide-react";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import { Button } from "./ui/button";

export default function Header() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/analyze", label: "Analyze" },
  ] as const;

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-4 py-3">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <Shield className="w-5 h-5 text-blue-600" />
            PhishGuard
          </Link>
          <nav className="hidden md:flex gap-2 text-sm">
            {links.map(({ to, label }) => {
              return (
                <Link key={to} href={to}>
                  <Button variant="ghost" size="sm">{label}</Button>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  );
}
