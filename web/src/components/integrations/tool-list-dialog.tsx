"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { MCPConnection } from "@/lib/types";
import { Wrench } from "lucide-react";

interface Props {
  connection: MCPConnection | null;
  open: boolean;
  onClose: () => void;
}

export function ToolListDialog({ connection, open, onClose }: Props) {
  if (!connection) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {connection.server_name} - ツール一覧
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-96 space-y-3 overflow-y-auto">
          {connection.tools.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              ツールが見つかりませんでした
            </p>
          ) : (
            connection.tools.map((tool) => (
              <div
                key={tool.name}
                className="rounded-lg border p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{tool.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {tool.description || "説明なし"}
                    </p>
                  </div>
                  <Badge variant="outline" className="ml-2 shrink-0">
                    MCP
                  </Badge>
                </div>
                {tool.parameters && Object.keys(tool.parameters).length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-muted-foreground">パラメータ:</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.keys(
                        (tool.parameters as Record<string, unknown>)?.properties as Record<string, unknown> || {}
                      ).map((param) => (
                        <Badge key={param} variant="secondary" className="text-[10px]">
                          {param}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
