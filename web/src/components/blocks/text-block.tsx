"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { ScreenBlock } from "@/lib/types";

interface Props {
  block: ScreenBlock;
  appId: string;
  onDataRefresh?: () => void;
}

export function TextBlock({ block }: Props) {
  return (
    <Card>
      <CardContent className="p-4">
        {block.label && <p className="mb-1 font-medium">{block.label}</p>}
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {block.config.content || block.config.description || ""}
        </p>
      </CardContent>
    </Card>
  );
}
