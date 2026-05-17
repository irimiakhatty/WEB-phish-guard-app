"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, CheckCircle, Clock, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { filterUserFacingThreats } from "@/lib/security/scan-tags";
import { adminDeleteScan } from "@/server/actions/scans";
import Link from "next/link";

type ScanWithUser = {
  id: string;
  url: string | null;
  textContent: string | null;
  riskLevel: string;
  isPhishing: boolean;
  overallScore: number;
  confidence: number;
  detectedThreats: string[];
  source: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
  organization: null | {
    id: string;
    name: string;
    slug: string;
  };
};

function getRiskBadgeClass(level: string) {
  switch (level) {
    case "safe":
      return "bg-emerald-500/10 text-emerald-300";
    case "low":
      return "bg-sky-500/10 text-sky-300";
    case "medium":
      return "bg-amber-500/10 text-amber-300";
    case "high":
      return "bg-orange-500/10 text-orange-300";
    case "critical":
      return "bg-red-500/10 text-red-400";
    default:
      return "bg-zinc-500/10 text-zinc-300";
  }
}

export default function AdminScansPanel({ initialScans }: { initialScans: ScanWithUser[] }) {
  const [scans, setScans] = useState(initialScans);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (scanId: string) => {
    if (!confirm("Are you sure you want to delete this scan?")) {
      return;
    }

    setDeletingId(scanId);
    try {
      await adminDeleteScan(scanId);
      setScans((current) => current.filter((scan) => scan.id !== scanId));
      toast.success("Scan deleted successfully");
    } catch (error) {
      toast.error("Failed to delete scan");
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-6">
          <div>
            <CardTitle>Recent Scans</CardTitle>
            <CardDescription>Quick scan summary with moderation controls when needed.</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/admin?tab=reports">
              <FileText className="h-4 w-4" />
              View All Reports
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {scans.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No scans available.</p>
        ) : (
          <div className="space-y-4">
            {scans.map((scan) => (
              <div
                key={scan.id}
                className="flex flex-col gap-3 rounded-xl border bg-muted/10 p-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <div className={`rounded-full p-2 ${scan.isPhishing ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-300"}`}>
                    {scan.isPhishing ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                  </div>

                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="truncate font-semibold text-zinc-100">{scan.url || "Text analysis"}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getRiskBadgeClass(scan.riskLevel)}`}>
                        {scan.riskLevel.toUpperCase()}
                      </span>
                      {scan.isPhishing ? (
                        <Badge variant="destructive" className="text-[11px]">
                          Phishing
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[11px]">
                          Safe
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[11px]">
                        {filterUserFacingThreats(scan.detectedThreats || []).length} threats
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        By: {scan.user.name || scan.user.email} ({scan.user.email})
                      </span>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(scan.createdAt).toLocaleString()}
                      </span>
                      {scan.source ? (
                        <>
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                          <span className="capitalize">{scan.source}</span>
                        </>
                      ) : null}
                      {scan.organization ? (
                        <>
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                          <Link href={`/org/${scan.organization.slug}`} className="hover:underline">
                            {scan.organization.name}
                          </Link>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">AI Confidence</p>
                    <p className="text-sm font-semibold text-zinc-100">{(scan.confidence * 100).toFixed(0)}%</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(scan.id)}
                    disabled={deletingId === scan.id}
                  >
                    {deletingId === scan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
