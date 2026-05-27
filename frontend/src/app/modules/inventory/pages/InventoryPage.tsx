import { useEffect, useCallback } from "react";
import { Plus, Printer, RefreshCw, Loader2 } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import axios from "axios";

import { Card, CardContent, CardHeader } from "@shared/ui/Card";
import { Button } from "@shared/ui/Button";
import { store, Product } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { useInventorySelection } from "@/hooks/useInventorySelection";
import { useProducts } from "@/api/hooks";
import { useAuth, Can } from "@/lib/auth-rbac";

// Module imports
import { useInventoryFilters } from "../hooks/useInventoryFilters";
import { useInventoryForm } from "../hooks/useInventoryForm";
import { InventoryTable } from "../components/InventoryTable";
import { InventoryFilters } from "../components/InventoryFilters";
import { InventoryFormModal } from "../components/InventoryFormModal";
import { StockStatus } from "../types";

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

export function InventoryPage() {
  const { t, language } = useLanguage();
  const { hasPermission } = useAuth();
  const canSeeCosts = hasPermission("inventory:viewCosts");
  const canDelete = hasPermission("inventory:delete");
  const navigate = useNavigate();

  const { selectedIds, toggleOne, toggleAll, isSelected, clearSelection } = useInventorySelection();
  const { data: products = [], isLoading, isError, error } = useProducts();

  const filters = useInventoryFilters(products);
  const form = useInventoryForm(t);

  useEffect(() => {
    if (isError) {
      toast.error(apiErrorMessage(error));
    }
  }, [isError, error]);

  const getStockStatus = useCallback((product: Product): StockStatus => {
    if (product.stock === 0)
      return { variant: "destructive", label: t("stock.outOfStock") };
    if (product.stock <= product.reorderThreshold / 2)
      return { variant: "destructive", label: t("stock.critical") };
    if (product.stock <= product.reorderThreshold)
      return { variant: "warning", label: t("stock.lowStock") };
    return { variant: "success", label: t("stock.inStock") };
  }, [t]);

  const autoGenerateRestock = useCallback(() => {
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
      date: new Date().toISOString().split("T")[0],
      total,
    });

    toast.success(
      language === "es"
        ? `Generada orden de compra para ${lowStockProducts.length} productos`
        : `Generated purchase order for ${lowStockProducts.length} products`
    );
  }, [products, language]);

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
            <Button onClick={form.openAdd} className="gap-2">
              <Plus className="w-4 h-4" />
              {t("inventory.addProduct")}
            </Button>
          </Can>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <InventoryFilters 
            searchTerm={filters.searchTerm}
            onSearchChange={filters.setSearchTerm}
            categoryFilter={filters.categoryFilter}
            onCategoryFilterChange={filters.setCategoryFilter}
            brandFilter={filters.brandFilter}
            onBrandFilterChange={filters.setBrandFilter}
            categories={filters.categories}
            brands={filters.brands}
            t={t}
          />
        </CardHeader>
        <CardContent>
          <InventoryTable 
            products={filters.filteredProducts}
            selectedIds={selectedIds}
            toggleOne={toggleOne}
            toggleAll={toggleAll}
            isSelected={isSelected}
            onEdit={form.openEdit}
            canSeeCosts={canSeeCosts}
            getStockStatus={getStockStatus}
            t={t}
          />
          {filters.filteredProducts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {filters.searchTerm ? t("inventory.noResults") : t("inventory.empty")}
            </div>
          )}
        </CardContent>
      </Card>

      <InventoryFormModal 
        isOpen={form.showModal}
        onClose={() => form.setShowModal(false)}
        editingProduct={form.editingProduct}
        formData={form.formData}
        setFormData={form.setFormData}
        onSubmit={form.handleSubmit}
        onDelete={form.handleDelete}
        isPending={form.isPending}
        canSeeCosts={canSeeCosts}
        canDelete={canDelete}
        t={t}
      />
    </div>
  );
}
