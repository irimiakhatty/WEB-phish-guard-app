"use client";

import { useEffect } from "react";

type AuthRedirectGuardProps = {
  redirectTo: string;
};

export default function AuthRedirectGuard({ redirectTo }: AuthRedirectGuardProps) {
  useEffect(() => {
    const checkSessionAndRedirect = async () => {
      try {
        const response = await fetch("/api/auth/get-session", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) return;

        const payload = (await response.json()) as { user?: unknown } | null;
        if (payload?.user) {
          window.location.replace(redirectTo);
        }
      } catch {
        // Ignore transient network errors in client redirect guard.
      }
    };

    void checkSessionAndRedirect();

    const onPageShow = () => {
      void checkSessionAndRedirect();
    };

    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [redirectTo]);

  return null;
}
