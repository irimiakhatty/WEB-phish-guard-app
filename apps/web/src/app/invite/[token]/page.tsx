import { notFound, redirect } from "next/navigation";
import prisma from "@phish-guard-app/db";
import AcceptInviteForm from "@/components/accept-invite-form";

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
      <div className="container mx-auto max-w-xl py-12 px-4 space-y-4">
        <h1 className="text-2xl font-bold">Invitation expired</h1>
        <p className="text-muted-foreground">
          This invitation link has expired. Please ask the admin to send a new invite.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-xl py-12 px-4 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">You have been invited to join</p>
        <h1 className="text-3xl font-bold">{invite.organization.name}</h1>
        <p className="text-muted-foreground mt-2">
          Accept the invite and create your account to join this organization.
        </p>
      </div>

      <AcceptInviteForm
        token={invite.token}
        email={invite.email}
        orgSlug={invite.organization.slug}
        orgName={invite.organization.name}
        role={invite.role}
      />
    </div>
  );
}
