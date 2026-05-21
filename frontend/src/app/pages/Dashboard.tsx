/**
 * Dashboard conectado a la API (ventas, inventario, órdenes, backups).
 */
import { useState, useMemo } from "react";
import { Link } from "react-router";
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Package as PackageIcon,
  Plus,
  DatabaseBackup,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { formatCurrency } from "../lib/utils";
import { useLanguage } from "../lib/i18n";
import { RevenueChart } from "../components/RevenueChart";
import { TopProductsChart } from "../components/TopProductsChart";
import {
  useBackups,
  useSales,
  useProducts,
  useOrders,
  useInventoryReport,
  useClients,
} from "../api/hooks";
import { format, subDays, startOfDay, isSameDay, isSameMonth } from "date-fns";
import { KpiCard } from "../components/ui/KpiCard";
import { PageSkeleton } from "../components/ui/PageSkeleton";

export function Dashboard() {
  const { t, language } = useLanguage();
  const [chartPeriod, setChartPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  const { data: sales = [], isLoading: salesLoading } = useSales();
  const { data: products = [] } = useProducts();
  const { data: orders = [] } = useOrders();
  const { data: clients = [] } = useClients();
  const { data: inventoryReport } = useInventoryReport();
  const { data: backups } = useBackups();

  const lastBackup = backups && backups.length > 0 ? backups[0] : null;
  const today = startOfDay(new Date());

  const yesterday = subDays(today, 1);

  const todayRevenue = useMemo(
    () =>
      sales
        .filter((s) => isSameDay(new Date(s.date), today))
        .reduce((sum, s) => sum + s.total, 0),
    [sales, today]
  );

  const yesterdayRevenue = useMemo(
    () =>
      sales
        .filter((s) => isSameDay(new Date(s.date), yesterday))
        .reduce((sum, s) => sum + s.total, 0),
    [sales, yesterday]
  );

  const revenueTrendPct = useMemo(() => {
    if (yesterdayRevenue === 0) return todayRevenue > 0 ? 100 : 0;
    return ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
  }, [todayRevenue, yesterdayRevenue]);

  const monthRevenue = useMemo(
    () =>
      sales
        .filter((s) => isSameMonth(new Date(s.date), today))
        .reduce((sum, s) => sum + s.total, 0),
    [sales, today]
  );

  const chartData = useMemo(() => {
    const data: { period: string; revenue: number }[] = [];

    if (chartPeriod === "daily") {
      for (let i = 6; i >= 0; i--) {
        const date = subDays(today, i);
        const revenue = sales
          .filter((s) => isSameDay(new Date(s.date), date))
          .reduce((sum, s) => sum + s.total, 0);
        data.push({ period: format(date, "dd MMM"), revenue });
      }
    } else if (chartPeriod === "weekly") {
      for (let i = 3; i >= 0; i--) {
        const endWeek = subDays(today, i * 7);
        const startWeek = subDays(endWeek, 6);
        const revenue = sales
          .filter((s) => {
            const d = new Date(s.date);
            return d >= startWeek && d <= new Date(endWeek.getTime() + 86400000);
          })
          .reduce((sum, s) => sum + s.total, 0);
        data.push({
          period: `${format(startWeek, "dd MMM")} - ${format(endWeek, "dd MMM")}`,
          revenue,
        });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const revenue = sales
          .filter((s) => {
            const sd = new Date(s.date);
            return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
          })
          .reduce((sum, s) => sum + s.total, 0);
        data.push({ period: format(d, "MMM yyyy"), revenue });
      }
    }
    return data;
  }, [chartPeriod, sales, today]);

  const topProductsData = useMemo(() => {
    const productSales = new Map<string, number>();
    sales.forEach((sale) => {
      sale.items.forEach((item) => {
        const current = productSales.get(item.productId) || 0;
        productSales.set(item.productId, current + item.price * item.quantity);
      });
    });

    return Array.from(productSales.entries())
      .map(([id, revenue]) => {
        const p = products.find((prod) => prod.id === id);
        return {
          name: p ? p.name.substring(0, 20) + (p.name.length > 20 ? "…" : "") : "—",
          revenue,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [sales, products]);

  const lowStockProducts = useMemo(() => {
    if (inventoryReport?.rows?.length) {
      return inventoryReport.rows
        .filter((r) => r.status === "Low Stock" || r.status === "Out of Stock")
        .slice(0, 5)
        .map((r) => ({
          id: String(r.product_id),
          name: r.product_name,
          brand: r.brand,
          stock: r.stock,
        }));
    }
    return products
      .filter((p) => p.stock <= p.reorderThreshold)
      .slice(0, 5);
  }, [inventoryReport, products]);

  const lowStockCount =
    inventoryReport?.rows?.filter(
      (r) => r.status === "Low Stock" || r.status === "Out of Stock"
    ).length ??
    products.filter((p) => p.stock <= p.reorderThreshold).length;

  const pendingOrders = orders.filter((o) => o.status === "pending").length;

  const recentSales = useMemo(
    () =>
      [...sales]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5),
    [sales]
  );

  if (salesLoading) {
    return (
      <div className="p-4 md:p-8">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1>{t("dashboard.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/sales">
            <Button size="sm">
              <Plus className="w-4 h-4" />
              {t("btn.newSale")}
            </Button>
          </Link>
          <Link to="/inventory">
            <Button variant="outline" size="sm">
              <PackageIcon className="w-4 h-4" />
              {t("btn.addInventory")}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={t("dashboard.todayRevenue")}
          value={formatCurrency(todayRevenue)}
          icon={DollarSign}
          trend={{ value: revenueTrendPct, label: t("dashboard.fromYesterday") }}
        />
        <KpiCard
          title={t("dashboard.monthSales")}
          value={formatCurrency(monthRevenue)}
          icon={TrendingUp}
          iconClassName="bg-success/10 text-success"
          subtitle={format(today, language === "es" ? "MMMM yyyy" : "MMMM yyyy")}
        />
        <KpiCard
          title={t("dashboard.lowStockAlerts")}
          value={String(lowStockCount)}
          icon={AlertTriangle}
          iconClassName="bg-warning/10 text-warning"
          subtitle={t("dashboard.viewItems")}
        />
        <KpiCard
          title={t("dashboard.pendingOrders")}
          value={String(pendingOrders)}
          icon={PackageIcon}
          iconClassName="bg-secondary/10 text-secondary"
          subtitle={t("dashboard.manageOrders")}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>{t("dashboard.revenueOverview")}</CardTitle>
            <div className="flex gap-2">
              {(["daily", "weekly", "monthly"] as const).map((period) => (
                <Button
                  key={period}
                  size="sm"
                  variant={chartPeriod === period ? "primary" : "outline"}
                  onClick={() => setChartPeriod(period)}
                >
                  {t(`period.${period}`)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {salesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <RevenueChart key={`${chartPeriod}-${language}`} data={chartData} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 5 productos más vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          {topProductsData.length > 0 ? (
            <TopProductsChart data={topProductsData} />
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              No hay ventas registradas
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.lowStockAlerts")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStockProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{product.brand}</p>
                  </div>
                  <Badge
                    variant={
                      product.stock === 0
                        ? "destructive"
                        : product.stock <= 5
                          ? "warning"
                          : "default"
                    }
                  >
                    {product.stock} {t("inventory.inStock")}
                  </Badge>
                </div>
              ))}
              {lowStockProducts.length === 0 && (
                <p className="text-muted-foreground text-center py-4">{t("dashboard.allStocked")}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recentSales")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {salesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : recentSales.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Sin ventas recientes</p>
              ) : (
                recentSales.map((sale) => {
                  const client = sale.clientId
                    ? clients.find((c) => c.id === sale.clientId)
                    : null;
                  return (
                    <div key={sale.id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{client?.name || t("dashboard.walkInCustomer")}</p>
                        <p className="text-sm text-muted-foreground">{sale.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(sale.total)}</p>
                        <Badge variant="secondary" className="text-xs mt-1">
                          {t(`payment.${sale.paymentMethod}`)}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-4 right-4 z-40">
        <Link to="/admin/backups">
          <div className="bg-card shadow-lg rounded-full px-4 py-2 border border-border flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors">
            {lastBackup ? (
              <CheckCircle className="w-4 h-4 text-success" />
            ) : (
              <DatabaseBackup className="w-4 h-4 text-warning" />
            )}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-muted-foreground leading-none">
                Último backup
              </span>
              <span className="text-xs font-medium leading-none mt-1">
                {lastBackup
                  ? format(new Date(lastBackup.created_at * 1000), "dd/MM HH:mm")
                  : "Ninguno"}
              </span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
