"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Nav } from "@/components/dashboard/nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { WorkflowTemplate, WorkflowStep, StepType, ScheduleType } from "@/lib/types";
import toast from "react-hot-toast";
import { Plus, GripVertical, Trash2, ArrowLeft } from "lucide-react";

interface Props {
  workflowId?: string;
}

const STEP_TYPES: { value: StepType; label: string }[] = [
  { value: "confirm_url", label: "URL確認" },
  { value: "approval", label: "承認" },
  { value: "input", label: "入力フォーム" },
  { value: "auto_aggregate", label: "自動集計" },
  { value: "confirm_value", label: "値確認" },
  { value: "ai_check", label: "AI分析" },
  { value: "ai_generate", label: "AI生成" },
  { value: "webhook", label: "外部連携" },
  { value: "notification", label: "通知" },
  { value: "conditional", label: "条件分岐" },
  { value: "wait", label: "待機" },
  { value: "mcp_tool", label: "外部ツール(MCP)" },
];

const SCHEDULE_TYPES: { value: ScheduleType; label: string }[] = [
  { value: "manual", label: "手動" },
  { value: "daily", label: "毎日" },
  { value: "weekly", label: "毎週" },
  { value: "monthly", label: "毎月" },
];

export function WorkflowEditor({ workflowId }: Props) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(!!workflowId);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("manual");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [steps, setSteps] = useState<WorkflowStep[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (workflowId) loadWorkflow();
  }, [user, authLoading, workflowId, router]);

  const loadWorkflow = async () => {
    try {
      const wf = await api.get<WorkflowTemplate>(`/api/workflows/${workflowId}`);
      setName(wf.name);
      setDescription(wf.description);
      setScheduleType(wf.schedule.type);
      setScheduleTime(wf.schedule.time);
      setSteps(wf.steps);
    } catch {
      toast.error("ワークフローの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const addStep = (type: StepType) => {
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}`,
      order: steps.length + 1,
      type,
      label: type === "confirm_url" ? "URL確認" : "承認",
      config: type === "confirm_url"
        ? { url: "", description: "" }
        : { approverIds: [], autoNotify: true },
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (index: number, updates: Partial<WorkflowStep>) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
    );
  };

  const updateStepConfig = (index: number, configUpdates: Record<string, unknown>) => {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, config: { ...s.config, ...configUpdates } } : s
      )
    );
  };

  const removeStep = (index: number) => {
    setSteps((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const moveStep = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= steps.length) return;
    const updated = [...steps];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setSteps(updated.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("ワークフロー名を入力してください");
      return;
    }
    if (steps.length === 0) {
      toast.error("少なくとも1つのステップを追加してください");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        description,
        schedule: { type: scheduleType, time: scheduleTime },
        steps,
        assigneeIds: [],
        approverIds: [],
      };

      if (workflowId) {
        await api.put(`/api/workflows/${workflowId}`, payload);
        toast.success("ワークフローを更新しました");
      } else {
        await api.post("/api/workflows", payload);
        toast.success("ワークフローを作成しました");
      }
      router.push("/admin/workflows");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

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
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => router.push("/admin/workflows")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          一覧に戻る
        </Button>

        <h1 className="mb-6 text-2xl font-bold">
          {workflowId ? "ワークフロー編集" : "新規ワークフロー作成"}
        </h1>

        {/* Basic Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">基本情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">ワークフロー名</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 経理・月次締め"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">説明</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="このワークフローの説明"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>スケジュール</Label>
                <Select
                  value={scheduleType}
                  onValueChange={(v) => setScheduleType(v as ScheduleType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">開始時刻</Label>
                <Input
                  id="time"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">ステップ</CardTitle>
          </CardHeader>
          <CardContent>
            {steps.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                ステップを追加してください
              </p>
            ) : (
              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div
                    key={step.id}
                    className="rounded-lg border bg-card p-4"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                          onClick={() => moveStep(idx, idx - 1)}
                          disabled={idx === 0}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                          onClick={() => moveStep(idx, idx + 1)}
                          disabled={idx === steps.length - 1}
                        >
                          ▼
                        </button>
                      </div>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Step {idx + 1}
                      </span>
                      <Select
                        value={step.type}
                        onValueChange={(v) =>
                          updateStep(idx, { type: v as StepType })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STEP_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStep(idx)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>ラベル</Label>
                        <Input
                          value={step.label}
                          onChange={(e) =>
                            updateStep(idx, { label: e.target.value })
                          }
                          placeholder="ステップ名"
                        />
                      </div>

                      {step.type === "confirm_url" && (
                        <>
                          <div className="space-y-2">
                            <Label>URL</Label>
                            <Input
                              value={step.config.url || ""}
                              onChange={(e) =>
                                updateStepConfig(idx, { url: e.target.value })
                              }
                              placeholder="https://..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>説明</Label>
                            <Input
                              value={step.config.description || ""}
                              onChange={(e) =>
                                updateStepConfig(idx, {
                                  description: e.target.value,
                                })
                              }
                              placeholder="確認内容の説明"
                            />
                          </div>
                        </>
                      )}

                      {step.type === "approval" && (
                        <div className="space-y-2">
                          <Label>説明</Label>
                          <Input
                            value={step.config.description || ""}
                            onChange={(e) =>
                              updateStepConfig(idx, {
                                description: e.target.value,
                              })
                            }
                            placeholder="承認時の確認事項"
                          />
                        </div>
                      )}

                      {step.type === "input" && (
                        <div className="space-y-2">
                          <Label>説明</Label>
                          <Input
                            value={step.config.description || ""}
                            onChange={(e) => updateStepConfig(idx, { description: e.target.value })}
                            placeholder="入力フォームの説明"
                          />
                          <p className="text-xs text-muted-foreground">
                            フィールドは対話AIで自動設定されます。手動で追加する場合はJSON形式でconfig.fieldsに設定してください。
                          </p>
                        </div>
                      )}

                      {step.type === "auto_aggregate" && (
                        <>
                          <div className="space-y-2">
                            <Label>スプレッドシートID</Label>
                            <Input
                              value={step.config.spreadsheetId || ""}
                              onChange={(e) => updateStepConfig(idx, { spreadsheetId: e.target.value })}
                              placeholder="スプレッドシートのID"
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>シート名</Label>
                              <Input
                                value={step.config.sheetName || ""}
                                onChange={(e) => updateStepConfig(idx, { sheetName: e.target.value })}
                                placeholder="Sheet1"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>対象列</Label>
                              <Input
                                value={step.config.targetColumn || ""}
                                onChange={(e) => updateStepConfig(idx, { targetColumn: e.target.value })}
                                placeholder="D"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {step.type === "webhook" && (
                        <>
                          <div className="space-y-2">
                            <Label>Webhook URL</Label>
                            <Input
                              value={step.config.url || ""}
                              onChange={(e) => updateStepConfig(idx, { url: e.target.value })}
                              placeholder="https://hooks.slack.com/..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>説明</Label>
                            <Input
                              value={step.config.description || ""}
                              onChange={(e) => updateStepConfig(idx, { description: e.target.value })}
                              placeholder="何を送信するか"
                            />
                          </div>
                        </>
                      )}

                      {step.type === "ai_generate" && (
                        <>
                          <div className="space-y-2">
                            <Label>生成タイプ</Label>
                            <select
                              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                              value={step.config.generationType || "text"}
                              onChange={(e) => updateStepConfig(idx, { generationType: e.target.value })}
                            >
                              <option value="text">テキスト</option>
                              <option value="image">画像</option>
                              <option value="summary">要約</option>
                              <option value="report">レポート</option>
                              <option value="email_draft">メール下書き</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>プロンプト</Label>
                            <Textarea
                              value={step.config.prompt || ""}
                              onChange={(e) => updateStepConfig(idx, { prompt: e.target.value })}
                              placeholder="AIへの指示"
                              rows={2}
                            />
                          </div>
                        </>
                      )}

                      {step.type === "mcp_tool" && (
                        <>
                          <div className="space-y-2">
                            <Label>接続ID</Label>
                            <Input
                              value={step.config.connectionId || ""}
                              onChange={(e) => updateStepConfig(idx, { connectionId: e.target.value })}
                              placeholder="mcp_..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>ツール名</Label>
                            <Input
                              value={step.config.toolName || ""}
                              onChange={(e) => updateStepConfig(idx, { toolName: e.target.value })}
                              placeholder="例: read_range, send_message"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>説明</Label>
                            <Input
                              value={step.config.description || ""}
                              onChange={(e) => updateStepConfig(idx, { description: e.target.value })}
                              placeholder="このツールで何をするか"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            引数はAI対話で自動設定されます。連携ページでサービスを接続してください。
                          </p>
                        </>
                      )}

                      {["ai_check", "confirm_value", "notification", "conditional", "wait"].includes(step.type) && (
                        <div className="space-y-2">
                          <Label>説明</Label>
                          <Input
                            value={step.config.description || ""}
                            onChange={(e) => updateStepConfig(idx, { description: e.target.value })}
                            placeholder="このステップの説明"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator className="my-4" />

            <div className="flex flex-wrap gap-2">
              {STEP_TYPES.map((t) => (
                <Button
                  key={t.value}
                  variant="outline"
                  size="sm"
                  onClick={() => addStep(t.value)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {t.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/admin/workflows")}
          >
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : workflowId ? "更新" : "作成"}
          </Button>
        </div>
      </main>
    </div>
  );
}
