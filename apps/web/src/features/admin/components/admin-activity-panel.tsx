"use client";

import { useEffect, useMemo, useState } from "react";
import { exportStandardReport, getRecentActivity } from "@/server/actions/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/shared/utils";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, Clock, Download, Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import type { AdminActivityData, AdminRecentScan, AdminRecentUser } from "./types";

type ActivityEvent =
  | { kind: "scan"; id: string; createdAt: Date; payload: AdminRecentScan }
  | { kind: "user"; id: string; createdAt: Date; payload: AdminRecentUser };

function triggerDownload(downloadUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function AdminActivityPanel() {
  const [activity, setActivity] = useState<AdminActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const loadActivity = async () => {
      const data = await getRecentActivity(50);
      setActivity(data);
      setLoading(false);
    };

    void loadActivity();
  }, []);

  const events = useMemo<ActivityEvent[]>(() => {
    if (!activity) {
      return [];
    }

    const scanEvents: ActivityEvent[] = activity.recentScans.map((scan) => ({
      kind: "scan",
      id: scan.id,
      createdAt: new Date(scan.createdAt),
      payload: scan,
    }));

    const userEvents: ActivityEvent[] = activity.recentUsers.map((user) => ({
      kind: "user",
      id: user.id,
      createdAt: new Date(user.createdAt),
      payload: user,
    }));

    return [...scanEvents, ...userEvents].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [activity]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const exported = await exportStandardReport("activity_log", "csv");
      const blob = new Blob([exported.content], { type: exported.mimeType });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, exported.filename);
      URL.revokeObjectURL(url);
      toast.success("Activity exported");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export activity";
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  if (loading || !activity) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-6">
          <div>
            <CardTitle>System Activity Log</CardTitle>
            <CardDescription>Track recent scans and newly created accounts.</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCsv} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No recent activity</p>
        ) : (
          <div className="relative ml-3 space-y-8 border-l border-white/10 pl-6">
            {events.map((event) => {
              const dotClass =
                event.kind === "user"
                  ? "bg-primary"
                  : event.payload.isPhishing
                    ? "bg-red-500"
                    : "bg-emerald-500";

              return (
                <div key={`${event.kind}-${event.id}`} className="relative">
                  <div
                    className={cn(
                      "absolute -left-[31px] top-1 h-4 w-4 rounded-full border-4 border-background",
                      dotClass
                    )}
                  />

                  <div className="rounded-xl border bg-muted/10 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        {event.kind === "scan" ? (
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-semibold text-zinc-100">
                              {event.payload.user.name || event.payload.user.email}
                            </span>
                            <span className="text-muted-foreground">scanned</span>
                            <span className="max-w-full break-all font-medium text-primary">
                              {event.payload.url || "text input"}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-semibold text-zinc-100">
                              {event.payload.email}
                            </span>
                            <span className="text-muted-foreground">created an account</span>
                            {event.payload.name ? (
                              <span className="font-medium text-primary">{event.payload.name}</span>
                            ) : null}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {event.kind === "scan" ? (
                            <>
                              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", event.payload.isPhishing ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-300")}>
                                {event.payload.isPhishing ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                {event.payload.isPhishing ? "Phishing" : "Safe"}
                              </span>
                              <Badge variant="secondary" className="text-[11px]">
                                {event.payload.riskLevel}
                              </Badge>
                              <Badge variant="outline" className="text-[11px]">
                                {(event.payload.confidence * 100).toFixed(0)}% confidence
                              </Badge>
                              {event.payload.organization ? (
                                <Link href={`/org/${event.payload.organization.slug}`}>
                                  <Badge variant="outline" className="text-[11px] hover:bg-muted/30">
                                    {event.payload.organization.name}
                                  </Badge>
                                </Link>
                              ) : null}
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <UserPlus className="h-3.5 w-3.5" />
                              New user record
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {formatRelativeTime(event.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
