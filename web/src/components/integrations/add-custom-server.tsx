"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (data: {
    server_name: string;
    server_url: string;
    auth_type: string;
    credentials: string;
    description: string;
  }) => void;
}

export function AddCustomServerDialog({ open, onClose, onAdd }: Props) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [authType, setAuthType] = useState("none");
  const [credentials, setCredentials] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!name.trim() || !url.trim()) return;
    onAdd({
      server_name: name.trim(),
      server_url: url.trim(),
      auth_type: authType,
      credentials: credentials.trim(),
      description: description.trim(),
    });
    // Reset form
    setName("");
    setUrl("");
    setAuthType("none");
    setCredentials("");
    setDescription("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            カスタムMCPサーバー追加
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="server-name">サーバー名</Label>
            <Input
              id="server-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 社内APIサーバー"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="server-url">サーバーURL</Label>
            <Input
              id="server-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://mcp.example.com/sse"
            />
          </div>
          <div className="space-y-2">
            <Label>認証方式</Label>
            <Select value={authType} onValueChange={(v) => v && setAuthType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">なし</SelectItem>
                <SelectItem value="api_key">APIキー</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {authType !== "none" && (
            <div className="space-y-2">
              <Label htmlFor="credentials">
                {authType === "api_key" ? "APIキー" : "トークン"}
              </Label>
              <Input
                id="credentials"
                type="password"
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                placeholder="認証情報を入力"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="description">説明（任意）</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="このサーバーの用途"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || !url.trim()}>
              追加
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
