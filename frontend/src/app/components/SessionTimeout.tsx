import { useState, useEffect, useCallback } from "react";
import { Lock, LogIn } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { useCurrentUser } from "../hooks/useCurrentUser";

// Timeout duration in milliseconds (e.g., 15 minutes = 15 * 60 * 1000)
const TIMEOUT_MS = 15 * 60 * 1000;
const WARNING_MS = 2 * 60 * 1000; // 2 minutes before timeout

export function SessionTimeout() {
  const [isLocked, setIsLocked] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [password, setPassword] = useState("");
  const { data: currentUser } = useCurrentUser();
  
  let timeoutTimer: NodeJS.Timeout;
  let warningTimer: NodeJS.Timeout;

  const resetTimers = useCallback(() => {
    if (isLocked) return;
    
    clearTimeout(timeoutTimer);
    clearTimeout(warningTimer);
    setShowWarning(false);

    warningTimer = setTimeout(() => {
      setShowWarning(true);
      toast.warning("Tu sesión expirará pronto por inactividad.");
    }, TIMEOUT_MS - WARNING_MS);

    timeoutTimer = setTimeout(() => {
      setIsLocked(true);
      setShowWarning(false);
      toast.error("Sesión bloqueada por inactividad.");
    }, TIMEOUT_MS);
  }, [isLocked]);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const handleActivity = () => resetTimers();

    events.forEach(event => document.addEventListener(event, handleActivity));
    resetTimers(); // Initial start

    return () => {
      events.forEach(event => document.removeEventListener(event, handleActivity));
      clearTimeout(timeoutTimer);
      clearTimeout(warningTimer);
    };
  }, [resetTimers]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    // Simplified unlock logic for the demo. In production, this would verify the token/password.
    if (password === "admin" || password === "1234") {
      setIsLocked(false);
      setPassword("");
      resetTimers();
      toast.success("Sesión reanudada");
    } else {
      toast.error("Contraseña incorrecta");
    }
  };

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-lg shadow-xl border border-border p-6 flex flex-col items-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        
        <h2 className="text-2xl font-bold mb-2">Sesión Bloqueada</h2>
        <p className="text-muted-foreground text-center mb-6">
          Por seguridad, tu sesión ha sido bloqueada debido a {TIMEOUT_MS / 60000} minutos de inactividad.
        </p>

        <form onSubmit={handleUnlock} className="w-full space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Contraseña de {currentUser?.username || "Usuario"}
            </label>
            <Input 
              type="password" 
              placeholder="Ingresa tu contraseña (usa: admin)" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>
          
          <Button type="submit" className="w-full" variant="primary">
            <LogIn className="w-4 h-4 mr-2" />
            Desbloquear
          </Button>
        </form>
      </div>
    </div>
  );
}
