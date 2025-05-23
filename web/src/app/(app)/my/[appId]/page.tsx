"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Nav } from "@/components/dashboard/nav";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { Button } from "@/components/ui/button";
import type { UserApp, AppScreen } from "@/lib/types";
import toast from "react-hot-toast";
import { Settings, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function UserAppPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [app, setApp] = useState<UserApp | null>(null);
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    loadApp();
  }, [user, authLoading, appId, router]);

  const loadApp = async () => {
    try {
      const data = await api.get<UserApp>(`/api/apps/${appId}`);
      setApp(data);
      if (data.screens.length > 0) {
        setActiveScreenId(data.screens[0].id);
      }
    } catch {
      toast.error("アプリの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">アプリが見つかりません</p>
      </div>
    );
  }

  const activeScreen = app.screens.find((s) => s.id === activeScreenId) || app.screens[0];

  const getWidthClass = (width: string) => {
    switch (width) {
      case "half": return "col-span-1";
      case "third": return "col-span-1";
      default: return "col-span-full";
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <Nav />
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* App header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">{app.name}</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => router.push(`/my/${appId}/edit`)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {/* Screen tabs */}
        {app.screens.length > 1 && (
          <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
            {app.screens
              .sort((a, b) => a.order - b.order)
              .map((screen) => (
                <button
                  key={screen.id}
                  className={cn(
                    "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                    activeScreenId === screen.id
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveScreenId(screen.id)}
                >
                  {screen.label}
                </button>
              ))}
          </div>
        )}

        {/* Blocks grid */}
        {activeScreen && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {activeScreen.blocks
              .sort((a, b) => a.order - b.order)
              .map((block) => (
                <div key={block.id} className={getWidthClass(block.width)}>
                  <BlockRenderer block={block} appId={appId} onDataRefresh={loadApp} />
                </div>
              ))}
          </div>
        )}

        {(!activeScreen || activeScreen.blocks.length === 0) && (
          <div className="rounded-lg border border-dashed py-16 text-center">
            <p className="text-muted-foreground">まだブロックがありません</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push(`/my/${appId}/edit`)}
            >
              ブロックを追加
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
