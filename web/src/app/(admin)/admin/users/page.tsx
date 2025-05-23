"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Nav } from "@/components/dashboard/nav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { User, UserRole } from "@/lib/types";
import toast from "react-hot-toast";
import { Plus, UserPlus } from "lucide-react";

export default function UsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviting, setInviting] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("member");
  const [inviteDepartment, setInviteDepartment] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    loadUsers();
  }, [user, authLoading, router]);

  const loadUsers = async () => {
    try {
      const data = await api.get<User[]>("/api/admin/users");
      setUsers(data);
    } catch {
      toast.error("ユーザー一覧の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !inviteName) {
      toast.error("メールアドレスと名前は必須です");
      return;
    }
    setInviting(true);
    try {
      const newUser = await api.post<User>("/api/admin/users/invite", {
        email: inviteEmail,
        name: inviteName,
        role: inviteRole,
        department: inviteDepartment,
      });
      setUsers((prev) => [...prev, newUser]);
      setDialogOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("member");
      setInviteDepartment("");
      toast.success("ユーザーを招待しました");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "招待に失敗しました");
    } finally {
      setInviting(false);
    }
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case "admin": return "管理者";
      case "manager": return "マネージャー";
      default: return "メンバー";
    }
  };

  const roleVariant = (role: string): "default" | "secondary" | "outline" => {
    switch (role) {
      case "admin": return "default";
      case "manager": return "secondary";
      default: return "outline";
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
          <h1 className="text-2xl font-bold">ユーザー管理</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button />}>
              <UserPlus className="mr-1 h-4 w-4" />
              招待
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ユーザーを招待</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-name">名前</Label>
                  <Input
                    id="invite-name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="田中太郎"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-email">メールアドレス</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="tanaka@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ロール</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v as UserRole)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">メンバー</SelectItem>
                      <SelectItem value="manager">マネージャー</SelectItem>
                      <SelectItem value="admin">管理者</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-dept">部門</Label>
                  <Input
                    id="invite-dept"
                    value={inviteDepartment}
                    onChange={(e) => setInviteDepartment(e.target.value)}
                    placeholder="経理部"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleInvite}
                  disabled={inviting}
                >
                  {inviting ? "招待中..." : "招待する"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3">
          {users.map((u) => (
            <Card key={u.uid}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                  {u.department && (
                    <p className="text-sm text-muted-foreground">{u.department}</p>
                  )}
                </div>
                <Badge variant={roleVariant(u.role)}>{roleLabel(u.role)}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
