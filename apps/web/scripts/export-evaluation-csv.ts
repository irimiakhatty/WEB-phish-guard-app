import fs from "node:fs/promises";
import path from "node:path";
import prisma from "@phish-guard-app/db";

type FeedbackLabel = "safe" | "phishing" | "unsure";
type FeedbackTrust = "user" | "analyst";

type Counters = {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  total: number;
};

function parseArg(name: string): string | null {
  const idx = process.argv.findIndex((arg) => arg === name);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

function getLatestTag(tags: string[], prefix: string): string | null {
  for (let i = tags.length - 1; i >= 0; i--) {
    const tag = tags[i];
    if (tag.startsWith(prefix)) return tag.slice(prefix.length);
  }
  return null;
}

function toCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`;
  return text;
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [headers.map(toCsvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => toCsvCell(row[header])).join(","));
  }
  return lines.join("\n");
}

function updateCounters(counters: Counters, actualPhishing: boolean, predictedPhishing: boolean) {
  counters.total += 1;
  if (actualPhishing && predictedPhishing) counters.tp += 1;
  else if (!actualPhishing && predictedPhishing) counters.fp += 1;
  else if (!actualPhishing && !predictedPhishing) counters.tn += 1;
  else counters.fn += 1;
}

function computeMetrics(counters: Counters) {
  const precision = counters.tp + counters.fp > 0 ? counters.tp / (counters.tp + counters.fp) : 0;
  const recall = counters.tp + counters.fn > 0 ? counters.tp / (counters.tp + counters.fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy = counters.total > 0 ? (counters.tp + counters.tn) / counters.total : 0;
  return {
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number(f1.toFixed(4)),
    accuracy: Number(accuracy.toFixed(4)),
  };
}

function normalizeLabel(value: string | null): FeedbackLabel | null {
  if (value === "safe" || value === "phishing" || value === "unsure") return value;
  return null;
}

function normalizeTrust(value: string | null): FeedbackTrust {
  return value === "analyst" ? "analyst" : "user";
}

async function main() {
  const fromRaw = parseArg("--from");
  const toRaw = parseArg("--to");
  const outRaw = parseArg("--out");
  const summaryOutRaw = parseArg("--summary-out");
  const trustRaw = parseArg("--trust");

  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const from = fromRaw ? new Date(fromRaw) : defaultFrom;
  const to = toRaw ? new Date(toRaw) : defaultTo;

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid --from/--to date. Use ISO format, e.g. 2026-03-01");
  }
  const trustFilter = (trustRaw || "analyst").toLowerCase();
  if (!["all", "user", "analyst"].includes(trustFilter)) {
    throw new Error("Invalid --trust value. Use: analyst | user | all");
  }

  const outFile = outRaw
    ? path.resolve(outRaw)
    : path.resolve(`evaluation-export-${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv`);
  const summaryFile = summaryOutRaw ? path.resolve(summaryOutRaw) : null;

  const scans = await prisma.scan.findMany({
    where: {
      isDeleted: false,
      createdAt: {
        gte: from,
        lt: to,
      },
      detectedThreats: {
        hasSome: ["feedback_label:safe", "feedback_label:phishing", "feedback_label:unsure"],
      },
    },
    select: {
      id: true,
      createdAt: true,
      overallScore: true,
      riskLevel: true,
      confidence: true,
      isPhishing: true,
      source: true,
      detectedThreats: true,
      analysis: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const detailedRows: Array<Record<string, unknown>> = [];
  const byVersion = new Map<
    string,
    {
      scoringVersion: string;
      textModelVersion: string;
      urlModelVersion: string;
      counters: Counters;
    }
  >();
  const overallCounters: Counters = { tp: 0, fp: 0, tn: 0, fn: 0, total: 0 };

  for (const scan of scans) {
    const tags = scan.detectedThreats || [];
    const label = normalizeLabel(getLatestTag(tags, "feedback_label:"));
    if (!label) continue;

    const scoringVersion = getLatestTag(tags, "scoring_version:") || "unknown";
    const textModelVersion = getLatestTag(tags, "model_text:") || "unknown";
    const urlModelVersion = getLatestTag(tags, "model_url:") || "unknown";
    const policyAction = getLatestTag(tags, "policy_action:") || "";
    const retentionText = getLatestTag(tags, "retention_text:") || "";
    const retentionUrl = getLatestTag(tags, "retention_url:") || "";
    const safeBrowsing = getLatestTag(tags, "safe_browsing:") || "";
    const textHash = getLatestTag(tags, "text_sha256:") || "";
    const urlHash = getLatestTag(tags, "url_sha256:") || "";
    const feedbackTrust = normalizeTrust(getLatestTag(tags, "feedback_trust:"));

    const predictedLabel = scan.isPhishing ? "phishing" : "safe";
    const actualLabel = label;
    const contributesToMetrics = actualLabel !== "unsure";

    detailedRows.push({
      scan_id: scan.id,
      created_at: scan.createdAt.toISOString(),
      predicted_label: predictedLabel,
      actual_label: actualLabel,
      overall_score: scan.overallScore,
      risk_level: scan.riskLevel,
      confidence: scan.confidence,
      source: scan.source || "",
      feedback_trust: feedbackTrust,
      scoring_version: scoringVersion,
      model_text_version: textModelVersion,
      model_url_version: urlModelVersion,
      policy_action: policyAction,
      retention_text: retentionText,
      retention_url: retentionUrl,
      safe_browsing: safeBrowsing,
      text_sha256: textHash,
      url_sha256: urlHash,
      analysis: (scan.analysis || "").replace(/\s+/g, " ").trim(),
      threats: tags.join(" | "),
    });

    if (!contributesToMetrics) continue;
    if (trustFilter !== "all" && feedbackTrust !== trustFilter) continue;

    updateCounters(overallCounters, actualLabel === "phishing", scan.isPhishing);
    const key = `${scoringVersion}__${textModelVersion}__${urlModelVersion}`;
    if (!byVersion.has(key)) {
      byVersion.set(key, {
        scoringVersion,
        textModelVersion,
        urlModelVersion,
        counters: { tp: 0, fp: 0, tn: 0, fn: 0, total: 0 },
      });
    }
    updateCounters(
      byVersion.get(key)!.counters,
      actualLabel === "phishing",
      scan.isPhishing
    );
  }

  const detailedHeaders = [
    "scan_id",
    "created_at",
    "predicted_label",
    "actual_label",
    "overall_score",
    "risk_level",
    "confidence",
    "source",
    "feedback_trust",
    "scoring_version",
    "model_text_version",
    "model_url_version",
    "policy_action",
    "retention_text",
    "retention_url",
    "safe_browsing",
    "text_sha256",
    "url_sha256",
    "analysis",
    "threats",
  ];

  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, toCsv(detailedHeaders, detailedRows), "utf8");

  const summaryRows = Array.from(byVersion.values()).map((entry) => {
    const metrics = computeMetrics(entry.counters);
    return {
      scoring_version: entry.scoringVersion,
      model_text_version: entry.textModelVersion,
      model_url_version: entry.urlModelVersion,
      evaluated_scans: entry.counters.total,
      tp: entry.counters.tp,
      fp: entry.counters.fp,
      tn: entry.counters.tn,
      fn: entry.counters.fn,
      precision: metrics.precision,
      recall: metrics.recall,
      f1: metrics.f1,
      accuracy: metrics.accuracy,
    };
  });

  const overallMetrics = computeMetrics(overallCounters);
  console.log("Evaluation export complete");
  console.log(`Detailed CSV: ${outFile}`);
  console.log(`Trust filter: ${trustFilter}`);
  console.log(`Evaluated scans (excluding unsure): ${overallCounters.total}`);
  console.log(
    `Overall metrics -> precision=${overallMetrics.precision}, recall=${overallMetrics.recall}, f1=${overallMetrics.f1}, accuracy=${overallMetrics.accuracy}`
  );

  if (summaryFile) {
    const summaryHeaders = [
      "scoring_version",
      "model_text_version",
      "model_url_version",
      "evaluated_scans",
      "tp",
      "fp",
      "tn",
      "fn",
      "precision",
      "recall",
      "f1",
      "accuracy",
    ];
    await fs.mkdir(path.dirname(summaryFile), { recursive: true });
    await fs.writeFile(summaryFile, toCsv(summaryHeaders, summaryRows), "utf8");
    console.log(`Summary CSV: ${summaryFile}`);
  }
}

main()
  .catch((error) => {
    console.error("Failed to export evaluation CSV:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
