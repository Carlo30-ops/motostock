import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { ArrowLeft, Printer, RefreshCw, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { formatCurrency } from "../lib/utils";
import { api } from "../api/client";
import { useProducts } from "@/api/hooks";
import { toast } from "sonner";

type FormatOptions = "format-a" | "format-b" | "format-c";

export function InventoryLabels() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [format, setFormat] = useState<FormatOptions>("format-a");
  const [copies, setCopies] = useState<Record<string, number>>({});
  
  const idsParam = searchParams.get("ids");
  const ids = idsParam ? idsParam.split(",") : [];
  
  const { data: products = [], isLoading, isError } = useProducts();

  const selectedProducts = useMemo(() => {
    return products.filter(p => ids.includes(String(p.id)));
  }, [ids, products]);

  // Initialize copies
  useMemo(() => {
    if (Object.keys(copies).length === 0 && selectedProducts.length > 0) {
      const initialCopies: Record<string, number> = {};
      selectedProducts.forEach(p => initialCopies[String(p.id)] = 1);
      setCopies(initialCopies);
    }
  }, [selectedProducts]);

  const handleCopyChange = (id: string, value: number) => {
    if (value < 1) value = 1;
    if (value > 99) value = 99;
    setCopies(prev => ({ ...prev, [id]: value }));
  };

  const handlePrint = () => {
    window.print();
  };

  const generateBarcode = async (productId: string) => {
    try {
      const res = await api.generateBarcode(Number(productId));
      if (res.barcode) {
        toast.success("Código generado correctamente");
        queryClient.invalidateQueries({ queryKey: ["products"] });
      }
    } catch (e) {
      toast.error("Error al generar código");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-destructive">Error al cargar productos</h2>
        <Button onClick={() => navigate("/inventory")}><ArrowLeft className="w-4 h-4 mr-2"/> Volver al Inventario</Button>
      </div>
    );
  }

  if (selectedProducts.length === 0) {
    return (
      <div className="p-8 text-center space-y-4 no-print">
        <h2 className="text-xl font-bold">No hay productos seleccionados</h2>
        <Button onClick={() => navigate("/inventory")}><ArrowLeft className="w-4 h-4 mr-2"/> Volver al Inventario</Button>
      </div>
    );
  }

  // Flatten products based on copies for printing
  const labelsToPrint = selectedProducts.flatMap(product => {
    const count = copies[String(product.id)] || 1;
    return Array(count).fill(product);
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      
      {/* HEADER NO PRINT */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-4 rounded-lg shadow-sm border border-border no-print">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/inventory")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-xl font-bold">Impresión de Etiquetas</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Formato:</label>
            <select 
              className="border border-border bg-background rounded-md px-3 py-1.5 text-sm"
              value={format}
              onChange={(e) => setFormat(e.target.value as FormatOptions)}
            >
              <option value="format-a">5×2 cm (20 por hoja)</option>
              <option value="format-b">7×3 cm (12 por hoja)</option>
              <option value="format-c">10×5 cm (8 por hoja)</option>
            </select>
          </div>
          
          <Button onClick={handlePrint} className="bg-primary text-primary-foreground">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir Hoja
          </Button>
        </div>
      </div>

      {/* COPIES CONTROLS NO PRINT */}
      <div className="bg-card p-4 rounded-lg shadow-sm border border-border no-print">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Control de Copias</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedProducts.map(product => (
            <div key={product.id} className="flex items-center justify-between bg-muted/30 p-2 rounded border border-border">
              <div className="flex-1 truncate pr-2">
                <span className="text-sm font-medium block truncate">{product.name}</span>
                {product.barcode ? (
                  <span className="text-xs text-muted-foreground font-mono">{product.barcode}</span>
                ) : (
                  <span className="text-xs text-warning flex items-center gap-1 cursor-pointer" onClick={() => generateBarcode(product.id)}>
                    Sin código <RefreshCw className="w-3 h-3"/> Generar
                  </span>
                )}
              </div>
              <input 
                type="number" 
                min="1" max="99" 
                className="w-16 border border-border rounded px-2 py-1 text-center bg-background text-sm"
                value={copies[product.id] || 1}
                onChange={(e) => handleCopyChange(product.id, parseInt(e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* PRINT AREA */}
      <div className="bg-white text-black p-4 md:p-8 rounded-lg shadow border border-border overflow-auto max-h-[800px] print:p-0 print:border-none print:shadow-none print:overflow-visible print:max-h-none">
        
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            .no-print { display: none !important; }
            @page {
              size: A4;
              margin: 10mm;
            }
            body {
              background-color: white !important;
            }
            .labels-grid {
              display: grid;
              width: 100%;
              gap: 2mm;
            }
            .labels-grid.format-a { grid-template-columns: repeat(4, 1fr); }
            .labels-grid.format-b { grid-template-columns: repeat(3, 1fr); }
            .labels-grid.format-c { grid-template-columns: repeat(2, 1fr); }
            
            .label-item {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        `}} />

        <div className={`labels-grid ${format} grid gap-2 md:gap-4`} style={{
           gridTemplateColumns: format === 'format-a' ? 'repeat(4, 1fr)' : format === 'format-b' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'
        }}>
          {labelsToPrint.map((product, index) => (
            <div key={`${product.id}-${index}`} className="label-item border border-dashed border-gray-400 p-2 flex flex-col justify-between"
                 style={{ 
                   height: format === 'format-a' ? '2cm' : format === 'format-b' ? '3cm' : '5cm',
                   minHeight: format === 'format-a' ? '80px' : '100px',
                 }}>
              
              <div className="text-[8pt] leading-tight font-sans font-bold truncate line-clamp-2" style={{ WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', whiteSpace: 'normal' }}>
                {product.name}
              </div>
              
              <div className="flex-1 flex flex-col items-center justify-center py-1">
                {product.barcode ? (
                  <>
                    <img 
                      src={`${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/inventory/${product.id}/barcode-image`} 
                      alt={product.barcode}
                      className="max-h-full max-w-full object-contain"
                      style={{ maxHeight: format === 'format-a' ? '1.2cm' : 'auto' }}
                    />
                    <div className="text-[7pt] font-mono leading-none tracking-widest">{product.barcode}</div>
                  </>
                ) : (
                  <div className="text-[8pt] text-red-500 font-bold border border-red-500 px-1">SIN CÓDIGO</div>
                )}
              </div>
              
              <div className="flex justify-between items-end">
                <span className="text-[6pt] text-gray-500 font-sans">MotoStock</span>
                <span className="text-[9pt] font-bold font-sans">{formatCurrency(product.salePrice)}</span>
              </div>
              
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
