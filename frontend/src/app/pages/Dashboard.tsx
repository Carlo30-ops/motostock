import { useState, useMemo } from "react";
import { Link } from "react-router";
import { TrendingUp, DollarSign, AlertTriangle, Package as PackageIcon, Plus, DatabaseBackup, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { store } from "../lib/store";
import { formatCurrency } from "../lib/utils";
import { useLanguage } from "../lib/i18n";
import { RevenueChart } from "../components/RevenueChart";
import { TopProductsChart } from "../components/TopProductsChart";
import { useBackups } from "../api/hooks";
import { format, subDays, startOfDay, isAfter, isSameDay } from "date-fns";

export function Dashboard() {
  const { t, language } = useLanguage();
  const [chartPeriod, setChartPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const { data: backups } = useBackups();
  const lastBackup = backups && backups.length > 0 ? backups[0] : null;

  const chartData = useMemo(() => {
    const today = startOfDay(new Date());
    const data = [];
    
    if (chartPeriod === "daily") {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = subDays(today, i);
        const dailySales = store.sales.filter(s => isSameDay(new Date(s.date), date));
        const revenue = dailySales.reduce((sum, s) => sum + s.total, 0);
        data.push({
          period: format(date, "MMM dd"),
          revenue
        });
      }
    } else if (chartPeriod === "weekly") {
      // Last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const endWeek = subDays(today, i * 7);
        const startWeek = subDays(endWeek, 6);
        const weeklySales = store.sales.filter(s => {
          const d = new Date(s.date);
          return d >= startWeek && d <= new Date(endWeek.getTime() + 86400000);
        });
        const revenue = weeklySales.reduce((sum, s) => sum + s.total, 0);
        data.push({
          period: `${format(startWeek, "dd MMM")} - ${format(endWeek, "dd MMM")}`,
          revenue
        });
      }
    } else {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthlySales = store.sales.filter(s => {
          const sd = new Date(s.date);
          return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
        });
        const revenue = monthlySales.reduce((sum, s) => sum + s.total, 0);
        data.push({
          period: format(d, "MMM yyyy"),
          revenue
        });
      }
    }
    return data;
  }, [chartPeriod, store.sales]);

  const topProductsData = useMemo(() => {
    const productSales = new Map<string, number>();
    store.sales.forEach((sale) => {
      sale.items.forEach((item) => {
        const current = productSales.get(item.productId) || 0;
        productSales.set(item.productId, current + (item.price * item.quantity));
      });
    });
    
    const sorted = Array.from(productSales.entries())
      .map(([id, revenue]) => {
        const p = store.products.find(prod => prod.id === id);
        return { name: p ? p.name.substring(0, 20) + (p.name.length > 20 ? "..." : "") : "Desc.", revenue };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
      
    return sorted;
  }, [store.sales, store.products]);

  const lowStockCount = store.getLowStockProducts().length;
  const todayRevenue = store.getTodayRevenue();
  const monthRevenue = store.getMonthRevenue();
  const pendingOrders = store.purchaseOrders.filter((o) => o.status === "pending").length;

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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("dashboard.todayRevenue")}</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">{formatCurrency(todayRevenue)}</div>
            <p className="text-sm text-muted-foreground mt-1">+12% {t("dashboard.fromYesterday")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("dashboard.monthSales")}</CardTitle>
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">{formatCurrency(monthRevenue)}</div>
            <p className="text-sm text-muted-foreground mt-1">{language === "es" ? "Mayo 2026" : "May 2026"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("dashboard.lowStockAlerts")}</CardTitle>
              <div className="p-2 rounded-lg bg-warning/10">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">{lowStockCount}</div>
            <Link to="/inventory" className="text-sm text-accent hover:underline mt-1 inline-block">
              {t("dashboard.viewItems")}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("dashboard.pendingOrders")}</CardTitle>
              <div className="p-2 rounded-lg bg-secondary/10">
                <PackageIcon className="w-5 h-5 text-secondary" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">{pendingOrders}</div>
            <Link to="/purchase-orders" className="text-sm text-accent hover:underline mt-1 inline-block">
              {t("dashboard.manageOrders")}
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>{t("dashboard.revenueOverview")}</CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={chartPeriod === "daily" ? "primary" : "outline"}
                onClick={() => setChartPeriod("daily")}
              >
                {t("period.daily")}
              </Button>
              <Button
                size="sm"
                variant={chartPeriod === "weekly" ? "primary" : "outline"}
                onClick={() => setChartPeriod("weekly")}
              >
                {t("period.weekly")}
              </Button>
              <Button
                size="sm"
                variant={chartPeriod === "monthly" ? "primary" : "outline"}
                onClick={() => setChartPeriod("monthly")}
              >
                {t("period.monthly")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RevenueChart key={`${chartPeriod}-${language}`} data={chartData} />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Productos más Vendidos</CardTitle>
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
              {store.getLowStockProducts().slice(0, 5).map((product) => (
                <div key={product.id} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{product.brand}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={product.stock === 0 ? "destructive" : product.stock <= 5 ? "warning" : "default"}
                    >
                      {product.stock} {t("inventory.inStock")}
                    </Badge>
                  </div>
                </div>
              ))}
              {store.getLowStockProducts().length === 0 && (
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
              {store.sales.slice(-5).reverse().map((sale) => {
                const client = sale.clientId ? store.clients.find((c) => c.id === sale.clientId) : null;
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
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backup Widget */}
      <div className="fixed bottom-4 right-4 z-40">
        <Link to="/admin/backups">
          <div className="bg-card shadow-lg rounded-full px-4 py-2 border border-border flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors">
            {lastBackup ? (
              <CheckCircle className="w-4 h-4 text-success" />
            ) : (
              <DatabaseBackup className="w-4 h-4 text-warning" />
            )}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-muted-foreground leading-none">Último Backup</span>
              <span className="text-xs font-medium leading-none mt-1">
                {lastBackup ? format(new Date(lastBackup.created_at * 1000), "dd/MM HH:mm") : "Ninguno"}
              </span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
