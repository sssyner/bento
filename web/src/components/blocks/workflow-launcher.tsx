"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ScreenBlock, WorkflowExecution } from "@/lib/types";
import toast from "react-hot-toast";
import { Play } from "lucide-react";

interface Props {
  block: ScreenBlock;
  appId: string;
  onDataRefresh?: () => void;
}

export function WorkflowLauncherBlock({ block }: Props) {
  const router = useRouter();
  const isLarge = block.config.style === "large";

  const launch = async () => {
    if (!block.config.workflowId) {
      toast.error("ワークフローが設定されていません");
      return;
    }
    try {
      const exec = await api.post<WorkflowExecution>(
        `/api/executions/start/${block.config.workflowId}`
      );
      router.push(`/workflow/${exec.id}`);
    } catch {
      toast.error("開始に失敗しました");
    }
  };

  if (isLarge) {
    return (
      <Card className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]" onClick={launch}>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Play className="h-7 w-7 text-primary" />
          </div>
          <p className="text-lg font-semibold">{block.label}</p>
          {block.config.description && (
            <p className="mt-1 text-sm text-muted-foreground">{block.config.description}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Button variant="outline" className="h-auto w-full justify-start gap-3 p-4" onClick={launch}>
      <Play className="h-5 w-5 text-primary" />
      <div className="text-left">
        <p className="font-medium">{block.label}</p>
        {block.config.description && (
          <p className="text-xs text-muted-foreground">{block.config.description}</p>
        )}
      </div>
    </Button>
  );
}
