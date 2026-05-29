import { useState } from "react";
import { ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { api } from "../../api/client";
import { toast } from "sonner";

interface TwoFactorVerificationProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function TwoFactorVerification({ onSuccess, onCancel }: TwoFactorVerificationProps) {
  const [code, setCode] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError("El código debe tener 6 dígitos");
      return;
    }

    setIsPending(true);
    setError("");

    try {
      await api.verifyTOTP(code);
      toast.success("Verificación exitosa");
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Código inválido o expirado";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <div className="text-center">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Verificación de Dos Factores</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Ingresa el código de 6 dígitos generado por tu aplicación de autenticación.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            placeholder="000000"
            className="text-center text-2xl tracking-[0.5em] font-mono h-14"
            value={code}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "");
              if (val.length <= 6) setCode(val);
            }}
            required
            autoFocus
          />
          {error && <p className="text-sm text-destructive mt-2 font-medium">{error}</p>}
        </div>

        <Button type="submit" className="w-full h-11" disabled={isPending || code.length !== 6}>
          {isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Verificar e Iniciar Sesión"}
        </Button>

        <Button type="button" variant="ghost" className="w-full" onClick={onCancel}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al Login
        </Button>
      </form>
    </div>
  );
}
