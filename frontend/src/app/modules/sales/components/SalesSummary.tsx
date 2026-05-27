import { Banknote, CreditCard, Smartphone, Wallet } from "lucide-react";
import { PaymentMethod } from "../types";
import { Card, CardHeader, CardTitle, CardContent } from "@shared/ui/Card";
import { Button } from "@shared/ui/Button";
import { formatCurrency, cn } from "@/lib/utils";
import { Can } from "@/lib/auth-rbac";
import { NumericKeypad } from "@shared/ui/NumericKeypad";

interface SalesSummaryProps {
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  ivaAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashReceived: number | "";
  onDiscountChange: (val: number) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onCashReceivedChange: (val: string) => void;
  onComplete: () => void;
  isProcessing: boolean;
  canComplete: boolean;
}

export function SalesSummary({
  subtotal,
  discountPercent,
  discountAmount,
  ivaAmount,
  total,
  paymentMethod,
  cashReceived,
  onDiscountChange,
  onPaymentMethodChange,
  onCashReceivedChange,
  onComplete,
  isProcessing,
  canComplete
}: SalesSummaryProps) {
  const numericReceived = Number(cashReceived);
  const vuelto = paymentMethod === "cash" && numericReceived >= total ? numericReceived - total : 0;
  const isCashInsufficient = paymentMethod === "cash" && numericReceived < total && numericReceived > 0;

  return (
    <Card className="shadow-sm border-border flex-1 flex flex-col">
      <CardHeader className="py-3 bg-muted/20 border-b border-border">
        <CardTitle className="text-sm">Resumen de Venta</CardTitle>
      </CardHeader>
      <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-4">
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          
          <div className="flex justify-between text-sm items-center">
            <span className="text-muted-foreground flex items-center gap-2">
              Descuento %
              <Can permission="sales:applyDiscount" fallback={<span className="font-bold">{discountPercent}%</span>}>
                <input 
                  type="number" 
                  min="0" 
                  max="100" 
                  value={discountPercent} 
                  onChange={e => onDiscountChange(Number(e.target.value))} 
                  className="w-12 h-6 px-1 border border-border rounded text-center text-xs bg-background" 
                />
              </Can>
            </span>
            <span className="text-destructive font-medium">-{formatCurrency(discountAmount)}</span>
          </div>

          {ivaAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">IVA</span>
              <span className="font-medium text-muted-foreground">+{formatCurrency(ivaAmount)}</span>
            </div>
          )}
          
          <div className="pt-3 mt-3 border-t border-border flex justify-between items-end">
            <span className="text-lg font-bold">Total</span>
            <span className="text-3xl font-black text-primary">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-3 pt-4 border-t border-border">
          <p className="text-sm font-medium">Método de Pago</p>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant={paymentMethod === "cash" ? "primary" : "outline"} 
              onClick={() => onPaymentMethodChange("cash")} 
              className="h-12 flex flex-col items-center justify-center gap-1"
            >
              <Banknote className="w-4 h-4"/> <span className="text-[10px] uppercase">Efectivo</span>
            </Button>
            <Button 
              variant={paymentMethod === "card" ? "primary" : "outline"} 
              onClick={() => onPaymentMethodChange("card")} 
              className="h-12 flex flex-col items-center justify-center gap-1"
            >
              <CreditCard className="w-4 h-4"/> <span className="text-[10px] uppercase">Tarjeta</span>
            </Button>
            <Button 
              variant={paymentMethod === "nequi" ? "primary" : "outline"} 
              onClick={() => onPaymentMethodChange("nequi")} 
              className="h-12 flex flex-col items-center justify-center gap-1"
            >
              <Smartphone className="w-4 h-4"/> <span className="text-[10px] uppercase">Nequi</span>
            </Button>
            <Button 
              variant={paymentMethod === "credit" ? "primary" : "outline"} 
              onClick={() => onPaymentMethodChange("credit")}
              className="h-12 flex flex-col items-center justify-center gap-1"
            >
              <Wallet className="w-4 h-4"/> <span className="text-[10px] uppercase">Crédito</span>
            </Button>
          </div>

          {paymentMethod === "cash" && (
            <div className="pt-2 space-y-3 animate-in slide-in-from-top-1">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Recibido</label>
                  <div className="font-bold text-lg h-12 flex items-center px-3 border border-border rounded-lg bg-muted/30">
                    {cashReceived === "" ? "—" : formatCurrency(Number(cashReceived))}
                  </div>
                </div>
                <div className="flex-1 text-right">
                  <label className="text-xs text-muted-foreground">Vuelto</label>
                  <div
                    className={cn(
                      "font-black text-2xl",
                      vuelto > 0 ? "text-success" : "text-muted-foreground"
                    )}
                  >
                    {formatCurrency(vuelto)}
                  </div>
                </div>
              </div>
              <NumericKeypad
                value={cashReceived === "" ? "" : String(cashReceived)}
                onChange={onCashReceivedChange}
              />
              {isCashInsufficient && (
                <p className="text-xs text-destructive font-bold text-center">
                  Falta: {formatCurrency(total - numericReceived)}
                </p>
              )}
            </div>
          )}
        </div>

        <Button 
          onClick={onComplete} 
          className="w-full h-14 text-lg font-bold shadow-lg" 
          size="lg"
          disabled={!canComplete || isProcessing}
        >
          {isProcessing ? "Registrando…" : `Cobrar ${formatCurrency(total)}`}
        </Button>
      </CardContent>
    </Card>
  );
}
