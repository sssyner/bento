"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { ScreenBlock } from "@/lib/types";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  block: ScreenBlock;
  appId: string;
  onDataRefresh?: () => void;
}

export function MetricCardBlock({ block }: Props) {
  const trend = block.config.trend;

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground";

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{block.label}</p>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-2xl font-bold">
            {block.config.value || "—"}
          </span>
          {block.config.unit && (
            <span className="mb-0.5 text-sm text-muted-foreground">{block.config.unit}</span>
          )}
          {trend && <TrendIcon className={`mb-1 h-4 w-4 ${trendColor}`} />}
        </div>
        {block.config.description && (
          <p className="mt-1 text-xs text-muted-foreground">{block.config.description}</p>
        )}
      </CardContent>
    </Card>
  );
}
