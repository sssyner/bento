"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MCPService, MCPConnection } from "@/lib/types";
import { Plug, CheckCircle2, ExternalLink } from "lucide-react";

interface Props {
  service: MCPService;
  connection?: MCPConnection;
  onConnect: (service: MCPService) => void;
  onDisconnect: (connectionId: string) => void;
  onViewTools: (connection: MCPConnection) => void;
}

const SERVICE_ICONS: Record<string, string> = {
  google_sheets: "📊",
  slack: "💬",
  notion: "📝",
  google_calendar: "📅",
  stripe: "💳",
  gmail: "✉️",
};

export function ServiceCard({ service, connection, onConnect, onDisconnect, onViewTools }: Props) {
  const isConnected = connection && connection.status === "connected";

  return (
    <Card className={isConnected ? "border-green-200 bg-green-50/30" : ""}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-2xl">
          {SERVICE_ICONS[service.id] || "🔗"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{service.name}</h3>
            {isConnected && (
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                接続済み
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">
            {service.description}
          </p>
          {isConnected && connection && (
            <p className="mt-1 text-xs text-muted-foreground">
              {connection.tools.length} ツール利用可能
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {isConnected && connection ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewTools(connection)}
              >
                ツール一覧
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => onDisconnect(connection.id)}
              >
                解除
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => onConnect(service)}>
              <Plug className="mr-1 h-4 w-4" />
              接続
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
