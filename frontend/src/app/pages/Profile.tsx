import { useState, useEffect } from "react";
import { Shield, Key, CheckCircle2, QrCode, Lock, RefreshCw, Copy, Check, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { toast } from "sonner";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { api } from "../api/client";

export function Profile() {
  const { data: currentUser } = useCurrentUser();
  
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: ""
  });
  
  const [isUpdating, setIsUpdating] = useState(false);

  // Estados para 2FA
  const [twoFAStatus, setTwoFAStatus] = useState<{ enabled: boolean; backup_codes_remaining: number } | null>(null);
  const [twoFAStep, setTwoFAStep] = useState<'status' | 'password' | 'verify'>('status');
  const [twoFAPassword, setTwoFAPassword] = useState("");
  const [twoFASetupData, setTwoFASetupData] = useState<{ qr_code: string; backup_codes: string[]; instructions: string } | null>(null);
  const [twoFAToken, setTwoFAToken] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetch2FAStatus = async () => {
    try {
      const res = await api.get2FAStatus();
      if (res.success) {
        setTwoFAStatus(res.data);
      }
    } catch (err: any) {
      toast.error("Error al obtener estado 2FA");
    }
  };

  useEffect(() => {
    fetch2FAStatus();
  }, []);

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
    
    // Simulate API call for password change
    setTimeout(() => {
      setIsUpdating(false);
      setPasswords({ current: "", new: "", confirm: "" });
      toast.success("Contraseña actualizada exitosamente");
    }, 1500);
  };

  const handleEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await api.enable2FA(twoFAPassword);
      if (res.success) {
        setTwoFASetupData(res.data);
        setTwoFAStep('verify');
        setTwoFAPassword("");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Contraseña incorrecta o error al habilitar 2FA");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    setActionLoading(true);
    try {
      const res = await api.verify2FA(twoFAToken);
      if (res.success) {
        toast.success("2FA activado correctamente");
        setTwoFAStep('status');
        setTwoFAToken("");
        fetch2FAStatus();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Código de verificación inválido");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm("¿Estás seguro de que deseas desactivar la autenticación de dos factores? Tu cuenta será menos segura.")) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.disable2FA();
      if (res.success) {
        toast.success("2FA desactivado correctamente");
        setTwoFASetupData(null);
        fetch2FAStatus();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al desactivar 2FA");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    setActionLoading(true);
    try {
      const res = await api.regenerateBackupCodes();
      if (res.success) {
        toast.success("Nuevos códigos de respaldo generados");
        setTwoFASetupData({
          qr_code: "",
          backup_codes: res.data.backup_codes,
          instructions: ""
        });
        fetch2FAStatus();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al regenerar códigos");
    } finally {
      setActionLoading(false);
    }
  };

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
                  <p className="font-medium">{currentUser?.name || "Administrador"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rol del Sistema</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
                      {currentUser?.role || "ADMIN"}
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  </div>
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
                  <label className="block text-sm font-medium mb-1">
                    Contraseña Actual
                  </label>
                  <Input 
                    type="password" 
                    placeholder="Ingresa tu contraseña actual"
                    value={passwords.current}
                    onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Nueva Contraseña
                    </label>
                    <Input 
                      type="password" 
                      placeholder="Mínimo 8 caracteres"
                      value={passwords.new}
                      onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Confirmar Contraseña
                    </label>
                    <Input 
                      type="password" 
                      placeholder="Repite la nueva contraseña"
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  <strong>Requisitos de seguridad:</strong>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    <li>Al menos 8 caracteres de longitud</li>
                    <li>No debe ser igual a las últimas 3 contraseñas</li>
                    <li>Incluye al menos un número o carácter especial</li>
                  </ul>
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
              {twoFAStatus === null ? (
                <div className="flex items-center justify-center p-4">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : twoFAStep === 'status' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="font-semibold text-sm">
                        Estado: <span className={twoFAStatus.enabled ? "text-success" : "text-warning"}>{twoFAStatus.enabled ? "Activado" : "Desactivado"}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {twoFAStatus.enabled
                          ? "Tu cuenta está protegida con autenticación TOTP adicional."
                          : "Añade una capa extra de seguridad requiriendo un código de tu teléfono al iniciar sesión."}
                      </p>
                    </div>
                    {twoFAStatus.enabled ? (
                      <span className="px-2 py-1 bg-success/15 text-success text-xs font-semibold rounded-full">
                        Seguro
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-warning/15 text-warning text-xs font-semibold rounded-full">
                        Recomendado
                      </span>
                    )}
                  </div>

                  {twoFAStatus.enabled ? (
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg space-y-2">
                        <p className="text-sm font-medium">Códigos de Respaldo</p>
                        <p className="text-xs text-muted-foreground">
                          Te quedan {twoFAStatus.backup_codes_remaining} códigos de respaldo de un solo uso.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRegenerateBackupCodes}
                          disabled={actionLoading}
                          className="mt-2"
                        >
                          {actionLoading ? "Regenerando..." : "Regenerar Códigos"}
                        </Button>
                      </div>

                      {twoFASetupData && (
                        <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                          <p className="text-sm font-semibold text-warning flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" /> ¡Guarda tus nuevos códigos!
                          </p>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {twoFASetupData.backup_codes.map((code, idx) => (
                              <code key={idx} className="p-1 bg-background border text-center rounded text-sm select-all">
                                {code}
                              </code>
                            ))}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(twoFASetupData.backup_codes.join("\n"));
                              toast.success("Copiado al portapapeles");
                            }}
                            className="w-full mt-2"
                          >
                            Copiar Códigos
                          </Button>
                        </div>
                      )}

                      <Button
                        variant="destructive"
                        onClick={handleDisable2FA}
                        disabled={actionLoading}
                        className="w-full"
                      >
                        {actionLoading ? "Desactivando..." : "Desactivar 2FA"}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => setTwoFAStep('password')}
                      className="w-full"
                    >
                      Habilitar 2FA
                    </Button>
                  )}
                </div>
              ) : twoFAStep === 'password' ? (
                <form onSubmit={handleEnable2FA} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Por motivos de seguridad, confirma tu contraseña para configurar la autenticación de dos factores.
                  </p>
                  <div>
                    <label className="block text-sm font-medium mb-1">Contraseña</label>
                    <Input
                      type="password"
                      placeholder="Ingresa tu contraseña actual"
                      value={twoFAPassword}
                      onChange={(e) => setTwoFAPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setTwoFAStep('status')}>
                      Cancelar
                    </Button>
                    <Button type="submit" variant="primary" disabled={actionLoading}>
                      {actionLoading ? "Cargando..." : "Siguiente"}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-background">
                    {twoFASetupData?.qr_code ? (
                      <img src={twoFASetupData.qr_code} alt="Código QR de Configuración 2FA" className="w-48 h-48 border p-2 bg-white rounded" />
                    ) : (
                      <QrCode className="w-48 h-48 text-muted-foreground" />
                    )}
                    <p className="text-xs text-muted-foreground text-center">
                      Escanea este código QR con tu aplicación de autenticación (Google Authenticator, Authy, etc.)
                    </p>
                  </div>

                  {twoFASetupData?.backup_codes && (
                    <div className="p-4 bg-warning/5 border border-warning/20 rounded-lg space-y-2">
                      <p className="text-sm font-semibold text-warning flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> Códigos de Respaldo Importantes
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Guarda estos códigos en un lugar seguro. Te permitirán acceder a tu cuenta si pierdes tu dispositivo.
                      </p>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {twoFASetupData.backup_codes.map((code, idx) => (
                          <code key={idx} className="p-1 bg-muted border text-center rounded text-xs select-all">
                            {code}
                          </code>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(twoFASetupData.backup_codes.join("\n"));
                          toast.success("Copiado al portapapeles");
                        }}
                        className="w-full mt-1"
                      >
                        Copiar todos los códigos
                      </Button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Verificar Código</label>
                    <p className="text-xs text-muted-foreground">
                      Ingresa el código de 6 dígitos que muestra tu aplicación para finalizar la activación.
                    </p>
                    <Input
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      className="text-center font-mono tracking-widest text-lg"
                      value={twoFAToken}
                      onChange={(e) => setTwoFAToken(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setTwoFAStep('status')}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleVerify2FA}
                      disabled={twoFAToken.length !== 6 || actionLoading}
                      variant="primary"
                    >
                      {actionLoading ? "Activando..." : "Verificar y Activar"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
