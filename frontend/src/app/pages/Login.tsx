/**
 * Login con branding MotoStock (Fase C).
 */
import { FormEvent, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { LogIn, Bike } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAuthSession } from "../lib/auth";
import { useLanguage } from "../lib/i18n";
import { toast } from "sonner";

export function Login() {
  const { login, isLoading } = useAuthSession();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(username, password);
      toast.success("Sesión iniciada");
      navigate(from, { replace: true });
    } catch {
      setError(t("login.error"));
      toast.error(t("login.error"));
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0f4c75] via-[#0f172a] to-[#1e293b] text-white p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white/10">
            <Bike className="w-8 h-8" />
          </div>
          <span className="text-2xl font-semibold tracking-tight">{t("login.title")}</span>
        </div>
        <div>
          <h2 className="text-3xl font-semibold leading-tight mb-4">
            {t("login.subtitle")}
          </h2>
          <p className="text-white/70 max-w-md">
            Inventario, ventas POS, taller, clientes y reportes en un solo lugar.
          </p>
        </div>
        <p className="text-xs text-white/50">© MotoStock</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-2">
            <Bike className="w-8 h-8 text-primary" />
            <span className="text-xl font-semibold">{t("login.title")}</span>
          </div>

          <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
            <h1 className="text-xl font-semibold flex items-center gap-2 mb-1">
              <LogIn className="w-5 h-5 text-primary" />
              {t("login.submit")}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">{t("login.subtitle")}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-1">
                  {t("login.user")}
                </label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  aria-invalid={!!error}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1">
                  {t("login.password")}
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  aria-invalid={!!error}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive font-medium" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Entrando…" : t("login.submit")}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground text-center mt-6 pt-4 border-t border-border">
              {t("login.demo")}: <strong>admin</strong> / <strong>admin123</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
