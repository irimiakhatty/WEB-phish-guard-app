"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { BookOpenCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { assignMemberTraining } from "@/app/actions/organizations";
import { Button } from "@/components/ui/button";

type TrainingAssignmentButtonProps = {
  organizationId: string;
  userId: string;
  hasOpenAssignment: boolean;
};

export default function TrainingAssignmentButton({
  organizationId,
  userId,
  hasOpenAssignment,
}: TrainingAssignmentButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleAssign = () => {
    startTransition(async () => {
      const result = await assignMemberTraining({
        organizationId,
        userId,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to assign training");
        return;
      }

      toast.success(result.reused ? "Assignment already exists" : "Training assigned");
      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      variant={hasOpenAssignment ? "outline" : "default"}
      size="sm"
      disabled={isPending}
      onClick={handleAssign}
    >
      <BookOpenCheck className="mr-2 h-3.5 w-3.5" />
      {isPending ? "Assigning..." : hasOpenAssignment ? "Reassign" : "Assign training"}
    </Button>
  );
}
