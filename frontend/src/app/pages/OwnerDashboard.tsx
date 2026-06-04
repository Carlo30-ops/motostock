import React, { useState } from "react";
import { 
  TrendingUp, 
  DollarSign, 
  AlertTriangle, 
  Package as PackageIcon, 
  PieChart, 
  Download,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { KpiCard } from "../components/ui/kpi-card";
import { PageSkeleton } from "../components/ui/page-skeleton";
import { formatCurrency } from "../lib/utils";
import { 
  useOwnerDashboard, 
  useFinancialAudit, 
  useProfitability, 
  useOwnerSalesHistory,
  useOwnerInventoryMovements
} from "../api/hooks";

interface LowStockProduct {
  id: number;
  name: string;
  cost: number;
  stock: number;
}

interface OwnerDashboardSummary {
  today_sales_count?: number;
  today_total_amount?: number;
  today_estimated_gross_profit?: number;
  today_expenses?: number;
  variation_percentage?: number;
  cancelled_sales_count?: number;
  manual_adjustments_count?: number;
  low_stock_products?: LowStockProduct[];
}

interface FinancialAuditLog {
  id: number;
  created_at: string;
  username?: string;
  user_id?: number;
  event_type: string;
  resource: string;
  resource_id?: string | number;
  details?: string;
  old_value?: string;
  new_value?: string;
  ip_address?: string;
}

interface ProfitabilityRow {
  product_id: number;
  product_name: string;
  quantity_sold: number;
  total_revenue: number;
  total_cost: number;
  net_profit: number;
}

interface ProfitabilityData {
  rows?: ProfitabilityRow[];
}

interface OwnerSale {
  id: number;
  date: string;
  paymentMethod: string;
  total: number;
  deleted_at?: string | null;
}

interface InventoryMovement {
  id: number;
  created_at: string;
  movement_type: string;
  quantity: number;
  new_stock: number;
}

export function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState("today");
  
  // Tab 1 Data
  const { data: summary, isLoading: summaryLoading } = useOwnerDashboard() as {
    data?: OwnerDashboardSummary;
    isLoading: boolean;
  };
  
  // Tab 2 Data
  const [auditParams] = useState({ page: 1, limit: 50 });
  const { data: auditLogs = [], isLoading: auditLoading } = useFinancialAudit(auditParams) as {
    data?: FinancialAuditLog[];
    isLoading: boolean;
  };
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  // Tab 3 Data
  const [profitParams, setProfitParams] = useState({ period: "daily" });
  const { data: profitability, isLoading: profitLoading } = useProfitability(profitParams) as {
    data?: ProfitabilityData;
    isLoading: boolean;
  };

  // Tab 4 Data
  const { data: salesHistory = [], isLoading: salesLoading } = useOwnerSalesHistory({}) as {
    data?: OwnerSale[];
    isLoading: boolean;
  };
  const { data: movements = [], isLoading: movementsLoading } = useOwnerInventoryMovements() as {
    data?: InventoryMovement[];
    isLoading: boolean;
  };

  const exportAuditToCSV = () => {
    if (!auditLogs.length) return;
    const headers = ["ID", "Fecha", "Usuario", "Evento", "Recurso", "ID Recurso", "Detalles"];
    const rows = auditLogs.map(log => [
      log.id,
      format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
      log.username || log.user_id,
      log.event_type,
      log.resource,
      log.resource_id || "",
      log.details || ""
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `auditoria_financiera_${format(new Date(), "yyyyMMdd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (summaryLoading && activeTab === "today") return <PageSkeleton />;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel del Dueño</h1>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest mt-1">
            Acceso de Alta Seguridad • MotoStock
          </p>
        </div>
        <Badge className="border border-primary/20 bg-primary/5 text-primary px-3 py-1">
          Modo Owner Activo
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="today">Hoy</TabsTrigger>
          <TabsTrigger value="audit">Auditoría</TabsTrigger>
          <TabsTrigger value="profit">Rentabilidad</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        {/* TAB 1: HOY */}
        <TabsContent value="today" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Ventas del Día"
              value={String(summary?.today_sales_count || 0)}
              icon={TrendingUp}
              subtitle="Operaciones totales"
            />
            <KpiCard
              title="Monto Total"
              value={formatCurrency(summary?.today_total_amount || 0)}
              icon={DollarSign}
              trend={{ 
                value: summary?.variation_percentage || 0, 
                label: "vs ayer" 
              }}
            />
            <KpiCard
              title="Utilidad Bruta"
              value={formatCurrency(summary?.today_estimated_gross_profit || 0)}
              icon={PieChart}
              iconClassName="bg-success/10 text-success"
              subtitle="Estimación (Precio - Costo)"
            />
            <KpiCard
              title="Egresos Hoy"
              value={formatCurrency(summary?.today_expenses || 0)}
              icon={Download}
              iconClassName="bg-destructive/10 text-destructive"
              subtitle="Compras recibidas hoy"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  <CardTitle>Alertas de Seguridad Hoy</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="font-medium text-sm">Ventas Anuladas</span>
                  <Badge variant={summary?.cancelled_sales_count ? "destructive" : "secondary"}>
                    {summary?.cancelled_sales_count || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="font-medium text-sm">Ajustes Manuales de Stock</span>
                  <Badge variant={summary?.manual_adjustments_count ? "warning" : "secondary"}>
                    {summary?.manual_adjustments_count || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="font-medium text-sm">Intentos 403 Bloqueados</span>
                  <Badge variant="secondary">0</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <PackageIcon className="w-5 h-5 text-primary" />
                  <CardTitle>Stock Crítico (Bajo Mínimo)</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary?.low_stock_products?.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{p.name}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground text-xs">Costo: {formatCurrency(p.cost)}</span>
                        <Badge variant="destructive">{p.stock} units</Badge>
                      </div>
                    </div>
                  ))}
                  {!summary?.low_stock_products?.length && (
                    <p className="text-center text-muted-foreground py-4">Sin productos bajo stock mínimo.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: AUDITORÍA FINANCIERA */}
        <TabsContent value="audit" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Registro de Auditoría Integral</CardTitle>
                <Button variant="outline" size="sm" onClick={exportAuditToCSV} className="gap-2">
                  <Download className="w-4 h-4" /> Exportar CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-[100px]">Fecha</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Recurso</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8">Cargando logs...</TableCell></TableRow>
                    ) : auditLogs.map((log) => (
                      <React.Fragment key={log.id}>
                        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                          <TableCell className="text-xs">{format(new Date(log.created_at), "dd/MM HH:mm")}</TableCell>
                          <TableCell className="font-medium">{log.username}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="border border-border bg-transparent text-[10px] uppercase font-bold">
                              {log.event_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{log.resource} ({log.resource_id})</TableCell>
                          <TableCell className="text-right">
                            {expandedLog === log.id ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
                          </TableCell>
                        </TableRow>
                        {expandedLog === log.id && (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={5} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                                <div className="p-2 rounded border bg-card">
                                  <p className="font-bold text-destructive mb-1">VALOR ANTERIOR:</p>
                                  <pre className="whitespace-pre-wrap">{log.old_value || "(vacio)"}</pre>
                                </div>
                                <div className="p-2 rounded border bg-card">
                                  <p className="font-bold text-success mb-1">VALOR NUEVO:</p>
                                  <pre className="whitespace-pre-wrap">{log.new_value || "(vacio)"}</pre>
                                </div>
                              </div>
                              {log.details && (
                                <div className="mt-2 p-2 rounded border bg-card text-xs">
                                  <p className="font-bold mb-1">DETALLES:</p>
                                  <p>{log.details}</p>
                                  <p className="mt-1 text-[10px] text-muted-foreground">IP: {log.ip_address}</p>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                    {!auditLoading && auditLogs.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-8">No se encontraron registros de auditoría.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: RENTABILIDAD */}
        <TabsContent value="profit" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle>Rentabilidad por Producto</CardTitle>
                <div className="flex gap-2">
                  {(["daily", "weekly", "monthly"] as const).map((p) => (
                    <Button 
                      key={p}
                      size="sm" 
                      variant={profitParams.period === p ? "primary" : "outline"}
                      onClick={() => setProfitParams({ period: p })}
                    >
                      {p === "daily" ? "Hoy" : p === "weekly" ? "Semana" : "Mes"}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-center">Vendidos</TableHead>
                      <TableHead className="text-right">Ingreso</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="text-right">Utilidad Neta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profitLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8">Calculando rentabilidad...</TableCell></TableRow>
                    ) : profitability?.rows?.map((row) => (
                      <TableRow key={row.product_id}>
                        <TableCell className="font-medium">{row.product_name}</TableCell>
                        <TableCell className="text-center">{row.quantity_sold}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.total_revenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.total_cost)}</TableCell>
                        <TableCell className="text-right font-bold text-success">
                          {formatCurrency(row.net_profit)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: HISTORIAL COMPLETO */}
        <TabsContent value="history" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Ventas (Incluye Anuladas)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>ID</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8">Cargando ventas...</TableCell></TableRow>
                    ) : salesHistory.map((sale) => (
                      <TableRow key={sale.id} className={sale.deleted_at ? "bg-destructive/5" : ""}>
                        <TableCell className="text-xs">#{sale.id}</TableCell>
                        <TableCell className="text-xs">{sale.date}</TableCell>
                        <TableCell className="capitalize text-xs">{sale.paymentMethod}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(sale.total)}</TableCell>
                        <TableCell className="text-right">
                          {sale.deleted_at ? (
                            <Badge variant="destructive" className="text-[10px]">ANULADA</Badge>
                          ) : (
                            <Badge variant="success" className="text-[10px]">COMPLETADA</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Movimientos de Inventario</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Stock Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movementsLoading ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8">Cargando movimientos...</TableCell></TableRow>
                    ) : movements.slice(0, 50).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs">{format(new Date(m.created_at), "dd/MM HH:mm")}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="border border-border bg-transparent text-[10px] uppercase">
                            {m.movement_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.new_stock}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
