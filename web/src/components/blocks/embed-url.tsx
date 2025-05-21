"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScreenBlock } from "@/lib/types";
import { ExternalLink } from "lucide-react";

interface Props {
  block: ScreenBlock;
  appId: string;
  onDataRefresh?: () => void;
}

export function EmbedUrlBlock({ block }: Props) {
  const url = block.config.url;
  const height = block.config.height || 300;

  if (!url) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          URLが設定されていません
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{block.label}</CardTitle>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
          <ExternalLink className="h-4 w-4" />
        </a>
      </CardHeader>
      <CardContent className="p-0">
        <iframe
          src={url}
          className="w-full rounded-b-lg border-0"
          style={{ height }}
          title={block.label}
          sandbox="allow-scripts allow-same-origin"
        />
      </CardContent>
    </Card>
  );
}
