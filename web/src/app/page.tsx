"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Nav } from "@/components/dashboard/nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type {
  ChatMessage,
  ChatResponse,
  WorkflowTemplate,
  MCPToolCallResult,
  Department,
  ToolVisibility,
} from "@/lib/types";
import toast from "react-hot-toast";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Save,
  Plug,
  CheckCircle2,
  XCircle,
  Lock,
  Building2,
  Users,
  Check,
} from "lucide-react";

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

const SUGGESTIONS = [
  "毎月末に売上をスプシで確認して上司に報告してます",
  "請求書を作って上司に見せて、OKもらったら顧客に送ってます",
  "新しい人が入ったら色々な手続きがあって毎回大変",
  "経費を申請したら部長に承認もらって経理に回す流れ",
];

const VISIBILITY_OPTIONS: {
  value: ToolVisibility;
  label: string;
  description: string;
  icon: typeof Lock;
}[] = [
  {
    value: "private",
    label: "自分だけ",
    description: "自分のみ表示・実行可能",
    icon: Lock,
  },
  {
    value: "department",
    label: "部門に共有",
    description: "選んだ部門のメンバーが使える",
    icon: Building2,
  },
  {
    value: "company",
    label: "全社に共有",
    description: "会社全員が使える",
    icon: Users,
  },
];

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [generatedWorkflow, setGeneratedWorkflow] = useState<
    Partial<WorkflowTemplate> | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [lastToolResult, setLastToolResult] =
    useState<MCPToolCallResult | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Save dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveVisibility, setSaveVisibility] =
    useState<ToolVisibility>("private");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(newMessages);
    setInput("");
    setSending(true);

    try {
      const resp = await api.post<ChatResponse>("/api/ai/chat", {
        messages: newMessages,
        conversation_id: conversationId,
        mode: "workflow",
      });

      setMessages([
        ...newMessages,
        { role: "assistant", content: resp.reply },
      ]);
      setConversationId(resp.conversation_id);

      if (resp.workflow) setGeneratedWorkflow(resp.workflow);
      if (resp.tool_result) setLastToolResult(resp.tool_result);
    } catch {
      toast.error("送信に失敗しました");
      setMessages(messages);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const openSaveDialog = async () => {
    if (!generatedWorkflow) return;
    setSaveName(generatedWorkflow.name || "新規ワークフロー");
    setSaveVisibility("private");
    setSelectedDeptIds([]);
    setSaveDialogOpen(true);

    // Fetch departments for the picker
    setLoadingDepts(true);
    try {
      const depts = await api.get<Department[]>("/api/departments");
      setDepartments(depts);
    } catch {
      setDepartments([]);
    } finally {
      setLoadingDepts(false);
    }
  };

  const toggleDept = (deptId: string) => {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId)
        ? prev.filter((id) => id !== deptId)
        : [...prev, deptId]
    );
  };

  const saveWorkflow = async () => {
    if (!generatedWorkflow) return;
    setSaving(true);
    try {
      await api.post("/api/workflows", {
        name: saveName || "新規ワークフロー",
        description: generatedWorkflow.description || "",
        schedule: generatedWorkflow.schedule || {
          type: "manual",
          time: "09:00",
        },
        steps: generatedWorkflow.steps || [],
        assigneeIds: [],
        approverIds: [],
        visibility: saveVisibility,
        departmentId:
          saveVisibility === "department" ? selectedDeptIds[0] || null : null,
        sharedDepartmentIds:
          saveVisibility === "department" ? selectedDeptIds : [],
      });
      toast.success("ワークフローを保存しました");
      setSaveDialogOpen(false);
      router.push("/tools");
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <Nav />
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 md:flex-row">
        {/* Chat area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-4">
            <h1 className="text-xl font-bold">どんな作業を自動化しますか？</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              普段やっている業務の流れを教えてください。AIがワークフローを作成します。
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto rounded-lg border bg-card p-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Bot className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="text-lg font-medium">
                  業務の流れを教えてください
                </p>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  普段やっていることを自然な言葉で教えてください。
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="rounded-full border bg-background px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      onClick={() => setInput(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`mb-4 flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
                {msg.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="mb-4 flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-lg bg-muted px-4 py-2.5">
                  <div className="flex gap-1">
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce delay-100">.</span>
                    <span className="animate-bounce delay-200">.</span>
                  </div>
                </div>
              </div>
            )}

            {lastToolResult && (
              <div className="mb-4 flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <Plug className="h-4 w-4 text-blue-600" />
                </div>
                <div className="max-w-[80%] rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm">
                  <div className="mb-1 flex items-center gap-2">
                    {lastToolResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium">
                      {lastToolResult.success
                        ? "ツール実行成功"
                        : "ツール実行失敗"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {lastToolResult.execution_time_ms}ms
                    </span>
                  </div>
                  {lastToolResult.success && lastToolResult.result != null && (
                    <pre className="mt-1 max-h-32 overflow-auto rounded bg-white/50 p-2 text-xs">
                      {typeof lastToolResult.result === "string"
                        ? lastToolResult.result
                        : JSON.stringify(lastToolResult.result, null, 2)}
                    </pre>
                  )}
                  {lastToolResult.error && (
                    <p className="mt-1 text-xs text-red-600">
                      {lastToolResult.error}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="mt-3 flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="普段やっている作業の流れを教えてください..."
              className="min-h-[44px] resize-none"
              rows={1}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              size="icon"
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Right panel - Workflow preview */}
        {generatedWorkflow && (
          <div className="w-full md:w-80 md:shrink-0">
            <Card className="sticky top-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {generatedWorkflow.name || "生成されたワークフロー"}
                  </CardTitle>
                  <Badge variant="secondary">
                    <Sparkles className="mr-1 h-3 w-3" />
                    AI生成
                  </Badge>
                </div>
                {generatedWorkflow.description && (
                  <p className="text-xs text-muted-foreground">
                    {generatedWorkflow.description}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(generatedWorkflow.steps || []).map((step, i) => (
                    <div
                      key={step.id || i}
                      className="flex items-start gap-2 rounded border p-2 text-xs"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium">{step.label}</p>
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          {STEP_TYPE_LABELS[step.type] || step.type}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={openSaveDialog}
                  >
                    <Save className="mr-1 h-3 w-3" />
                    保存
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setInput(
                        "このワークフローを少し変えたいのですが..."
                      )
                    }
                  >
                    修正
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Save dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ワークフローを保存</DialogTitle>
            <DialogDescription>
              名前と公開範囲を設定してください
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="wf-name">名前</Label>
              <Input
                id="wf-name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="ワークフロー名"
              />
            </div>

            {/* Visibility */}
            <div className="space-y-1.5">
              <Label>公開範囲</Label>
              <div className="space-y-1.5">
                {VISIBILITY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = saveVisibility === opt.value;
                  return (
                    <button
                      key={opt.value}
                      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent"
                      }`}
                      onClick={() => {
                        setSaveVisibility(opt.value);
                        if (opt.value !== "department") {
                          setSelectedDeptIds([]);
                        }
                      }}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <div className="flex-1">
                        <p
                          className={`text-sm font-medium ${selected ? "text-primary" : ""}`}
                        >
                          {opt.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {opt.description}
                        </p>
                      </div>
                      {selected && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Department picker */}
            {saveVisibility === "department" && (
              <div className="space-y-1.5">
                <Label>共有する部門</Label>
                {loadingDepts ? (
                  <p className="text-xs text-muted-foreground">読み込み中...</p>
                ) : departments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    部門がまだ登録されていません。管理画面から追加してください。
                  </p>
                ) : (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
                    {departments.map((dept) => {
                      const checked = selectedDeptIds.includes(dept.id);
                      return (
                        <button
                          key={dept.id}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                            checked
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-accent"
                          }`}
                          onClick={() => toggleDept(dept.id)}
                        >
                          <div
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border"
                            }`}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </div>
                          <span>{dept.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              onClick={saveWorkflow}
              disabled={
                saving ||
                !saveName.trim() ||
                (saveVisibility === "department" &&
                  selectedDeptIds.length === 0)
              }
            >
              <Save className="mr-1 h-3 w-3" />
              {saving ? "保存中..." : "保存する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
