"use client";

import type { ScreenBlock } from "@/lib/types";
import { WorkflowLauncherBlock } from "./workflow-launcher";
import { DataListBlock } from "./data-list";
import { MetricCardBlock } from "./metric-card";
import { ChartBlock } from "./chart-block";
import { QuickInputBlock } from "./quick-input";
import { EmbedUrlBlock } from "./embed-url";
import { TextBlock } from "./text-block";

interface BlockRendererProps {
  block: ScreenBlock;
  appId: string;
  onDataRefresh?: () => void;
}

export function BlockRenderer({ block, appId, onDataRefresh }: BlockRendererProps) {
  const Component = BLOCK_COMPONENTS[block.type];
  if (!Component) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        未対応のブロックタイプ: {block.type}
      </div>
    );
  }
  return <Component block={block} appId={appId} onDataRefresh={onDataRefresh} />;
}

const BLOCK_COMPONENTS: Record<string, React.ComponentType<BlockRendererProps>> = {
  workflow_launcher: WorkflowLauncherBlock,
  data_list: DataListBlock,
  metric_card: MetricCardBlock,
  chart: ChartBlock,
  quick_input: QuickInputBlock,
  embed_url: EmbedUrlBlock,
  text: TextBlock,
};
