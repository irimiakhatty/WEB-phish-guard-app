"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Scan } from "@phish-guard-app/db";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { filterUserFacingThreats } from "@/lib/security/scan-tags";
import { deleteScan } from "@/server/actions/scans";

type ScansClientProps = {
  scans: Scan[];
  embedded?: boolean;
  initialVisibleCount?: number;
};

export default function ScansClient({
  scans: initialScans,
  embedded = false,
  initialVisibleCount = 10,
}: ScansClientProps) {
  const [scans, setScans] = useState(initialScans);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setScans(initialScans);
    setShowAll(false);
  }, [initialScans]);

  const getDisplayThreats = (scan: Scan) => filterUserFacingThreats(scan.detectedThreats || []);

  const handleDelete = async (scanId: string) => {
    if (!confirm("Are you sure you want to delete this scan?")) {
      return;
    }

    setDeletingId(scanId);
    try {
      await deleteScan(scanId);
      setScans((prev) => prev.filter((s) => s.id !== scanId));
      toast.success("Scan deleted successfully");
    } catch (error) {
      toast.error("Failed to delete scan");
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  };

  const getRiskPillClass = (level: string) => {
    switch (level) {
      case "safe":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
      case "low":
        return "border-white/10 bg-white/[0.04] text-zinc-200";
      case "medium":
        return "border-amber-500/30 bg-amber-500/10 text-amber-200";
      case "high":
        return "border-orange-500/30 bg-orange-500/10 text-orange-200";
      case "critical":
        return "border-red-500/30 bg-red-500/10 text-red-200";
      default:
        return "border-white/10 bg-white/[0.04] text-zinc-200";
    }
  };

  const getRiskIcon = (level: string) => {
    if (level === "safe") return <CheckCircle className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  const scanItems = useMemo(
    () => (showAll ? scans : scans.slice(0, initialVisibleCount)),
    [initialVisibleCount, scans, showAll],
  );

  const content =
    scans.length === 0 ? (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">No scans yet.</p>
        </CardContent>
      </Card>
    ) : (
      <div className="space-y-4">
        {scanItems.map((scan) => {
          const threats = getDisplayThreats(scan);

          return (
            <Card key={scan.id} className="transition-colors hover:bg-muted/30">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getRiskPillClass(scan.riskLevel)}`}
                      >
                        {getRiskIcon(scan.riskLevel)}
                        {scan.riskLevel.toUpperCase()}
                      </span>
                      {scan.isPhishing ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200">
                          <AlertTriangle className="h-4 w-4" />
                          Phishing detected
                        </span>
                      ) : null}
                    </div>

                    <CardTitle className="text-base md:text-lg">
                      {scan.url ? (
                        <a
                          href={scan.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-zinc-100 underline-offset-2 hover:underline"
                          title={scan.url}
                        >
                          {scan.url}
                        </a>
                      ) : (
                        scan.imageUrl
                          ? "Image analysis"
                          : scan.textContent
                            ? "Text content analysis"
                            : "Content analysis"
                      )}
                    </CardTitle>

                    {scan.analysis ? (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{scan.analysis}</p>
                    ) : null}
                    <CardDescription className="mt-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {new Date(scan.createdAt).toLocaleString("en-GB")}
                    </CardDescription>
                  </div>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(scan.id)}
                    disabled={deletingId === scan.id}
                    title="Delete scan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Overall</p>
                    <p className="text-lg font-semibold text-zinc-100">
                      {(scan.overallScore * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Confidence</p>
                    <p className="text-lg font-semibold text-zinc-100">
                      {(scan.confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Threats</p>
                    <p className="text-lg font-semibold text-zinc-100">{threats.length}</p>
                  </div>
                </div>

                {threats.length > 0 ? (
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <p className="text-sm font-medium text-zinc-100">Detected threats</p>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {threats.slice(0, 4).map((threat, idx) => (
                        <li key={idx} className="truncate">
                          {threat}
                        </li>
                      ))}
                      {threats.length > 4 ? <li>+ {threats.length - 4} more...</li> : null}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}

        {scans.length > initialVisibleCount ? (
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={() => setShowAll((prev) => !prev)}>
              {showAll ? "Show less" : `Show all ${scans.length}`}
            </Button>
          </div>
        ) : null}
      </div>
    );

  if (embedded) {
    return content;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1680px] px-6 py-10 sm:px-8 lg:px-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-zinc-100">My Scans</h1>
          <p className="text-muted-foreground">View and manage your phishing analysis history</p>
        </div>

        {content}
      </div>
    </div>
  );
}
