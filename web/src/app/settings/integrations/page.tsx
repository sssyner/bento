"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Nav } from "@/components/dashboard/nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ServiceCard } from "@/components/integrations/service-card";
import { ToolListDialog } from "@/components/integrations/tool-list-dialog";
import { AddCustomServerDialog } from "@/components/integrations/add-custom-server";
import type { MCPService, MCPConnection } from "@/lib/types";
import toast from "react-hot-toast";
import { Plug, Plus, RefreshCw } from "lucide-react";

export default function IntegrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [services, setServices] = useState<MCPService[]>([]);
  const [connections, setConnections] = useState<MCPConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [toolDialogConn, setToolDialogConn] = useState<MCPConnection | null>(null);
  const [showAddCustom, setShowAddCustom] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    loadData();
  }, [user, authLoading, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [servicesRes, connectionsRes] = await Promise.all([
        api.get<{ services: MCPService[] }>("/api/mcp/services"),
        api.get<{ connections: MCPConnection[] }>("/api/mcp/connections"),
      ]);
      setServices(servicesRes.services);
      setConnections(connectionsRes.connections);
    } catch {
      toast.error("データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (service: MCPService) => {
    if (service.auth_type === "oauth") {
      // For OAuth services, get auth URL and redirect
      try {
        const res = await api.get<{ url: string }>(
          `/api/mcp/auth/${service.id}/url?redirect_uri=${encodeURIComponent(window.location.href)}`
        );
        if (res.url) {
          window.location.href = res.url;
          return;
        }
      } catch {
        // Fallback: create direct connection
      }
    }

    // For API key or non-OAuth services, create connection directly
    try {
      await api.post("/api/mcp/connections", {
        server_name: service.name,
        server_url: "",
        service_id: service.id,
        auth_type: service.auth_type,
        description: service.description,
      });
      toast.success(`${service.name}を接続しました`);
      loadData();
    } catch {
      toast.error("接続に失敗しました");
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      await api.delete(`/api/mcp/connections/${connectionId}`);
      toast.success("接続を解除しました");
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    } catch {
      toast.error("解除に失敗しました");
    }
  };

  const handleAddCustom = async (data: {
    server_name: string;
    server_url: string;
    auth_type: string;
    credentials: string;
    description: string;
  }) => {
    try {
      await api.post("/api/mcp/connections", data);
      toast.success("サーバーを追加しました");
      loadData();
    } catch {
      toast.error("追加に失敗しました");
    }
  };

  const getConnectionForService = (serviceId: string): MCPConnection | undefined => {
    return connections.find((c) => c.service_id === serviceId);
  };

  // Connections that don't map to a catalog service (custom servers)
  const customConnections = connections.filter(
    (c) => !services.some((s) => s.id === c.service_id)
  );

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Plug className="h-6 w-6" />
              外部サービス連携
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              サービスを接続すると、AIチャットやワークフローから自動で利用できます
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="mr-1 h-4 w-4" />
              更新
            </Button>
            <Button size="sm" onClick={() => setShowAddCustom(true)}>
              <Plus className="mr-1 h-4 w-4" />
              カスタム追加
            </Button>
          </div>
        </div>

        {/* Connected count */}
        {connections.length > 0 && (
          <div className="mb-4">
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              {connections.filter((c) => c.status === "connected").length} サービス接続済み
            </Badge>
          </div>
        )}

        {/* Service catalog */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">サービスカタログ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                connection={getConnectionForService(service.id)}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onViewTools={setToolDialogConn}
              />
            ))}
          </CardContent>
        </Card>

        {/* Custom connections */}
        {customConnections.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">カスタムサーバー</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customConnections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{conn.server_name}</p>
                    <p className="text-xs text-muted-foreground">{conn.server_url}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge
                        variant={conn.status === "connected" ? "secondary" : "destructive"}
                        className={conn.status === "connected" ? "bg-green-100 text-green-700" : ""}
                      >
                        {conn.status === "connected" ? "接続済み" : conn.status === "error" ? "エラー" : "未接続"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {conn.tools.length} ツール
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {conn.tools.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setToolDialogConn(conn)}
                      >
                        ツール
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleDisconnect(conn.id)}
                    >
                      削除
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Dialogs */}
        <ToolListDialog
          connection={toolDialogConn}
          open={!!toolDialogConn}
          onClose={() => setToolDialogConn(null)}
        />
        <AddCustomServerDialog
          open={showAddCustom}
          onClose={() => setShowAddCustom(false)}
          onAdd={handleAddCustom}
        />
      </main>
    </div>
  );
}
