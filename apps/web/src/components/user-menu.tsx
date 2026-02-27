import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

type UserMenuProps = {
  compact?: boolean;
};

export default function UserMenu({ compact = false }: UserMenuProps) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

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

  const userInitial = session.user.name?.trim()?.charAt(0)?.toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size={compact ? "icon" : "default"} />}
      >
        {compact ? (
          <>
            <span className="font-semibold">{userInitial}</span>
            <span className="sr-only">Open account menu</span>
          </>
        ) : (
          session.user.name
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>{session.user.email}</DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              // 1. Send logout signal first
              if (typeof window !== "undefined") {
                  window.postMessage({ type: "PHISHGUARD_LOGOUT" }, "*");
                  // Backup try for slower scripts
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
                },
              });
            }}
          >
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
