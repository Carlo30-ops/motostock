import { useEffect, Suspense } from "react";
import { RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { router } from "./routes";
import { LanguageProvider } from "./lib/i18n";
import { NotificationSystem } from "./components/ui/NotificationSystem";
import { AuthProvider } from "./lib/auth-refresh-client";
import { flushPendingMutations } from "./offline/sync";
import type { OfflineFlushedEventDetail, OfflineQueuedEventDetail } from "./offline/sync";

const queryClient = new QueryClient();

export default function App() {
  useEffect(() => {
    void flushPendingMutations().then((result) => {
      if (result.synced > 0) {
        void queryClient.invalidateQueries();
      }
    });
    const onOnline = () => {
      void flushPendingMutations().then((result) => {
        if (result.synced > 0) {
          void queryClient.invalidateQueries();
        }
      });
    };
    const onOfflineQueued = (event: Event) => {
      const custom = event as CustomEvent<OfflineQueuedEventDetail>;
      toast.info(`Operacion encolada offline. Pendientes: ${custom.detail.pendingCount}`);
    };
    const onOfflineFlushed = (event: Event) => {
      const custom = event as CustomEvent<OfflineFlushedEventDetail>;
      const { synced, failed, remaining } = custom.detail;
      if (synced > 0) {
        toast.success(`Sincronizadas ${synced} operaciones.`);
        void queryClient.invalidateQueries();
      } else if (failed > 0) {
        if (custom.detail.authFailure) {
          toast.error("La sincronizacion se detuvo: vuelve a iniciar sesion.");
        } else {
          toast.error(custom.detail.lastError ?? "La sincronizacion se detuvo por un error.");
        }
      } else if (remaining > 0 && !navigator.onLine) {
        toast.info("Sin conexion. Las operaciones pendientes se mantendran en cola.");
      }
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline:queued", onOfflineQueued as EventListener);
    window.addEventListener("offline:flushed", onOfflineFlushed as EventListener);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline:queued", onOfflineQueued as EventListener);
      window.removeEventListener("offline:flushed", onOfflineFlushed as EventListener);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <Suspense fallback={<div>Cargando...</div>}>
            <RouterProvider router={router} />
          </Suspense>
          <Toaster position="top-right" richColors />
          <NotificationSystem />
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}