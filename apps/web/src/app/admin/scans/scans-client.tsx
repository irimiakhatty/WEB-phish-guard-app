"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { adminDeleteScan } from "@/app/actions/scans";

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

export default function AdminScansClient({ scans: initialScans }: { scans: ScanWithUser[] }) {
  const [scans, setScans] = useState(initialScans);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (scanId: string) => {
    if (!confirm("Are you sure you want to delete this scan?")) {
      return;
    }

    setDeletingId(scanId);
    try {
      await adminDeleteScan(scanId);
      setScans(scans.filter((s) => s.id !== scanId));
      toast.success("Scan deleted successfully");
    } catch (error) {
      toast.error("Failed to delete scan");
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  };

  const getRiskColor = (level: string) => {
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
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Manage Scans</h1>
        <p className="text-muted-foreground">
          View and moderate all platform scans
        </p>
      </div>

      <div className="space-y-4">
        {scans.map((scan) => (
          <Card key={scan.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(scan.riskLevel)}`}
                    >
                      {scan.isPhishing ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      {scan.riskLevel.toUpperCase()}
                    </span>
                    {scan.isPhishing && (
                      <span className="text-sm text-red-600 font-semibold">
                        Phishing
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-lg">
                    {scan.url || "Text Analysis"}
                  </CardTitle>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span>By: {scan.user.name} ({scan.user.email})</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
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
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Score</p>
                  <p className="text-lg font-semibold">
                    {(scan.overallScore * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Confidence</p>
                  <p className="text-lg font-semibold">
                    {(scan.confidence * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Threats</p>
                  <p className="text-lg font-semibold">
                    {scan.detectedThreats.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
