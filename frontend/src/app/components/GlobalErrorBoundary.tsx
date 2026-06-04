import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/button";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-xl shadow-xl p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="bg-destructive/10 p-4 rounded-full">
                <AlertTriangle className="w-12 h-12 text-destructive" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Algo salió mal</h1>
              <p className="text-muted-foreground">
                Ha ocurrido un error inesperado en la aplicación. Hemos notificado al equipo técnico.
              </p>
            </div>

            {import.meta.env.DEV && (
              <div className="bg-muted p-4 rounded-lg text-left overflow-auto max-h-40">
                <p className="text-xs font-mono text-destructive break-all">
                  {this.state.error?.toString()}
                </p>
              </div>
            )}

            <div className="pt-2">
              <Button onClick={this.handleReset} className="w-full gap-2" size="lg">
                <RefreshCcw className="w-4 h-4" />
                Reiniciar Aplicación
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
