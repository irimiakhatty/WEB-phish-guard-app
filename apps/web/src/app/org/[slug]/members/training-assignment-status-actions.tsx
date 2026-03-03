"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateTrainingAssignmentStatus } from "@/app/actions/organizations";

type TrainingAssignmentStatus = "assigned" | "in_progress" | "completed" | "dismissed";

type TrainingAssignmentStatusActionsProps = {
  organizationId: string;
  assignmentId: string;
  status: string;
};

export default function TrainingAssignmentStatusActions({
  organizationId,
  assignmentId,
  status,
}: TrainingAssignmentStatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const runStatusUpdate = (nextStatus: TrainingAssignmentStatus, successMessage: string) => {
    startTransition(async () => {
      const result = await updateTrainingAssignmentStatus({
        organizationId,
        assignmentId,
        status: nextStatus,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to update assignment status");
        return;
      }

      toast.success(result.unchanged ? "No changes" : successMessage);
      router.refresh();
    });
  };

  if (status === "completed") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => runStatusUpdate("in_progress", "Assignment reopened")}
      >
        <RotateCcw className="mr-2 h-3.5 w-3.5" />
        {isPending ? "Updating..." : "Reopen"}
      </Button>
    );
  }

  if (status === "dismissed") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => runStatusUpdate("assigned", "Assignment reactivated")}
      >
        <RotateCcw className="mr-2 h-3.5 w-3.5" />
        {isPending ? "Updating..." : "Reactivate"}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "assigned" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => runStatusUpdate("in_progress", "Assignment started")}
        >
          <Play className="mr-2 h-3.5 w-3.5" />
          {isPending ? "Updating..." : "Start"}
        </Button>
      )}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={isPending}
        onClick={() => runStatusUpdate("completed", "Assignment completed")}
      >
        <Check className="mr-2 h-3.5 w-3.5" />
        {isPending ? "Updating..." : "Complete"}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => runStatusUpdate("dismissed", "Assignment dismissed")}
      >
        <X className="mr-2 h-3.5 w-3.5" />
        {isPending ? "Updating..." : "Dismiss"}
      </Button>
    </div>
  );
}
