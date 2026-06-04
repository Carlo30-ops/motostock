/**
 * Clientes conectados a la API (React Query).
 */
import { useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Calendar, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Modal } from "../components/ui/modal";
import type { Client } from "../lib/store";
import { formatDate } from "../lib/utils";
import { useLanguage } from "../lib/i18n";
import { useClients, useCreateClient, useUpdateClient } from "../api/hooks";
import { toast } from "sonner";
import axios from "axios";

function Spinner() {
  const { t } = useLanguage();
  return (
    <div className="flex justify-center items-center py-16" role="status" aria-label={t("common.loading")}>
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data;
    if (typeof detail === "object" && detail !== null && "detail" in detail) {
      return String((detail as { detail: unknown }).detail);
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Error";
}

export function Clients() {
  const { t } = useLanguage();
  const { data: clients = [], isLoading, isError, error } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    motorcycleModel: "",
    lastServiceDate: "",
    oilChangeIntervalKm: 6000,
    currentKm: 0,
    creditLimit: 500000,
    creditBalance: 0,
  });

  useEffect(() => {
    if (isError) toast.error(apiErrorMessage(error));
  }, [isError, error]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClient) {
      updateClient.mutate(
        { id: editingClient.id, data: formData },
        {
          onSuccess: () => {
            toast.success(t("clients.updated"));
            setShowModal(false);
            setEditingClient(null);
            resetForm();
          },
          onError: (err) => toast.error(apiErrorMessage(err)),
        }
      );
    } else {
      createClient.mutate(formData, {
        onSuccess: () => {
          toast.success(t("clients.created"));
          setShowModal(false);
          resetForm();
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      motorcycleModel: "",
      lastServiceDate: "",
      oilChangeIntervalKm: 6000,
      currentKm: 0,
      creditLimit: 500000,
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
      creditLimit: client.creditLimit,
      creditBalance: client.creditBalance,
    });
    setShowModal(true);
  };

  const getOilChangeStatus = (client: Client) => {
    const lastServiceKm = client.currentKm - client.oilChangeIntervalKm;
    const nextServiceKm = lastServiceKm + client.oilChangeIntervalKm;
    const remainingKm = nextServiceKm - client.currentKm;

    if (remainingKm <= 0) {
      return { variant: "destructive" as const, label: t("oil.overdue") };
    }
    if (remainingKm <= 500) {
      return { variant: "warning" as const, label: t("oil.dueSoon") };
    }
    return { variant: "success" as const, label: t("oil.ok") };
  };

  const getDaysUntilOilChange = (client: Client): number => {
    if (!client.lastServiceDate) return 999;
    const lastService = new Date(client.lastServiceDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysSinceService = Math.floor(
      (today.getTime() - lastService.getTime()) / (1000 * 60 * 60 * 24)
    );
    const estimatedDaysForInterval = Math.floor(client.oilChangeIntervalKm / 50);
    return Math.max(0, estimatedDaysForInterval - daysSinceService);
  };

  const dueThisWeek = useMemo(
    () => clients.filter((c) => {
      const days = getDaysUntilOilChange(c);
      return days <= 7 && days >= 0;
    }),
    [clients]
  );

  const dueNextWeek = useMemo(
    () => clients.filter((c) => {
      const days = getDaysUntilOilChange(c);
      return days > 7 && days <= 14;
    }),
    [clients]
  );

  const isSaving = createClient.isPending || updateClient.isPending;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1>{t("clients.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("clients.subtitle")}</p>
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
          {t("clients.newClient")}
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-2 border-warning/50 shadow-md bg-warning/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-warning" />
                  <CardTitle className="text-warning">{t("clients.dueThisWeek")}</CardTitle>
                  <Badge variant="warning" className="ml-auto">
                    {dueThisWeek.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dueThisWeek.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">{t("clients.noDueThisWeek")}</p>
                  ) : (
                    dueThisWeek.map((client) => (
                      <div key={client.id} className="p-3 border border-border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{client.name}</p>
                            <p className="text-sm text-muted-foreground">{client.motorcycleModel}</p>
                            <p className="text-sm text-muted-foreground mt-1">{client.phone}</p>
                          </div>
                          <Badge variant="warning">{getDaysUntilOilChange(client)} {t("clients.days")}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-primary/30 bg-primary/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <CardTitle>{t("clients.dueNextWeek")}</CardTitle>
                  <Badge variant="secondary" className="ml-auto">
                    {dueNextWeek.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dueNextWeek.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">{t("clients.noDueNextWeek")}</p>
                  ) : (
                    dueNextWeek.map((client) => (
                      <div key={client.id} className="p-3 border border-border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{client.name}</p>
                            <p className="text-sm text-muted-foreground">{client.motorcycleModel}</p>
                            <p className="text-sm text-muted-foreground mt-1">{client.phone}</p>
                          </div>
                          <Badge variant="secondary">{getDaysUntilOilChange(client)} {t("clients.days")}</Badge>
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
              <CardTitle>{t("clients.allClients")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2">{t("clients.name")}</th>
                      <th className="text-left py-3 px-2">{t("clients.phone")}</th>
                      <th className="text-left py-3 px-2">{t("clients.motorcycle")}</th>
                      <th className="text-left py-3 px-2">{t("clients.lastService")}</th>
                      <th className="text-right py-3 px-2">{t("clients.currentKm")}</th>
                      <th className="text-right py-3 px-2">{t("nav.credit")}</th>
                      <th className="text-center py-3 px-2">{t("clients.oilChangeStatus")}</th>
                      <th className="text-right py-3 px-2">{t("clients.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => {
                      const status = getOilChangeStatus(client);
                      const lastServiceKm = client.currentKm - client.oilChangeIntervalKm;
                      const nextServiceKm = lastServiceKm + client.oilChangeIntervalKm;

                      return (
                        <tr key={client.id} className="border-b border-border hover:bg-muted/50">
                          <td className="py-3 px-2 font-medium">{client.name}</td>
                          <td className="py-3 px-2 text-muted-foreground">{client.phone}</td>
                          <td className="py-3 px-2">{client.motorcycleModel}</td>
                          <td className="py-3 px-2 text-muted-foreground">
                            {client.lastServiceDate ? formatDate(client.lastServiceDate) : "—"}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div>
                              <p className="font-medium">{client.currentKm.toLocaleString()} km</p>
                              <p className="text-xs text-muted-foreground">
                                Próximo: {nextServiceKm.toLocaleString()} km
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <p className="font-medium">{client.creditBalance.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">
                              Max: {client.creditLimit.toLocaleString()}
                            </p>
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
        </>
      )}

      <Modal
        open={showModal}
        onOpenChange={setShowModal}
        title={editingClient ? t("clients.edit") : t("clients.newClient")}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">{t("clients.name")}</label>
              <Input
                required
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block mb-2">{t("clients.phone")}</label>
              <Input
                required
                value={formData.phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block mb-2">{t("clients.model")}</label>
            <Input
              required
              value={formData.motorcycleModel}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, motorcycleModel: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">{t("clients.lastServiceDate")}</label>
              <Input
                type="date"
                value={formData.lastServiceDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, lastServiceDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block mb-2">{t("clients.currentKilometers")}</label>
              <Input
                type="number"
                required
                min="0"
                value={formData.currentKm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, currentKm: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="block mb-2">{t("clients.oilChangeInterval")}</label>
            <Input
              type="number"
              required
              min="1000"
              step="1000"
              value={formData.oilChangeIntervalKm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFormData({ ...formData, oilChangeIntervalKm: Number(e.target.value) })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">{t("credit.addTitle")}</label>
              <Input
                type="number"
                required
                min="0"
                step="1000"
                value={formData.creditLimit}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block mb-2">{t("credit.currentBalance")}</label>
              <Input
                type="number"
                required
                min="0"
                step="1000"
                max={formData.creditLimit}
                value={formData.creditBalance}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, creditBalance: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1" disabled={isSaving}>
              {isSaving ? t("common.loading") : editingClient ? t("btn.updateClient") : t("btn.addClient")}
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
              {t("btn.cancel")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
