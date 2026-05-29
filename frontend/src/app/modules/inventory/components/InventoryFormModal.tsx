import { Loader2, Trash2 } from "lucide-react";
import { Modal } from "@shared/ui/modal";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Product } from "@/lib/store";
import { InventoryFormData } from "../types";

interface InventoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: Product | null;
  formData: InventoryFormData;
  setFormData: (data: InventoryFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onDelete: () => void;
  isPending: boolean;
  canSeeCosts: boolean;
  canDelete: boolean;
  t: (key: string) => string;
}

export function InventoryFormModal({
  isOpen,
  onClose,
  editingProduct,
  formData,
  setFormData,
  onSubmit,
  onDelete,
  isPending,
  canSeeCosts,
  canDelete,
  t
}: InventoryFormModalProps) {
  return (
    <Modal
      open={isOpen}
      onOpenChange={onClose}
      title={editingProduct ? t("inventory.editProduct") : t("inventory.addProduct")}
    >
      <form onSubmit={onSubmit} className="space-y-4">
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
          {canSeeCosts && (
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
          )}
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
            {canDelete && editingProduct && (
              <Button type="button" variant="destructive" onClick={onDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("common.save")}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
