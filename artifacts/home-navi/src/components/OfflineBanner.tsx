import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { useOffline } from "@/contexts/OfflineContext";

export function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, lastSynced, manualSync } = useOffline();

  const show = !isOnline || pendingCount > 0 || isSyncing || lastSynced > 0;
  if (!show) return null;

  if (lastSynced > 0 && isOnline && pendingCount === 0 && !isSyncing) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] md:left-56 bg-green-500 text-white text-sm px-4 h-10 flex items-center justify-center gap-2 shadow-md">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>{lastSynced}件のデータを同期しました</span>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] md:left-56 bg-blue-500 text-white text-sm px-4 h-10 flex items-center justify-center gap-2 shadow-md">
        <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
        <span>オンラインに復帰しました。データを同期しています...</span>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] md:left-56 bg-orange-500 text-white text-sm px-4 h-10 flex items-center justify-between gap-3 shadow-md">
      <div className="flex items-center gap-2 min-w-0">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span className="truncate">
          {pendingCount > 0
            ? `オフライン — ${pendingCount}件が送信待ちです`
            : "オフライン — 記録は後で自動送信されます"}
        </span>
      </div>
      {isOnline && pendingCount > 0 && (
        <button
          onClick={manualSync}
          className="shrink-0 text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors"
        >
          今すぐ送信
        </button>
      )}
    </div>
  );
}

export function OfflineBannerSpacer() {
  const { isOnline, pendingCount, isSyncing, lastSynced } = useOffline();
  const show = !isOnline || pendingCount > 0 || isSyncing || lastSynced > 0;
  if (!show) return null;
  return <div className="h-10" />;
}
