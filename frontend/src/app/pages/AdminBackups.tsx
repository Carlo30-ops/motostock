/** Fase 1.2: descarga de backups usa access_token unificado. */
import { useState, useEffect } from "react";
import { useBackups, useTriggerBackup } from "../api/hooks";
import type { BackupFile } from "../api/client";
import { getAccessToken } from "../api/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Download, HardDrive, Clock, CheckCircle, DatabaseBackup, Loader2, Info } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Modal } from "../components/ui/modal";

// Helper to format bytes
function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function AdminBackups() {
  const { data: backups, isLoading, refetch } = useBackups();
  const triggerMutation = useTriggerBackup();
  const [selectedBackup, setSelectedBackup] = useState<BackupFile | null>(null);
  
  // Cuenta regresiva
  const [nextBackupTime, setNextBackupTime] = useState<string>("");
  
  useEffect(() => {
    // Calculamos el próximo backup (ej. asumiendo 8 AM o 8 PM)
    const updateCountdown = () => {
      const now = new Date();
      let next = new Date();
      if (now.getHours() < 8) {
        next.setHours(8, 0, 0, 0);
      } else if (now.getHours() < 20) {
        next.setHours(20, 0, 0, 0);
      } else {
        next.setDate(next.getDate() + 1);
        next.setHours(8, 0, 0, 0);
      }
      
      const diff = next.getTime() - now.getTime();
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      
      setNextBackupTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTrigger = () => {
    triggerMutation.mutate(undefined, {
      onSuccess: () => {
        alert("Backup generado y enviado por correo exitosamente.");
        refetch();
      },
      onError: () => {
        alert("Error al generar backup.");
      }
    });
  };

  const handleDownload = (filename: string) => {
    const url = `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/backups/${filename}/download`;
    // We need to attach the token if auth is required for download
    const token = getAccessToken();
    
    fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    })
    .then(res => res.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    })
    .catch(() => alert("Error descargando el archivo"));
  };

  const lastBackup = backups && backups.length > 0 ? backups[0] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Copias de Seguridad</h1>
          <p className="text-muted-foreground">Administra y descarga los snapshots de la base de datos.</p>
        </div>
        
        <Button onClick={handleTrigger} disabled={triggerMutation.isPending} className="bg-primary">
          {triggerMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DatabaseBackup className="w-4 h-4 mr-2" />}
          Generar Backup Ahora
        </Button>
      </div>
      
      {/* Barra de estado con cuenta regresiva */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-primary">Próximo backup automático programado en:</span>
        </div>
        <div className="text-xl font-mono font-bold text-primary tracking-wider bg-background px-3 py-1 rounded shadow-sm border border-border">
          {nextBackupTime}
        </div>
      </div>

      {/* 4 Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success/10 text-success rounded-lg">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Último Backup Exitoso</p>
              <h3 className="text-xl font-bold text-foreground mt-1">
                {lastBackup ? format(new Date(lastBackup.createdAt * 1000), "dd/MM/yyyy HH:mm") : "Ninguno"}
              </h3>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-lg">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Backups Guardados</p>
              <h3 className="text-xl font-bold text-foreground mt-1">
                {backups?.length || 0} / 60
              </h3>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-warning/10 text-warning rounded-lg">
              <DatabaseBackup className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Espacio Utilizado</p>
              <h3 className="text-xl font-bold text-foreground mt-1">
                {formatBytes(backups?.reduce((acc: number, curr: BackupFile) => acc + curr.sizeBytes, 0) || 0)}
              </h3>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-secondary/10 text-secondary rounded-lg">
              <Info className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Retención Máxima</p>
              <h3 className="text-xl font-bold text-foreground mt-1">30 Días</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium">Nombre de Archivo</th>
                <th className="px-6 py-4 font-medium">Fecha y Hora</th>
                <th className="px-6 py-4 font-medium">Tamaño</th>
                <th className="px-6 py-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    Cargando respaldos...
                  </td>
                </tr>
              ) : backups?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    No hay respaldos disponibles.
                  </td>
                </tr>
              ) : (
                backups?.map((backup: BackupFile) => (
                  <tr key={backup.filename} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-primary">
                      {backup.filename}
                    </td>
                    <td className="px-6 py-4">
                      {format(new Date(backup.createdAt * 1000), "PPP p", { locale: es })}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary">{formatBytes(backup.sizeBytes)}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedBackup(backup)}>
                        Detalles
                      </Button>
                      <Button variant="outline" size="sm" className="ml-2" onClick={() => handleDownload(backup.filename)}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer Lateral (Usando Modal adaptado a Drawer o Modal estándar) */}
      {selectedBackup && (
        <Modal
          open={!!selectedBackup}
          onOpenChange={(open) => !open && setSelectedBackup(null)}
          title="Detalle del Backup"
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Archivo</label>
              <p className="mt-1 font-mono text-sm bg-muted p-2 rounded break-all">{selectedBackup.filename}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tamaño</label>
                <p className="mt-1 font-medium">{formatBytes(selectedBackup.sizeBytes)}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Creado</label>
                <p className="mt-1 font-medium">{format(new Date(selectedBackup.createdAt * 1000), "dd/MM/yyyy HH:mm")}</p>
              </div>
            </div>
            <div className="pt-4 flex gap-3">
              <Button className="w-full" onClick={() => handleDownload(selectedBackup.filename)}>
                <Download className="w-4 h-4 mr-2" /> Descargar Copia
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setSelectedBackup(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
