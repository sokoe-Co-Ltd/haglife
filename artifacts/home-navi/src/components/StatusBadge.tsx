import React from "react";

export function StatusBadge({ status, isImportant }: { status?: string; isImportant?: boolean }) {
  if (isImportant) return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-600">重要</span>;
  if (status === "対応中") return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-600">対応中</span>;
  if (status === "完了") return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-secondary text-muted-foreground">完了</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border border-primary text-primary">未対応</span>;
}
