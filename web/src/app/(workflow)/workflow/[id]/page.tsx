"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Nav } from "@/components/dashboard/nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { WorkflowExecution, WorkflowStep } from "@/lib/types";
import toast from "react-hot-toast";
import { CheckCircle2, Circle, XCircle, ExternalLink, ArrowLeft, Link2 } from "lucide-react";

export default function WorkflowExecutionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    loadExecution();
  }, [user, authLoading, id, router]);

  const loadExecution = async () => {
    try {
      const exec = await api.get<WorkflowExecution>(`/api/executions/${id}`);
      setExecution(exec);
    } catch {
      toast.error("ワークフローの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (stepId: string) => {
    setActionLoading(true);
    try {
      const updated = await api.post<WorkflowExecution>(
        `/api/executions/${id}/steps/${stepId}/complete`
      );
      setExecution(updated);
      toast.success("ステップを完了しました");
    } catch {
      toast.error("操作に失敗しました");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (stepId: string) => {
    setActionLoading(true);
    try {
      const updated = await api.post<WorkflowExecution>(
        `/api/executions/${id}/steps/${stepId}/approve`
      );
      setExecution(updated);
      toast.success("承認しました");
    } catch {
      toast.error("操作に失敗しました");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (stepId: string) => {
    setActionLoading(true);
    try {
      const updated = await api.post<WorkflowExecution>(
        `/api/executions/${id}/steps/${stepId}/reject`,
        { reason: rejectReason }
      );
      setExecution(updated);
      setShowRejectInput(false);
      setRejectReason("");
      toast.success("差し戻しました");
    } catch {
      toast.error("操作に失敗しました");
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (!execution || !execution.template) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">ワークフローが見つかりません</p>
      </div>
    );
  }

  const template = execution.template;
  const steps = [...template.steps].sort((a, b) => a.order - b.order);
  const completedCount = Object.values(execution.steps).filter(
    (s) => s.status === "completed"
  ).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  const getStepIcon = (step: WorkflowStep) => {
    const result = execution.steps[step.id];
    if (!result) return <Circle className="h-5 w-5 text-muted-foreground" />;
    switch (result.status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "in_progress":
        return <Circle className="h-5 w-5 text-blue-500 fill-blue-500" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const STEP_TYPE_LABELS: Record<string, string> = {
    confirm_url: "URL確認",
    approval: "承認",
    auto_aggregate: "自動集計",
    confirm_value: "値確認",
    input: "入力",
    ai_check: "AI分析",
    ai_generate: "AI生成",
    webhook: "外部連携",
    conditional: "条件分岐",
    notification: "通知",
    wait: "待機",
    mcp_tool: "外部ツール",
    trigger_workflow: "別のワークフローへ",
  };

  const getStepTypeBadge = (type: string) => (
    <Badge variant="secondary">{STEP_TYPE_LABELS[type] || type}</Badge>
  );

  const currentStep = steps.find((s) => s.id === execution.currentStepId);

  return (
    <div className="min-h-screen bg-muted/30">
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          ホームに戻る
        </Button>

        {/* Source chain banner */}
        {execution.sourceWorkflowName && (
          <Card className="mb-4 border-blue-200 bg-blue-50">
            <CardContent className="flex items-center gap-3 p-3">
              <Link2 className="h-5 w-5 shrink-0 text-blue-600" />
              <div className="text-sm">
                <span className="font-medium text-blue-900">
                  {execution.sourceAssigneeName || "メンバー"}
                </span>
                <span className="text-blue-700">
                  {" "}が「{execution.sourceWorkflowName}」から送信
                </span>
              </div>
              {execution.sourceData && Object.keys(execution.sourceData).length > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  データあり
                </Badge>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-bold">{template.name}</h1>
          {template.description && (
            <p className="mt-1 text-muted-foreground">{template.description}</p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Step {completedCount}/{steps.length}
            </span>
            <Progress value={progress} className="h-2 flex-1" />
            <span className="text-sm font-medium">{progress}%</span>
          </div>
        </div>

        {execution.status === "completed" && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-500" />
              <p className="font-medium text-green-700">全ステップ完了</p>
            </CardContent>
          </Card>
        )}

        {/* Stepper */}
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const stepResult = execution.steps[step.id];
            const isCurrent = step.id === execution.currentStepId;
            const isCompleted = stepResult?.status === "completed";
            const isRejected = stepResult?.status === "rejected";

            return (
              <Card
                key={step.id}
                className={
                  isCurrent && execution.status !== "completed"
                    ? "border-blue-300 shadow-md"
                    : ""
                }
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getStepIcon(step)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Step {idx + 1}
                        </span>
                        {getStepTypeBadge(step.type)}
                      </div>
                      <p className="mt-1 font-medium">{step.label}</p>

                      {/* Step description */}
                      {step.config.description && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {step.config.description}
                        </p>
                      )}

                      {/* Rejected reason */}
                      {isRejected && stepResult?.rejectedReason && (
                        <p className="mt-2 text-sm text-red-600">
                          差し戻し理由: {stepResult.rejectedReason}
                        </p>
                      )}

                      {/* Completed info */}
                      {isCompleted && stepResult?.completedAt && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          完了: {new Date(stepResult.completedAt).toLocaleString("ja-JP")}
                        </p>
                      )}

                      {/* Current step actions */}
                      {isCurrent && execution.status !== "completed" && (
                        <div className="mt-4">
                          <Separator className="mb-4" />

                          {/* confirm_url step */}
                          {step.type === "confirm_url" && (
                            <div>
                              {step.config.url && (
                                <a
                                  href={step.config.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mb-4 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  リンクを開く
                                </a>
                              )}
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleComplete(step.id)}
                                  disabled={actionLoading}
                                >
                                  OK - 確認完了
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => setShowRejectInput(!showRejectInput)}
                                  disabled={actionLoading}
                                >
                                  差し戻し
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* approval step */}
                          {step.type === "approval" && (
                            <div>
                              <p className="mb-3 text-sm text-muted-foreground">
                                承認者として確認してください。
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleApprove(step.id)}
                                  disabled={actionLoading}
                                >
                                  承認する
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => setShowRejectInput(!showRejectInput)}
                                  disabled={actionLoading}
                                >
                                  却下
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* input step */}
                          {step.type === "input" && (
                            <div className="space-y-3">
                              {(step.config.fields || []).map((field) => (
                                <div key={field.key} className="space-y-1">
                                  <label className="text-sm font-medium">
                                    {field.label}
                                    {field.required && <span className="text-destructive"> *</span>}
                                  </label>
                                  {field.type === "textarea" ? (
                                    <Textarea placeholder={field.placeholder || ""} />
                                  ) : field.type === "select" ? (
                                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm">
                                      <option value="">選択してください</option>
                                      {(field.options || []).map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type={field.type || "text"}
                                      placeholder={field.placeholder || ""}
                                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                                    />
                                  )}
                                </div>
                              ))}
                              <Button onClick={() => handleComplete(step.id)} disabled={actionLoading}>
                                送信
                              </Button>
                            </div>
                          )}

                          {/* trigger_workflow step */}
                          {step.type === "trigger_workflow" && (
                            <div>
                              <p className="mb-3 text-sm text-muted-foreground">
                                {step.config.description || "別のワークフローにデータを送信します。"}
                              </p>
                              <Button onClick={() => handleComplete(step.id)} disabled={actionLoading}>
                                <Link2 className="mr-1 h-4 w-4" />
                                送信する
                              </Button>
                            </div>
                          )}

                          {/* auto_aggregate / confirm_value / ai_check / ai_generate / notification / wait / webhook */}
                          {["auto_aggregate", "confirm_value", "ai_check", "ai_generate", "notification", "wait", "webhook"].includes(step.type) && (
                            <div>
                              <p className="mb-3 text-sm text-muted-foreground">
                                {step.config.description || "このステップを確認して完了してください。"}
                              </p>
                              <Button onClick={() => handleComplete(step.id)} disabled={actionLoading}>
                                完了
                              </Button>
                            </div>
                          )}

                          {/* Reject reason input */}
                          {showRejectInput && (
                            <div className="mt-3 space-y-2">
                              <Textarea
                                placeholder="差し戻し/却下の理由（任意）"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleReject(step.id)}
                                  disabled={actionLoading}
                                >
                                  確定
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setShowRejectInput(false);
                                    setRejectReason("");
                                  }}
                                >
                                  キャンセル
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
