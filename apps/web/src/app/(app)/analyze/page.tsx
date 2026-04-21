import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/auth-helpers";
import ManualAnalysis from "@/components/manual-analysis";
import ScansClient from "../scans/scans-client";
import { getMyScans } from "@/server/actions/scans";

export default async function AnalyzePage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role === "super_admin") {
    redirect("/admin");
  }

  const scans = await getMyScans();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1680px] px-6 py-12 sm:px-8 lg:px-12">
        <div id="analyze">
          <ManualAnalysis embedded />
        </div>

        <section id="history" className="mt-14 scroll-mt-24">
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-zinc-100">Scan history</h2>
              <p className="text-sm text-muted-foreground">
                Your most recent phishing analyses (last {scans.length} events).
              </p>
            </div>
          </div>

          <ScansClient scans={scans} embedded initialVisibleCount={10} />
        </section>
      </div>
    </div>
  );
}
