import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { useMemo, useState } from "react";

import { authClient } from "@/lib/auth/auth-client";

import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

type UserMenuProps = {
  compact?: boolean;
};

export default function UserMenu({ compact = false }: UserMenuProps) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (isPending) {
    return <Skeleton className={compact ? "size-9 rounded-md" : "h-9 w-24"} />;
  }

  if (!session) {
    return (
      <Link href="/login">
        {compact ? (
          <Button variant="outline" size="icon" aria-label="Sign In">
            <LogIn className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline">Sign In</Button>
        )}
      </Link>
    );
  }

  const signOutLabel = useMemo(() => {
    const name = session.user.name?.trim();
    if (name) return `Sign out ${name}`;
    return "Sign out";
  }, [session.user.name]);

  const handleSignOut = () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    // 1. Send logout signal first (extension integration)
    if (typeof window !== "undefined") {
      window.postMessage({ type: "PHISHGUARD_LOGOUT" }, "*");
      setTimeout(() => window.postMessage({ type: "PHISHGUARD_LOGOUT" }, "*"), 100);
    }

    // 2. Perform sign out
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          // Small delay to ensure extension gets the message before page unload
          setTimeout(() => {
            router.push("/");
          }, 500);
        },
        onError: () => {
          setIsSigningOut(false);
        },
      },
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "icon" : "default"}
      onClick={handleSignOut}
      disabled={isSigningOut}
      aria-label={signOutLabel}
    >
      <LogOut className="h-4 w-4" />
      {compact ? <span className="sr-only">{signOutLabel}</span> : signOutLabel}
    </Button>
  );
}
