import React, { useState } from "react";
import { useNavigate } from "react-router";
import { 
  Plus, 
  Trash2, 
  ArrowLeft,
  Save,
  PackagePlus,
  Search
} from "lucide-react";
import { 
  useProducts, 
  useSuppliers, 
  useCreateOrder 
} from "../../../api/hooks";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { formatCurrency } from "../../../lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

export function PurchaseOrderCreatePage() {
  const navigate = useNavigate();
  const { data: products = [] } = useProducts();
  const { data: suppliers = [] } = useSuppliers();
  const createOrder = useCreateOrder();

  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [items, setItems] = useState<{ productId: string; quantity: number; unitCost: number }[]>([]);
  const [notes, setNotes] = useState("");

  const [currentProductId, setCurrentProductId] = useState("");
  const [currentQty, setCurrentQty] = useState(1);
  const [currentCost, setCurrentCost] = useState(0);

  const handleAddProduct = () => {
    if (!currentProductId || currentQty <= 0) return;
    
    const existingIndex = items.findIndex(i => i.productId === currentProductId);
    if (existingIndex >= 0) {
      const newItems = [...items];
      newItems[existingIndex].quantity += currentQty;
      setItems(newItems);
    } else {
      setItems([...items, { productId: currentProductId, quantity: currentQty, unitCost: currentCost }]);
    }
    
    setCurrentProductId("");
    setCurrentQty(1);
    setCurrentCost(0);
  };

  const handleProductSelect = (id: string) => {
    setCurrentProductId(id);
    const prod = products.find(p => String(p.id) === id);
    if (prod) {
      setCurrentCost(prod.costPrice);
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const total = items.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0);

  const handleSubmit = async () => {
    const supplier = suppliers.find(s => String(s.id) === selectedSupplierId);
    if (!supplier && !selectedSupplierId) {
      toast.error("Selecciona un proveedor");
      return;
    }

    if (items.length === 0) {
      toast.error("Agrega al menos un producto");
      return;
    }

    try {
      await createOrder.mutateAsync({
        supplier: supplier?.name || selectedSupplierId,
        supplierId: selectedSupplierId,
        date: format(new Date(), "yyyy-MM-dd"),
        items,
        notes
      });
      toast.success("Borrador de orden creado");
      navigate("/purchase-orders");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al crear orden");
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/purchase-orders")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-2xl font-bold">Nueva Orden de Compra</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información del Proveedor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Proveedor</label>
                <select
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                >
                  <option value="">Seleccionar proveedor...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Notas / Observaciones</label>
                <textarea
                  className="w-full mt-1 min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Instrucciones adicionales..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PackagePlus className="w-5 h-5" />
                Agregar Productos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                <div className="md:col-span-6">
                  <label className="text-xs font-medium text-muted-foreground">Producto</label>
                  <select
                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={currentProductId}
                    onChange={(e) => handleProductSelect(e.target.value)}
                  >
                    <option value="">Buscar producto...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Cant.</label>
                  <Input 
                    type="number" 
                    min={1} 
                    value={currentQty} 
                    onChange={(e) => setCurrentQty(parseInt(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="text-xs font-medium text-muted-foreground">Costo Unit.</label>
                  <Input 
                    type="number" 
                    value={currentCost} 
                    onChange={(e) => setCurrentCost(parseFloat(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-1">
                  <Button onClick={handleAddProduct} disabled={!currentProductId} className="w-full">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Separator className="my-4" />

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Cant.</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                        No hay productos agregados
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, index) => {
                      const prod = products.find(p => String(p.id) === item.productId);
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="font-medium">{prod?.name || "Producto"}</div>
                            <div className="text-xs text-muted-foreground">{prod?.code}</div>
                          </TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unitCost)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.quantity * item.unitCost)}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">Resumen de Orden</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Items únicos</span>
                <span>{items.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Unidades totales</span>
                <span>{items.reduce((acc, i) => acc + i.quantity, 0)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-4">
                <span>Total Estimado</span>
                <span className="text-blue-600">{formatCurrency(total)}</span>
              </div>
              <Button 
                className="w-full mt-4" 
                size="lg" 
                onClick={handleSubmit}
                disabled={createOrder.isPending || items.length === 0}
              >
                <Save className="w-4 h-4 mr-2" />
                {createOrder.isPending ? "Guardando..." : "Guardar Borrador"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
                <p className="text-xs text-yellow-800">
                  La orden se creará en estado <strong>BORRADOR</strong>. Deberás enviarla para aprobación antes de poder enviarla al proveedor.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
