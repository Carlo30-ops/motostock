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
import { useAuth, Can } from "../lib/auth-rbac";
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
  const { hasPermission } = useAuth();
  const canSeeCosts = hasPermission("inventory:viewCosts");
  const canEdit = hasPermission("inventory:edit");
  const canDelete = hasPermission("inventory:delete");
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
      supplierId: "sup1",
      items,
      status: "pending",
      date: new Date().toISOString().split("T")[0] as string,
      total,
    });

    toast.success(
      language === "es"
        ? `Generada orden de compra para ${lowStockProducts.length} productos`
        : `Generated purchase order for ${lowStockProducts.length} products`
    );
  };

  if (isLoading) return <Spinner />;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("inventory.title")}</h1>
          <p className="text-muted-foreground">{t("inventory.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Can permission="inventory:adjustStock">
            <Button variant="outline" onClick={autoGenerateRestock} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Repo. Automática</span>
            </Button>
          </Can>
          <Button variant="outline" onClick={() => navigate("/inventory/labels")} className="gap-2">
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">{t("inventory.labels")}</span>
          </Button>
          <Can permission="inventory:edit">
            <Button
              onClick={() => {
                setEditingProduct(null);
                resetForm();
                setShowAddModal(true);
              }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              {t("inventory.addProduct")}
            </Button>
          </Can>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("inventory.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="flex h-10 w-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">{t("inventory.allCategories")}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className="flex h-10 w-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
              >
                <option value="">{t("inventory.allBrands")}</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium w-10">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={products.length > 0 && selectedIds.length === products.length}
                      onChange={() => toggleAll(products.map((p) => p.id))}
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium">{t("inventory.code")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("inventory.product")}</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">
                    {t("inventory.category")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">{t("inventory.stock")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("inventory.price")}</th>
                  <th className="px-4 py-3 text-right font-medium w-20">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredProducts.map((product) => {
                  const status = getStockStatus(product);
                  return (
                    <tr
                      key={product.id}
                      className={cn(
                        "hover:bg-muted/50 transition-colors",
                        isSelected(product.id) && "bg-muted"
                      )}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={isSelected(product.id)}
                          onChange={() => toggleOne(product.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{product.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{product.name}</div>
                        <div className="text-xs text-muted-foreground md:hidden">
                          {product.category} • {product.brand}
                        </div>
                        <div className="text-xs text-muted-foreground hidden md:block">
                          {product.brand}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">{product.category}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-medium">{product.stock}</span>
                          <Badge variant={status.variant} className="text-[10px] px-1.5 py-0">
                            {status.label}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium">{formatCurrency(product.salePrice)}</div>
                        <Can permission="inventory:viewCosts">
                          <div className="text-[10px] text-muted-foreground">
                            Costo: {formatCurrency(product.costPrice)}
                          </div>
                        </Can>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Can permission="inventory:edit">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(product)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="w-4 h-4" />
                            <span className="sr-only">Editar</span>
                          </Button>
                        </Can>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? t("inventory.noResults") : t("inventory.empty")}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editingProduct ? t("inventory.editProduct") : t("inventory.addProduct")}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-medium">{t("inventory.productName")}</label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("inventory.code")}</label>
              <Input
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("inventory.brand")}</label>
              <Input
                required
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("inventory.category")}</label>
              <Input
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("inventory.stock")}</label>
              <Input
                type="number"
                required
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("inventory.salePrice")}</label>
              <Input
                type="number"
                step="0.01"
                required
                value={formData.salePrice}
                onChange={(e) => setFormData({ ...formData, salePrice: parseFloat(e.target.value) })}
              />
            </div>
            <Can permission="inventory:viewCosts">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("inventory.costPrice")}</label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) })}
                />
              </div>
            </Can>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("inventory.reorderThreshold")}</label>
              <Input
                type="number"
                required
                value={formData.reorderThreshold}
                onChange={(e) =>
                  setFormData({ ...formData, reorderThreshold: parseInt(e.target.value) })
                }
              />
            </div>
          </div>
          <div className="flex justify-between gap-3 pt-4">
            <div>
              <Can permission="inventory:delete">
                {editingProduct && (
                  <Button type="button" variant="destructive" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar
                  </Button>
                )}
              </Can>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
                {(createProduct.isPending || updateProduct.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {t("common.save")}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
