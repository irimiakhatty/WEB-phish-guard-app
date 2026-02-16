import { notFound, redirect } from "next/navigation";
import prisma from "@phish-guard-app/db";
import AcceptInviteForm from "@/components/accept-invite-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;

  const invite = await prisma.organizationInvite.findUnique({
    where: { token },
    include: {
      organization: {
        select: { name: true, slug: true },
      },
    },
  });

  if (!invite) {
    notFound();
  }

  if (invite.expiresAt < new Date()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/20 dark:from-gray-950 dark:via-blue-950/20 dark:to-purple-950/20">
        <div className="container mx-auto max-w-xl py-16 px-4">
          <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
            <CardHeader>
              <CardTitle>Invitation expired</CardTitle>
              <CardDescription>
                This invitation link has expired. Please ask the admin to send a new invite.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 dark:text-gray-400">
              You can close this page now.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/20 dark:from-gray-950 dark:via-blue-950/20 dark:to-purple-950/20">
      <div className="container mx-auto max-w-xl py-16 px-4">
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
          <CardHeader>
            <p className="text-sm text-muted-foreground">You have been invited to join</p>
            <CardTitle className="text-3xl">{invite.organization.name}</CardTitle>
            <CardDescription className="mt-2">
              Accept the invite and create your account to join this organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AcceptInviteForm
              token={invite.token}
              email={invite.email}
              orgSlug={invite.organization.slug}
              orgName={invite.organization.name}
              role={invite.role}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
