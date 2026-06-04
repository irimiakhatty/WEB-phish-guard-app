"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Image as ImageIcon,
  Send,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { analyzePhishing } from "@/server/actions/analyze";
import { uploadScanImage } from "@/server/actions/upload";
import { filterUserFacingThreats } from "@/lib/security/scan-tags";
import { cn } from "@/lib/shared/utils";

type AnalysisResult = {
  textScore: number;
  urlScore: number;
  overallScore: number;
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  isPhishing: boolean;
  confidence: number;
  detectedThreats: string[];
  analysis: string;
  scanId?: string;
  scoringVersion?: string;
  scoreBreakdown?: {
    urlMlScore: number;
    urlHeuristicScore: number;
    textMlScore: number;
    textHeuristicScore: number;
    safeBrowsingScore: number;
    weightedScore: number;
  };
  modelVersions?: {
    urlModel: string | null;
    textModel: string | null;
    safeBrowsingHit: boolean;
  };
  policyDecision?: {
    action: "allow" | "warn" | "block";
    reason: string;
    hardBlock: boolean;
  };
  retentionPolicy?: {
    storedText: boolean;
    storedUrl: boolean;
    usedUrlHostOnly: boolean;
    forensicsMode: boolean;
  };
};

type LimitInfo = {
  message: string;
  planId?: string;
  organizationSlug?: string;
  limits?: {
    monthly: { used: number; limit: number };
    hourly: { used: number; limit: number };
  };
};

type ChatMessage =
  | {
      id: string;
      role: "user";
      createdAt: number;
      text: string;
      imagePreview?: string | null;
    }
  | {
      id: string;
      role: "assistant";
      createdAt: number;
      status: "analyzing" | "done" | "error" | "limit";
      phase?: string;
      result?: AnalysisResult;
      errorMessage?: string;
      limitInfo?: LimitInfo;
    };

type ManualAnalysisProps = {
  embedded?: boolean;
};

const SESSION_KEYS = {
  DRAFT: "phishguard_analyze_chat_draft",
} as const;

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

async function downscaleImageFile(file: File, maxSide: number) {
  if (typeof window === "undefined") return file;
  if (typeof createImageBitmap !== "function") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = Math.max(bitmap.width, bitmap.height);
    if (!Number.isFinite(maxDim) || maxDim <= maxSide) return file;

    const scale = maxSide / maxDim;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof canvas.toBlob !== "function") return file;

    ctx.drawImage(bitmap, 0, 0, width, height);

    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const quality = outputType === "image/jpeg" ? 0.92 : undefined;
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, quality);
    });

    if (!blob) return file;
    return new File([blob], file.name, { type: blob.type });
  } catch {
    return file;
  }
}

function findFirstUrl(input: string): string | null {
  const stripTrailingPunctuation = (value: string) => value.replace(/[),.;!?]+$/g, "");

  const match = input.match(/https?:\/\/[^\s<>"']+/i);
  if (match?.[0]) return stripTrailingPunctuation(match[0]);

  const embedded = input.match(
    /(^|[^a-z0-9@])((?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"']*)?)/i,
  );
  if (embedded?.[2]) {
    return `https://${stripTrailingPunctuation(embedded[2])}`;
  }

  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?$/i.test(trimmed)) {
    return `https://${stripTrailingPunctuation(trimmed)}`;
  }
  return null;
}

function getRiskColor(level: string) {
  switch (level) {
    case "safe":
      return "text-green-600 dark:text-green-400";
    case "low":
      return "text-zinc-700 dark:text-zinc-300";
    case "medium":
      return "text-yellow-600 dark:text-yellow-400";
    case "high":
      return "text-orange-600 dark:text-orange-400";
    case "critical":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-gray-600 dark:text-gray-400";
  }
}

function getRiskIcon(level: string) {
  if (level === "safe") return <CheckCircle className="h-7 w-7" />;
  if (level === "low" || level === "medium") return <AlertTriangle className="h-7 w-7" />;
  return <XCircle className="h-7 w-7" />;
}

function getKeyFactors(result: AnalysisResult): string[] {
  const humanize = (value: string) =>
    value
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());

  const policyReasonMap: Record<string, string> = {
    high_confidence_reputation_hit: "High confidence + reputation hit",
    high_risk_requires_user_confirmation: "High risk requires confirmation",
    medium_risk_advisory: "Medium risk advisory",
    risk_below_enforcement_threshold: "Risk below enforcement threshold",
  };

  const factors: string[] = [];

  if (result.policyDecision) {
    const actionLabel =
      result.policyDecision.action === "allow"
        ? "Allowed"
        : result.policyDecision.action === "warn"
          ? "Warning"
          : result.policyDecision.hardBlock
            ? "Blocked (hard)"
            : "Blocked";
    const reason =
      policyReasonMap[result.policyDecision.reason] || humanize(result.policyDecision.reason);
    factors.push(`Decision: ${actionLabel} — ${reason}`);
  }

  if (typeof result.modelVersions?.safeBrowsingHit === "boolean") {
    factors.push(
      `Google Safe Browsing: ${result.modelVersions.safeBrowsingHit ? "Flagged as unsafe" : "No match found"}`,
    );
  }

  if (result.scoreBreakdown) {
    factors.push(
      `Signals: URL ${(result.scoreBreakdown.urlMlScore * 100).toFixed(0)}% ML + ${(result.scoreBreakdown.urlHeuristicScore * 100).toFixed(0)}% heuristics`,
    );
    factors.push(
      `Signals: Text ${(result.scoreBreakdown.textMlScore * 100).toFixed(0)}% ML + ${(result.scoreBreakdown.textHeuristicScore * 100).toFixed(0)}% heuristics`,
    );
  }

  return factors;
}

export default function ManualAnalysis({ embedded = false }: ManualAnalysisProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<{ file: File; preview: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const router = useRouter();
  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Hydrate draft from sessionStorage (keeps chat-like UX across refreshes).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedDraft = sessionStorage.getItem(SESSION_KEYS.DRAFT);
    if (savedDraft) setDraft(savedDraft);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(SESSION_KEYS.DRAFT, draft);
  }, [draft, hydrated]);

  // Auto-scroll to newest message.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const updateAssistantMessage = (id: string, patch: Partial<Extract<ChatMessage, { role: "assistant" }>>) => {
    setMessages((prev) =>
      prev.map((m) => (m.role === "assistant" && m.id === id ? ({ ...m, ...patch } as ChatMessage) : m)),
    );
  };

  const resizeTextarea = () => {
    if (!textareaRef.current) return;

    const minHeight = 48; // aligns with h-12 buttons
    const maxHeight = 160; // ~6 lines before scrolling

    textareaRef.current.style.height = "0px";
    const scrollHeight = textareaRef.current.scrollHeight;
    const next = Math.max(minHeight, Math.min(scrollHeight, maxHeight));

    textareaRef.current.style.height = `${next}px`;
    textareaRef.current.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
    textareaRef.current.style.overflowX = "hidden";
  };

  useEffect(() => {
    resizeTextarea();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const handleFileSelected = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    const reader = new FileReader();
    const preview = await new Promise<string>((resolve) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    setAttachment({ file, preview });
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = async (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await handleFileSelected(file);
  };

  const handleSend = async () => {
    if (busy) return;

    const trimmed = draft.trim();
    if (!trimmed && !attachment) {
      toast.error("Paste a URL, email text, or attach an image");
      return;
    }

    setBusy(true);

    const userMessageId = createId();
    const assistantMessageId = createId();

    setMessages((prev) => [
      ...prev,
      {
        id: userMessageId,
        role: "user",
        createdAt: Date.now(),
        text: trimmed,
        imagePreview: attachment?.preview ?? null,
      },
      {
        id: assistantMessageId,
        role: "assistant",
        createdAt: Date.now(),
        status: "analyzing",
        phase: attachment ? "Uploading image…" : "Analyzing…",
      },
    ]);

    setDraft("");
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    try {
      let url: string | undefined;
      let textContent: string | undefined;
      let imageUrl: string | undefined;

      if (attachment) {
        updateAssistantMessage(assistantMessageId, { phase: "Uploading image…" });
        const preparedFile = await downscaleImageFile(attachment.file, 1600);

        const formData = new FormData();
        formData.append("file", preparedFile);

        const uploadPromise = uploadScanImage(formData);

        updateAssistantMessage(assistantMessageId, { phase: "Extracting text (OCR)…" });
        const ocrPromise = import("@/lib/integrations/ocr")
          .then(({ extractTextFromImage }) => extractTextFromImage(preparedFile))
          .then((value) => value?.trim() || "")
          .catch(() => "");

        const [uploadResult, extractedText] = await Promise.all([uploadPromise, ocrPromise]);
        imageUrl = uploadResult.imageUrl;
        if (extractedText.length > 0) {
          textContent = extractedText;
        }

        const detectedUrl = findFirstUrl(trimmed) || findFirstUrl(extractedText);
        if (detectedUrl) {
          url = detectedUrl;
        }
      } else {
        const detectedUrl = findFirstUrl(trimmed);
        if (detectedUrl && detectedUrl === trimmed.trim()) {
          url = detectedUrl;
        } else if (detectedUrl) {
          url = detectedUrl;
          textContent = trimmed;
        } else {
          textContent = trimmed;
        }
      }

      updateAssistantMessage(assistantMessageId, { phase: "Running analysis…" });

      const data = await analyzePhishing({
        url,
        textContent,
        imageUrl,
      });

      updateAssistantMessage(assistantMessageId, {
        status: "done",
        phase: undefined,
        result: data,
      });
      toast.success("Analysis complete");
      router.refresh();
    } catch (error: any) {
      let message = error?.message || "Analysis failed";

      // Decode serialized limit error
      if (typeof message === "string" && message.startsWith("PG_LIMIT:")) {
        const json = message.replace("PG_LIMIT:", "");
        try {
          const payload = JSON.parse(json);
          const limitInfo: LimitInfo = {
            message: payload.message || "Scan limit reached",
            planId: payload.planId,
            organizationSlug: payload.organizationSlug,
            limits: payload.limits,
          };
          updateAssistantMessage(assistantMessageId, {
            status: "limit",
            phase: undefined,
            limitInfo,
          });
          toast.error(limitInfo.message);
          return;
        } catch (e) {
          console.warn("Failed to parse limit payload", e);
        }
      }

      updateAssistantMessage(assistantMessageId, {
        status: "error",
        phase: undefined,
        errorMessage: message,
      });
      toast.error(message);
      console.error(error);
    } finally {
      setBusy(false);
    }
  };

  const visibleMessages = messages.filter(
    (message) =>
      !(
        message.role === "assistant" &&
        message.status === "done" &&
        !message.result &&
        !message.errorMessage &&
        !message.limitInfo
      ),
  );

  const assistantAvatarSrc = "/icon.png";

  const content = (
    <>
      <Card className="border-cyan-400/15 bg-card shadow-lg shadow-black/30">
        <CardHeader>
          <CardTitle className="text-2xl">Analyze</CardTitle>
          <CardDescription>
            Paste a URL, email text, or drop a screenshot. PhishGuard replies with a phishing verdict, confidence,
            and key indicators.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div
            className="rounded-2xl border border-cyan-400/15 bg-background p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div
              className={cn(
                "no-scrollbar max-h-[520px] overflow-y-auto overflow-x-hidden",
                embedded ? "min-h-[420px]" : "min-h-[520px]",
              )}
            >
              <div className="space-y-3">
                {visibleMessages.length === 0 ? (
                  <div className="flex items-end gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
                      <img
                        src={assistantAvatarSrc}
                        alt="PhishGuard"
                        className="h-full w-full object-cover brightness-110 saturate-125"
                        loading="eager"
                      />
                    </div>
                    <div className="max-w-[88%] rounded-3xl rounded-bl-lg border border-white/10 bg-zinc-950 px-4 py-3 text-zinc-100">
                      <p className="text-sm font-semibold">Drop or paste anything</p>
                      <p className="mt-1 text-sm text-zinc-300">
                        Paste a URL, paste an email body, or drag-and-drop a screenshot. I&apos;ll reply with a
                        phishing verdict and key indicators.
                      </p>
                    </div>
                  </div>
                ) : (
                  visibleMessages.map((message) => {
                    if (message.role === "user") {
                      return (
                        <div key={message.id} className="flex justify-end">
                          <div className="max-w-[88%] overflow-hidden rounded-3xl rounded-br-lg border border-cyan-400/20 bg-cyan-950 px-4 py-3 text-cyan-50 shadow-[0_0_18px_rgba(0,229,255,0.08)]">
                            {message.imagePreview ? (
                              <img
                                src={message.imagePreview}
                                alt="Uploaded"
                                className="mb-2 max-h-56 w-full rounded-xl border border-white/10 object-cover"
                              />
                            ) : null}
                            {message.text ? (
                              <p className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">
                                {message.text}
                              </p>
                            ) : (
                              <p className="text-sm text-cyan-100/80">Image uploaded</p>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (message.status === "analyzing") {
                      return (
                        <div key={message.id} className="flex items-end gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
                            <img
                              src={assistantAvatarSrc}
                              alt="PhishGuard"
                              className="h-full w-full object-cover brightness-110 saturate-125"
                              loading="eager"
                            />
                          </div>
                          <div className="max-w-[88%] rounded-3xl rounded-bl-lg border border-white/10 bg-zinc-950 px-4 py-3 text-zinc-100">
                            <div className="flex items-center gap-3 text-zinc-200">
                              <div
                                className="flex items-center gap-1.5 [&>span]:animate-bounce [&>span]:[animation-duration:900ms]"
                                aria-hidden="true"
                              >
                                <span
                                  className="h-2 w-2 rounded-full bg-cyan-200/80"
                                  style={{ animationDelay: "0ms" }}
                                />
                                <span
                                  className="h-2 w-2 rounded-full bg-cyan-200/80"
                                  style={{ animationDelay: "120ms" }}
                                />
                                <span
                                  className="h-2 w-2 rounded-full bg-cyan-200/80"
                                  style={{ animationDelay: "240ms" }}
                                />
                              </div>
                              <p className="text-sm">{message.phase || "Analyzing…"}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (message.status === "error") {
                      return (
                        <div key={message.id} className="flex items-end gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
                            <img
                              src={assistantAvatarSrc}
                              alt="PhishGuard"
                              className="h-full w-full object-cover brightness-110 saturate-125"
                              loading="eager"
                            />
                          </div>
                          <div className="max-w-[88%] rounded-3xl rounded-bl-lg border border-red-500/25 bg-red-950 px-4 py-3 text-red-100">
                            <p className="text-sm font-semibold">Analysis failed</p>
                            <p className="mt-1 text-sm text-red-100/80">{message.errorMessage}</p>
                          </div>
                        </div>
                      );
                    }

                    if (message.status === "limit") {
                      const upgradeHref: Route = message.limitInfo?.organizationSlug
                        ? (`/org/${message.limitInfo.organizationSlug}` as Route)
                        : "/subscriptions";
                      return (
                        <div key={message.id} className="flex items-end gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
                            <img
                              src={assistantAvatarSrc}
                              alt="PhishGuard"
                              className="h-full w-full object-cover brightness-110 saturate-125"
                              loading="eager"
                            />
                          </div>
                          <div className="max-w-[88%] rounded-3xl rounded-bl-lg border border-amber-500/25 bg-amber-950 px-4 py-3 text-amber-100">
                            <p className="text-sm font-semibold">Limit reached</p>
                            <p className="mt-1 text-sm text-amber-100/80">{message.limitInfo?.message}</p>
                            <div className="mt-3 flex items-center gap-2">
                              <Button asChild size="sm" className="bg-amber-400 text-amber-950 hover:bg-amber-300">
                                <Link href={upgradeHref}>Upgrade plan</Link>
                              </Button>
                              <p className="text-xs text-amber-100/70">Then retry your scan.</p>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // done
                    const result = message.result;
                    if (!result) return null;
                    const displayThreats = filterUserFacingThreats(result.detectedThreats || []);
                    const keyFactors = getKeyFactors(result).slice(0, 4);

                    return (
                      <div key={message.id} className="flex items-end gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
                          <img
                            src={assistantAvatarSrc}
                            alt="PhishGuard"
                            className="h-full w-full object-cover brightness-110 saturate-125"
                            loading="eager"
                          />
                        </div>
                        <div className="max-w-[88%] rounded-3xl rounded-bl-lg border border-white/10 bg-zinc-950 px-4 py-3 text-zinc-100">
                          <div className="flex items-start gap-3">
                            <div className={cn("mt-0.5", getRiskColor(result.riskLevel))}>
                              {getRiskIcon(result.riskLevel)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="text-base font-semibold capitalize">
                                  {result.riskLevel} risk
                                </p>
                                <p className="text-xs text-zinc-400">
                                  {(result.overallScore * 100).toFixed(1)}% overall •{" "}
                                  {(result.confidence * 100).toFixed(1)}% confidence
                                </p>
                              </div>
                              <p className="mt-2 break-words text-sm leading-6 text-zinc-300 [overflow-wrap:anywhere]">
                                {result.analysis}
                              </p>

                              {keyFactors.length > 0 ? (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                                    Key factors
                                  </p>
                                  <ul className="mt-2 space-y-1 break-words text-sm text-zinc-300 [overflow-wrap:anywhere]">
                                    {keyFactors.map((factor, idx) => (
                                      <li key={idx} className="flex gap-2">
                                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                                        <span className="min-w-0">{factor}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}

                              {displayThreats.length > 0 ? (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                                    Indicators found
                                  </p>
                                  <ul className="mt-2 space-y-1 break-words text-sm text-zinc-300 [overflow-wrap:anywhere]">
                                    {displayThreats.slice(0, 6).map((threat, idx) => (
                                      <li key={idx} className="flex items-start gap-2">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                                        <span className="min-w-0">{threat}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div ref={endRef} />
            </div>

            <div className="mt-4 space-y-3">
              {attachment ? (
                <div className="flex items-center gap-3 rounded-2xl border border-cyan-400/15 bg-zinc-950 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-cyan-300" />
                    <p className="text-sm text-zinc-200">Image attached</p>
                  </div>
                  <div className="flex-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-zinc-300 hover:text-zinc-50"
                    onClick={() => {
                      setAttachment(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    aria-label="Remove attachment"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <textarea
                    ref={textareaRef}
                    className={cn(
                      "no-scrollbar w-full min-h-12 resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-sm leading-6 text-foreground",
                      "break-words [overflow-wrap:anywhere] overflow-x-hidden",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    )}
                    placeholder="Paste a URL, email text, or drop an image…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    rows={1}
                    disabled={busy}
                  />
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void handleFileSelected(file);
                  }}
                />

                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 rounded-2xl border-cyan-400/20 bg-background px-3 py-2.5 h-auto"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  aria-label="Attach image"
                >
                  <ImageIcon className="h-5 w-5" />
                </Button>

                <Button
                  type="button"
                  className="shrink-0 rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground hover:bg-primary/90 h-auto"
                  onClick={() => void handleSend()}
                  disabled={busy}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Tip: Press Enter to send, Shift+Enter for a new line.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );

  if (embedded) return content;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1680px] px-6 py-12 sm:px-8 lg:px-12">{content}</div>
    </div>
  );
}
