import { useState } from "react";
import {
  Wrench,
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  Bike,
  FileText,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import type { WorkOrder } from "../lib/store";
import { formatDate } from "../lib/utils";
import {
  useClients,
  useServiceTemplates,
  useVehicles,
  useWorkOrders,
  useCreateVehicle,
  useCreateWorkOrder,
  useUpdateWorkOrderStatus,
} from "../api/hooks";
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

import { useAuth, Can } from "../lib/auth-rbac";

export function Workshop() {
  const { user: currentUser } = useAuth();
  const { data: clients = [] } = useClients();
  const { data: serviceTemplates = [] } = useServiceTemplates();
  const { data: vehicles = [], isLoading: loadingVehicles } = useVehicles();
  const { data: workOrders = [], isLoading: loadingOrders } = useWorkOrders();
  const createVehicle = useCreateVehicle();
  const createWorkOrder = useCreateWorkOrder();
  const updateStatus = useUpdateWorkOrderStatus();

  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const [vehicleForm, setVehicleForm] = useState({
    clientId: "",
    brand: "",
    model: "",
    year: new Date().getFullYear(),
    plate: "",
  });

  const [orderForm, setOrderForm] = useState({
    vehicleId: "",
    scheduledDate: new Date().toISOString().split("T")[0],
    serviceIds: [] as string[],
    notes: "",
  });

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    createVehicle.mutate(vehicleForm, {
      onSuccess: () => {
        toast.success("Vehículo registrado");
        setShowVehicleModal(false);
        setVehicleForm({
          clientId: "",
          brand: "",
          model: "",
          year: new Date().getFullYear(),
          plate: "",
        });
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    });
  };

  const handleAddOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderForm.serviceIds.length === 0) {
      toast.error("Selecciona al menos un servicio");
      return;
    }
    createWorkOrder.mutate(orderForm, {
      onSuccess: () => {
        toast.success("Orden de trabajo creada");
        setShowOrderModal(false);
        setOrderForm({
          vehicleId: "",
          scheduledDate: new Date().toISOString().split("T")[0],
          serviceIds: [],
          notes: "",
        });
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    });
  };

  const toggleServiceSelection = (serviceId: string) => {
    setOrderForm((prev) => {
      if (prev.serviceIds.includes(serviceId)) {
        return { ...prev, serviceIds: prev.serviceIds.filter((id) => id !== serviceId) };
      }
      return { ...prev, serviceIds: [...prev.serviceIds, serviceId] };
    });
  };

  const getStatusBadge = (status: WorkOrder["status"]) => {
    switch (status) {
      case "scheduled":
        return (
          <Badge variant="secondary">
            <Calendar className="w-3 h-3 mr-1" /> Agendado
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="warning">
            <Wrench className="w-3 h-3 mr-1" /> En Progreso
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="success">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Terminado
          </Badge>
        );
      case "cancelled":
        return <Badge variant="destructive">Cancelado</Badge>;
    }
  };

  const advanceOrderStatus = (orderId: string, currentStatus: WorkOrder["status"]) => {
    const next: WorkOrder["status"] | null =
      currentStatus === "scheduled"
        ? "in_progress"
        : currentStatus === "in_progress"
          ? "completed"
          : null;
    if (!next) return;
    updateStatus.mutate(
      { id: orderId, status: next },
      {
        onSuccess: () => toast.success("Estado actualizado"),
        onError: (err) => toast.error(apiErrorMessage(err)),
      }
    );
  };

  const renderOrderCard = (order: WorkOrder, column: WorkOrder["status"]) => {
    const vehicle = vehicles.find((v) => v.id === order.vehicleId);
    const client = clients.find((c) => c.id === vehicle?.clientId);
    return (
      <Card
        key={order.id}
        className={
          column === "in_progress"
            ? "border-warning/50 bg-warning/5"
            : column === "completed"
              ? "border-success/20 bg-success/5 opacity-80"
              : "border-border"
        }
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <span className="font-medium text-sm">
              #{order.id}
              {column === "scheduled" ? ` - ${formatDate(order.scheduledDate)}` : ""}
            </span>
            {getStatusBadge(order.status)}
          </div>
          <div className="mb-3">
            <p className="font-bold text-lg">
              {vehicle?.brand} {vehicle?.model}
            </p>
            <p className="text-sm text-muted-foreground">
              Placa: {vehicle?.plate}
              {client ? ` • ${client.name}` : ""}
            </p>
          </div>
          {column === "in_progress" && (
            <div className="space-y-1 mb-4">
              <p className="text-xs font-semibold text-warning">Servicios Activos:</p>
              {order.serviceIds.map((sid) => {
                const srv = serviceTemplates.find((s) => s.id === sid);
                return (
                  <p key={sid} className="text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {srv?.name}
                  </p>
                );
              })}
            </div>
          )}
          {column === "scheduled" && (
            <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{order.notes}</p>
          )}
          {column === "scheduled" && (
            <Can permission="workshop:updateStatus">
              <Button
                size="sm"
                className="w-full text-xs"
                variant="outline"
                onClick={() => advanceOrderStatus(order.id, order.status)}
              >
                Iniciar Trabajo
              </Button>
            </Can>
          )}
          {column === "in_progress" && (
            <Can permission="workshop:updateStatus">
              <Button
                size="sm"
                className="w-full text-xs"
                variant="primary"
                onClick={() => advanceOrderStatus(order.id, order.status)}
              >
                Marcar Terminado
              </Button>
            </Can>
          )}
          {column === "completed" && (
            <Button size="sm" className="w-full text-xs" variant="outline">
              <FileText className="w-3 h-3 mr-1" /> Ver Detalles
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loadingVehicles || loadingOrders) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const scheduled = workOrders.filter((o) => o.status === "scheduled");
  const inProgress = workOrders.filter((o) => o.status === "in_progress");
  const completed = workOrders.filter((o) => o.status === "completed");

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1>Taller y Servicios</h1>
          <p className="text-muted-foreground mt-1">
            Gestión de vehículos, citas y órdenes de trabajo
          </p>
        </div>
        <div className="flex gap-2">
          <Can permission="workshop:createOrder">
            <Button onClick={() => setShowVehicleModal(true)} variant="outline" size="sm">
              <Bike className="w-4 h-4 mr-2" />
              Nuevo Vehículo
            </Button>
          </Can>
          <Can permission="workshop:createOrder">
            <Button onClick={() => setShowOrderModal(true)} size="sm" variant="primary">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Orden
            </Button>
          </Can>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2 text-muted-foreground border-b pb-2">
            <Calendar className="w-5 h-5" /> Agendadas
            <Badge className="ml-auto bg-muted text-muted-foreground">{scheduled.length}</Badge>
          </h3>
          <div className="space-y-3">
            {scheduled.map((order) => renderOrderCard(order, "scheduled"))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2 text-warning border-b border-warning/20 pb-2">
            <Wrench className="w-5 h-5" /> En Progreso
            <Badge className="ml-auto bg-warning/10 text-warning">{inProgress.length}</Badge>
          </h3>
          <div className="space-y-3">
            {inProgress.map((order) => renderOrderCard(order, "in_progress"))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2 text-success border-b border-success/20 pb-2">
            <CheckCircle2 className="w-5 h-5" /> Terminados
            <Badge className="ml-auto bg-success/10 text-success">{completed.length}</Badge>
          </h3>
          <div className="space-y-3">
            {completed.map((order) => renderOrderCard(order, "completed"))}
          </div>
        </div>
      </div>

      <Modal open={showVehicleModal} onOpenChange={setShowVehicleModal} title="Registrar Vehículo">
        <form onSubmit={handleAddVehicle} className="space-y-4">
          <div>
            <label className="block mb-2 text-sm font-medium">Cliente Dueño</label>
            <select
              required
              className="w-full p-2 border border-input rounded-lg bg-input-background"
              value={vehicleForm.clientId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVehicleForm({ ...vehicleForm, clientId: e.target.value })}
            >
              <option value="">Seleccione un cliente...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.phone}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm font-medium">Marca</label>
              <Input
                required
                value={vehicleForm.brand}
                onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })}
                placeholder="Ej: Yamaha"
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium">Modelo</label>
              <Input
                required
                value={vehicleForm.model}
                onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                placeholder="Ej: FZ-25"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm font-medium">Año</label>
              <Input
                type="number"
                required
                value={vehicleForm.year}
                onChange={(e) =>
                  setVehicleForm({ ...vehicleForm, year: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium">Placa</label>
              <Input
                required
                value={vehicleForm.plate}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    plate: e.target.value.toUpperCase(),
                  })
                }
                placeholder="AAA123"
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={createVehicle.isPending}>
            Guardar Vehículo
          </Button>
        </form>
      </Modal>

      <Modal open={showOrderModal} onOpenChange={setShowOrderModal} title="Crear Orden de Trabajo">
        <form onSubmit={handleAddOrder} className="space-y-4">
          <div>
            <label className="block mb-2 text-sm font-medium">Vehículo</label>
            <select
              required
              className="w-full p-2 border border-input rounded-lg bg-input-background"
              value={orderForm.vehicleId}
              onChange={(e) => setOrderForm({ ...orderForm, vehicleId: e.target.value })}
            >
              <option value="">Seleccione un vehículo...</option>
              {vehicles.map((v) => {
                const client = clients.find((c) => c.id === v.clientId);
                return (
                  <option key={v.id} value={v.id}>
                    {v.plate} - {v.brand} {v.model} ({client?.name})
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium">Fecha Programada</label>
            <Input
              type="date"
              required
              value={orderForm.scheduledDate}
              onChange={(e) =>
                setOrderForm({ ...orderForm, scheduledDate: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium">Servicios a Realizar</label>
            <div className="space-y-2 border rounded-lg p-3 max-h-48 overflow-y-auto">
              {serviceTemplates.map((st) => (
                <div key={st.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id={st.id}
                    checked={orderForm.serviceIds.includes(st.id)}
                    onChange={() => toggleServiceSelection(st.id)}
                    className="mt-1"
                  />
                  <label htmlFor={st.id} className="text-sm cursor-pointer">
                    <span className="font-semibold">{st.name}</span>
                    <p className="text-xs text-muted-foreground">{st.description}</p>
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium">
              Observaciones / Notas del Cliente
            </label>
            <textarea
              className="w-full p-2 border border-input rounded-lg bg-input-background h-24 resize-none"
              placeholder="Ej: Cliente indica que los frenos suenan..."
              value={orderForm.notes}
              onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
            />
          </div>
          <Button type="submit" className="w-full" disabled={createWorkOrder.isPending}>
            Generar Orden
          </Button>
        </form>
      </Modal>
    </div>
  );
}
