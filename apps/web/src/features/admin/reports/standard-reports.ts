export type StandardReportFormat = "csv" | "json";

export type StandardReportId =
  | "platform_overview"
  | "organizations_snapshot"
  | "subscriptions_paid"
  | "recent_scans"
  | "recent_users"
  | "activity_log"
  | "risk_signals_30d";

export type StandardReportDefinition = {
  id: StandardReportId;
  name: string;
  description: string;
  formats: StandardReportFormat[];
};

export const STANDARD_REPORTS: StandardReportDefinition[] = [
  {
    id: "platform_overview",
    name: "Platform Overview",
    description: "High-level platform metrics (users, orgs, scans, revenue).",
    formats: ["json"],
  },
  {
    id: "organizations_snapshot",
    name: "Organizations Snapshot",
    description: "Organizations, members, scans, plan, and estimated MRR.",
    formats: ["csv", "json"],
  },
  {
    id: "subscriptions_paid",
    name: "Paid Subscriptions",
    description: "Paid personal and team subscriptions with billing status.",
    formats: ["csv", "json"],
  },
  {
    id: "activity_log",
    name: "Activity Log",
    description: "Combined timeline of recent scans and new accounts.",
    formats: ["csv", "json"],
  },
  {
    id: "recent_scans",
    name: "Recent Scans",
    description: "Most recent scan events with risk and confidence metadata.",
    formats: ["csv", "json"],
  },
  {
    id: "recent_users",
    name: "New Users",
    description: "Most recent user sign-ups (created accounts).",
    formats: ["csv", "json"],
  },
  {
    id: "risk_signals_30d",
    name: "Risk Signals (30d)",
    description: "Risky departments, users, and incident evolution (30 days).",
    formats: ["json"],
  },
];

export function getStandardReportDefinition(reportId: StandardReportId) {
  const match = STANDARD_REPORTS.find((report) => report.id === reportId);
  if (!match) {
    throw new Error(`Unknown report: ${reportId}`);
  }

  return match;
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"] as const;
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export type CsvColumn<Row extends Record<string, unknown>> = {
  header: string;
  key: keyof Row & string;
};

function escapeCsvValue(value: unknown, delimiter: string) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = typeof value === "string" ? value : String(value);
  const needsQuoting =
    stringValue.includes(delimiter) ||
    /[",\n\r]/.test(stringValue);

  if (!needsQuoting) {
    return stringValue;
  }

  return `"${stringValue.replaceAll("\"", "\"\"")}"`;
}

export type CreateCsvOptions = {
  delimiter?: string;
  lineEnding?: "\n" | "\r\n";
  /**
   * Excel-compatible separator hint. When enabled, the file starts with `sep=<delimiter>`.
   * This improves opening the file directly in Excel across regional settings.
   */
  includeExcelSeparatorHint?: boolean;
};

export function createCsv<Row extends Record<string, unknown>>(
  columns: CsvColumn<Row>[],
  rows: Row[],
  options: CreateCsvOptions = {}
) {
  const delimiter = options.delimiter ?? ";";
  const lineEnding = options.lineEnding ?? "\r\n";
  const includeExcelSeparatorHint = options.includeExcelSeparatorHint ?? true;

  const headerRow = columns
    .map((column) => escapeCsvValue(column.header, delimiter))
    .join(delimiter);
  const bodyRows = rows.map((row) =>
    columns.map((column) => escapeCsvValue(row[column.key], delimiter)).join(delimiter)
  );

  const lines = includeExcelSeparatorHint ? [`sep=${delimiter}`, headerRow, ...bodyRows] : [headerRow, ...bodyRows];
  return lines.join(lineEnding);
}
