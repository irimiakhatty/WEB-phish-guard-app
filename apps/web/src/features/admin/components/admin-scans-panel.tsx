"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, CheckCircle, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { filterUserFacingThreats } from "@/lib/security/scan-tags";
import { adminDeleteScan } from "@/server/actions/scans";

type ScanWithUser = {
  id: string;
  url: string | null;
  textContent: string | null;
  riskLevel: string;
  isPhishing: boolean;
  overallScore: number;
  confidence: number;
  detectedThreats: string[];
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

function getRiskColor(level: string) {
  switch (level) {
    case "safe":
      return "bg-green-100 text-green-800";
    case "low":
      return "bg-zinc-100 text-zinc-800";
    case "medium":
      return "bg-yellow-100 text-yellow-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "critical":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
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
        <CardTitle>Scan Moderation</CardTitle>
        <CardDescription>Review recent scans and remove problematic records when needed.</CardDescription>
      </CardHeader>
      <CardContent>
        {scans.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No scans available.</p>
        ) : (
          <div className="space-y-4">
            {scans.map((scan) => (
              <div key={scan.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <span className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${getRiskColor(scan.riskLevel)}`}>
                        {scan.isPhishing ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                        {scan.riskLevel.toUpperCase()}
                      </span>
                      {scan.isPhishing ? <span className="text-sm font-semibold text-red-600">Phishing</span> : null}
                    </div>
                    <h3 className="text-lg font-semibold">{scan.url || "Text Analysis"}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span>By: {scan.user.name} ({scan.user.email})</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {new Date(scan.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(scan.id)}
                    disabled={deletingId === scan.id}
                  >
                    {deletingId === scan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Score</p>
                    <p className="text-lg font-semibold">{(scan.overallScore * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Confidence</p>
                    <p className="text-lg font-semibold">{(scan.confidence * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Threats</p>
                    <p className="text-lg font-semibold">
                      {filterUserFacingThreats(scan.detectedThreats || []).length}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
