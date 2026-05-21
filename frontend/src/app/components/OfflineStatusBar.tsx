import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { cn } from "../lib/utils";
import { useOfflineSyncStatus } from "../offline/useOfflineSyncStatus";

export function OfflineStatusBar() {
  const { pendingCount, isOnline, isSyncing, syncNow } = useOfflineSyncStatus();

  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div
      className={cn(
        "sticky top-0 z-20 px-4 py-2 text-sm flex flex-wrap items-center justify-between gap-2 border-b",
        isOnline ? "bg-warning/15 border-warning/40 text-foreground" : "bg-destructive/15 border-destructive/40"
      )}
      role="status"
    >
      <div className="flex items-center gap-2 font-medium">
        {isOnline ? (
          <Wifi className="w-4 h-4 text-warning" />
        ) : (
          <CloudOff className="w-4 h-4 text-destructive" />
        )}
        <span>
          {isOnline
            ? `Modo en línea — ${pendingCount} operación(es) pendiente(s) de sincronizar`
            : "Sin conexión — las ventas se guardan en cola local"}
        </span>
      </div>
      <button
        type="button"
        disabled={!isOnline || isSyncing || pendingCount === 0}
        onClick={() => void syncNow()}
        className={cn(
          "inline-flex items-center gap-2 rounded-md px-3 py-1.5 border text-xs font-medium",
          "border-border bg-card hover:bg-muted disabled:opacity-50"
        )}
      >
        <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
        {isSyncing ? "Sincronizando…" : "Sincronizar ahora"}
      </button>
    </div>
  );
}
