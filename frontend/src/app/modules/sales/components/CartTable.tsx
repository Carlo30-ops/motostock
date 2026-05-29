import { Search, Minus, Plus, Trash2 } from "lucide-react";
import { CartItem } from "../types";
import { formatCurrency } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@shared/ui/card";

interface CartTableProps {
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}

export function CartTable({ items, onUpdateQuantity, onRemove }: CartTableProps) {
  return (
    <Card className="flex-1 border border-border shadow-sm">
      <CardHeader className="py-4 border-b border-border bg-muted/20">
        <CardTitle className="text-lg">Carrito de Compras</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground flex flex-col items-center">
            <Search className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p>El carrito está vacío.</p>
            <p className="text-sm mt-1">Escanea un producto para comenzar.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-muted/50 text-muted-foreground text-sm border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium text-center">Cant.</th>
                    <th className="px-4 py-3 font-medium text-right">Unitario</th>
                    <th className="px-4 py-3 font-medium text-right">Subtotal</th>
                    <th className="px-4 py-3 font-medium text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item) => (
                    <tr key={item.product.id} className="hover:bg-muted/20 animate-in fade-in slide-in-from-top-2 duration-200">
                      <td className="px-4 py-3">
                        <div className="font-medium text-sm leading-tight">{item.product.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{item.product.code}</div>
                      </td>
                      <td className="px-4 py-3 text-center w-32">
                        <div className={`flex items-center justify-center gap-1 ${item.quantity > item.product.stock ? 'bg-warning/20 border border-warning/50 rounded p-1' : ''}`}>
                          <button onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)} className="p-1.5 hover:bg-muted rounded bg-background border border-border"><Minus className="w-3 h-3" /></button>
                          <input 
                            type="number" 
                            value={item.quantity} 
                            onChange={(e) => onUpdateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                            className="w-10 text-center font-bold bg-transparent outline-none p-0 border-none focus:ring-0" 
                          />
                          <button onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)} className="p-1.5 hover:bg-muted rounded bg-background border border-border"><Plus className="w-3 h-3" /></button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-muted-foreground">
                        {formatCurrency(item.product.salePrice)}
                        {item.quantity >= 5 && <div className="text-[10px] text-success font-bold">(-10% Vol.)</div>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">
                        {formatCurrency(item.product.salePrice * item.quantity * (item.quantity >= 5 ? 0.9 : 1))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => onRemove(item.product.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-full transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tablet/Mobile Cards */}
            <div className="md:hidden divide-y divide-border">
              {items.map((item) => (
                <div key={item.product.id} className="p-4 space-y-3 animate-in fade-in slide-in-from-left-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="font-bold text-sm leading-tight">{item.product.name}</div>
                    <div className="font-bold whitespace-nowrap">{formatCurrency(item.product.salePrice * item.quantity)}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className={`flex items-center gap-1 ${item.quantity > item.product.stock ? 'bg-warning/20 border border-warning/50 rounded' : ''}`}>
                      <button onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)} className="h-11 w-11 flex items-center justify-center hover:bg-muted rounded border border-border active:bg-muted/50"><Minus className="w-5 h-5" /></button>
                      <input 
                        type="number" 
                        value={item.quantity} 
                        onChange={(e) => onUpdateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                        className="w-12 text-center font-bold text-lg bg-transparent border-none outline-none focus:ring-0" 
                      />
                      <button onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)} className="h-11 w-11 flex items-center justify-center hover:bg-muted rounded border border-border active:bg-muted/50"><Plus className="w-5 h-5" /></button>
                    </div>
                    <button onClick={() => onRemove(item.product.id)} className="h-11 w-11 flex items-center justify-center text-destructive border border-destructive/30 rounded active:bg-destructive/10">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
