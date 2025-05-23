"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Nav } from "@/components/dashboard/nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { DashboardSummary, UserProgress } from "@/lib/types";
import toast from "react-hot-toast";
import { CheckCircle2, Clock, AlertTriangle, Users } from "lucide-react";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    loadDashboard();
  }, [user, authLoading, router]);

  const loadDashboard = async () => {
    try {
      const [sum, users] = await Promise.all([
        api.get<DashboardSummary>("/api/dashboard"),
        api.get<UserProgress[]>("/api/dashboard/by-user"),
      ]);
      setSummary(sum);
      setUserProgress(users);
    } catch {
      toast.error("ダッシュボードの読み込みに失敗しました");
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

  return (
    <div className="min-h-screen bg-muted/30">
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold">進捗ダッシュボード</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">
          チーム全体のタスク完了率・メンバー別の進捗状況
        </p>

        {summary && (
          <>
            {/* Summary cards */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">完了率</p>
                      <p className="mt-1 text-2xl font-bold">
                        {summary.completionRate}%
                      </p>
                    </div>
                    <CheckCircle2 className="h-8 w-8 text-green-500/30" />
                  </div>
                  <Progress value={summary.completionRate} className="mt-3 h-2" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">進行中</p>
                      <p className="mt-1 text-2xl font-bold">
                        {summary.inProgress}
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-500/30" />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    全{summary.total}件中
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">承認待ち</p>
                      <p className="mt-1 text-2xl font-bold">
                        {summary.pendingApprovals}
                      </p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-amber-500/30" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">完了</p>
                      <p className="mt-1 text-2xl font-bold">
                        {summary.completed}/{summary.total}
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Per-user progress */}
            {userProgress.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">メンバー別進捗</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {userProgress.map((up) => (
                      <div key={up.uid}>
                        <div className="mb-1 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{up.name}</span>
                            {up.department && (
                              <Badge variant="outline" className="text-xs">
                                {up.department}
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {up.completed}/{up.total} ({up.completionRate}%)
                          </span>
                        </div>
                        <Progress value={up.completionRate} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
