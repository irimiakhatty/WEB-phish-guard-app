import { NextResponse } from "next/server";
import { runTrainingReminderJob } from "@/lib/training-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

async function runJob(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  try {
    const summary = await runTrainingReminderJob();
    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to run training reminder job",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return runJob(request);
}

export async function POST(request: Request) {
  return runJob(request);
}
