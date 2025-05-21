"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScreenBlock } from "@/lib/types";

interface Props {
  block: ScreenBlock;
  appId: string;
  onDataRefresh?: () => void;
}

export function ChartBlock({ block }: Props) {
  const chartType = block.config.chartType || "bar";

  // Placeholder chart using CSS bars
  // In production, use recharts or chart.js
  const mockData = [
    { label: "1月", value: 65 },
    { label: "2月", value: 72 },
    { label: "3月", value: 58 },
    { label: "4月", value: 89 },
    { label: "5月", value: 76 },
    { label: "6月", value: 94 },
  ];

  const maxValue = Math.max(...mockData.map((d) => d.value));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{block.label}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartType === "bar" && (
          <div className="flex items-end gap-2 pt-2" style={{ height: 120 }}>
            {mockData.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary/80 transition-all"
                  style={{ height: `${(d.value / maxValue) * 100}%` }}
                />
                <span className="text-[10px] text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        )}
        {chartType === "line" && (
          <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
            折れ線グラフ（recharts統合予定）
          </div>
        )}
        {chartType === "pie" && (
          <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
            円グラフ（recharts統合予定）
          </div>
        )}
      </CardContent>
    </Card>
  );
}
