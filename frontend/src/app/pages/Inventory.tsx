/**
 * Fase 2: inventario conectado a la API (React Query); Zustand solo para UI local.
 */
import { useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Search, Printer, RefreshCw, Loader2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { store, type Product } from "../lib/store";
import { formatCurrency } from "../lib/utils";
import { useLanguage } from "../lib/i18n";
import { useInventorySelection } from "../hooks/useInventorySelection";
import { api } from "../api/client";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "../api/hooks";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { hasRoleAccess } from "../lib/rbac";
import { toast } from "sonner";
import axios from "axios";

function Spinner() {
  return (
    <div className="flex justify-center items-center py-16" role="status" aria-label="Cargando">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
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

export function Inventory() {
  const { t, language } = useLanguage();
  const { data: currentUser } = useCurrentUser();
  const canSeeCosts = hasRoleAccess(currentUser?.role, "supervisor");
  const canDelete = hasRoleAccess(currentUser?.role, "supervisor");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedIds, toggleOne, toggleAll, isSelected, count, clearSelection } =
    useInventorySelection();

  const { data: products = [], isLoading, isError, error } = useProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
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

  useEffect(() => {
    if (isError) {
      toast.error(apiErrorMessage(error));
    }
  }, [isError, error]);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products]
  );
  const brands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(),
    [products]
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q);
        const matchesCategory = !categoryFilter || p.category === categoryFilter;
        const matchesBrand = !brandFilter || p.brand === brandFilter;
        return matchesSearch && matchesCategory && matchesBrand;
      }),
    [products, searchTerm, categoryFilter, brandFilter]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await updateProduct.mutateAsync({ id: editingProduct.id, data: formData });
        toast.success(t("inventory.editProduct") || "Producto actualizado");
        setEditingProduct(null);
      } else {
        await createProduct.mutateAsync(formData);
        toast.success(t("inventory.addProduct") || "Producto creado");
      }
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!editingProduct || !canDelete) return;
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      await deleteProduct.mutateAsync(editingProduct.id);
      toast.success("Producto eliminado");
      setShowAddModal(false);
      setEditingProduct(null);
      resetForm();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
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
    if (product.stock === 0)
      return { variant: "destructive" as const, label: t("stock.outOfStock") };
    if (product.stock <= product.reorderThreshold / 2)
      return { variant: "destructive" as const, label: t("stock.critical") };
    if (product.stock <= product.reorderThreshold)
      return { variant: "warning" as const, label: t("stock.lowStock") };
    return { variant: "success" as const, label: t("stock.inStock") };
  };

  const autoGenerateRestock = () => {
    const lowStockProducts = products.filter((p) => p.stock <= p.reorderThreshold);
    if (lowStockProducts.length === 0) {
      toast.info(
        language === "es"
          ? "No hay productos que necesiten reposición"
          : "No products need restocking"
      );
      return;
    }

    const items = lowStockProducts.map((p) => ({
      productId: p.id,
      quantity: p.reorderThreshold * 2,
      cost: p.costPrice,
    }));

    const total = items.reduce((sum, item) => sum + item.quantity * item.cost, 0);

    store.addPurchaseOrder({
      supplierId: "auto-restock",
      items,
      status: "pending",
      date: new Date().toISOString().split("T")[0] ?? "",
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
      const selectedProducts = products.filter(
        (p) => selectedIds.has(p.id) && !p.barcode
      );
      for (const p of selectedProducts) {
        await api.generateBarcode(Number(p.id));
      }
    },
    onSuccess: () => {
      toast.success("Códigos generados exitosamente");
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      clearSelection();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const generateSingleBarcode = async (productId: string) => {
    try {
      await api.generateBarcode(Number(productId));
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Código generado");
    } catch (e) {
      toast.error("Error al generar código: " + apiErrorMessage(e));
    }
  };

  const allFilteredIds = filteredProducts.map((p) => p.id);
  const isAllSelected =
    filteredProducts.length > 0 && filteredProducts.every((p) => isSelected(p.id));

  const isSaving =
    createProduct.isPending || updateProduct.isPending || deleteProduct.isPending;

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
          <Button
            onClick={() => {
              resetForm();
              setEditingProduct(null);
              setShowAddModal(true);
            }}
            size="sm"
          >
            <Plus className="w-4 h-4" />
            {t("btn.addProduct")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-5 h-5 text-muted-foreground shrink-0" />
              <Input
                placeholder={t("inventory.search")}
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-input bg-input-background px-3 py-2 text-sm min-w-[140px]"
              aria-label={t("inventory.category")}
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="rounded-lg border border-input bg-input-background px-3 py-2 text-sm min-w-[140px]"
              aria-label={t("inventory.brand")}
            >
              <option value="">Todas las marcas</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Spinner />
          ) : (
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
                    {canSeeCosts && (
                      <th className="text-right py-3 px-2">{t("inventory.costPrice")}</th>
                    )}
                    <th className="text-center py-3 px-2">{t("common.status")}</th>
                    <th className="text-right py-3 px-2">{t("clients.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const status = getStockStatus(product);
                    return (
                      <tr
                        key={product.id}
                        className="border-b border-border hover:bg-muted/50"
                      >
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
                            <Badge
                              variant="warning"
                              className="cursor-pointer"
                              onClick={() => generateSingleBarcode(product.id)}
                            >
                              Sin código
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-2 font-medium">{product.name}</td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {product.category}
                        </td>
                        <td className="py-3 px-2">{product.brand}</td>
                        <td className="py-3 px-2 text-right font-medium">
                          {product.stock}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {formatCurrency(product.salePrice)}
                        </td>
                        {canSeeCosts && (
                          <td className="py-3 px-2 text-right text-muted-foreground">
                            {formatCurrency(product.costPrice)}
                          </td>
                        )}
                        <td className="py-3 px-2 text-center">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(product)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredProducts.length === 0 && !isLoading && (
                <p className="text-center text-muted-foreground py-8">
                  {t("inventory.noProducts")}
                </p>
              )}
            </div>
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("inventory.enterProductName")}
              />
            </div>
            <div>
              <label className="block mb-2">{t("inventory.productCode")}</label>
              <Input
                required
                value={formData.code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, code: e.target.value })}
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, category: e.target.value })}
                placeholder={t("inventory.enterCategory")}
              />
            </div>
            <div>
              <label className="block mb-2">{t("inventory.brand")}</label>
              <Input
                required
                value={formData.brand}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, brand: e.target.value })}
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
                onChange={(e) =>
                  setFormData({ ...formData, stock: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <label className="block mb-2">{t("inventory.reorderThreshold")}</label>
              <Input
                type="number"
                required
                min="1"
                value={formData.reorderThreshold}
                onChange={(e) =>
                  setFormData({ ...formData, reorderThreshold: Number(e.target.value) })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, salePrice: Number(e.target.value) })
                }
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
                  onChange={(e) =>
                    setFormData({ ...formData, costPrice: Number(e.target.value) })
                  }
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1" disabled={isSaving}>
              {isSaving
                ? "Guardando…"
                : editingProduct
                  ? t("btn.updateProduct")
                  : t("btn.addProduct")}
            </Button>
            {editingProduct && canDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSaving}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                resetForm();
                setEditingProduct(null);
              }}
            >
              {t("btn.cancel")}
            </Button>
          </div>
        </form>
      </Modal>

      {count > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 shadow-lg flex items-center justify-between z-50">
          <div className="font-medium">
            {count} producto{count !== 1 ? "s" : ""} seleccionado{count !== 1 ? "s" : ""}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => bulkGenerateMutation.mutate()}
              disabled={bulkGenerateMutation.isPending}
            >
              {bulkGenerateMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
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
