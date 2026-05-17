"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportStandardReport, getStandardReportPreview, type StandardReportPreview } from "@/server/actions/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  generatedAt: string;
  downloadUrl?: string;
};

const REPORT_HISTORY_STORAGE_KEY = "phishguard_admin_report_history_v1";
const REPORT_HISTORY_LIMIT = 25;

function loadReportHistory(): GeneratedReportItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(REPORT_HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((value) => value && typeof value === "object")
      .map((value) => value as GeneratedReportItem)
      .filter(
        (value) =>
          typeof value.id === "string" &&
          typeof value.reportId === "string" &&
          typeof value.name === "string" &&
          typeof value.format === "string" &&
          typeof value.filename === "string" &&
          typeof value.bytes === "number" &&
          typeof value.generatedAt === "string",
      )
      .slice(0, REPORT_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function persistReportHistory(items: GeneratedReportItem[]) {
  if (typeof window === "undefined") return;

  try {
    const payload = items.map(({ downloadUrl: _downloadUrl, ...rest }) => rest).slice(0, REPORT_HISTORY_LIMIT);
    window.localStorage.setItem(REPORT_HISTORY_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota/security errors; history is best-effort.
  }
}

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

  const [reportId, setReportId] = useState<StandardReportId>(defaultReportId);
  const [format, setFormat] = useState<StandardReportFormat>("csv");
  const [preview, setPreview] = useState<StandardReportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReportItem[]>([]);
  const generatedReportsRef = useRef<GeneratedReportItem[]>([]);
  const hasLoadedHistoryRef = useRef(false);
  const [downloadingHistoryId, setDownloadingHistoryId] = useState<string | null>(null);

  const reportDefinition = useMemo(() => getStandardReportDefinition(reportId), [reportId]);
  const formatOptions = reportDefinition.formats;

  useEffect(() => {
    if (formatOptions.includes(format)) {
      return;
    }

    setFormat(formatOptions[0] ?? "json");
  }, [format, formatOptions]);

  const loadPreview = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const next = await getStandardReportPreview(reportId, 50);
      setPreview(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load preview";
      setPreviewError(message);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  useEffect(() => {
    setGeneratedReports(loadReportHistory());
    hasLoadedHistoryRef.current = true;
  }, []);

  useEffect(() => {
    generatedReportsRef.current = generatedReports;

    if (!hasLoadedHistoryRef.current) return;
    persistReportHistory(generatedReports);
  }, [generatedReports]);

  useEffect(() => {
    return () => {
      generatedReportsRef.current.forEach((item) => {
        if (item.downloadUrl) URL.revokeObjectURL(item.downloadUrl);
      });
    };
  }, []);

  const generatedList = useMemo(
    () =>
      generatedReports
        .slice()
        .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()),
    [generatedReports],
  );

  const handleHistoryDownload = async (item: GeneratedReportItem) => {
    if (item.downloadUrl) {
      triggerDownload(item.downloadUrl, item.filename);
      return;
    }

    setDownloadingHistoryId(item.id);
    try {
      const exported = await exportStandardReport(item.reportId, item.format);
      const blob = new Blob([exported.content], { type: exported.mimeType });
      const downloadUrl = URL.createObjectURL(blob);

      setGeneratedReports((current) =>
        current.map((report) => (report.id === item.id ? { ...report, downloadUrl } : report)),
      );

      triggerDownload(downloadUrl, exported.filename);
      toast.success("Report regenerated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download report";
      toast.error(message);
    } finally {
      setDownloadingHistoryId(null);
    }
  };

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
        generatedAt: now.toISOString(),
        downloadUrl,
      };

      setGeneratedReports((current) => [item, ...current].slice(0, REPORT_HISTORY_LIMIT));
      triggerDownload(downloadUrl, exported.filename);
      toast.success("Report generated");
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
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-muted/10 p-4">
            <h3 className="text-sm font-semibold">Report Builder</h3>
            <p className="mt-1 text-xs text-muted-foreground">Preview data in-app, then download when ready.</p>

            <div className="mt-4 space-y-4">
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
                        {opt === "csv" ? "CSV (Excel)" : opt.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={loadPreview} disabled={previewLoading}>
                  {previewLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    "Refresh preview"
                  )}
                </Button>
                <Button onClick={handleGenerate} disabled={generating}>
                  {generating ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Download
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Preview</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {preview && preview.kind === "table"
                    ? preview.rows.length === 0
                      ? "No rows yet"
                      : `${preview.rows.length}${preview.truncated ? "+" : ""} rows`
                    : "Report output snapshot"}
                </p>
              </div>
            </div>

            <div className="mt-4">
              {previewError ? (
                <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-3 text-xs text-muted-foreground">
                  {previewError}
                </div>
              ) : null}

              {!previewError && previewLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : null}

              {!previewError && !previewLoading && preview ? (
                preview.kind === "json" ? (
                  <pre className="max-h-[420px] overflow-auto rounded-lg border bg-black/20 p-3 text-xs text-muted-foreground">
                    {preview.json}
                  </pre>
                ) : (
                  preview.rows.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-4 text-xs text-muted-foreground">
                      {reportId === "subscriptions_paid"
                        ? "No paid subscription data yet."
                        : "No data available for this report yet."}
                    </div>
                  ) : (
                    <div className="max-h-[420px] overflow-auto rounded-lg border">
                      <table className="w-full table-fixed border-collapse text-left text-xs">
                        <thead className="sticky top-0 bg-background/90 backdrop-blur">
                          <tr className="border-b">
                            {preview.columns.map((column) => (
                              <th
                                key={column.key}
                                className="px-3 py-2 align-top font-semibold leading-snug text-muted-foreground break-words"
                              >
                                {column.header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {preview.rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="hover:bg-muted/10">
                              {preview.columns.map((column) => (
                                <td key={column.key} className="px-3 py-2 align-top text-muted-foreground break-all">
                                  {row[column.key] === null || row[column.key] === undefined
                                    ? ""
                                    : String(row[column.key])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">History</h3>
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
                    <span>{new Date(report.generatedAt).toLocaleDateString()}</span>
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
                onClick={() => void handleHistoryDownload(report)}
                disabled={downloadingHistoryId === report.id}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          ))
        )}
        </div>
      </CardContent>
    </Card>
  );
}
