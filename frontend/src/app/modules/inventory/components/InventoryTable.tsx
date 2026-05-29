import { Edit2 } from "lucide-react";
import { Product } from "@/lib/store";
import { formatCurrency, cn } from "@/lib/utils";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Can } from "@/lib/auth-rbac";
import { StockStatus } from "../types";

interface InventoryTableProps {
  products: Product[];
  selectedIds: string[];
  toggleOne: (id: string) => void;
  toggleAll: (ids: string[]) => void;
  isSelected: (id: string) => boolean;
  onEdit: (product: Product) => void;
  canSeeCosts: boolean;
  getStockStatus: (product: Product) => StockStatus;
  t: (key: string) => string;
}

export function InventoryTable({
  products,
  selectedIds,
  toggleOne,
  toggleAll,
  isSelected,
  onEdit,
  canSeeCosts,
  getStockStatus,
  t
}: InventoryTableProps) {
  return (
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
          {products.map((product) => {
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
                  {canSeeCosts && (
                    <div className="text-[10px] text-muted-foreground">
                      Costo: {formatCurrency(product.costPrice)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Can permission="inventory:edit">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(product)}
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
  );
}
