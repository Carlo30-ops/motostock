/**
 * Crédito en tienda: cupo disponible y ledger vía API.
 */
import { useState, useMemo } from "react";
import { CreditCard, Plus, Minus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import type { Client } from "../lib/store";
import { formatCurrency, formatDate } from "../lib/utils";
import { useClients, useSales, useAdjustClientCredit } from "../api/hooks";
import { toast } from "sonner";
import axios from "axios";

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

export function StoreCredit() {
  const { data: clients = [], isLoading } = useClients();
  const { data: sales = [] } = useSales();
  const adjustCredit = useAdjustClientCredit();

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [creditAmount, setCreditAmount] = useState(0);
  const [isAdding, setIsAdding] = useState(true);

  const openAddCredit = (client: Client) => {
    setSelectedClient(client);
    setIsAdding(true);
    setCreditAmount(0);
    setShowModal(true);
  };

  const openDeductCredit = (client: Client) => {
    setSelectedClient(client);
    setIsAdding(false);
    setCreditAmount(0);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || creditAmount <= 0) return;

    const amount = isAdding ? creditAmount : -creditAmount;
    if (isAdding && selectedClient.creditBalance + creditAmount > selectedClient.creditLimit) {
      toast.error("No puedes recargar por encima del cupo máximo");
      return;
    }
    if (!isAdding && selectedClient.creditBalance < creditAmount) {
      toast.error("No puedes descontar más del cupo disponible");
      return;
    }

    adjustCredit.mutate(
      {
        id: selectedClient.id,
        data: {
          amount,
          description: isAdding ? "Recarga manual de cupo" : "Ajuste / descuento de cupo",
        },
      },
      {
        onSuccess: () => {
          toast.success(isAdding ? "Cupo recargado" : "Cupo descontado");
          setShowModal(false);
          setCreditAmount(0);
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      }
    );
  };

  const clientsWithCredit = useMemo(
    () => clients.filter((c) => c.creditBalance > 0),
    [clients]
  );
  const totalAvailableCredit = useMemo(
    () => clients.reduce((sum, c) => sum + c.creditBalance, 0),
    [clients]
  );
  const creditSales = useMemo(
    () =>
      [...sales]
        .filter((s) => s.paymentMethod === "credit")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10),
    [sales]
  );

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1>Crédito en tienda</h1>
        <p className="text-muted-foreground mt-1">Cupo disponible de clientes y movimientos de crédito</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Cupo disponible total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">{formatCurrency(totalAvailableCredit)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Clientes con cupo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">{clientsWithCredit.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Clientes registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">{clients.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" /> Cupo disponible de clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2">Cliente</th>
                    <th className="text-left py-3 px-2">Teléfono</th>
                    <th className="text-right py-3 px-2">Cupo disponible</th>
                    <th className="text-right py-3 px-2">Cupo máximo</th>
                    <th className="text-right py-3 px-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">{client.name}</td>
                      <td className="py-3 px-2 text-muted-foreground">{client.phone}</td>
                      <td className="py-3 px-2 text-right">
                        <Badge variant={client.creditBalance > 0 ? "warning" : "secondary"}>
                          {formatCurrency(client.creditBalance)}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground">
                        {formatCurrency(client.creditLimit)}
                      </td>
                      <td className="py-3 px-2 text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => openAddCredit(client)}>
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDeductCredit(client)}
                          disabled={client.creditBalance <= 0}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimas ventas a crédito</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {creditSales.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Sin ventas a crédito</p>
            ) : (
              creditSales.map((sale) => {
                const client = clients.find((c) => c.id === sale.clientId);
                return (
                  <div key={sale.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{client?.name ?? "Cliente"}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(sale.date)}</p>
                    </div>
                    <p className="font-medium">{formatCurrency(sale.total)}</p>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Modal
        open={showModal}
        onOpenChange={setShowModal}
        title={isAdding ? "Recargar cupo" : "Descontar cupo"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {selectedClient && (
            <p className="text-sm text-muted-foreground">
              Cliente: <strong>{selectedClient.name}</strong> — Cupo disponible:{" "}
              {formatCurrency(selectedClient.creditBalance)}
            </p>
          )}
          <div>
            <label className="block mb-2">Monto</label>
            <Input
              type="number"
              min="0"
              step="1000"
              required
              value={creditAmount || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreditAmount(Number(e.target.value))}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={adjustCredit.isPending}>
              {adjustCredit.isPending ? "Guardando…" : "Confirmar"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
