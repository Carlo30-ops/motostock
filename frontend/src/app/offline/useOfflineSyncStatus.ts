import { useCallback, useEffect, useState } from "react";
import {
  clearPendingMutations,
  flushPendingMutations,
  getPendingMutationsCount,
  listPendingMutations,
  removePendingMutationById,
  type FlushResult,
} from "./sync";
import type { PendingMutation } from "./db";

interface OfflineSyncStatus {
  pendingCount: number;
  pendingItems: PendingMutation[];
  isOnline: boolean;
  isSyncing: boolean;
  refresh: () => Promise<void>;
  syncNow: () => Promise<FlushResult>;
  clearQueue: () => Promise<number>;
  removePendingItem: (id: number) => Promise<boolean>;
}

export function useOfflineSyncStatus(): OfflineSyncStatus {
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingItems, setPendingItems] = useState<PendingMutation[]>([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const [count, items] = await Promise.all([getPendingMutationsCount(), listPendingMutations()]);
    setPendingCount(count);
    setPendingItems(items);
    setIsOnline(navigator.onLine);
  }, []);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await flushPendingMutations();
      setPendingCount(result.remaining);
      await refresh();
      setIsOnline(navigator.onLine);
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [refresh]);

  const clearQueue = useCallback(async () => {
    const removed = await clearPendingMutations();
    await refresh();
    return removed;
  }, [refresh]);

  const removePendingItem = useCallback(async (id: number) => {
    const removed = await removePendingMutationById(id);
    await refresh();
    return removed;
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, 3000);
    const onOnline = () => {
      setIsOnline(true);
      void refresh();
    };
    const onOffline = () => {
      setIsOnline(false);
      void refresh();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refresh]);

  return { pendingCount, pendingItems, isOnline, isSyncing, refresh, syncNow, clearQueue, removePendingItem };
}
