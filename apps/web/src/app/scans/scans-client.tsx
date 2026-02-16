"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { deleteScan } from "@/app/actions/scans";
import type { Scan } from "@phish-guard-app/db";

type ScansClientProps = {
  scans: Scan[];
};

export default function ScansClient({ scans: initialScans }: ScansClientProps) {
  const [scans, setScans] = useState(initialScans);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (scanId: string) => {
    if (!confirm("Are you sure you want to delete this scan?")) {
      return;
    }

    setDeletingId(scanId);
    try {
      await deleteScan(scanId);
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
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "low":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getRiskIcon = (level: string) => {
    if (level === "safe") return <CheckCircle className="w-5 h-5" />;
    return <AlertTriangle className="w-5 h-5" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/20 dark:from-gray-950 dark:via-blue-950/20 dark:to-purple-950/20">
      <div className="container mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">My Scans</h1>
        <p className="text-muted-foreground">
          View and manage your phishing analysis history
        </p>
      </div>

      {scans.length === 0 ? (
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No scans yet</p>
            <Button asChild>
              <a href="/analyze">Start Your First Analysis</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {scans.map((scan) => (
            <Card key={scan.id} className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(scan.riskLevel)}`}>
                        {getRiskIcon(scan.riskLevel)}
                        {scan.riskLevel.toUpperCase()}
                      </span>
                      {scan.isPhishing && (
                        <span className="text-sm text-red-600 dark:text-red-400 font-semibold">
                          ⚠️ Phishing Detected
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-lg">
                      {scan.url ? (
                        <a
                          href={scan.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {scan.url.substring(0, 80)}
                          {scan.url.length > 80 ? "..." : ""}
                        </a>
                      ) : (
                        "Text Content Analysis"
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2">
                      <Clock className="w-4 h-4" />
                      {new Date(scan.createdAt).toLocaleString()}
                    </CardDescription>
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
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Overall Score</p>
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
                
                {scan.detectedThreats.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Detected Threats:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {scan.detectedThreats.slice(0, 3).map((threat, idx) => (
                        <li key={idx}>• {threat}</li>
                      ))}
                      {scan.detectedThreats.length > 3 && (
                        <li>+ {scan.detectedThreats.length - 3} more...</li>
                      )}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
    </div>
  );
}
