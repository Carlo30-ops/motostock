import { useState } from "react";
import { Plus, Edit2, Search, Printer, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { store, Product } from "../lib/store";
import { formatCurrency } from "../lib/utils";
import { useLanguage } from "../lib/i18n";
import { useInventorySelection } from "../hooks/useInventorySelection";
import { api } from "../api/client";
import { useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { hasRoleAccess } from "../lib/rbac";
import { toast } from "sonner";

export function Inventory() {
  const { t, language } = useLanguage();
  const { data: currentUser } = useCurrentUser();
  const canSeeCosts = hasRoleAccess(currentUser?.role, "supervisor");
  const navigate = useNavigate();
  const { selectedIds, toggleOne, toggleAll, isSelected, count, clearSelection } = useInventorySelection();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    brand: "",
    stock: 0,
    salePrice: 0,
    costPrice: 0,
    reorderThreshold: 10,
    code: "",
  });

  const filteredProducts = store.products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      store.updateProduct(editingProduct.id, formData);
      setEditingProduct(null);
    } else {
      store.addProduct(formData);
    }
    setShowAddModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      brand: "",
      stock: 0,
      salePrice: 0,
      costPrice: 0,
      reorderThreshold: 10,
      code: "",
    });
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      brand: product.brand,
      stock: product.stock,
      salePrice: product.salePrice,
      costPrice: product.costPrice,
      reorderThreshold: product.reorderThreshold,
      code: product.code,
    });
    setShowAddModal(true);
  };

  const getStockStatus = (product: Product) => {
    if (product.stock === 0) return { variant: "destructive" as const, label: t("stock.outOfStock") };
    if (product.stock <= product.reorderThreshold / 2) return { variant: "destructive" as const, label: t("stock.critical") };
    if (product.stock <= product.reorderThreshold) return { variant: "warning" as const, label: t("stock.lowStock") };
    return { variant: "success" as const, label: t("stock.inStock") };
  };

  const autoGenerateRestock = () => {
    const lowStockProducts = store.getLowStockProducts();
    if (lowStockProducts.length === 0) {
      toast.info(language === "es" ? "No hay productos que necesiten reposición" : "No products need restocking");
      return;
    }

    const items = lowStockProducts.map((p) => ({
      productId: p.id,
      quantity: p.reorderThreshold * 2,
      cost: p.costPrice,
    }));

    const total = items.reduce((sum, item) => sum + item.quantity * item.cost, 0);

    store.addPurchaseOrder({
      supplier: language === "es" ? "Orden Auto-generada" : "Auto-generated Order",
      items,
      status: "pending",
      date: new Date().toISOString().split("T")[0],
      total,
    });

    toast.success(
      language === "es"
        ? `Orden de reposición creada para ${lowStockProducts.length} productos`
        : `Restock order created for ${lowStockProducts.length} products`
    );
  };

  const handlePrintLabels = () => {
    navigate(`/inventory/labels?ids=${Array.from(selectedIds).join(",")}`);
  };

  const bulkGenerateMutation = useMutation({
    mutationFn: async () => {
      // Custom bulk generate for only selected items without barcode
      const selectedProducts = store.products.filter(p => selectedIds.has(p.id) && !p.barcode);
      for (const p of selectedProducts) {
        try {
          const res = await api.generateBarcode(Number(p.id));
          store.updateProduct(p.id, { ...p, barcode: res.barcode });
        } catch (e) {
          console.error("Error generating barcode for", p.id);
        }
      }
    },
    onSuccess: () => {
      toast.success("Códigos generados exitosamente");
      clearSelection();
    }
  });

  const generateSingleBarcode = async (productId: string) => {
    try {
      const res = await api.generateBarcode(Number(productId));
      store.updateProduct(productId, { barcode: res.barcode });
    } catch (e) {
      toast.error("Error al generar código: " + String(e));
    }
  };

  const allFilteredIds = filteredProducts.map(p => p.id);
  const isAllSelected = filteredProducts.length > 0 && filteredProducts.every(p => isSelected(p.id));

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1>{t("inventory.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("inventory.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={autoGenerateRestock} variant="accent" size="sm">
            {t("btn.autoRestock")}
          </Button>
          <Button onClick={() => { resetForm(); setEditingProduct(null); setShowAddModal(true); }} size="sm">
            <Plus className="w-4 h-4" />
            {t("btn.addProduct")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-muted-foreground" />
            <Input
              placeholder={t("inventory.search")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 w-10">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 cursor-pointer"
                      checked={isAllSelected}
                      onChange={() => toggleAll(allFilteredIds)}
                    />
                  </th>
                  <th className="text-left py-3 px-2">{t("common.code")}</th>
                  <th className="text-left py-3 px-2">Cód. Barra</th>
                  <th className="text-left py-3 px-2">{t("common.product")}</th>
                  <th className="text-left py-3 px-2">{t("inventory.category")}</th>
                  <th className="text-left py-3 px-2">{t("inventory.brand")}</th>
                  <th className="text-right py-3 px-2">{t("inventory.stock")}</th>
                  <th className="text-right py-3 px-2">{t("inventory.salePrice")}</th>
                  {canSeeCosts && <th className="text-right py-3 px-2">{t("inventory.costPrice")}</th>}
                  <th className="text-center py-3 px-2">{t("common.status")}</th>
                  <th className="text-right py-3 px-2">{t("clients.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const status = getStockStatus(product);
                  return (
                    <tr key={product.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-2 text-center">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 cursor-pointer"
                          checked={isSelected(product.id)}
                          onChange={() => toggleOne(product.id)}
                        />
                      </td>
                      <td className="py-3 px-2 font-mono text-sm">{product.code}</td>
                      <td className="py-3 px-2">
                        {product.barcode ? (
                          <span className="font-mono text-xs">{product.barcode}</span>
                        ) : (
                          <Badge variant="warning" className="cursor-pointer" onClick={() => generateSingleBarcode(product.id)}>
                            Sin código
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-2 font-medium">{product.name}</td>
                      <td className="py-3 px-2 text-muted-foreground">{product.category}</td>
                      <td className="py-3 px-2">{product.brand}</td>
                      <td className="py-3 px-2 text-right font-medium">{product.stock}</td>
                      <td className="py-3 px-2 text-right">{formatCurrency(product.salePrice)}</td>
                      {canSeeCosts && (
                        <td className="py-3 px-2 text-right text-muted-foreground">{formatCurrency(product.costPrice)}</td>
                      )}
                      <td className="py-3 px-2 text-center">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(product)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredProducts.length === 0 && (
            <p className="text-center text-muted-foreground py-8">{t("inventory.noProducts")}</p>
          )}
        </CardContent>
      </Card>

      <Modal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        title={editingProduct ? t("inventory.editProduct") : t("inventory.addProduct")}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">{t("inventory.productName")}</label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("inventory.enterProductName")}
              />
            </div>
            <div>
              <label className="block mb-2">{t("inventory.productCode")}</label>
              <Input
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder={t("inventory.enterCode")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">{t("inventory.category")}</label>
              <Input
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder={t("inventory.enterCategory")}
              />
            </div>
            <div>
              <label className="block mb-2">{t("inventory.brand")}</label>
              <Input
                required
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder={t("inventory.enterBrand")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">{t("inventory.stockQuantity")}</label>
              <Input
                type="number"
                required
                min="0"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block mb-2">{t("inventory.reorderThreshold")}</label>
              <Input
                type="number"
                required
                min="1"
                value={formData.reorderThreshold}
                onChange={(e) => setFormData({ ...formData, reorderThreshold: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">{t("inventory.salePrice")}</label>
              <Input
                type="number"
                step="0.01"
                required
                min="0"
                value={formData.salePrice}
                onChange={(e) => setFormData({ ...formData, salePrice: Number(e.target.value) })}
              />
            </div>
            {canSeeCosts && (
              <div>
                <label className="block mb-2">{t("inventory.costPrice")}</label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              {editingProduct ? t("btn.updateProduct") : t("btn.addProduct")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setShowAddModal(false); resetForm(); setEditingProduct(null); }}
            >
              {t("btn.cancel")}
            </Button>
          </div>
        </form>
      </Modal>

      {count > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 shadow-lg flex items-center justify-between z-50">
          <div className="font-medium">
            {count} producto{count !== 1 ? 's' : ''} seleccionado{count !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => bulkGenerateMutation.mutate()} disabled={bulkGenerateMutation.isPending}>
              {bulkGenerateMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Generar códigos faltantes
            </Button>
            <Button onClick={handlePrintLabels}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimir etiquetas
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
