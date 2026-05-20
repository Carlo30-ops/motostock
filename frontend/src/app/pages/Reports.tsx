import { useState } from "react";
import { FileDown, TrendingUp, Package, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { store, Product } from "../lib/store";
import { formatCurrency, formatDate } from "../lib/utils";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { hasRoleAccess } from "../lib/rbac";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function Reports() {
  const { data: currentUser } = useCurrentUser();
  const canSeeCosts = hasRoleAccess(currentUser?.role, "supervisor");
  const [dateFrom, setDateFrom] = useState("2026-05-01");
  const [dateTo, setDateTo] = useState("2026-05-07");

  const filteredSales = store.sales.filter((sale) => {
    const saleDate = new Date(sale.date);
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    return saleDate >= from && saleDate <= to;
  });

  const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalCost = canSeeCosts
    ? filteredSales.reduce((sum, sale) => {
    return (
      sum +
      sale.items.reduce((itemSum, item) => {
        const product = store.products.find((p) => p.id === item.productId);
        return itemSum + (product?.costPrice || 0) * item.quantity;
      }, 0)
    );
  }, 0)
    : 0;
  const totalProfit = totalRevenue - totalCost;
  const averageTicket = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

  const productSales = new Map<string, { product: Product; quantity: number; revenue: number }>();
  filteredSales.forEach((sale) => {
    sale.items.forEach((item) => {
      const product = store.products.find((p) => p.id === item.productId);
      if (product) {
        const existing = productSales.get(item.productId);
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += item.price * item.quantity;
        } else {
          productSales.set(item.productId, {
            product,
            quantity: item.quantity,
            revenue: item.price * item.quantity,
          });
        }
      }
    });
  });

  const topProducts = Array.from(productSales.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const currentStockValue = canSeeCosts
    ? store.products.reduce(
    (sum, product) => sum + product.stock * product.costPrice,
    0
  )
    : 0;

  const slowMovers = store.products.filter((product) => {
    const sold = productSales.get(product.id);
    return !sold || sold.quantity < 2;
  });

  const exportReport = (type: "sales" | "inventory", format: "excel" | "pdf") => {
    if (type === "sales") {
      const data = filteredSales.map((sale) => ({
        Fecha: formatDate(sale.date),
        Total: formatCurrency(sale.total),
        Pago: sale.paymentMethod,
        Items: sale.items.length,
      }));
      
      if (format === "excel") {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Ventas");
        XLSX.writeFile(workbook, `Reporte_Ventas_${dateFrom}_${dateTo}.xlsx`);
        toast.success("Reporte de ventas exportado a Excel");
      } else {
        const doc = new jsPDF();
        doc.text(`Reporte de Ventas: ${dateFrom} a ${dateTo}`, 14, 15);
        autoTable(doc, {
          head: [['Fecha', 'Total', 'Pago', 'Items']],
          body: data.map(d => [d.Fecha, d.Total, d.Pago, d.Items.toString()]),
          startY: 20
        });
        doc.save(`Reporte_Ventas_${dateFrom}_${dateTo}.pdf`);
        toast.success("Reporte de ventas exportado a PDF");
      }
    } else {
      const data = store.products.map((p) => ({
        Codigo: p.code,
        Nombre: p.name,
        Stock: p.stock,
        Valor: formatCurrency(p.stock * p.costPrice),
      }));
      
      if (format === "excel") {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
        XLSX.writeFile(workbook, "Reporte_Inventario.xlsx");
        toast.success("Reporte de inventario exportado a Excel");
      } else {
        const doc = new jsPDF();
        doc.text("Reporte de Inventario (Valoracion)", 14, 15);
        autoTable(doc, {
          head: [['Código', 'Nombre', 'Stock', 'Valor Total']],
          body: data.map(d => [d.Codigo, d.Nombre, d.Stock.toString(), d.Valor]),
          startY: 20
        });
        doc.save("Reporte_Inventario.pdf");
        toast.success("Reporte de inventario exportado a PDF");
      }
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1>Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">View sales and inventory insights</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block mb-2">From</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="block mb-2">To</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2>Sales Report</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportReport("sales", "excel")}>
              <FileDown className="w-4 h-4 mr-2" />
              Exportar a Excel
            </Button>
            <Button variant="primary" size="sm" onClick={() => exportReport("sales", "pdf")}>
              <FileDown className="w-4 h-4 mr-2" />
              Exportar a PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Total Sold</CardTitle>
                <div className="p-2 rounded-lg bg-primary/10">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-medium">{formatCurrency(totalRevenue)}</div>
              <p className="text-sm text-muted-foreground mt-1">{filteredSales.length} transactions</p>
            </CardContent>
          </Card>

          {canSeeCosts && (
            <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Total Profit</CardTitle>
                <div className="p-2 rounded-lg bg-success/10">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-medium text-success">{formatCurrency(totalProfit)}</div>
              <p className="text-sm text-muted-foreground mt-1">
                {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}% margin
              </p>
            </CardContent>
          </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Average Ticket</CardTitle>
                <div className="p-2 rounded-lg bg-accent/10">
                  <DollarSign className="w-5 h-5 text-accent" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-medium">{formatCurrency(averageTicket)}</div>
              <p className="text-sm text-muted-foreground mt-1">Per transaction</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Transactions</CardTitle>
                <div className="p-2 rounded-lg bg-secondary/10">
                  <Package className="w-5 h-5 text-secondary" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-medium">{filteredSales.length}</div>
              <p className="text-sm text-muted-foreground mt-1">Total sales</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Selling Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topProducts.map((item, index) => (
              <div key={item.product.id} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-medium text-primary">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{item.product.name}</p>
                  <p className="text-sm text-muted-foreground">{item.quantity} units sold</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatCurrency(item.revenue)}</p>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                </div>
              </div>
            ))}
            {topProducts.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No sales in selected period</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2>Inventory Report</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportReport("inventory", "excel")}>
              <FileDown className="w-4 h-4 mr-2" />
              Exportar a Excel
            </Button>
            <Button variant="primary" size="sm" onClick={() => exportReport("inventory", "pdf")}>
              <FileDown className="w-4 h-4 mr-2" />
              Exportar a PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {canSeeCosts && (
            <Card>
            <CardHeader>
              <CardTitle>Stock Value Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Current Stock Value</p>
                  <p className="text-3xl font-medium">{formatCurrency(currentStockValue)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Products</p>
                    <p className="text-xl font-medium">{store.products.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Units</p>
                    <p className="text-xl font-medium">
                      {store.products.reduce((sum, p) => sum + p.stock, 0)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Slow Moving Items ({slowMovers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {slowMovers.slice(0, 5).map((product) => (
                  <div key={product.id} className="flex items-center justify-between py-2 border-b border-border">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.stock} in stock</p>
                    </div>
                    <p className="text-sm text-warning">Low sales</p>
                  </div>
                ))}
                {slowMovers.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">All products moving well</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
