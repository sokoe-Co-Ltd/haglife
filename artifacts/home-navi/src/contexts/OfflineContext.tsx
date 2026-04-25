import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addQueueListener, syncOfflineQueue } from "@/lib/offlineManager";
import { queueCount } from "@/lib/offlineQueue";

type OfflineContextType = {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSynced: number;
  manualSync: () => Promise<void>;
};

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  lastSynced: 0,
  manualSync: async () => {},
});

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(queueCount());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(0);
  const queryClient = useQueryClient();

  const doSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const { synced } = await syncOfflineQueue();
    setIsSyncing(false);
    setPendingCount(queueCount());
    if (synced > 0) {
      setLastSynced(synced);
      queryClient.invalidateQueries();
      setTimeout(() => setLastSynced(0), 3500);
    }
  }, [isSyncing, queryClient]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      doSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const unsub = addQueueListener((count) => setPendingCount(count));

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsub();
    };
  }, [doSync]);

  const manualSync = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    await doSync();
  }, [isOnline, isSyncing, doSync]);

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, isSyncing, lastSynced, manualSync }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  return useContext(OfflineContext);
}
