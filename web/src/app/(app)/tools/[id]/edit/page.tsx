"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Nav } from "@/components/dashboard/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import type { UserApp, AppScreen, ScreenBlock, BlockType, BlockConfig } from "@/lib/types";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Save,
  Eye,
  Pencil,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BLOCK_TYPE_OPTIONS: { type: BlockType; label: string; icon: string }[] = [
  { type: "workflow_launcher", label: "ワークフロー", icon: "🚀" },
  { type: "data_list", label: "データ一覧", icon: "📋" },
  { type: "chart", label: "グラフ", icon: "📊" },
  { type: "metric_card", label: "数値カード", icon: "🔢" },
  { type: "quick_input", label: "入力フォーム", icon: "✏️" },
  { type: "embed_url", label: "URL埋め込み", icon: "🌐" },
  { type: "text", label: "テキスト", icon: "📝" },
  { type: "image", label: "画像", icon: "🖼️" },
  { type: "calendar", label: "カレンダー", icon: "📅" },
  { type: "recent_activity", label: "アクティビティ", icon: "🕐" },
  { type: "ai_chat", label: "AIチャット", icon: "🤖" },
  { type: "notification_feed", label: "通知", icon: "🔔" },
];

const WIDTH_OPTIONS: { value: "full" | "half" | "third"; label: string }[] = [
  { value: "full", label: "全幅" },
  { value: "half", label: "1/2" },
  { value: "third", label: "1/3" },
];

function generateId() {
  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function generateScreenId() {
  return `scr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function ToolEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [app, setApp] = useState<UserApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeScreenIndex, setActiveScreenIndex] = useState(0);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [appName, setAppName] = useState("");

  const loadApp = useCallback(async () => {
    try {
      const data = await api.get<UserApp>(`/api/apps/${id}`);
      setApp(data);
      setAppName(data.name);
      if (data.screens.length === 0) {
        const defaultScreen: AppScreen = {
          id: generateScreenId(),
          label: "メイン",
          blocks: [],
          order: 0,
        };
        setApp({ ...data, screens: [defaultScreen] });
      }
    } catch {
      toast.error("アプリの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    loadApp();
  }, [user, authLoading, id, router, loadApp]);

  const saveApp = async () => {
    if (!app) return;
    setSaving(true);
    try {
      await api.put(`/api/apps/${id}`, {
        name: appName,
        screens: app.screens,
      });
      toast.success("保存しました");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const updateScreens = (screens: AppScreen[]) => {
    if (!app) return;
    setApp({ ...app, screens });
  };

  const activeScreen = app?.screens[activeScreenIndex];

  const addScreen = () => {
    if (!app) return;
    const newScreen: AppScreen = {
      id: generateScreenId(),
      label: `画面${app.screens.length + 1}`,
      blocks: [],
      order: app.screens.length,
    };
    updateScreens([...app.screens, newScreen]);
    setActiveScreenIndex(app.screens.length);
  };

  const removeScreen = (index: number) => {
    if (!app || app.screens.length <= 1) return;
    const screens = app.screens.filter((_, i) => i !== index);
    updateScreens(screens);
    if (activeScreenIndex >= screens.length) {
      setActiveScreenIndex(screens.length - 1);
    }
  };

  const updateScreenLabel = (index: number, label: string) => {
    if (!app) return;
    const screens = [...app.screens];
    screens[index] = { ...screens[index], label };
    updateScreens(screens);
  };

  const addBlock = (type: BlockType) => {
    if (!activeScreen || !app) return;
    const newBlock: ScreenBlock = {
      id: generateId(),
      type,
      label: BLOCK_TYPE_OPTIONS.find((b) => b.type === type)?.label || type,
      config: {},
      width: type === "metric_card" ? "half" : "full",
      order: activeScreen.blocks.length,
    };
    const screens = [...app.screens];
    screens[activeScreenIndex] = {
      ...activeScreen,
      blocks: [...activeScreen.blocks, newBlock],
    };
    updateScreens(screens);
    setEditingBlockId(newBlock.id);
  };

  const removeBlock = (blockId: string) => {
    if (!activeScreen || !app) return;
    const screens = [...app.screens];
    screens[activeScreenIndex] = {
      ...activeScreen,
      blocks: activeScreen.blocks.filter((b) => b.id !== blockId),
    };
    updateScreens(screens);
    if (editingBlockId === blockId) setEditingBlockId(null);
  };

  const moveBlock = (blockId: string, direction: -1 | 1) => {
    if (!activeScreen || !app) return;
    const blocks = [...activeScreen.blocks].sort((a, b) => a.order - b.order);
    const idx = blocks.findIndex((b) => b.id === blockId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= blocks.length) return;

    [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
    blocks.forEach((b, i) => (b.order = i));

    const screens = [...app.screens];
    screens[activeScreenIndex] = { ...activeScreen, blocks };
    updateScreens(screens);
  };

  const updateBlock = (blockId: string, updates: Partial<ScreenBlock>) => {
    if (!activeScreen || !app) return;
    const screens = [...app.screens];
    screens[activeScreenIndex] = {
      ...activeScreen,
      blocks: activeScreen.blocks.map((b) =>
        b.id === blockId ? { ...b, ...updates } : b
      ),
    };
    updateScreens(screens);
  };

  const updateBlockConfig = (blockId: string, configUpdates: Partial<BlockConfig>) => {
    if (!activeScreen || !app) return;
    const block = activeScreen.blocks.find((b) => b.id === blockId);
    if (!block) return;
    updateBlock(blockId, { config: { ...block.config, ...configUpdates } });
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

  return (
    <div className="min-h-screen bg-muted/30">
      <Nav />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/tools/${id}`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Input
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="h-9 w-full text-lg font-bold sm:w-48"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewMode(!previewMode)}
            >
              {previewMode ? (
                <>
                  <Pencil className="mr-1 h-3 w-3" /> 編集
                </>
              ) : (
                <>
                  <Eye className="mr-1 h-3 w-3" /> プレビュー
                </>
              )}
            </Button>
            <Button size="sm" onClick={saveApp} disabled={saving}>
              <Save className="mr-1 h-3 w-3" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-1">
          {app.screens.map((screen, i) => (
            <div key={screen.id} className="flex items-center">
              {activeScreenIndex === i && !previewMode ? (
                <Input
                  value={screen.label}
                  onChange={(e) => updateScreenLabel(i, e.target.value)}
                  className="h-8 w-24 text-sm"
                />
              ) : (
                <button
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    activeScreenIndex === i
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveScreenIndex(i)}
                >
                  {screen.label}
                </button>
              )}
              {!previewMode && app.screens.length > 1 && activeScreenIndex === i && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeScreen(i)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          {!previewMode && (
            <Button variant="ghost" size="sm" onClick={addScreen}>
              <Plus className="mr-1 h-3 w-3" /> 画面追加
            </Button>
          )}
        </div>

        {previewMode ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {activeScreen?.blocks
              .sort((a, b) => a.order - b.order)
              .map((block) => (
                <div
                  key={block.id}
                  className={
                    block.width === "full" ? "col-span-full" : "col-span-1"
                  }
                >
                  <BlockRenderer block={block} appId={id} />
                </div>
              ))}
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-6 lg:flex-row">
            <div className="min-w-0 flex-1 space-y-3">
              {activeScreen?.blocks
                .sort((a, b) => a.order - b.order)
                .map((block) => (
                  <Card
                    key={block.id}
                    className={cn(
                      "transition-shadow",
                      editingBlockId === block.id && "ring-2 ring-primary"
                    )}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm">
                          {BLOCK_TYPE_OPTIONS.find((b) => b.type === block.type)?.icon}
                        </span>
                        <span className="flex-1 text-sm font-medium">
                          {block.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {WIDTH_OPTIONS.find((w) => w.value === block.width)?.label}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveBlock(block.id, -1)}>
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveBlock(block.id, 1)}>
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingBlockId(editingBlockId === block.id ? null : block.id)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeBlock(block.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {editingBlockId === block.id && (
                        <div className="mt-3 space-y-3 border-t pt-3">
                          <div className="space-y-1">
                            <Label className="text-xs">ラベル</Label>
                            <Input
                              value={block.label}
                              onChange={(e) => updateBlock(block.id, { label: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">幅</Label>
                            <div className="flex gap-1">
                              {WIDTH_OPTIONS.map((w) => (
                                <button
                                  key={w.value}
                                  className={cn(
                                    "rounded border px-3 py-1 text-xs transition-colors",
                                    block.width === w.value
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "text-muted-foreground hover:text-foreground"
                                  )}
                                  onClick={() => updateBlock(block.id, { width: w.value })}
                                >
                                  {w.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <BlockConfigEditor
                            block={block}
                            onConfigChange={(config) => updateBlockConfig(block.id, config)}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

              {(!activeScreen || activeScreen.blocks.length === 0) && (
                <div className="rounded-lg border border-dashed py-12 text-center">
                  <LayoutGrid className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    右パネルからブロックを追加してください
                  </p>
                </div>
              )}
            </div>

            <div className="w-full lg:w-56 lg:shrink-0">
              <Card className="lg:sticky lg:top-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">ブロック追加</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-1">
                  {BLOCK_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.type}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                      onClick={() => addBlock(opt.type)}
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BlockConfigEditor({
  block,
  onConfigChange,
}: {
  block: ScreenBlock;
  onConfigChange: (config: Partial<BlockConfig>) => void;
}) {
  switch (block.type) {
    case "workflow_launcher":
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">ワークフローID</Label>
            <Input value={block.config.workflowId || ""} onChange={(e) => onConfigChange({ workflowId: e.target.value })} placeholder="workflow_xxx" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">スタイル</Label>
            <div className="flex gap-1">
              {(["large", "compact", "icon"] as const).map((s) => (
                <button key={s} className={cn("rounded border px-2 py-1 text-xs", block.config.style === s ? "border-primary bg-primary/10" : "text-muted-foreground")} onClick={() => onConfigChange({ style: s })}>
                  {s === "large" ? "大" : s === "compact" ? "小" : "アイコン"}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    case "data_list":
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">データソース</Label>
            <Input value={block.config.source || ""} onChange={(e) => onConfigChange({ source: e.target.value })} placeholder="customers" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">表示件数</Label>
            <Input type="number" value={block.config.limit || 10} onChange={(e) => onConfigChange({ limit: Number(e.target.value) })} className="h-8 text-sm" />
          </div>
        </div>
      );
    case "chart":
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">グラフタイプ</Label>
            <div className="flex gap-1">
              {(["bar", "line", "pie", "area"] as const).map((t) => (
                <button key={t} className={cn("rounded border px-2 py-1 text-xs", block.config.chartType === t ? "border-primary bg-primary/10" : "text-muted-foreground")} onClick={() => onConfigChange({ chartType: t })}>
                  {t === "bar" ? "棒" : t === "line" ? "折線" : t === "pie" ? "円" : "面"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">データソース</Label>
            <Input value={block.config.dataSource || ""} onChange={(e) => onConfigChange({ dataSource: e.target.value })} placeholder="sales_data" className="h-8 text-sm" />
          </div>
        </div>
      );
    case "metric_card":
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">値</Label>
            <Input value={block.config.value || ""} onChange={(e) => onConfigChange({ value: e.target.value })} placeholder="1,234 または auto" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">単位</Label>
            <Input value={block.config.unit || ""} onChange={(e) => onConfigChange({ unit: e.target.value })} placeholder="円 / 件 / %" className="h-8 text-sm" />
          </div>
        </div>
      );
    case "embed_url":
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">URL</Label>
            <Input value={block.config.url || ""} onChange={(e) => onConfigChange({ url: e.target.value })} placeholder="https://..." className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">高さ (px)</Label>
            <Input type="number" value={block.config.height || 300} onChange={(e) => onConfigChange({ height: Number(e.target.value) })} className="h-8 text-sm" />
          </div>
        </div>
      );
    case "text":
      return (
        <div className="space-y-1">
          <Label className="text-xs">テキスト内容</Label>
          <textarea value={block.config.content || ""} onChange={(e) => onConfigChange({ content: e.target.value })} placeholder="メモやお知らせを入力..." className="h-20 w-full rounded-md border px-3 py-2 text-sm" />
        </div>
      );
    case "image":
      return (
        <div className="space-y-1">
          <Label className="text-xs">画像URL</Label>
          <Input value={block.config.imageUrl || ""} onChange={(e) => onConfigChange({ imageUrl: e.target.value })} placeholder="https://..." className="h-8 text-sm" />
        </div>
      );
    default:
      return <p className="text-xs text-muted-foreground">{block.type} の設定はAIチャットから変更できます</p>;
  }
}
