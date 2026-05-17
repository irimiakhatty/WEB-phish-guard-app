"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { exportStandardReport } from "@/server/actions/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatBytes,
  getStandardReportDefinition,
  STANDARD_REPORTS,
  type StandardReportFormat,
  type StandardReportId,
} from "@/features/admin/reports/standard-reports";

type GeneratedReportItem = {
  id: string;
  reportId: StandardReportId;
  name: string;
  format: StandardReportFormat;
  filename: string;
  bytes: number;
  generatedAt: Date;
  downloadUrl: string;
};

function triggerDownload(downloadUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export default function AdminReportsPanel() {
  const defaultReportId = STANDARD_REPORTS.find((report) => report.formats.includes("csv"))?.id ?? "risk_signals_30d";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportId, setReportId] = useState<StandardReportId>(defaultReportId);
  const [format, setFormat] = useState<StandardReportFormat>("csv");
  const [generating, setGenerating] = useState(false);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReportItem[]>([]);
  const generatedReportsRef = useRef<GeneratedReportItem[]>([]);

  const reportDefinition = useMemo(() => getStandardReportDefinition(reportId), [reportId]);
  const formatOptions = reportDefinition.formats;

  useEffect(() => {
    if (formatOptions.includes(format)) {
      return;
    }

    setFormat(formatOptions[0] ?? "json");
  }, [format, formatOptions]);

  useEffect(() => {
    generatedReportsRef.current = generatedReports;
  }, [generatedReports]);

  useEffect(() => {
    return () => {
      generatedReportsRef.current.forEach((item) => URL.revokeObjectURL(item.downloadUrl));
    };
  }, []);

  const generatedList = useMemo(() => generatedReports.slice().sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime()), [generatedReports]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const definition = getStandardReportDefinition(reportId);
      const exported = await exportStandardReport(reportId, format);

      const blob = new Blob([exported.content], { type: exported.mimeType });
      const downloadUrl = URL.createObjectURL(blob);
      const now = new Date();

      const item: GeneratedReportItem = {
        id: `${reportId}-${now.getTime()}`,
        reportId,
        name: definition.name,
        format,
        filename: exported.filename,
        bytes: exported.bytes,
        generatedAt: now,
        downloadUrl,
      };

      setGeneratedReports((current) => [item, ...current].slice(0, 25));
      triggerDownload(downloadUrl, exported.filename);
      toast.success("Report generated");
      setDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate report";
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Generated Reports</CardTitle>
              <CardDescription>Download standard exports that define the platform&apos;s output data.</CardDescription>
            </div>
          </div>

          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Report
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Generate a report</AlertDialogTitle>
              </AlertDialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="report-type">Report type</Label>
                  <Select value={reportId} onValueChange={(value) => setReportId(value as StandardReportId)}>
                    <SelectTrigger id="report-type">
                      <SelectValue placeholder="Select a report" />
                    </SelectTrigger>
                    <SelectContent>
                      {STANDARD_REPORTS.map((report) => (
                        <SelectItem key={report.id} value={report.id}>
                          {report.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{reportDefinition.description}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="report-format">Format</Label>
                  <Select value={format} onValueChange={(value) => setFormat(value as StandardReportFormat)}>
                    <SelectTrigger id="report-format">
                      <SelectValue placeholder="Select a format" />
                    </SelectTrigger>
                    <SelectContent>
                      {formatOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={generating}>Cancel</AlertDialogCancel>
                <Button onClick={handleGenerate} disabled={generating}>
                  {generating ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </span>
                  ) : (
                    "Generate & download"
                  )}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {generatedList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-sm text-muted-foreground">
            Generate your first export to start building a report history.
          </div>
        ) : (
          generatedList.map((report) => (
            <div
              key={report.id}
              className="flex flex-col gap-3 rounded-xl border bg-muted/10 p-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/40">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">{report.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{report.generatedAt.toLocaleDateString()}</span>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                    <span>{report.format.toUpperCase()}</span>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                    <span>{formatBytes(report.bytes)}</span>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 sm:w-auto"
                onClick={() => triggerDownload(report.downloadUrl, report.filename)}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
