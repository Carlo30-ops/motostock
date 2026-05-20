import { useState } from "react";
import { Plus, Edit2, Calendar, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { store, Client } from "../lib/store";
import { formatDate } from "../lib/utils";

export function Clients() {
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    motorcycleModel: "",
    lastServiceDate: "",
    oilChangeIntervalKm: 6000,
    currentKm: 0,
    creditBalance: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClient) {
      store.updateClient(editingClient.id, formData);
      setEditingClient(null);
    } else {
      store.addClient(formData);
    }
    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      motorcycleModel: "",
      lastServiceDate: "",
      oilChangeIntervalKm: 6000,
      currentKm: 0,
      creditBalance: 0,
    });
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      phone: client.phone,
      motorcycleModel: client.motorcycleModel,
      lastServiceDate: client.lastServiceDate,
      oilChangeIntervalKm: client.oilChangeIntervalKm,
      currentKm: client.currentKm,
      creditBalance: client.creditBalance,
    });
    setShowModal(true);
  };

  const getOilChangeStatus = (client: Client) => {
    const lastServiceKm = client.currentKm - client.oilChangeIntervalKm;
    const nextServiceKm = lastServiceKm + client.oilChangeIntervalKm;
    const remainingKm = nextServiceKm - client.currentKm;

    if (remainingKm <= 0) {
      return { variant: "destructive" as const, label: "Overdue", urgency: "high" };
    } else if (remainingKm <= 500) {
      return { variant: "warning" as const, label: "Due Soon", urgency: "medium" };
    } else {
      return { variant: "success" as const, label: "Good", urgency: "low" };
    }
  };

  const getDaysUntilOilChange = (client: Client): number => {
    const lastService = new Date(client.lastServiceDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysSinceService = Math.floor((today.getTime() - lastService.getTime()) / (1000 * 60 * 60 * 24));
    const estimatedDaysForInterval = Math.floor(client.oilChangeIntervalKm / 50);
    return Math.max(0, estimatedDaysForInterval - daysSinceService);
  };

  const getDueThisWeek = () => {
    return store.clients.filter((client) => {
      const days = getDaysUntilOilChange(client);
      return days <= 7 && days >= 0;
    });
  };

  const getDueNextWeek = () => {
    return store.clients.filter((client) => {
      const days = getDaysUntilOilChange(client);
      return days > 7 && days <= 14;
    });
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1>Client Management</h1>
          <p className="text-muted-foreground mt-1">Track clients and service reminders</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setEditingClient(null);
            setShowModal(true);
          }}
          size="sm"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              <CardTitle>Oil Change Due This Week</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {getDueThisWeek().length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No clients due this week</p>
              ) : (
                getDueThisWeek().map((client) => (
                  <div key={client.id} className="p-3 border border-border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{client.name}</p>
                        <p className="text-sm text-muted-foreground">{client.motorcycleModel}</p>
                        <p className="text-sm text-muted-foreground mt-1">{client.phone}</p>
                      </div>
                      <Badge variant="warning">{getDaysUntilOilChange(client)} days</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <CardTitle>Oil Change Due Next Week</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {getDueNextWeek().length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No clients due next week</p>
              ) : (
                getDueNextWeek().map((client) => (
                  <div key={client.id} className="p-3 border border-border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{client.name}</p>
                        <p className="text-sm text-muted-foreground">{client.motorcycleModel}</p>
                        <p className="text-sm text-muted-foreground mt-1">{client.phone}</p>
                      </div>
                      <Badge variant="secondary">{getDaysUntilOilChange(client)} days</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2">Name</th>
                  <th className="text-left py-3 px-2">Phone</th>
                  <th className="text-left py-3 px-2">Motorcycle</th>
                  <th className="text-left py-3 px-2">Last Service</th>
                  <th className="text-right py-3 px-2">Current KM</th>
                  <th className="text-center py-3 px-2">Oil Change Status</th>
                  <th className="text-right py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {store.clients.map((client) => {
                  const status = getOilChangeStatus(client);
                  const lastServiceKm = client.currentKm - client.oilChangeIntervalKm;
                  const nextServiceKm = lastServiceKm + client.oilChangeIntervalKm;

                  return (
                    <tr key={client.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">{client.name}</td>
                      <td className="py-3 px-2 text-muted-foreground">{client.phone}</td>
                      <td className="py-3 px-2">{client.motorcycleModel}</td>
                      <td className="py-3 px-2 text-muted-foreground">{formatDate(client.lastServiceDate)}</td>
                      <td className="py-3 px-2 text-right">
                        <div>
                          <p className="font-medium">{client.currentKm.toLocaleString()} km</p>
                          <p className="text-xs text-muted-foreground">
                            Next: {nextServiceKm.toLocaleString()} km
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(client)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal
        open={showModal}
        onOpenChange={setShowModal}
        title={editingClient ? "Edit Client" : "Add New Client"}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">Name</label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Client name"
              />
            </div>
            <div>
              <label className="block mb-2">Phone</label>
              <Input
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div>
            <label className="block mb-2">Motorcycle Model</label>
            <Input
              required
              value={formData.motorcycleModel}
              onChange={(e) => setFormData({ ...formData, motorcycleModel: e.target.value })}
              placeholder="e.g., Yamaha MT-07"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">Last Service Date</label>
              <Input
                type="date"
                required
                value={formData.lastServiceDate}
                onChange={(e) => setFormData({ ...formData, lastServiceDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block mb-2">Current Kilometers</label>
              <Input
                type="number"
                required
                min="0"
                value={formData.currentKm}
                onChange={(e) => setFormData({ ...formData, currentKm: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="block mb-2">Oil Change Interval (km)</label>
            <Input
              type="number"
              required
              min="1000"
              step="1000"
              value={formData.oilChangeIntervalKm}
              onChange={(e) => setFormData({ ...formData, oilChangeIntervalKm: Number(e.target.value) })}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              {editingClient ? "Update Client" : "Add Client"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowModal(false);
                resetForm();
                setEditingClient(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
