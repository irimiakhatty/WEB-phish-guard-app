"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Link as LinkIcon, FileText, AlertTriangle, CheckCircle, XCircle, Upload, Image as ImageIcon, Loader } from "lucide-react";
import { toast } from "sonner";
import type { Route } from "next";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { analyzePhishing } from "@/app/actions/analyze";
import Link from "next/link";
import { uploadScanImage } from "@/app/actions/upload";
import { extractTextFromImage } from "@/lib/ocr";

type AnalysisResult = {
  textScore: number;
  urlScore: number;
  overallScore: number;
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  isPhishing: boolean;
  confidence: number;
  detectedThreats: string[];
  analysis: string;
};

// Session storage keys
const SESSION_KEYS = {
  ACTIVE_TAB: "phishguard_active_tab",
  URL: "phishguard_url",
  TEXT_CONTENT: "phishguard_text_content",
  IMAGE_URL: "phishguard_image_url",
  IMAGE_PREVIEW: "phishguard_image_preview",
};

export default function ManualAnalysis() {
  const [activeTab, setActiveTab] = useState<"url" | "text" | "image">("url");
  const [url, setUrl] = useState("");
  const [textContent, setTextContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extractingText, setExtractingText] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [limitInfo, setLimitInfo] = useState<{
    message: string;
    planId?: string;
    organizationSlug?: string;
    limits?: { monthly: { used: number; limit: number }; hourly: { used: number; limit: number } };
  } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore state from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTab = sessionStorage.getItem(SESSION_KEYS.ACTIVE_TAB) as "url" | "text" | "image" | null;
      const savedUrl = sessionStorage.getItem(SESSION_KEYS.URL);
      const savedText = sessionStorage.getItem(SESSION_KEYS.TEXT_CONTENT);
      const savedImageUrl = sessionStorage.getItem(SESSION_KEYS.IMAGE_URL);
      const savedImagePreview = sessionStorage.getItem(SESSION_KEYS.IMAGE_PREVIEW);

      if (savedTab) setActiveTab(savedTab);
      if (savedUrl) setUrl(savedUrl);
      if (savedText) setTextContent(savedText);
      if (savedImageUrl) setImageUrl(savedImageUrl);
      if (savedImagePreview) setImagePreview(savedImagePreview);

      setHydrated(true);
    }
  }, []);

  // Persist activeTab to sessionStorage
  useEffect(() => {
    if (hydrated) {
      sessionStorage.setItem(SESSION_KEYS.ACTIVE_TAB, activeTab);
    }
  }, [activeTab, hydrated]);

  // Persist url to sessionStorage
  useEffect(() => {
    if (hydrated) {
      sessionStorage.setItem(SESSION_KEYS.URL, url);
    }
  }, [url, hydrated]);

  // Persist textContent to sessionStorage
  useEffect(() => {
    if (hydrated) {
      sessionStorage.setItem(SESSION_KEYS.TEXT_CONTENT, textContent);
    }
  }, [textContent, hydrated]);

  // Persist imageUrl to sessionStorage
  useEffect(() => {
    if (hydrated) {
      sessionStorage.setItem(SESSION_KEYS.IMAGE_URL, imageUrl);
    }
  }, [imageUrl, hydrated]);

  // Persist imagePreview to sessionStorage
  useEffect(() => {
    if (hydrated) {
      if (imagePreview) {
        sessionStorage.setItem(SESSION_KEYS.IMAGE_PREVIEW, imagePreview);
      } else {
        sessionStorage.removeItem(SESSION_KEYS.IMAGE_PREVIEW);
      }
    }
  }, [imagePreview, hydrated]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    setUploading(true);

    try {
      // Convert image to base64 for persistent preview
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      
      const base64Preview = await base64Promise;
      setImagePreview(base64Preview);

      // Upload image for record keeping (in parallel with OCR)
      const uploadPromise = (async () => {
        const formData = new FormData();
        formData.append("file", file);
        const result = await uploadScanImage(formData);
        setImageUrl(result.imageUrl);
      })();

      // Extract text using OCR
      setExtractingText(true);
      toast.info("Extracting text from image...");
      
      try {
        const extractedText = await extractTextFromImage(file);
        
        if (extractedText && extractedText.trim().length > 10) {
          setTextContent(extractedText);
          toast.success("Text extracted! Review and edit if needed, then analyze.");
        } else {
          toast.warning("Little or no text detected. You can add text manually.");
        }
      } catch (ocrError) {
        console.error("OCR failed:", ocrError);
        toast.warning("Text extraction failed. You can add text manually.");
      } finally {
        setExtractingText(false);
      }

      // Wait for upload to complete
      await uploadPromise;
      
    } catch (error: any) {
      toast.error(error.message || "Failed to upload image");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleClearImage = () => {
    setImagePreview(null);
    setImageUrl("");
    setTextContent("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // Clear from sessionStorage too
    sessionStorage.removeItem(SESSION_KEYS.IMAGE_PREVIEW);
    sessionStorage.removeItem(SESSION_KEYS.IMAGE_URL);
    sessionStorage.removeItem(SESSION_KEYS.TEXT_CONTENT);
  };

  const handleAnalyze = async () => {
    if (activeTab === "url" && !url.trim()) {
      toast.error("Please enter a URL");
      return;
    }
    if (activeTab === "text" && !textContent.trim()) {
      toast.error("Please enter some text");
      return;
    }
    if (activeTab === "image" && !imageUrl) {
      toast.error("Please upload an image first");
      return;
    }

    setAnalyzing(true);
    setResult(null);
    setLimitInfo(null);

    try {
      const data = await analyzePhishing({
        url: activeTab === "url" ? url : undefined,
        textContent: activeTab === "text" || (activeTab === "image" && textContent.trim()) 
          ? textContent 
          : undefined,
        imageUrl: activeTab === "image" ? imageUrl : undefined,
      });

      setResult(data);
      toast.success("Analysis complete");
    } catch (error: any) {
      let message = error?.message || "Analysis failed";

      // Decode serialized limit error
      if (typeof message === "string" && message.startsWith("PG_LIMIT:")) {
        const json = message.replace("PG_LIMIT:", "");
        try {
          const payload = JSON.parse(json);
          setLimitInfo({
            message: payload.message || "Scan limit reached",
            planId: payload.planId,
            organizationSlug: payload.organizationSlug,
            limits: payload.limits,
          });
          message = payload.message || message;
        } catch (e) {
          console.warn("Failed to parse limit payload", e);
        }
      }

      toast.error(message);
      console.error(error);
    } finally {
      setAnalyzing(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "safe":
        return "text-green-600 dark:text-green-400";
      case "low":
        return "text-blue-600 dark:text-blue-400";
      case "medium":
        return "text-yellow-600 dark:text-yellow-400";
      case "high":
        return "text-orange-600 dark:text-orange-400";
      case "critical":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const getRiskIcon = (level: string) => {
    if (level === "safe") return <CheckCircle className="w-16 h-16" />;
    if (level === "low" || level === "medium") return <AlertTriangle className="w-16 h-16" />;
    return <XCircle className="w-16 h-16" />;
  };

  const upgradeHref: Route = limitInfo?.organizationSlug
    ? (`/org/${limitInfo.organizationSlug}` as Route)
    : "/subscriptions";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/20 dark:from-gray-950 dark:via-blue-950/20 dark:to-purple-950/20">
      <div className="container mx-auto max-w-6xl px-4 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-gray-900 dark:text-white">
            Phishing Analysis
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-400">
            Analyze URLs, text content, and images for potential phishing threats
          </p>
        </div>

        {limitInfo && (
          <div className="mb-6 border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/70 dark:bg-amber-500/10 dark:text-amber-100 rounded-md p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 text-amber-500 dark:text-amber-300" />
              <div className="flex-1">
                <div className="font-semibold">Scan limit reached</div>
                <p className="text-sm">{limitInfo.message}</p>
                {limitInfo.limits && (
                  <p className="text-xs mt-1">
                    Monthly {limitInfo.limits.monthly.used}/{limitInfo.limits.monthly.limit} · Hourly {limitInfo.limits.hourly.used}/{limitInfo.limits.hourly.limit}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setLimitInfo(null)}>
                    Dismiss
                  </Button>
                  <Button size="sm" asChild>
                    <Link href={upgradeHref}>
                      Upgrade or Request More
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          <Button
            variant={activeTab === "url" ? "default" : "outline"}
            onClick={() => setActiveTab("url")}
            className="flex items-center gap-2"
          >
            <LinkIcon className="w-4 h-4" />
            URL Analysis
          </Button>
          <Button
            variant={activeTab === "text" ? "default" : "outline"}
            onClick={() => setActiveTab("text")}
            className="flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Text Analysis
          </Button>
          <Button
            variant={activeTab === "image" ? "default" : "outline"}
            onClick={() => setActiveTab("image")}
            className="flex items-center gap-2"
          >
            <ImageIcon className="w-4 h-4" />
            Image Analysis
          </Button>
        </div>

        {/* Input Section */}
        <Card className="mb-8 hover:shadow-2xl transition-shadow bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
          <CardHeader>
            <CardTitle className="text-xl">
              {activeTab === "url" && "Enter URL"}
              {activeTab === "text" && "Enter Text Content"}
              {activeTab === "image" && "Upload Image"}
            </CardTitle>
            <CardDescription>
              {activeTab === "url" && "Enter a website URL to check for phishing indicators"}
              {activeTab === "text" && "Paste email content or message text to analyze"}
              {activeTab === "image" && "Upload a screenshot of suspicious email or message"}
            </CardDescription>
          </CardHeader>
          <CardContent>
          {activeTab === "url" ? (
            <div className="space-y-3">
              <Label htmlFor="url">URL</Label>
              <div className="flex gap-2">
                <Input
                  id="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={handleAnalyze} 
                  disabled={analyzing}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {analyzing ? (
                    <>Analyzing...</>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Analyze
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : activeTab === "text" ? (
            <div className="space-y-3">
              <Label htmlFor="text">Text Content</Label>
              <textarea
                id="text"
                className="w-full min-h-50 p-3 rounded-lg border border-input bg-background"
                placeholder="Paste email or message content here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
              />
              <Button 
                onClick={handleAnalyze} 
                disabled={analyzing} 
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {analyzing ? (
                  <>Analyzing...</>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Analyze
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex-1"
                >
                  {uploading ? (
                    <>Uploading...</>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Choose Image
                    </>
                  )}
                </Button>
              </div>

              {imagePreview && (
                <div className="space-y-3">
                  <div className="relative rounded-lg border overflow-hidden bg-gray-50">
                    <img
                      src={imagePreview}
                      alt="Uploaded preview"
                      className="w-full h-auto max-h-100 object-contain"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearImage}
                      className="absolute top-2 right-2 bg-white/90 hover:bg-white"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                  
                  {extractingText && (
                    <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                      <Loader className="h-4 w-4 animate-spin" />
                      Extracting text from image...
                    </div>
                  )}
                  
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <strong>Note:</strong> OCR text extraction may not be perfect, especially with screenshots. 
                        Please review and edit the extracted text as needed before analyzing.
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="image-text">
                      {textContent ? "Extracted Text (Review and edit if needed)" : "Add text from the image (optional)"}
                    </Label>
                    <textarea
                      id="image-text"
                      className="w-full min-h-30 p-3 rounded-lg border border-input bg-background"
                      placeholder="Text will be extracted automatically from image, or enter manually..."
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      disabled={extractingText}
                    />
                  </div>

                  <Button 
                    onClick={handleAnalyze} 
                    disabled={analyzing || extractingText} 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {analyzing ? (
                      <>Analyzing...</>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Analyze Image
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
        {result && (
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Risk Level */}
            <div className="flex items-center gap-4">
              <div className={getRiskColor(result.riskLevel)}>
                {getRiskIcon(result.riskLevel)}
              </div>
              <div>
                <h3 className="text-2xl font-bold capitalize">{result.riskLevel} Risk</h3>
                <p className="text-muted-foreground">
                  {result.isPhishing ? "⚠️ Potential phishing detected" : "✓ No immediate threats detected"}
                </p>
              </div>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Overall Score</p>
                <p className="text-2xl font-bold">{(result.overallScore * 100).toFixed(1)}%</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Confidence</p>
                <p className="text-2xl font-bold">{(result.confidence * 100).toFixed(1)}%</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">URL Score</p>
                <p className="text-2xl font-bold">{(result.urlScore * 100).toFixed(1)}%</p>
              </div>
            </div>

            {/* Detected Threats */}
            {result.detectedThreats.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Detected Threats</h4>
                <ul className="space-y-1">
                  {result.detectedThreats.map((threat, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      {threat}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Analysis Details */}
            <div>
              <h4 className="font-semibold mb-2">Analysis Details</h4>
              <p className="text-sm text-muted-foreground">{result.analysis}</p>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
