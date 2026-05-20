import { useState } from "react";
import { Shield, Key, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { toast } from "sonner";
import { useCurrentUser } from "../hooks/useCurrentUser";

export function Profile() {
  const { data: currentUser } = useCurrentUser();
  
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: ""
  });
  
  const [isUpdating, setIsUpdating] = useState(false);

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

        <div className="md:col-span-2">
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
        </div>
      </div>
    </div>
  );
}
