import { useState } from "react";
import { CreditCard, Plus, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { store, Client } from "../lib/store";
import { formatCurrency, formatDate } from "../lib/utils";
import { toast } from "sonner";

export function StoreCredit() {
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

    const newBalance = isAdding
      ? selectedClient.creditBalance + creditAmount
      : selectedClient.creditBalance - creditAmount;

    if (newBalance < 0) {
      toast.error("Cannot deduct more than available balance");
      return;
    }

    store.updateClient(selectedClient.id, { creditBalance: newBalance });
    setShowModal(false);
    setCreditAmount(0);
  };

  const clientsWithCredit = store.clients.filter((c) => c.creditBalance > 0);
  const totalCreditOutstanding = store.clients.reduce((sum, c) => sum + c.creditBalance, 0);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1>Store Credit Management</h1>
        <p className="text-muted-foreground mt-1">Manage customer credit balances and transactions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Total Credit Out</CardTitle>
              <div className="p-2 rounded-lg bg-warning/10">
                <CreditCard className="w-5 h-5 text-warning" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">{formatCurrency(totalCreditOutstanding)}</div>
            <p className="text-sm text-muted-foreground mt-1">{clientsWithCredit.length} clients with credit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Active Credits</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">{clientsWithCredit.length}</div>
            <p className="text-sm text-muted-foreground mt-1">Clients with outstanding balance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Total Clients</CardTitle>
              <div className="p-2 rounded-lg bg-success/10">
                <CreditCard className="w-5 h-5 text-success" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-medium">{store.clients.length}</div>
            <p className="text-sm text-muted-foreground mt-1">Registered in system</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client Credit Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2">Client</th>
                  <th className="text-left py-3 px-2">Phone</th>
                  <th className="text-left py-3 px-2">Motorcycle</th>
                  <th className="text-right py-3 px-2">Credit Balance</th>
                  <th className="text-center py-3 px-2">Status</th>
                  <th className="text-right py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {store.clients.map((client) => (
                  <tr key={client.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-2 font-medium">{client.name}</td>
                    <td className="py-3 px-2 text-muted-foreground">{client.phone}</td>
                    <td className="py-3 px-2">{client.motorcycleModel}</td>
                    <td className="py-3 px-2 text-right font-medium">
                      {formatCurrency(client.creditBalance)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <Badge variant={client.creditBalance > 0 ? "warning" : "success"}>
                        {client.creditBalance > 0 ? "Credit Due" : "Clear"}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openAddCredit(client)}>
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeductCredit(client)}
                          disabled={client.creditBalance === 0}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Credit Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {store.sales
              .filter((s) => s.paymentMethod === "credit")
              .reverse()
              .slice(0, 10)
              .map((sale) => {
                const client = store.clients.find((c) => c.id === sale.clientId);
                return (
                  <div key={sale.id} className="flex items-center justify-between py-2 border-b border-border">
                    <div>
                      <p className="font-medium">{client?.name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(sale.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-warning">+{formatCurrency(sale.total)}</p>
                      <p className="text-xs text-muted-foreground">Credit added</p>
                    </div>
                  </div>
                );
              })}
            {store.sales.filter((s) => s.paymentMethod === "credit").length === 0 && (
              <p className="text-center text-muted-foreground py-8">No credit transactions yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Modal open={showModal} onOpenChange={setShowModal} title={isAdding ? "Add Credit" : "Deduct Credit"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-2">Client</label>
            <Input value={selectedClient?.name || ""} disabled />
          </div>

          <div>
            <label className="block mb-2">Current Balance</label>
            <Input value={formatCurrency(selectedClient?.creditBalance || 0)} disabled />
          </div>

          <div>
            <label className="block mb-2">Amount</label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={creditAmount || ""}
              onChange={(e) => setCreditAmount(Number(e.target.value))}
              placeholder="Enter amount"
            />
          </div>

          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">New Balance</p>
            <p className="font-medium">
              {formatCurrency(
                isAdding
                  ? (selectedClient?.creditBalance || 0) + creditAmount
                  : (selectedClient?.creditBalance || 0) - creditAmount
              )}
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              {isAdding ? "Add Credit" : "Deduct Credit"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
