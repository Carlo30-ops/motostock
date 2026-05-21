import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, Search, Minus, Trash2, Receipt, CreditCard, Banknote, Wallet, Smartphone, AlertCircle, X, Printer, CheckCircle, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { store, Product, Client } from "../lib/store";
import { formatCurrency } from "../lib/utils";
import { useLanguage } from "../lib/i18n";
import { useBarcodeScanner } from "../lib/useBarcodeScanner";
import type { Sale } from "../lib/store";
import { useProducts, useClients, useCreateSale } from "../api/hooks";
import { toast } from "sonner";
import axios from "axios";
import { NumericKeypad } from "../components/ui/NumericKeypad";
import { playSaleSuccessSound } from "../lib/feedback";
import { cn } from "../lib/utils";

interface CartItem {
  product: Product;
  quantity: number;
  isCombo?: boolean;
}

interface SaleReceipt {
  saleId: string;
  date: Date;
  client: Client | null;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  ivaAmount: number;
  total: number;
  paymentMethod: Sale["paymentMethod"];
  received: number;
  vuelto: number;
}

interface AuthMeResponse {
  role: string;
}

function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data;
    if (typeof detail === "object" && detail !== null && "detail" in detail) {
      return String((detail as { detail: unknown }).detail);
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Error desconocido";
}

export function Sales() {
  const { t, language } = useLanguage();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: clients = [] } = useClients();
  const createSale = useCreateSale();
  const [cart, setCart] = useState<CartItem[]>([]);
  const tabletMode = store((state) => state.tabletMode);
  const setTabletMode = store((state) => state.setTabletMode);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchStatus, setSearchStatus] = useState<"idle" | "success" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  // Totals & Discounts
  const [discountPercent, setDiscountPercent] = useState(0);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "credit" | "nequi">("cash");
  const [cashReceived, setCashReceived] = useState<number | "">("");

  // Client state
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Receipt state
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSaleReceipt, setLastSaleReceipt] = useState<SaleReceipt | null>(null);

  // Exit Tablet Mode Modal state
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitUsername, setExitUsername] = useState("");
  const [exitPassword, setExitPassword] = useState("");
  const [exitLoading, setExitLoading] = useState(false);
  const [exitError, setExitError] = useState("");

  // Focus input continuously
  useEffect(() => {
    if (!showReceipt && inputRef.current) {
      inputRef.current.focus();
    }
  }, [cart, showReceipt]);

  // Handle barcode scanner
  useBarcodeScanner((barcode) => {
    const product = products.find(p => p.barcode === barcode || p.code === barcode);
    if (product) {
      setSearchStatus("success");
      addToCart(product);
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
      stock: 99, // Simplified
      salePrice: c.price,
      costPrice: 0,
      reorderThreshold: 0,
      code: c.id
    } as Product));
    return [...products, ...combosAsProducts];
  }, [products, store.combos]);

  const filteredProducts = useMemo(() => {
    if (searchTerm.length < 3) return [];
    return searchableCatalog.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, searchableCatalog]);

  const filteredClients = useMemo(() => {
    if (clientSearch.length < 2) return [];
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.phone.includes(clientSearch)
    );
  }, [clientSearch, clients]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, isCombo: product.id.startsWith("c") }];
    });
    setSearchTerm("");
    setShowDropdown(false);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) return;
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Calculations & Volume Discount
  const subtotal = cart.reduce((sum, item) => {
    // Descuento automático por volumen: 10% de descuento si lleva 5 o más
    const volumeDiscount = item.quantity >= 5 ? 0.9 : 1;
    return sum + (item.product.salePrice * item.quantity * volumeDiscount);
  }, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  
  // Calculate IVA only for products with taxRate > 0
  const ivaAmount = cart.reduce((sum, item) => {
    const taxRate = item.product.taxRate || 0; // Default 0 if undefined
    return sum + (item.product.salePrice * item.quantity * (taxRate / 100));
  }, 0);

  const total = subtotal - discountAmount + ivaAmount;

  // Cash logic
  const numericReceived = Number(cashReceived);
  const isCashInsufficient = paymentMethod === "cash" && numericReceived < total && numericReceived > 0;
  const vuelto = paymentMethod === "cash" && numericReceived >= total ? numericReceived - total : 0;

  const finishSaleUi = (saleId: string) => {
    setLastSaleReceipt({
      saleId,
      date: new Date(),
      client: selectedClient,
      items: [...cart],
      subtotal,
      discountAmount,
      ivaAmount,
      total,
      paymentMethod,
      received: numericReceived,
      vuelto,
    });
    setCart([]);
    setDiscountPercent(0);
    setPaymentMethod("cash");
    setCashReceived("");
    setSelectedClient(null);
    setShowReceipt(true);
  };

  // Complete sale (API)
  const completeSale = () => {
    if (cart.length === 0) return;
    if (cart.some((item) => item.isCombo)) {
      toast.error("Los combos aún no están disponibles en la API.");
      return;
    }

    if (paymentMethod === "credit" && !selectedClient) {
      toast.error("Selecciona un cliente para dar crédito.");
      return;
    }
    if (paymentMethod === "credit" && selectedClient && total > selectedClient.creditBalance) {
      toast.error("Crédito insuficiente.");
      return;
    }
    if (paymentMethod === "cash" && (numericReceived < total || cashReceived === "")) {
      toast.error("Monto recibido insuficiente.");
      return;
    }

    const sale: Omit<Sale, "id"> = {
      date: new Date().toISOString().slice(0, 10),
      items: cart.map((item) => {
        const volumeDiscount = item.quantity >= 5 ? 0.9 : 1;
        return {
          productId: item.product.id,
          quantity: item.quantity,
          price: item.product.salePrice * volumeDiscount,
        };
      }),
      total,
      paymentMethod,
      ...(selectedClient ? { clientId: selectedClient.id } : {}),
    };

    createSale.mutate(
      { data: sale, discountPct: discountPercent },
      {
        onSuccess: (created) => {
          toast.success("Venta registrada");
          playSaleSuccessSound();
          finishSaleUi(created.id);
        },
        onError: (error) => toast.error(apiErrorMessage(error)),
      }
    );
  };

  // Check oil
  const isOilChangePending = (client: Client) => {
    if (!client.lastServiceDate) return false;
    const diffTime = Math.abs(new Date().getTime() - new Date(client.lastServiceDate).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 90; // Exceeded 3 months roughly
  };

  const handleExitTabletMode = async () => {
    setExitError("");
    if (!exitUsername || !exitPassword) {
      setExitError("Por favor ingrese usuario y contraseña");
      return;
    }
    
    setExitLoading(true);
    try {
      // 1. Get Token
      const formData = new URLSearchParams();
      formData.append("username", exitUsername);
      formData.append("password", exitPassword);
      
      const tokenRes = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString()
      });
      
      if (!tokenRes.ok) throw new Error("Credenciales inválidas");
      const { access_token } = await tokenRes.json();
      
      // 2. Verify Role
      const userRes = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/auth/users/me`, {
        headers: { "Authorization": `Bearer ${access_token}` }
      });
      
      if (!userRes.ok) throw new Error("Error verificando usuario");
      const user: AuthMeResponse = await userRes.json();
      
      if (user.role === "admin") {
        setTabletMode(false);
        setShowExitModal(false);
      } else {
        setExitError("El usuario no tiene permisos de administrador");
      }
    } catch (e: unknown) {
      setExitError(e instanceof Error ? e.message : "Error de autenticación");
    } finally {
      setExitLoading(false);
    }
  };

  // Cross-selling suggestions logic
  const suggestedProducts = useMemo(() => {
    if (cart.length === 0) return [];
    const inCartIds = new Set(cart.map(i => i.product.id));
    const suggestions: Product[] = [];
    
    cart.forEach(item => {
      const cat = item.product.category.toLowerCase();
      if (cat.includes("oil") || cat.includes("aceite")) {
        // Suggest Filters
        products.forEach(p => {
          if ((p.category.toLowerCase().includes("filter") || p.category.toLowerCase().includes("filtro")) && !inCartIds.has(p.id)) {
            suggestions.push(p);
          }
        });
      } else if (cat.includes("tire") || cat.includes("llanta")) {
        // Suggest Brakes or Chains
        products.forEach(p => {
          if ((p.category.toLowerCase().includes("brake") || p.category.toLowerCase().includes("freno")) && !inCartIds.has(p.id)) {
            suggestions.push(p);
          }
        });
      }
    });
    // Return max 3 unique suggestions
    const unique = Array.from(new Set(suggestions));
    return unique.slice(0, 3);
  }, [cart, products]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto h-[calc(100vh-80px)] md:h-auto overflow-y-auto">
      {tabletMode && (
        <Button 
          variant="destructive" 
          size="sm" 
          onClick={() => setShowExitModal(true)}
          className="fixed top-4 right-4 z-50 shadow-lg rounded-full"
        >
          <LogOut className="w-4 h-4 mr-2" /> Salir de Caja
        </Button>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("sales.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("sales.subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Lado Izquierdo: Buscador y Carrito (60%) */}
        <div className="w-full lg:w-[60%] flex flex-col gap-6">
          
          {/* Search Input */}
          <div className="relative">
            <div className={`relative flex items-center border-2 rounded-xl bg-background transition-colors ${searchStatus === "success" ? "border-success bg-success/5" : searchStatus === "error" ? "border-destructive bg-destructive/5" : "border-primary"}`}>
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
            
            {/* Dropdown Results */}
            {showDropdown && searchTerm.length >= 3 && (
              <div className="absolute top-full mt-2 w-full bg-card border border-border rounded-lg shadow-xl z-50 max-h-[300px] overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">No se encontraron productos.</div>
                ) : (
                  filteredProducts.map((p) => (
                    <div 
                      key={p.id} 
                      className={`p-3 border-b border-border hover:bg-muted/50 cursor-pointer flex justify-between items-center ${p.stock <= 0 ? 'opacity-60 bg-muted/20' : ''}`}
                      onMouseDown={() => addToCart(p)} // mousedown to trigger before blur
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

          {/* Cart Section */}
          <Card className="flex-1 border border-border shadow-sm">
            <CardHeader className="py-4 border-b border-border bg-muted/20">
              <CardTitle className="text-lg">Carrito de Compras</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {cart.length === 0 ? (
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
                        {cart.map((item) => (
                          <tr key={item.product.id} className="hover:bg-muted/20 animate-in fade-in slide-in-from-top-2 duration-200">
                            <td className="px-4 py-3">
                              <div className="font-medium text-sm leading-tight">{item.product.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{item.product.code}</div>
                            </td>
                            <td className="px-4 py-3 text-center w-32">
                              <div className={`flex items-center justify-center gap-1 ${item.quantity > item.product.stock ? 'bg-warning/20 border border-warning/50 rounded p-1' : ''}`}>
                                <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="p-1.5 hover:bg-muted rounded bg-background border border-border"><Minus className="w-3 h-3" /></button>
                                <input 
                                  type="number" 
                                  value={item.quantity} 
                                  onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                                  className="w-10 text-center font-bold bg-transparent outline-none p-0 border-none focus:ring-0" 
                                />
                                <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="p-1.5 hover:bg-muted rounded bg-background border border-border"><Plus className="w-3 h-3" /></button>
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
                              <button onClick={() => removeFromCart(item.product.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-full transition-colors">
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
                    {cart.map((item) => (
                      <div key={item.product.id} className="p-4 space-y-3 animate-in fade-in slide-in-from-left-2">
                        <div className="flex justify-between items-start gap-2">
                          <div className="font-bold text-sm leading-tight">{item.product.name}</div>
                          <div className="font-bold whitespace-nowrap">{formatCurrency(item.product.salePrice * item.quantity)}</div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className={`flex items-center gap-1 ${item.quantity > item.product.stock ? 'bg-warning/20 border border-warning/50 rounded' : ''}`}>
                            <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="h-11 w-11 flex items-center justify-center hover:bg-muted rounded border border-border active:bg-muted/50"><Minus className="w-5 h-5" /></button>
                            <input 
                              type="number" 
                              value={item.quantity} 
                              onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                              className="w-12 text-center font-bold text-lg bg-transparent border-none outline-none focus:ring-0" 
                            />
                            <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="h-11 w-11 flex items-center justify-center hover:bg-muted rounded border border-border active:bg-muted/50"><Plus className="w-5 h-5" /></button>
                          </div>
                          <button onClick={() => removeFromCart(item.product.id)} className="h-11 w-11 flex items-center justify-center text-destructive border border-destructive/30 rounded active:bg-destructive/10">
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

          {/* Sugerencias de Venta (Cross-Selling) */}
          {suggestedProducts.length > 0 && (
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
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addToCart(p)}>
                        Agregar
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>


        {/* Lado Derecho: Resumen y Pagos (40%) */}
        <div className="w-full lg:w-[40%] flex flex-col gap-6">
          
          {/* Client Selector */}
          <Card className="shadow-sm border-border">
            <CardHeader className="py-3 bg-muted/20 border-b border-border">
              <CardTitle className="text-sm flex justify-between items-center">
                <span>Cliente (Opcional)</span>
                {selectedClient && (
                  <button onClick={() => setSelectedClient(null)} className="text-xs font-normal text-muted-foreground hover:text-foreground flex items-center">
                    <X className="w-3 h-3 mr-1"/> Limpiar
                  </button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {!selectedClient ? (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nombre o teléfono..." 
                    className="pl-9"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                  {clientSearch.length >= 2 && (
                    <div className="absolute top-full mt-1 w-full bg-card border border-border rounded shadow-lg z-10 max-h-[200px] overflow-auto">
                      {filteredClients.map(c => (
                        <div key={c.id} className="p-2 border-b border-border hover:bg-muted cursor-pointer" onClick={() => { setSelectedClient(c); setClientSearch(""); }}>
                          <div className="font-bold text-sm">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.phone} | {c.motorcycleModel}</div>
                        </div>
                      ))}
                      {filteredClients.length === 0 && <div className="p-3 text-sm text-muted-foreground">No hay resultados.</div>}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="font-bold flex items-center gap-2">
                    {selectedClient.name}
                  </div>
                  <div className="text-sm text-muted-foreground">{selectedClient.motorcycleModel} | {selectedClient.phone}</div>
                  
                  {selectedClient.creditBalance > 0 && (
                    <div className="text-sm font-bold text-success flex items-center gap-1 mt-1">
                      <Wallet className="w-4 h-4"/> Crédito disponible: {formatCurrency(selectedClient.creditBalance)}
                    </div>
                  )}
                  
                  {isOilChangePending(selectedClient) && (
                    <div className="mt-2 bg-warning/10 border border-warning/30 p-2 rounded flex items-start gap-2 text-warning-foreground text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>Este cliente tiene cambio de aceite pendiente.</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
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
                    <input type="number" min="0" max="100" value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} className="w-12 h-6 px-1 border border-border rounded text-center text-xs bg-background" />
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
                  <Button variant={paymentMethod === "cash" ? "primary" : "outline"} onClick={() => setPaymentMethod("cash")} className="h-12 flex flex-col items-center justify-center gap-1">
                    <Banknote className="w-4 h-4"/> <span className="text-[10px] uppercase">Efectivo</span>
                  </Button>
                  <Button variant={paymentMethod === "card" ? "primary" : "outline"} onClick={() => setPaymentMethod("card")} className="h-12 flex flex-col items-center justify-center gap-1">
                    <CreditCard className="w-4 h-4"/> <span className="text-[10px] uppercase">Tarjeta</span>
                  </Button>
                  <Button variant={paymentMethod === "nequi" ? "primary" : "outline"} onClick={() => setPaymentMethod("nequi")} className="h-12 flex flex-col items-center justify-center gap-1">
                    <Smartphone className="w-4 h-4"/> <span className="text-[10px] uppercase">Nequi</span>
                  </Button>
                  <Button 
                    variant={paymentMethod === "credit" ? "primary" : "outline"} 
                    onClick={() => setPaymentMethod("credit")} 
                    disabled={!selectedClient}
                    className="h-12 flex flex-col items-center justify-center gap-1 disabled:opacity-50"
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
                      onChange={(v) => setCashReceived(v ? Number(v) : "")}
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
                onClick={completeSale} 
                className="w-full h-14 text-lg font-bold shadow-lg" 
                size="lg"
                disabled={
                  productsLoading ||
                  createSale.isPending ||
                  cart.length === 0 ||
                  (paymentMethod === "cash" && (numericReceived < total || cashReceived === "")) ||
                  (paymentMethod === "credit" && selectedClient && total > selectedClient.creditBalance)
                }
              >
                {createSale.isPending ? "Registrando…" : `Cobrar ${formatCurrency(total)}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* THERMAL RECEIPT MODAL */}
      <Modal open={showReceipt} onOpenChange={setShowReceipt} className="max-w-[400px]">
        {lastSaleReceipt && (
          <div className="flex flex-col h-full max-h-[85vh]">
            <div className="flex-1 overflow-y-auto px-4 py-6 bg-white text-black" id="receipt-print-area">
              <style dangerouslySetInnerHTML={{__html: `
                @media print {
                  body * { visibility: hidden; }
                  #receipt-print-area, #receipt-print-area * { visibility: visible; }
                  #receipt-print-area {
                    position: absolute; left: 0; top: 0;
                    width: 80mm; /* Thermal printer format */
                    padding: 0; margin: 0;
                  }
                  .no-print { display: none !important; }
                }
              `}} />
              
              {/* Receipt Content */}
              <div className="font-mono text-xs text-center space-y-1 border-b border-dashed border-gray-400 pb-4 mb-4">
                <h2 className="text-lg font-black uppercase">MotoStock</h2>
                <p>NIT: 900.123.456-7</p>
                <p>Av. Principal #45-20, Centro</p>
                <p>Tel: (604) 555-0123</p>
                <div className="mt-2 pt-2 border-t border-dashed border-gray-400">
                  <p>Factura: #{lastSaleReceipt.saleId}</p>
                  <p>Fecha: {lastSaleReceipt.date.toLocaleString('es-CO')}</p>
                  <p>Cajero: CAJA_01</p>
                </div>
              </div>

              <div className="font-mono text-xs mb-4">
                <p className="font-bold">Cliente:</p>
                <p>{lastSaleReceipt.client ? lastSaleReceipt.client.name : "CONSUMIDOR FINAL"}</p>
                {lastSaleReceipt.client && <p>CC/NIT: {lastSaleReceipt.client.id}</p>}
              </div>

              <table className="w-full font-mono text-[10px] mb-4">
                <thead className="border-b border-dashed border-gray-400">
                  <tr>
                    <th className="text-left py-1">CANT DESCRIPCIÓN</th>
                    <th className="text-right py-1">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-gray-200">
                  {lastSaleReceipt.items.map((item: CartItem, i: number) => (
                    <tr key={i}>
                      <td className="py-2 pr-2">
                        <div className="font-bold">{item.quantity}x {item.product.name}</div>
                        <div className="text-gray-500">@{formatCurrency(item.product.salePrice)}</div>
                      </td>
                      <td className="py-2 text-right align-top font-bold">
                        {formatCurrency(item.product.salePrice * item.quantity * (item.quantity >= 5 ? 0.9 : 1))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="font-mono text-xs border-t border-dashed border-gray-400 pt-2 space-y-1 text-right">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span>{formatCurrency(lastSaleReceipt.subtotal)}</span>
                </div>
                {lastSaleReceipt.discountAmount > 0 && (
                  <div className="flex justify-between text-black">
                    <span>DESCUENTO:</span>
                    <span>-{formatCurrency(lastSaleReceipt.discountAmount)}</span>
                  </div>
                )}
                {lastSaleReceipt.ivaAmount > 0 && (
                  <div className="flex justify-between">
                    <span>IVA:</span>
                    <span>{formatCurrency(lastSaleReceipt.ivaAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black mt-2 pt-2 border-t border-dashed border-gray-400">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(lastSaleReceipt.total)}</span>
                </div>
              </div>

              <div className="font-mono text-xs mt-4 space-y-1">
                <div className="flex justify-between">
                  <span>MÉTODO DE PAGO:</span>
                  <span className="uppercase">{t(`payment.${lastSaleReceipt.paymentMethod}`)}</span>
                </div>
                {lastSaleReceipt.paymentMethod === 'cash' && (
                  <>
                    <div className="flex justify-between">
                      <span>RECIBIDO:</span>
                      <span>{formatCurrency(lastSaleReceipt.received)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>CAMBIO/VUELTO:</span>
                      <span>{formatCurrency(lastSaleReceipt.vuelto)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="text-center font-mono text-[10px] mt-8 pt-4 border-t border-dashed border-gray-400">
                <p className="font-bold mb-1">¡GRACIAS POR SU COMPRA!</p>
                <p>Software POS por MotoStock</p>
                <p>Impreso el: {new Date().toLocaleString('es-CO')}</p>
              </div>
            </div>
            
            <div className="p-4 bg-muted/20 border-t border-border flex gap-3 no-print">
              <Button onClick={() => window.print()} className="flex-1">
                <Printer className="w-4 h-4 mr-2" /> Imprimir Recibo
              </Button>
              <Button variant="outline" onClick={() => setShowReceipt(false)} className="flex-1">
                Nueva Venta
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Exit Tablet Mode Auth Modal */}
      <Modal open={showExitModal} onOpenChange={setShowExitModal} title="Autenticación Requerida" className="max-w-[400px]">
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
            <Button variant="outline" onClick={() => setShowExitModal(false)} className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
