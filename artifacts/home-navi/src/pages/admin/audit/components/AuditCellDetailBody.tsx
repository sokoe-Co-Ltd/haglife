import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { AuditCellView, AuditCellHistoryEntry } from "@workspace/api-client-react";
import {
  useGetAuditCellHistory,
  useUnskipAuditCell,
  useUpdateAuditCellSkipReason,
  useUpdateAuditCellNote,
  useClearAuditCellNote,
  getGetAuditCellQueryKey,
  getGetAuditCellHistoryQueryKey,
  getGetAuditRouteSheetQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isReasonEmpty } from "../utils/skipReason";

export function ComparisonTable({ cell }: { cell: AuditCellView }) {
  const rows = [
    {
      label: "担当",
      planned: cell.plannedStaffName,
      actual: cell.actualStaffName,
      changed: cell.staffReassigned,
    },
    {
      label: "開始時刻",
      planned: cell.plannedStartTime,
      actual: cell.startTime,
      changed: cell.plannedStartTime !== cell.startTime,
    },
    {
      label: "終了時刻",
      planned: cell.plannedEndTime,
      actual: cell.endTime,
      changed: cell.plannedEndTime !== cell.endTime,
    },
    {
      label: "サービス",
      planned: cell.plannedServiceLabel,
      actual: cell.serviceLabel,
      changed: cell.plannedServiceTypeId !== cell.serviceTypeId,
    },
  ];

  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-muted-foreground">
        <tr>
          <th className="text-left py-2 w-20">項目</th>
          <th className="text-left py-2">計画</th>
          <th className="text-left py-2">実態</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className={cn("border-t", row.changed && "bg-amber-50/40")}>
            <td className="py-2 text-muted-foreground">{row.label}</td>
            <td className="py-2">{row.planned ?? "—"}</td>
            <td className={cn("py-2", row.changed && "font-medium")}>
              {row.actual ?? "—"}
              {row.changed && <span className="ml-2 text-xs text-amber-700">変更</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const SKIP_PRESETS = ["利用者拒否", "入院", "欠席", "家族都合"];

function SkippedSection({
  cell,
  date,
  onMutated,
}: {
  cell: AuditCellView;
  date: string;
  onMutated?: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingReason, setEditingReason] = useState(false);
  const [reasonText, setReasonText] = useState(cell.skipReason ?? "");
  const noReason = isReasonEmpty(cell.skipReason);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetAuditCellQueryKey(cell.id) });
    qc.invalidateQueries({ queryKey: getGetAuditCellHistoryQueryKey(cell.id) });
    qc.invalidateQueries({ queryKey: getGetAuditRouteSheetQueryKey(date) });
    onMutated?.();
  };

  const unskip = useUnskipAuditCell({
    mutation: {
      onSuccess: () => {
        toast({ title: "未実施を解除しました" });
        invalidate();
      },
      onError: () => toast({ title: "解除に失敗しました", variant: "destructive" }),
    },
  });
  const updateReason = useUpdateAuditCellSkipReason({
    mutation: {
      onSuccess: () => {
        toast({ title: "理由を保存しました" });
        setEditingReason(false);
        invalidate();
      },
      onError: () => toast({ title: "保存に失敗しました", variant: "destructive" }),
    },
  });

  return (
    <div
      className={cn(
        "p-3 rounded-md border",
        noReason ? "bg-orange-50 border-orange-300" : "bg-red-50 border-red-300",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-red-900">未実施</span>
        <button
          onClick={() => unskip.mutate({ cellId: cell.id, data: { restoreStatus: "done" } })}
          disabled={unskip.isPending}
          className="text-xs text-blue-700 hover:underline disabled:opacity-50"
        >
          未実施を解除
        </button>
      </div>
      {!editingReason ? (
        <div className="flex items-center justify-between">
          <span className={cn("text-sm", noReason && "text-orange-700")}>
            理由：{cell.skipReason?.trim() || "未記入"}
          </span>
          <button
            onClick={() => {
              setReasonText(cell.skipReason ?? "");
              setEditingReason(true);
            }}
            className="text-xs text-blue-700"
          >
            理由を{noReason ? "追加" : "編集"}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <select
            value={SKIP_PRESETS.includes(reasonText) ? reasonText : ""}
            onChange={(e) => setReasonText(e.target.value)}
            className="w-full text-sm border rounded p-1 bg-background"
          >
            <option value="">選択してください</option>
            {SKIP_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="自由記述（プリセットを選んでも上書き可）"
            className="w-full text-sm border rounded p-2 bg-background"
            rows={2}
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditingReason(false)} className="text-xs px-2 py-1">
              キャンセル
            </button>
            <button
              onClick={() => {
                const trimmed = reasonText.trim();
                if (trimmed) {
                  updateReason.mutate({
                    cellId: cell.id,
                    data: { skipReason: trimmed },
                  });
                }
              }}
              disabled={!reasonText.trim() || updateReason.isPending}
              className="text-xs bg-foreground text-background px-2 py-1 rounded disabled:opacity-50"
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NoteSection({
  cell,
  date,
  onMutated,
}: {
  cell: AuditCellView;
  date: string;
  onMutated?: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(cell.modifiedNote ?? "");
  const note = cell.modifiedNote;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetAuditCellQueryKey(cell.id) });
    qc.invalidateQueries({ queryKey: getGetAuditCellHistoryQueryKey(cell.id) });
    qc.invalidateQueries({ queryKey: getGetAuditRouteSheetQueryKey(date) });
    onMutated?.();
  };

  const updateNote = useUpdateAuditCellNote({
    mutation: {
      onSuccess: () => {
        toast({ title: "メモを保存しました" });
        setEditing(false);
        invalidate();
      },
      onError: () => toast({ title: "保存に失敗しました", variant: "destructive" }),
    },
  });
  const deleteNote = useClearAuditCellNote({
    mutation: {
      onSuccess: () => {
        toast({ title: "メモを消去しました" });
        invalidate();
      },
      onError: () => toast({ title: "削除に失敗しました", variant: "destructive" }),
    },
  });

  if (!note && !editing) {
    return (
      <button
        onClick={() => {
          setText("");
          setEditing(true);
        }}
        className="text-xs text-muted-foreground hover:underline"
      >
        + 変更メモを追加
      </button>
    );
  }

  return (
    <div className="p-3 rounded-md border bg-amber-50/40 border-amber-300">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">変更メモ</span>
        {!editing && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setText(note ?? "");
                setEditing(true);
              }}
              className="text-xs"
            >
              編集
            </button>
            <button
              onClick={() => deleteNote.mutate({ cellId: cell.id })}
              disabled={deleteNote.isPending}
              className="text-xs text-red-700 disabled:opacity-50"
            >
              消去
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full text-sm border rounded p-2 bg-background"
            rows={3}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setText(note ?? "");
                setEditing(false);
              }}
              className="text-xs px-2 py-1"
            >
              キャンセル
            </button>
            <button
              onClick={() => {
                const trimmed = text.trim();
                if (trimmed) updateNote.mutate({ cellId: cell.id, data: { note: trimmed } });
              }}
              disabled={!text.trim() || updateNote.isPending}
              className="text-xs bg-foreground text-background px-2 py-1 rounded disabled:opacity-50"
            >
              保存
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap">{note}</p>
      )}
    </div>
  );
}

function actionLabel(action: string): string {
  return (
    (
      {
        create: "作成",
        update: "更新",
        delete: "削除",
        skip: "未実施登録",
        unskip: "未実施解除",
        add_adhoc: "追加サービス",
        reassign: "担当変更",
        update_note: "メモ更新",
        update_skip_reason: "理由更新",
        clear_note: "メモ消去",
        accept_notification: "通知採用",
      } as Record<string, string>
    )[action] ?? action
  );
}

function HistorySection({ history }: { history: AuditCellHistoryEntry[] | undefined }) {
  if (!history || history.length === 0) return null;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        変更履歴（{history.length}件）
      </summary>
      <ul className="mt-2 space-y-1.5 border-l-2 border-muted pl-3">
        {history.map((log) => (
          <li key={log.id} className="text-xs">
            <span className="text-muted-foreground">
              {format(new Date(log.occurredAt), "M/d HH:mm")}
            </span>
            <span className="ml-2 font-medium">{actionLabel(log.action)}</span>
            {log.actorStaffName && (
              <span className="ml-2 text-muted-foreground">by {log.actorStaffName}</span>
            )}
            {log.reason && (
              <p className="mt-0.5 text-muted-foreground ml-0">{log.reason}</p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function AuditCellDetailBody({
  cell,
  date,
}: {
  cell: AuditCellView;
  date: string;
}) {
  const { data: historyResp } = useGetAuditCellHistory(cell.id);
  return (
    <div className="space-y-4">
      <ComparisonTable cell={cell} />
      {cell.status === "skipped" && <SkippedSection cell={cell} date={date} />}
      <NoteSection cell={cell} date={date} />
      <HistorySection history={historyResp?.history} />
    </div>
  );
}
