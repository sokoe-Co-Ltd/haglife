import { useState } from "react";
import { Bell } from "lucide-react";
import {
  useGetAuditNotifications,
  type AuditNotification,
} from "@workspace/api-client-react";
import { AcceptDialog } from "./AcceptDialog";

export function NotificationPanel({ date }: { date: string }) {
  const { data } = useGetAuditNotifications(date);
  const [acceptTarget, setAcceptTarget] = useState<AuditNotification | null>(null);
  const notifications = data?.notifications ?? [];

  if (notifications.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
        <Bell className="size-4 text-purple-600" />
        追加サービス通知
        <span className="text-xs text-muted-foreground font-normal ml-1">
          採用するとその日の実績またはテンプレに反映されます
        </span>
      </h3>

      <div className="border rounded-lg overflow-hidden">
        <div
          className="grid bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
          style={{ gridTemplateColumns: "80px 1fr 1fr 1fr 100px" }}
        >
          <span>時刻</span>
          <span>利用者</span>
          <span>サービス</span>
          <span>担当</span>
          <span className="text-right">採否</span>
        </div>
        {notifications.map((n) => (
          <div
            key={n.cellId}
            className="grid px-3 py-2.5 text-sm items-center border-t"
            style={{ gridTemplateColumns: "80px 1fr 1fr 1fr 100px" }}
          >
            <span>{n.startTime}</span>
            <span>{n.residentName ?? "—"}</span>
            <span>{n.serviceLabel ?? "—"}</span>
            <span>{n.actualStaffName ?? "—"}</span>
            <div className="flex gap-1.5 justify-end">
              <button
                onClick={() => setAcceptTarget(n)}
                className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                採用
              </button>
            </div>
          </div>
        ))}
      </div>

      <AcceptDialog
        notification={acceptTarget}
        date={date}
        onClose={() => setAcceptTarget(null)}
      />
    </div>
  );
}
