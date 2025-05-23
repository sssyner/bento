"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Nav } from "@/components/dashboard/nav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkflowTemplate } from "@/lib/types";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function WorkflowsListPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    loadWorkflows();
  }, [user, authLoading, router]);

  const loadWorkflows = async () => {
    try {
      const data = await api.get<WorkflowTemplate[]>("/api/workflows");
      setWorkflows(data);
    } catch {
      toast.error("ワークフローの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このワークフローを削除しますか？")) return;
    try {
      await api.delete(`/api/workflows/${id}`);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      toast.success("削除しました");
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const scheduleLabel = (type: string) => {
    switch (type) {
      case "daily": return "毎日";
      case "weekly": return "毎週";
      case "monthly": return "毎月";
      default: return "手動";
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">テンプレート管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              繰り返し使うワークフローの雛形を作成・編集
            </p>
          </div>
          <Button onClick={() => router.push("/admin/workflows/new")}>
            <Plus className="mr-1 h-4 w-4" />
            新規作成
          </Button>
        </div>

        {workflows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">ワークフローがまだありません。</p>
              <Button
                className="mt-4"
                onClick={() => router.push("/admin/workflows/new")}
              >
                最初のワークフローを作成
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {workflows.map((wf) => (
              <Card key={wf.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{wf.name}</p>
                      {wf.description && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {wf.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="secondary">
                          {wf.steps.length}ステップ
                        </Badge>
                        <Badge variant="outline">
                          {scheduleLabel(wf.schedule.type)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/admin/workflows/${wf.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(wf.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
