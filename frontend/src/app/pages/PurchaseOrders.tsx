/**
 * Órdenes de compra conectadas a la API.
 */
import { useState } from "react";
import { Plus, Check, Clock, Package, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import type { PurchaseOrder } from "../lib/store";
import { formatCurrency, formatDate } from "../lib/utils";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { hasRoleAccess } from "../lib/rbac";
import {
  useProducts,
  useOrders,
  useCreateOrder,
  useUpdateOrderStatus,
  useSuppliers,
} from "../api/hooks";
import { toast } from "sonner";
import axios from "axios";
import { format } from "date-fns";

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

export function PurchaseOrders() {
  const { data: currentUser } = useCurrentUser();
  const canSeeCosts = hasRoleAccess(currentUser?.role, "supervisor");
  const { data: products = [] } = useProducts();
  const { data: suppliers = [] } = useSuppliers();
  const { data: orders = [], isLoading } = useOrders();
  const createOrder = useCreateOrder();
  const updateOrderStatus = useUpdateOrderStatus();

  const [showModal, setShowModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<
    { productId: string; quantity: number; cost: number }[]
  >([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supplier) {
      toast.error("Selecciona un proveedor");
      return;
    }
    if (selectedProducts.length === 0) {
      toast.error("Añade al menos un producto");
      return;
    }

    createOrder.mutate(
      {
        supplier: supplier.name,
        supplierId: supplier.id,
        date: format(new Date(), "yyyy-MM-dd"),
        items: selectedProducts,
      },
      {
        onSuccess: () => {
          toast.success("Orden de compra creada");
          setShowModal(false);
          resetForm();
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      }
    );
  };

  const resetForm = () => {
    setSelectedSupplierId("");
    setSelectedProducts([]);
    setSelectedProductId("");
    setQuantity(0);
  };

  const addProduct = () => {
    if (!selectedProductId || quantity <= 0) return;
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    const existing = selectedProducts.find((p) => p.productId === selectedProductId);
    if (existing) {
      setSelectedProducts(
        selectedProducts.map((p) =>
          p.productId === selectedProductId ? { ...p, quantity: p.quantity + quantity } : p
        )
      );
    } else {
      setSelectedProducts([
        ...selectedProducts,
        { productId: selectedProductId, quantity, cost: product.costPrice },
      ]);
    }
    setSelectedProductId("");
    setQuantity(0);
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter((p) => p.productId !== productId));
  };

  const handleStatusAction = (order: PurchaseOrder) => {
    const next: PurchaseOrder["status"] =
      order.status === "pending" ? "sent" : "received";
    updateOrderStatus.mutate(
      { id: order.id, status: next },
      {
        onSuccess: () => toast.success(next === "sent" ? "Marcada como enviada" : "Recibida — stock actualizado"),
        onError: (err) => toast.error(apiErrorMessage(err)),
      }
    );
  };

  const getStatusIcon = (status: PurchaseOrder["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "sent":
        return <Package className="w-4 h-4" />;
      case "received":
        return <Check className="w-4 h-4" />;
    }
  };

  const getStatusVariant = (status: PurchaseOrder["status"]) => {
    switch (status) {
      case "pending":
        return "warning" as const;
      case "sent":
        return "secondary" as const;
      case "received":
        return "success" as const;
    }
  };

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const sentCount = orders.filter((o) => o.status === "sent").length;
  const receivedCount = orders.filter((o) => o.status === "received").length;

  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1>Órdenes de compra</h1>
          <p className="text-muted-foreground mt-1">Gestión de pedidos a proveedores</p>
        </div>
        <Button onClick={() => setShowModal(true)} size="sm">
          <Plus className="w-4 h-4" />
          Nueva orden
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Enviadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">{sentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recibidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">{receivedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todas las órdenes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Sin órdenes de compra</p>
          ) : (
            <div className="space-y-4">
              {sortedOrders.map((order) => (
                <div key={order.id} className="p-4 border border-border rounded-lg">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3>
                          {suppliers.find((s) => s.id === order.supplierId)?.name ??
                            order.supplierId}
                        </h3>
                        <Badge variant={getStatusVariant(order.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(order.status)}
                            {order.status}
                          </span>
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Orden #{order.id} • {formatDate(order.date)}
                      </p>
                      <div className="space-y-1">
                        {order.items.map((item) => {
                          const product = products.find((p) => p.id === item.productId);
                          return (
                            <p key={item.productId} className="text-sm">
                              {product?.name ?? "Producto"} — {item.quantity} uds.
                              {canSeeCosts ? ` @ ${formatCurrency(item.cost)}` : ""}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="text-xl font-medium">{formatCurrency(order.total)}</p>
                      </div>
                      {order.status !== "received" && (
                        <Button
                          size="sm"
                          variant={order.status === "pending" ? "accent" : "primary"}
                          disabled={updateOrderStatus.isPending}
                          onClick={() => handleStatusAction(order)}
                        >
                          {order.status === "pending" ? "Marcar enviada" : "Marcar recibida"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={showModal} onOpenChange={setShowModal} title="Nueva orden de compra" className="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-2">Proveedor</label>
            <select
              required
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full rounded-lg border border-input bg-input-background px-3 py-2"
            >
              <option value="">Seleccionar proveedor…</option>
              {suppliers
                .filter((s) => s.isActive)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block mb-2">Productos</label>
            <div className="flex gap-2 mb-3">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="flex-1 rounded-lg border border-input bg-input-background px-3 py-2"
              >
                <option value="">Seleccionar producto…</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                    {canSeeCosts ? ` — ${formatCurrency(product.costPrice)}` : ""}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min="1"
                value={quantity || ""}
                onChange={(e) => setQuantity(Number(e.target.value))}
                placeholder="Cant."
                className="w-24"
              />
              <Button type="button" onClick={addProduct} variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="border border-border rounded-lg p-3 space-y-2">
              {selectedProducts.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Sin productos</p>
              ) : (
                selectedProducts.map((item) => {
                  const product = products.find((p) => p.id === item.productId);
                  return (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between p-2 bg-muted rounded"
                    >
                      <div>
                        <p className="font-medium">{product?.name}</p>
                        {canSeeCosts && (
                          <p className="text-sm text-muted-foreground">
                            {item.quantity} × {formatCurrency(item.cost)} ={" "}
                            {formatCurrency(item.quantity * item.cost)}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProduct(item.productId)}
                      >
                        Quitar
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1" disabled={createOrder.isPending}>
              {createOrder.isPending ? "Creando…" : "Crear orden"}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setShowModal(false); resetForm(); }}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
