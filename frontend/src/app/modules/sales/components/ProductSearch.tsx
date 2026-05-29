import { useState, useMemo, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { Product, store } from "@/lib/store";
import { Badge } from "@shared/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { useBarcodeScanner } from "@/lib/useBarcodeScanner";

interface ProductSearchProps {
  products: Product[];
  onSelect: (product: Product) => void;
  isLoading?: boolean;
}

export function ProductSearch({ products, onSelect }: ProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchStatus, setSearchStatus] = useState<"idle" | "success" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  useBarcodeScanner((barcode) => {
    const product = products.find(p => p.barcode === barcode || p.code === barcode);
    if (product) {
      setSearchStatus("success");
      onSelect(product);
      setSearchTerm("");
      setTimeout(() => setSearchStatus("idle"), 300);
    } else {
      setSearchStatus("error");
      setTimeout(() => setSearchStatus("idle"), 500);
    }
  });

  const searchableCatalog = useMemo(() => {
    const combosAsProducts = store.combos.map(c => ({
      id: c.id,
      name: `[COMBO] ${c.name}`,
      category: "Combos",
      brand: "MotoStock",
      stock: 99,
      salePrice: c.price,
      costPrice: 0,
      reorderThreshold: 0,
      code: c.id
    } as Product));
    return [...products, ...combosAsProducts];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (searchTerm.length < 3) return [];
    return searchableCatalog.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, searchableCatalog]);

  return (
    <div className="relative">
      <div className={`relative flex items-center border-2 rounded-xl bg-background transition-colors ${
        searchStatus === "success" ? "border-success bg-success/5" : 
        searchStatus === "error" ? "border-destructive bg-destructive/5" : "border-primary"
      }`}>
        <Search className="w-6 h-6 ml-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          className="w-full bg-transparent border-none focus:ring-0 text-lg p-4 outline-none placeholder:text-muted-foreground/70"
          placeholder="Escanea el código o busca un producto..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        />
      </div>
      
      {showDropdown && searchTerm.length >= 3 && (
        <div className="absolute top-full mt-2 w-full bg-card border border-border rounded-lg shadow-xl z-50 max-h-[300px] overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">No se encontraron productos.</div>
          ) : (
            filteredProducts.map((p) => (
              <div 
                key={p.id} 
                className={`p-3 border-b border-border hover:bg-muted/50 cursor-pointer flex justify-between items-center ${p.stock <= 0 ? 'opacity-60 bg-muted/20' : ''}`}
                onMouseDown={() => {
                  onSelect(p);
                  setSearchTerm("");
                  setShowDropdown(false);
                }}
              >
                <div>
                  <div className="font-bold flex items-center gap-2">
                    {p.name}
                    {p.stock <= 0 && <Badge variant="destructive" className="text-[10px]">Sin stock</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">{p.code} | {p.brand}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary">{formatCurrency(p.salePrice)}</div>
                  <div className="text-xs font-medium text-muted-foreground">Stock: {p.stock}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
