"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, CheckCircle } from "lucide-react";
import {
  completeTrainingAssignment,
  generateAndCreateTrainingAssignment,
  getTrainingAssignments,
} from "@/server/actions/training";

interface TrainingRecommendationsProps {
  organizationId: string;
  userId: string;
  slug: string;
  isAdmin: boolean;
  currentUserId: string;
}

interface Recommendation {
  needsTraining: boolean;
  avgScore: number;
  totalScans: number;
  highCriticalCount: number;
  dominantAttack: string;
  recommendation: string;
  riskTier: string;
}

export function TrainingRecommendations({
  organizationId,
  userId,
  slug,
  isAdmin,
  currentUserId,
}: TrainingRecommendationsProps) {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canComplete = isAdmin || currentUserId === userId;

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Fetch recommendation
        const recRes = await fetch(
          `/api/v1/training-recommendations?organizationId=${organizationId}&userId=${userId}`
        );
        if (recRes.ok) {
          const data = await recRes.json();
          setRecommendation(data);
        }

        // Fetch existing assignments
        const assignRes = await getTrainingAssignments(organizationId, userId);
        setAssignments(assignRes || []);
      } catch (err) {
        setError("Failed to load training data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [organizationId, userId]);

  const handleCreateAssignment = async () => {
    try {
      setCreating(true);
      await generateAndCreateTrainingAssignment(organizationId, userId, slug);
      // Reload assignments
      const assignRes = await getTrainingAssignments(organizationId, userId);
      setAssignments(assignRes || []);
    } catch (err) {
      setError("Failed to create training assignment");
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleCompleteAssignment = async (assignmentId: string) => {
    try {
      setCompletingId(assignmentId);
      await completeTrainingAssignment(assignmentId, slug);
      // Reload assignments
      const assignRes = await getTrainingAssignments(organizationId, userId);
      setAssignments(assignRes || []);
    } catch (err) {
      setError("Failed to complete training assignment");
      console.error(err);
    } finally {
      setCompletingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/30 bg-red-500/10">
        <CardContent className="py-4 text-sm text-red-400">{error}</CardContent>
      </Card>
    );
  }

  const activeAssignments = assignments.filter((a) => a.status !== "completed");
  const completedAssignments = assignments.filter((a) => a.status === "completed");

  return (
    <>
      {recommendation?.needsTraining && (
        <Card
          className={
            recommendation.riskTier === "critical"
              ? "border-red-500/30 bg-red-500/10"
              : "border-orange-500/30 bg-orange-500/10"
          }
        >
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className={`w-5 h-5 mt-0.5 shrink-0 ${
                    recommendation.riskTier === "critical" ? "text-red-500" : "text-orange-500"
                  }`}
                />
                <div>
                  <CardTitle>Training recommended</CardTitle>
                  <CardDescription>Based on recent phishing detection patterns</CardDescription>
                </div>
              </div>
              {isAdmin && !activeAssignments.some((a) => a.status === "assigned") && (
                <Button
                  size="sm"
                  onClick={handleCreateAssignment}
                  disabled={creating}
                  className="shrink-0"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Assign training"
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground mb-1">Total scans</div>
                <div className="text-lg font-semibold">{recommendation.totalScans}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground mb-1">High/Critical</div>
                <div className="text-lg font-semibold text-red-400">{recommendation.highCriticalCount}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground mb-1">Avg risk score</div>
                <div className="text-lg font-semibold">{(recommendation.avgScore * 100).toFixed(0)}%</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground mb-1">Dominant attack</div>
                <div className="text-sm font-semibold truncate">{recommendation.dominantAttack}</div>
              </div>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">{recommendation.recommendation}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {activeAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active training assignments</CardTitle>
            <CardDescription>{activeAssignments.length} pending</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <Badge variant="outline" className="mb-2">
                      {assignment.attackType}
                    </Badge>
                    <p className="text-sm text-muted-foreground">{assignment.recommendation}</p>
                  </div>
                  {assignment.dueAt && (
                    <div className="text-xs text-muted-foreground text-right shrink-0">
                      Due: {new Date(assignment.dueAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
                {assignment.assignedBy && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Assigned by {assignment.assignedBy.name || assignment.assignedBy.email}
                  </p>
                )}
                {canComplete && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCompleteAssignment(assignment.id)}
                    disabled={completingId === assignment.id}
                  >
                    {completingId === assignment.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Completing...
                      </>
                    ) : (
                      "Mark as completed"
                    )}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {completedAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed training</CardTitle>
            <CardDescription>{completedAssignments.length} completed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {completedAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <Badge variant="outline" className="mb-2">
                        {assignment.attackType}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        Completed on {new Date(assignment.completedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
