/**
 * Perfil: contraseña (simulado) y 2FA conectado a /api/2fa (Fase B).
 */
import { useState } from "react";
import { Shield, Key, CheckCircle2, Lock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { useCurrentUser } from "../hooks/useCurrentUser";
import {
  use2FAStatus,
  useEnable2FA,
  useVerify2FA,
  useDisable2FA,
  useRegenerateBackupCodes,
} from "../api/hooks";
import axios from "axios";

function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data;
    if (typeof detail === "object" && detail !== null && "detail" in detail) {
      return String((detail as { detail: unknown }).detail);
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Error desconocido";
}

export function Profile() {
  const { data: currentUser } = useCurrentUser();
  const { data: tfaStatus, isLoading: loading2fa } = use2FAStatus();
  const enable2FA = useEnable2FA();
  const verify2FA = useVerify2FA();
  const disable2FA = useDisable2FA();
  const regenerateBackup = useRegenerateBackupCodes();

  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [verifyToken, setVerifyToken] = useState("");
  const [setupData, setSetupData] = useState<{
    qr_code: string;
    backup_codes: string[];
  } | null>(null);
  const [lastBackupCodes, setLastBackupCodes] = useState<string[]>([]);

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      toast.error("Las nuevas contraseñas no coinciden");
      return;
    }
    if (passwords.new.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setIsUpdating(true);
    setTimeout(() => {
      setIsUpdating(false);
      setPasswords({ current: "", new: "", confirm: "" });
      toast.success("Contraseña actualizada exitosamente");
    }, 1500);
  };

  const handleEnable2FA = () => {
    enable2FA.mutate(undefined, {
      onSuccess: (res) => {
        setSetupData({
          qr_code: res.qr_code,
          backup_codes: res.backup_codes,
        });
        setLastBackupCodes(res.backup_codes);
        toast.success("Escanea el código QR con tu app de autenticación");
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    });
  };

  const handleVerify2FA = (e: React.FormEvent) => {
    e.preventDefault();
    verify2FA.mutate(verifyToken.trim(), {
      onSuccess: () => {
        toast.success("Código verificado correctamente");
        setVerifyToken("");
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    });
  };

  const handleDisable2FA = () => {
    disable2FA.mutate(undefined, {
      onSuccess: () => {
        setSetupData(null);
        toast.success("2FA deshabilitado");
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    });
  };

  const handleRegenerateBackup = () => {
    regenerateBackup.mutate(undefined, {
      onSuccess: (res) => {
        setLastBackupCodes(res.backup_codes);
        toast.success("Códigos de respaldo regenerados");
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    });
  };

  const tfaEnabled = tfaStatus?.enabled ?? false;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1>Configuración de Seguridad</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tu perfil y la seguridad de tu cuenta
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Tu Perfil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nombre</p>
                  <p className="font-medium">{currentUser?.username || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rol del Sistema</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
                      {currentUser?.role || "—"}
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">2FA</p>
                  {loading2fa ? (
                    <Loader2 className="w-4 h-4 animate-spin mt-1" />
                  ) : (
                    <Badge variant={tfaEnabled ? "success" : "secondary"} className="mt-1">
                      {tfaEnabled ? "Activo" : "Inactivo"}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Cambiar Contraseña
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Contraseña Actual</label>
                  <Input
                    type="password"
                    value={passwords.current}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswords({ ...passwords, current: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nueva Contraseña</label>
                    <Input
                      type="password"
                      value={passwords.new}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswords({ ...passwords, new: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Confirmar</label>
                    <Input
                      type="password"
                      value={passwords.confirm}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswords({ ...passwords, confirm: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="primary" disabled={isUpdating}>
                    {isUpdating ? "Actualizando..." : "Actualizar Contraseña"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Autenticación de Dos Factores (2FA)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading2fa ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : tfaEnabled ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    2FA activo. Códigos de respaldo restantes:{" "}
                    <strong>{tfaStatus?.backup_codes_remaining ?? 0}</strong>
                  </p>
                  <form onSubmit={handleVerify2FA} className="flex gap-2">
                    <Input
                      placeholder="Código de 6 dígitos"
                      value={verifyToken}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVerifyToken(e.target.value)}
                      maxLength={8}
                    />
                    <Button type="submit" variant="outline" disabled={verify2FA.isPending}>
                      Verificar
                    </Button>
                  </form>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={handleRegenerateBackup}
                      disabled={regenerateBackup.isPending}
                    >
                      Regenerar códigos backup
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDisable2FA}
                      disabled={disable2FA.isPending}
                    >
                      Deshabilitar 2FA
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Protege tu cuenta con Google Authenticator, Authy u otra app TOTP.
                  </p>
                  {!setupData ? (
                    <Button
                      onClick={handleEnable2FA}
                      disabled={enable2FA.isPending}
                      className="w-full"
                    >
                      {enable2FA.isPending ? "Generando..." : "Activar 2FA"}
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <img
                          src={setupData.qr_code}
                          alt="Código QR 2FA"
                          className="w-48 h-48 border rounded-lg"
                        />
                      </div>
                      <div className="rounded-lg border p-3 bg-muted/30">
                        <p className="text-xs font-semibold mb-2">
                          Guarda estos códigos de respaldo (solo se muestran una vez):
                        </p>
                        <ul className="text-xs font-mono grid grid-cols-2 gap-1">
                          {setupData.backup_codes.map((code) => (
                            <li key={code}>{code}</li>
                          ))}
                        </ul>
                      </div>
                      <form onSubmit={handleVerify2FA} className="flex gap-2">
                        <Input
                          placeholder="Confirma con código de la app"
                          value={verifyToken}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVerifyToken(e.target.value)}
                          required
                        />
                        <Button type="submit" disabled={verify2FA.isPending}>
                          Confirmar
                        </Button>
                      </form>
                    </div>
                  )}
                </>
              )}

              {lastBackupCodes.length > 0 && !setupData && (
                <div className="rounded-lg border p-3 text-xs font-mono">
                  <p className="font-semibold mb-2">Últimos códigos generados:</p>
                  {lastBackupCodes.map((c) => (
                    <div key={c}>{c}</div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
