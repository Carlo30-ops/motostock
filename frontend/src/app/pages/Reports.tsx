/**
 * Reportes conectados a la API (/reports/sales, /reports/inventory).
 */
import { useState } from "react";
import { FileDown, TrendingUp, Package, DollarSign, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { formatCurrency, formatDate } from "../lib/utils";
import { useAuth, Can } from "../lib/auth-rbac";
import { useSalesReport, useInventoryReport } from "../api/hooks";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { useLanguage } from "../lib/i18n";
import { SalesReportChart } from "../components/SalesReportChart";
import { KpiCard } from "../components/ui/kpi-card";

interface SalesReportRow {
  product_id: number;
  product_name: string;
  category: string;
  quantity_sold: number;
  revenue: number;
  cost: number;
  profit: number;
}

interface SalesReport {
  total_revenue: number;
  total_transactions: number;
  total_cost: number;
  total_profit: number;
  average_ticket: number;
  rows: SalesReportRow[];
}

interface InventoryReportRow {
  product_id: number;
  product_name: string;
  category: string;
  brand: string;
  stock: number;
  status: string;
}

interface InventoryReport {
  total_products: number;
  total_units: number;
  total_stock_value: number;
  rows: InventoryReportRow[];
}

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
  const { hasPermission } = useAuth();
  const canSeeCosts = hasPermission("reports:financial");
  const defaults = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  const {
    data: salesReport,
    isLoading: salesLoading,
    isError: salesError,
    refetch: refetchSales,
  } = useSalesReport(dateFrom, dateTo) as { data: SalesReport | undefined; isLoading: boolean; isError: boolean; refetch: () => void };
  const { data: inventoryReport, isLoading: inventoryLoading } = useInventoryReport() as { data: InventoryReport | undefined; isLoading: boolean };

  const exportReport = (type: "sales" | "inventory", fmt: "excel" | "pdf") => {
    if (type === "sales" && !salesReport) {
      toast.error(t("reports.noDataExport"));
      return;
    }
    if (type === "inventory" && !inventoryReport) {
      toast.error(t("reports.noDataExport"));
      return;
    }

    if (type === "sales" && salesReport) {
      const rows = salesReport.rows.map((r: SalesReportRow) => ({
        [t("common.product")]: r.product_name,
        [t("inventory.category")]: r.category,
        [t("common.quantity")]: r.quantity_sold,
        [t("reports.revenue")]: r.revenue,
        ...(canSeeCosts ? { [t("reports.costs")]: r.cost, [t("reports.profit")]: r.profit } : {}),
      }));

      if (fmt === "excel") {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, t("nav.sales"));
        XLSX.writeFile(wb, `reporte-ventas-${dateFrom}-${dateTo}.xlsx`);
      } else {
        const doc = new jsPDF();
        doc.text(`${t("reports.sales")} ${dateFrom} — ${dateTo}`, 14, 15);
        autoTable(doc, {
          head: [Object.keys(rows[0] ?? { [t("common.product")]: "" })],
          body: rows.map((r) => Object.values(r)),
          startY: 22,
        });
        doc.save(`reporte-ventas-${dateFrom}-${dateTo}.pdf`);
      }
      toast.success(t("reports.exportSuccess"));
      return;
    }

    if (type === "inventory" && inventoryReport) {
      const rows = inventoryReport.rows.map((r: InventoryReportRow) => ({
        [t("common.product")]: r.product_name,
        [t("inventory.category")]: r.category,
        [t("inventory.brand")]: r.brand,
        [t("inventory.stock")]: r.stock,
        [t("common.status")]: r.status,
      }));

      if (fmt === "excel") {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, t("nav.inventory"));
        XLSX.writeFile(wb, `reporte-inventario-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      } else {
        const doc = new jsPDF();
        doc.text(t("reports.inventory"), 14, 15);
        autoTable(doc, {
          head: [[t("common.product"), t("inventory.category"), t("inventory.stock"), t("common.status")]],
          body: inventoryReport.rows.map((r) => [r.product_name, r.category, r.stock, r.status]),
          startY: 22,
        });
        doc.save(`reporte-inventario-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      }
      toast.success(t("reports.exportSuccess"));
    }
  };

  const topProducts = salesReport?.rows.slice(0, 5) ?? [];
  const slowMovers =
    inventoryReport?.rows.filter((r: InventoryReportRow) => r.status === "Good" && r.stock > 0).slice(0, 8) ?? [];

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1>{t("reports.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("reports.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("reports.dateRangeSales")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm mb-1">{t("reports.from")}</label>
            <Input type="date" value={dateFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">{t("reports.to")}</label>
            <Input type="date" value={dateTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => refetchSales()}>
            {t("reports.update")}
          </Button>
        </CardContent>
      </Card>

      {salesError && (
        <p className="text-destructive text-sm">
          {t("reports.noSales")}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={t("reports.revenue")}
          value={salesLoading ? "…" : formatCurrency(salesReport?.total_revenue ?? 0)}
          icon={DollarSign}
          subtitle={`${salesReport?.total_transactions ?? 0} ${t("reports.transactions")}`}
          loading={salesLoading}
        />

        <Can permission="reports:financial">
          <>
            <Card>
              <CardHeader>
                <CardTitle>{t("reports.costs")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-medium">
                  {formatCurrency(salesReport?.total_cost ?? 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("reports.profit")}</CardTitle>
                <TrendingUp className="w-5 h-5 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-medium text-success">
                  {formatCurrency(salesReport?.total_profit ?? 0)}
                </div>
              </CardContent>
            </Card>
          </>
        </Can>

        <Card>
          <CardHeader>
            <CardTitle>{t("reports.averageTicket")}</CardTitle>
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
            <CardTitle>{t("reports.topProducts")}</CardTitle>
            <Can permission="reports:export">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => exportReport("sales", "excel")}>
                  <FileDown className="w-4 h-4" /> Excel
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportReport("sales", "pdf")}>
                  <FileDown className="w-4 h-4" /> PDF
                </Button>
              </div>
            </Can>
          </CardHeader>
          <CardContent>
            {salesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : topProducts.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">{t("reports.noSales")}</p>
            ) : (
              <>
                <SalesReportChart
                  data={topProducts.map((row: SalesReportRow) => ({
                    name: row.product_name.slice(0, 18),
                    revenue: row.revenue,
                  }))}
                />
                <div className="space-y-3 mt-4 border-t pt-4">
                  {topProducts.map((row: SalesReportRow) => (
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
              <Package className="w-5 h-5" /> {t("nav.inventory")}
            </CardTitle>
            <Can permission="reports:export">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => exportReport("inventory", "excel")}>
                  Excel
                </Button>
              </div>
            </Can>
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
                    <p className="text-sm text-muted-foreground">{t("inventory.stock")}</p>
                    <p className="text-xl font-medium">{inventoryReport?.total_products ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t("common.units")}</p>
                    <p className="text-xl font-medium">{inventoryReport?.total_units ?? 0}</p>
                  </div>
                </div>
                <Can permission="reports:financial">
                  <p className="text-sm mb-3">
                    {t("reports.stockValue")}: {formatCurrency(inventoryReport?.total_stock_value ?? 0)}
                  </p>
                </Can>
                <p className="text-sm font-medium mb-2">{t("reports.lowRotation")}</p>
                {slowMovers.length === 0 ? (
                  <p className="text-muted-foreground text-sm">—</p>
                ) : (
                  slowMovers.map((r: InventoryReportRow) => (
                    <p key={r.product_id} className="text-sm text-muted-foreground">
                      {r.product_name} — {t("inventory.stock")} {r.stock}
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
            <CardTitle>{t("reports.detailByProduct")} ({formatDate(dateFrom)} — {formatDate(dateTo)})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">{t("common.product")}</th>
                    <th className="text-right py-2">{t("common.quantity")}</th>
                    <th className="text-right py-2">{t("reports.revenue")}</th>
                    <Can permission="reports:financial">
                      <th className="text-right py-2">{t("reports.profit")}</th>
                    </Can>
                  </tr>
                </thead>
                <tbody>
                  {salesReport.rows.map((row: SalesReportRow) => (
                    <tr key={row.product_id} className="border-b border-border/50">
                      <td className="py-2">{row.product_name}</td>
                      <td className="text-right py-2">{row.quantity_sold}</td>
                      <td className="text-right py-2">{formatCurrency(row.revenue)}</td>
                      <Can permission="reports:financial">
                        <td className="text-right py-2">{formatCurrency(row.profit)}</td>
                      </Can>
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
