import { useState } from "react";
import { Modal } from "../../../components/ui/modal";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { AuthMeResponse } from "../types";

interface ExitTabletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ExitTabletModal({ open, onOpenChange, onSuccess }: ExitTabletModalProps) {
  const [exitUsername, setExitUsername] = useState("");
  const [exitPassword, setExitPassword] = useState("");
  const [exitLoading, setExitLoading] = useState(false);
  const [exitError, setExitError] = useState("");

  const handleExitTabletMode = async () => {
    setExitError("");
    if (!exitUsername || !exitPassword) {
      setExitError("Por favor ingrese usuario y contraseña");
      return;
    }
    
    setExitLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append("username", exitUsername);
      formData.append("password", exitPassword);
      
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
      
      const tokenRes = await fetch(`${apiUrl}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString()
      });
      
      if (!tokenRes.ok) throw new Error("Credenciales inválidas");
      const { access_token } = await tokenRes.json();
      
      const userRes = await fetch(`${apiUrl}/auth/users/me`, {
        headers: { "Authorization": `Bearer ${access_token}` }
      });
      
      if (!userRes.ok) throw new Error("Error verificando usuario");
      const user: AuthMeResponse = await userRes.json();
      
      if (user.role === "admin" || user.role === "superadmin") {
        onSuccess();
      } else {
        setExitError("El usuario no tiene permisos de administrador");
      }
    } catch (e: unknown) {
      setExitError(e instanceof Error ? e.message : "Error de autenticación");
    } finally {
      setExitLoading(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Autenticación Requerida" className="max-w-[400px]">
      <div className="space-y-4 pt-4">
        <p className="text-sm text-muted-foreground">
          Ingrese sus credenciales de administrador para salir del modo caja y volver al panel principal.
        </p>
        {exitError && <div className="text-sm font-bold text-destructive bg-destructive/10 p-2 rounded">{exitError}</div>}
        
        <div>
          <label className="text-sm font-medium block mb-1">Usuario</label>
          <Input 
            value={exitUsername} 
            onChange={(e) => setExitUsername(e.target.value)} 
            placeholder="admin"
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Contraseña</label>
          <Input 
            type="password" 
            value={exitPassword} 
            onChange={(e) => setExitPassword(e.target.value)} 
            placeholder="••••••••"
            onKeyDown={(e) => { if (e.key === 'Enter') handleExitTabletMode(); }}
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={handleExitTabletMode} disabled={exitLoading} className="flex-1 bg-primary">
            {exitLoading ? "Verificando..." : "Confirmar"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
