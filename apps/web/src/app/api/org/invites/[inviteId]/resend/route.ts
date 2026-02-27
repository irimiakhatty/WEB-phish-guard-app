import { NextResponse } from "next/server";
import { resendInvite } from "@/app/actions/organizations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ inviteId: string }>;
}

export async function POST(_req: Request, ctx: RouteContext) {
  const { inviteId } = await ctx.params;
  const result = await resendInvite(inviteId);

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
