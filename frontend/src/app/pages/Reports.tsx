/**
 * Reportes conectados a la API (/reports/sales, /reports/inventory).
 */
import { useState } from "react";
import { FileDown, TrendingUp, Package, DollarSign, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { formatCurrency, formatDate } from "../lib/utils";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { hasRoleAccess } from "../lib/rbac";
import { useSalesReport, useInventoryReport } from "../api/hooks";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { useLanguage } from "../lib/i18n";
import { SalesReportChart } from "../components/SalesReportChart";
import { KpiCard } from "../components/ui/KpiCard";

function defaultDateRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    from: format(from, "yyyy-MM-dd"),
    to: format(today, "yyyy-MM-dd"),
  };
}

export function Reports() {
  const { t } = useLanguage();
  const { data: currentUser } = useCurrentUser();
  const canSeeCosts = hasRoleAccess(currentUser?.role, "supervisor");
  const defaults = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  const {
    data: salesReport,
    isLoading: salesLoading,
    isError: salesError,
    refetch: refetchSales,
  } = useSalesReport(dateFrom, dateTo);
  const { data: inventoryReport, isLoading: inventoryLoading } = useInventoryReport();

  const exportReport = (type: "sales" | "inventory", fmt: "excel" | "pdf") => {
    if (type === "sales" && !salesReport) {
      toast.error("No hay datos de ventas para exportar");
      return;
    }
    if (type === "inventory" && !inventoryReport) {
      toast.error("No hay datos de inventario para exportar");
      return;
    }

    if (type === "sales" && salesReport) {
      const rows = salesReport.rows.map((r) => ({
        Producto: r.product_name,
        Categoría: r.category,
        Cantidad: r.quantity_sold,
        Ingresos: r.revenue,
        ...(canSeeCosts ? { Costo: r.cost, Utilidad: r.profit } : {}),
      }));

      if (fmt === "excel") {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ventas");
        XLSX.writeFile(wb, `reporte-ventas-${dateFrom}-${dateTo}.xlsx`);
      } else {
        const doc = new jsPDF();
        doc.text(`Reporte de ventas ${dateFrom} — ${dateTo}`, 14, 15);
        autoTable(doc, {
          head: [Object.keys(rows[0] ?? { Producto: "" })],
          body: rows.map((r) => Object.values(r)),
          startY: 22,
        });
        doc.save(`reporte-ventas-${dateFrom}-${dateTo}.pdf`);
      }
      toast.success("Reporte exportado");
      return;
    }

    if (type === "inventory" && inventoryReport) {
      const rows = inventoryReport.rows.map((r) => ({
        Producto: r.product_name,
        Categoría: r.category,
        Marca: r.brand,
        Stock: r.stock,
        Estado: r.status,
        ...(canSeeCosts ? { "Valor stock": r.stock * (inventoryReport.rows.find((x) => x.product_id === r.product_id)?.stock ?? 0) } : {}),
      }));

      if (fmt === "excel") {
        const ws = XLSX.utils.json_to_sheet(
          inventoryReport.rows.map((r) => ({
            Producto: r.product_name,
            Categoría: r.category,
            Marca: r.brand,
            Stock: r.stock,
            Estado: r.status,
          }))
        );
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventario");
        XLSX.writeFile(wb, `reporte-inventario-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      } else {
        const doc = new jsPDF();
        doc.text("Reporte de inventario", 14, 15);
        autoTable(doc, {
          head: [["Producto", "Categoría", "Stock", "Estado"]],
          body: rows.map((r) => [r.Producto, r.Categoría, r.Stock, r.Estado]),
          startY: 22,
        });
        doc.save(`reporte-inventario-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      }
      toast.success("Reporte exportado");
    }
  };

  const topProducts = salesReport?.rows.slice(0, 5) ?? [];
  const slowMovers =
    inventoryReport?.rows.filter((r) => r.status === "Good" && r.stock > 0).slice(0, 8) ?? [];

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1>{t("reports.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("reports.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rango de fechas (ventas)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm mb-1">Desde</label>
            <Input type="date" value={dateFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Hasta</label>
            <Input type="date" value={dateTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => refetchSales()}>
            Actualizar
          </Button>
        </CardContent>
      </Card>

      {salesError && (
        <p className="text-destructive text-sm">
          No se pudo cargar el reporte de ventas. Requiere rol supervisor o superior.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Ingresos"
          value={salesLoading ? "…" : formatCurrency(salesReport?.total_revenue ?? 0)}
          icon={DollarSign}
          subtitle={`${salesReport?.total_transactions ?? 0} transacciones`}
          loading={salesLoading}
        />

        {canSeeCosts && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Costos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-medium">
                  {formatCurrency(salesReport?.total_cost ?? 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Utilidad</CardTitle>
                <TrendingUp className="w-5 h-5 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-medium text-success">
                  {formatCurrency(salesReport?.total_profit ?? 0)}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Ticket promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">
              {formatCurrency(salesReport?.average_ticket ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Top productos vendidos</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => exportReport("sales", "excel")}>
                <FileDown className="w-4 h-4" /> Excel
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportReport("sales", "pdf")}>
                <FileDown className="w-4 h-4" /> PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {salesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : topProducts.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Sin ventas en el período</p>
            ) : (
              <>
                <SalesReportChart
                  data={topProducts.map((row) => ({
                    name: row.product_name.slice(0, 18),
                    revenue: row.revenue,
                  }))}
                />
                <div className="space-y-3 mt-4 border-t pt-4">
                  {topProducts.map((row) => (
                    <div key={row.product_id} className="flex justify-between items-center text-sm">
                      <span>{row.product_name}</span>
                      <span className="font-medium">{formatCurrency(row.revenue)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" /> Inventario
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => exportReport("inventory", "excel")}>
                Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {inventoryLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Productos</p>
                    <p className="text-xl font-medium">{inventoryReport?.total_products ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unidades</p>
                    <p className="text-xl font-medium">{inventoryReport?.total_units ?? 0}</p>
                  </div>
                </div>
                {canSeeCosts && (
                  <p className="text-sm mb-3">
                    Valor stock: {formatCurrency(inventoryReport?.total_stock_value ?? 0)}
                  </p>
                )}
                <p className="text-sm font-medium mb-2">Baja rotación (muestra)</p>
                {slowMovers.length === 0 ? (
                  <p className="text-muted-foreground text-sm">—</p>
                ) : (
                  slowMovers.map((r) => (
                    <p key={r.product_id} className="text-sm text-muted-foreground">
                      {r.product_name} — stock {r.stock}
                    </p>
                  ))
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {salesReport && salesReport.rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detalle por producto ({formatDate(dateFrom)} — {formatDate(dateTo)})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Producto</th>
                    <th className="text-right py-2">Cant.</th>
                    <th className="text-right py-2">Ingresos</th>
                    {canSeeCosts && <th className="text-right py-2">Utilidad</th>}
                  </tr>
                </thead>
                <tbody>
                  {salesReport.rows.map((row) => (
                    <tr key={row.product_id} className="border-b border-border/50">
                      <td className="py-2">{row.product_name}</td>
                      <td className="text-right py-2">{row.quantity_sold}</td>
                      <td className="text-right py-2">{formatCurrency(row.revenue)}</td>
                      {canSeeCosts && (
                        <td className="text-right py-2">{formatCurrency(row.profit)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
