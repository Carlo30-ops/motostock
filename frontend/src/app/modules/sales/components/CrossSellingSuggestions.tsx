import { Plus } from "lucide-react";
import { Product } from "@/lib/store";
import { Card, CardHeader, CardTitle, CardContent } from "@shared/ui/card";
import { Button } from "@shared/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useMemo } from "react";
import { CartItem } from "../types";

interface CrossSellingSuggestionsProps {
  cart: CartItem[];
  allProducts: Product[];
  onAdd: (product: Product) => void;
}

export function CrossSellingSuggestions({ cart, allProducts, onAdd }: CrossSellingSuggestionsProps) {
  const suggestedProducts = useMemo(() => {
    if (cart.length === 0) return [];
    const inCartIds = new Set(cart.map(i => i.product.id));
    const suggestions: Product[] = [];
    
    cart.forEach(item => {
      const cat = item.product.category.toLowerCase();
      if (cat.includes("oil") || cat.includes("aceite")) {
        allProducts.forEach(p => {
          if ((p.category.toLowerCase().includes("filter") || p.category.toLowerCase().includes("filtro")) && !inCartIds.has(p.id)) {
            suggestions.push(p);
          }
        });
      } else if (cat.includes("tire") || cat.includes("llanta")) {
        allProducts.forEach(p => {
          if ((p.category.toLowerCase().includes("brake") || p.category.toLowerCase().includes("freno")) && !inCartIds.has(p.id)) {
            suggestions.push(p);
          }
        });
      }
    });
    
    const unique = Array.from(new Set(suggestions));
    return unique.slice(0, 3);
  }, [cart, allProducts]);

  if (suggestedProducts.length === 0) return null;

  return (
    <Card className="border border-primary/20 shadow-sm bg-primary/5">
      <CardHeader className="py-3 border-b border-primary/10">
        <CardTitle className="text-sm text-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Comprados frecuentemente juntos
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div className="flex flex-col gap-2">
          {suggestedProducts.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-background p-2 rounded border border-border">
              <div>
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(p.salePrice)}</div>
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onAdd(p)}>
                Agregar
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
