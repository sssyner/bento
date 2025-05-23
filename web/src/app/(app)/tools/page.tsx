"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Nav } from "@/components/dashboard/nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WorkflowTemplate, WorkflowExecution } from "@/lib/types";
import toast from "react-hot-toast";
import {
  Play,
  Pencil,
  Trash2,
  Workflow,
  Clock,
  Users,
  Lock,
  Building2,
} from "lucide-react";

type FilterTab = "all" | "mine" | "shared";

const VISIBILITY_LABELS = {
  private: "自分のみ",
  department: "部門内",
  company: "全社",
} as const;

export default function ToolsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    loadData();
  }, [user, authLoading, router]);

  const loadData = async () => {
    try {
      const [wfs, todayExecs] = await Promise.all([
        api.get<WorkflowTemplate[]>("/api/workflows"),
        api.get<WorkflowExecution[]>("/api/executions/today"),
      ]);

      wfs.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      setWorkflows(wfs);
      setExecutions(todayExecs);
    } catch {
      toast.error("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const startWorkflow = async (templateId: string) => {
    try {
      const exec = await api.post<WorkflowExecution>(
        `/api/executions/start/${templateId}`
      );
      router.push(`/workflow/${exec.id}`);
    } catch {
      toast.error("開始に失敗しました");
    }
  };

  const deleteWorkflow = async (wf: WorkflowTemplate) => {
    if (!confirm("このワークフローを削除しますか？")) return;
    try {
      await api.delete(`/api/workflows/${wf.id}`);
      setWorkflows((prev) => prev.filter((w) => w.id !== wf.id));
      toast.success("削除しました");
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const filteredWorkflows = workflows.filter((wf) => {
    if (filter === "all") return true;
    if (filter === "mine") return wf.visibility === "private";
    if (filter === "shared") return wf.visibility !== "private";
    return true;
  });

  // Active executions (in progress)
  const activeExecs = executions.filter((e) => e.status === "in_progress");

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
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold">マイワークフロー</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AIが作成したワークフローを管理・実行
          </p>
        </div>

        {/* Active executions banner */}
        {activeExecs.length > 0 && (
          <div className="mb-6 space-y-2">
            <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              実行中のタスク
            </h2>
            {activeExecs.map((exec) => {
              const steps = Object.values(exec.steps);
              const completed = steps.filter(
                (s) => s.status === "completed"
              ).length;
              const pct = Math.round((completed / steps.length) * 100);
              return (
                <Card
                  key={exec.id}
                  className="cursor-pointer border-primary/20 bg-primary/5 transition-shadow hover:shadow-md"
                  onClick={() => router.push(`/workflow/${exec.id}`)}
                >
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <Play className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {exec.template?.name || "ワークフロー"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {completed}/{steps.length} ステップ完了 ({pct}%)
                        </p>
                      </div>
                    </div>
                    <Badge variant="default" className="text-xs">
                      続ける
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Filter tabs */}
        <div className="mb-4 flex gap-1 rounded-lg border bg-card p-1">
          {(
            [
              { key: "all", label: "すべて" },
              { key: "mine", label: "自分の" },
              { key: "shared", label: "共有" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
                filter === key
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Workflow list */}
        {filteredWorkflows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-16 text-center">
            <p className="text-muted-foreground">
              {filter === "all"
                ? "まだワークフローがありません"
                : filter === "shared"
                  ? "共有されたワークフローはありません"
                  : "自分のワークフローはまだありません"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              ホームのAIチャットで業務を説明して作成できます
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => router.push("/")}
            >
              AIで作成する
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredWorkflows.map((wf) => (
              <Card
                key={wf.id}
                className="transition-shadow hover:shadow-md"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Workflow className="h-5 w-5" />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{wf.name}</p>
                        {wf.visibility && wf.visibility !== "private" && (
                          <Badge
                            variant="secondary"
                            className="shrink-0 text-[10px]"
                          >
                            {wf.visibility === "department" ? (
                              <Building2 className="mr-0.5 h-2.5 w-2.5" />
                            ) : (
                              <Users className="mr-0.5 h-2.5 w-2.5" />
                            )}
                            {VISIBILITY_LABELS[wf.visibility]}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {wf.steps.length}ステップ
                        {wf.schedule.type !== "manual" &&
                          ` / ${
                            wf.schedule.type === "daily"
                              ? "毎日"
                              : wf.schedule.type === "weekly"
                                ? "毎週"
                                : "毎月"
                          }`}
                        {" / "}
                        {new Date(wf.updatedAt).toLocaleDateString("ja-JP")}{" "}
                        更新
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startWorkflow(wf.id)}
                      >
                        <Play className="mr-1 h-3 w-3" />
                        実行
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => router.push(`/admin/workflows/${wf.id}`)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => deleteWorkflow(wf)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
