"use client";

import { useState, useRef } from "react";
import { Send, Link as LinkIcon, FileText, AlertTriangle, CheckCircle, XCircle, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { analyzePhishing } from "@/app/actions/analyze";
import { uploadScanImage } from "@/app/actions/upload";

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

export default function ManualAnalysis() {
  const [activeTab, setActiveTab] = useState<"url" | "text" | "image">("url");
  const [url, setUrl] = useState("");
  const [textContent, setTextContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await uploadScanImage(formData);
      setImageUrl(result.imageUrl);
      toast.success("Image uploaded successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload image");
      console.error(error);
    } finally {
      setUploading(false);
    }
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

    try {
      const data = await analyzePhishing({
        url: activeTab === "url" ? url : undefined,
        textContent: activeTab === "text" ? textContent : undefined,
        imageUrl: activeTab === "image" ? imageUrl : undefined,
      });

      setResult(data);
      toast.success("Analysis complete");
    } catch (error) {
      toast.error("Analysis failed");
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
        <Card className="mb-8 hover:shadow-lg transition-shadow">
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
                className="w-full min-h-[200px] p-3 rounded-lg border border-input bg-background"
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

              {imageUrl && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="relative rounded-lg border overflow-hidden">
                    <img
                      src={imageUrl}
                      alt="Uploaded scan"
                      className="w-full h-auto"
                    />
                  </div>
                  <Button onClick={handleAnalyze} disabled={analyzing} className="w-full">
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
        <Card>
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
