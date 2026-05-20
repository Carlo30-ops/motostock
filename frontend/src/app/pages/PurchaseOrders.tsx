import { useState } from "react";
import { Plus, Check, Clock, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { store, PurchaseOrder } from "../lib/store";
import { formatCurrency, formatDate } from "../lib/utils";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { hasRoleAccess } from "../lib/rbac";

export function PurchaseOrders() {
  const { data: currentUser } = useCurrentUser();
  const canSeeCosts = hasRoleAccess(currentUser?.role, "supervisor");
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    supplierId: "",
    selectedProducts: [] as { productId: string; quantity: number; cost: number }[],
  });
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.selectedProducts.length === 0) {
      alert("Please add at least one product");
      return;
    }

    const total = formData.selectedProducts.reduce((sum, item) => sum + item.quantity * item.cost, 0);

    store.addPurchaseOrder({
      supplierId: formData.supplierId,
      items: formData.selectedProducts,
      status: "pending",
      date: new Date().toISOString().split("T")[0],
      total,
    });

    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      supplierId: "",
      selectedProducts: [],
    });
    setSelectedProductId("");
    setQuantity(0);
  };

  const addProduct = () => {
    if (!selectedProductId || quantity <= 0) return;

    const product = store.products.find((p) => p.id === selectedProductId);
    if (!product) return;

    const existing = formData.selectedProducts.find((p) => p.productId === selectedProductId);
    if (existing) {
      setFormData({
        ...formData,
        selectedProducts: formData.selectedProducts.map((p) =>
          p.productId === selectedProductId ? { ...p, quantity: p.quantity + quantity } : p
        ),
      });
    } else {
      setFormData({
        ...formData,
        selectedProducts: [
          ...formData.selectedProducts,
          { productId: selectedProductId, quantity, cost: product.costPrice },
        ],
      });
    }

    setSelectedProductId("");
    setQuantity(0);
  };

  const removeProduct = (productId: string) => {
    setFormData({
      ...formData,
      selectedProducts: formData.selectedProducts.filter((p) => p.productId !== productId),
    });
  };

  const markAsReceived = (orderId: string) => {
    store.receivePurchaseOrder(orderId);
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

  const pendingCount = store.purchaseOrders.filter((o) => o.status === "pending").length;
  const sentCount = store.purchaseOrders.filter((o) => o.status === "sent").length;
  const receivedCount = store.purchaseOrders.filter((o) => o.status === "received").length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1>Purchase Orders</h1>
          <p className="text-muted-foreground mt-1">Manage supplier orders and inventory restocking</p>
        </div>
        <Button onClick={() => setShowModal(true)} size="sm">
          <Plus className="w-4 h-4" />
          New Order
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pending</CardTitle>
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="w-5 h-5 text-warning" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">{pendingCount}</div>
            <p className="text-sm text-muted-foreground mt-1">Awaiting confirmation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Sent</CardTitle>
              <div className="p-2 rounded-lg bg-secondary/10">
                <Package className="w-5 h-5 text-secondary" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">{sentCount}</div>
            <p className="text-sm text-muted-foreground mt-1">In transit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Received</CardTitle>
              <div className="p-2 rounded-lg bg-success/10">
                <Check className="w-5 h-5 text-success" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">{receivedCount}</div>
            <p className="text-sm text-muted-foreground mt-1">Completed</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {store.purchaseOrders
              .slice()
              .reverse()
              .map((order) => {
                const supplier = store.suppliers.find(s => s.id === order.supplierId);
                return (
                <div key={order.id} className="p-4 border border-border rounded-lg">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3>{supplier?.name || "Proveedor desconocido"}</h3>
                        <Badge variant={getStatusVariant(order.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(order.status)}
                            {order.status}
                          </span>
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Order #{order.id} • {formatDate(order.date)}
                      </p>
                      <div className="space-y-1">
                        {order.items.map((item) => {
                          const product = store.products.find((p) => p.id === item.productId);
                          return (
                            <p key={item.productId} className="text-sm">
                              {product?.name} - {item.quantity} units{canSeeCosts ? ` @ ${formatCurrency(item.cost)}` : ""}
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
                          onClick={() => {
                            if (order.status === "pending") {
                              store.updatePurchaseOrderStatus(order.id, "sent");
                            } else {
                              markAsReceived(order.id);
                            }
                          }}
                        >
                          {order.status === "pending" ? "Mark as Sent" : "Mark as Received"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            {store.purchaseOrders.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No purchase orders yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Modal open={showModal} onOpenChange={setShowModal} title="Create Purchase Order" className="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-2">Proveedor</label>
            <select
              required
              value={formData.supplierId}
              onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
              className="w-full p-2 border border-input rounded-lg bg-input-background"
            >
              <option value="">Selecciona un proveedor...</option>
              {store.suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name} - {s.contactName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-2">Add Products</label>
            <div className="flex gap-2 mb-3">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="flex-1 rounded-lg border border-input bg-input-background px-3 py-2"
              >
                <option value="">Select a product...</option>
                {store.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}{canSeeCosts ? ` - ${formatCurrency(product.costPrice)}` : ""}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min="1"
                value={quantity || ""}
                onChange={(e) => setQuantity(Number(e.target.value))}
                placeholder="Qty"
                className="w-24"
              />
              <Button type="button" onClick={addProduct} variant="outline">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="border border-border rounded-lg p-3 space-y-2">
              {formData.selectedProducts.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No products added</p>
              ) : (
                formData.selectedProducts.map((item) => {
                  const product = store.products.find((p) => p.id === item.productId);
                  return (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between p-2 bg-muted rounded"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{product?.name}</p>
                        {canSeeCosts && (
                          <p className="text-sm text-muted-foreground">
                            {item.quantity} units × {formatCurrency(item.cost)} = {formatCurrency(item.quantity * item.cost)}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProduct(item.productId)}
                      >
                        Remove
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {formData.selectedProducts.length > 0 && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">Order Total</span>
                <span className="text-xl font-medium text-primary">
                  {formatCurrency(
                    formData.selectedProducts.reduce((sum, item) => sum + item.quantity * item.cost, 0)
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              Create Order
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
