"use client";

import { useState } from "react";
import { Send, Link as LinkIcon, FileText, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { analyzePhishing } from "@/app/actions/analyze";

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
  const [activeTab, setActiveTab] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [textContent, setTextContent] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async () => {
    if (activeTab === "url" && !url.trim()) {
      toast.error("Please enter a URL");
      return;
    }
    if (activeTab === "text" && !textContent.trim()) {
      toast.error("Please enter some text");
      return;
    }

    setAnalyzing(true);
    setResult(null);

    try {
      const data = await analyzePhishing({
        url: activeTab === "url" ? url : undefined,
        textContent: activeTab === "text" ? textContent : undefined,
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
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Phishing Analysis</h1>
        <p className="text-muted-foreground">
          Analyze URLs and text content for potential phishing threats
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
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
      </div>

      {/* Input Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{activeTab === "url" ? "Enter URL" : "Enter Text Content"}</CardTitle>
          <CardDescription>
            {activeTab === "url"
              ? "Enter a website URL to check for phishing indicators"
              : "Paste email content or message text to analyze"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeTab === "url" ? (
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <div className="flex gap-2">
                <Input
                  id="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAnalyze} disabled={analyzing}>
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
          ) : (
            <div className="space-y-2">
              <Label htmlFor="text">Text Content</Label>
              <textarea
                id="text"
                className="w-full min-h-[200px] p-3 rounded-md border border-input bg-background"
                placeholder="Paste email or message content here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
              />
              <Button onClick={handleAnalyze} disabled={analyzing} className="w-full">
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
  );
}
