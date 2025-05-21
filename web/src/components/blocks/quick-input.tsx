"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScreenBlock } from "@/lib/types";
import toast from "react-hot-toast";

interface Props {
  block: ScreenBlock;
  appId: string;
  onDataRefresh?: () => void;
}

export function QuickInputBlock({ block, appId, onDataRefresh }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const fields = block.config.fields || [];

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const target = block.config.submitAction || block.config.source || "data";
      await api.post(`/api/apps/${appId}/data/${target}`, { data: values });
      toast.success("送信しました");
      setValues({});
      onDataRefresh?.();
    } catch {
      toast.error("送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{block.label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label className="text-xs">{field.label}</Label>
              <Input
                type={field.type || "text"}
                placeholder={field.placeholder || ""}
                value={values[field.key] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              />
            </div>
          ))}
          <Button size="sm" onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? "送信中..." : "送信"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
