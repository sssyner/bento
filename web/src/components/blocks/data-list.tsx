"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ScreenBlock, DataRecord } from "@/lib/types";
import { Plus, ChevronRight } from "lucide-react";

interface Props {
  block: ScreenBlock;
  appId: string;
  onDataRefresh?: () => void;
}

export function DataListBlock({ block, appId }: Props) {
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const source = block.config.source || "data";
  const columns = block.config.columns || [];

  useEffect(() => {
    loadData();
  }, [appId, source]);

  const loadData = async () => {
    try {
      const data = await api.get<DataRecord[]>(`/api/apps/${appId}/data/${source}`);
      setRecords(data);
    } catch {
      // No data yet
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{block.label}</CardTitle>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Plus className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">読み込み中...</p>
        ) : records.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            データがありません
          </p>
        ) : (
          <div className="divide-y">
            {records.slice(0, block.config.limit || 10).map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <div className="flex-1">
                  {columns.length > 0 ? (
                    <div className="flex gap-4">
                      {columns.map((col) => (
                        <span key={col.key} className={col.key === columns[0].key ? "font-medium" : "text-muted-foreground"}>
                          {String(record[col.key] ?? "")}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="font-medium">
                      {String(record.name ?? record.title ?? record.id)}
                    </span>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
