import { useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Search, Star, Phone, Mail, MapPin, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Modal } from "../components/ui/modal";
import type { Supplier } from "../lib/store";
import { formatCurrency, formatDate } from "../lib/utils";
import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useOrders,
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

export function Suppliers() {
  const { data: suppliers = [], isLoading, isError, error } = useSuppliers();
  const { data: orders = [] } = useOrders();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();

  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
    rating: 5,
    isActive: true,
  });
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  useEffect(() => {
    if (isError) toast.error(apiErrorMessage(error));
  }, [isError, error]);

  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter(
        (s) =>
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.email.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [suppliers, searchTerm]
  );

  const supplierOrders = useMemo(() => {
    if (!selectedSupplierId) return [];
    return orders
      .filter((po) => po.supplierId === selectedSupplierId)
      .slice()
      .reverse();
  }, [orders, selectedSupplierId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSupplier) {
      updateSupplier.mutate(
        { id: editingSupplier.id, data: formData },
        {
          onSuccess: () => {
            toast.success("Proveedor actualizado");
            setShowAddModal(false);
            setEditingSupplier(null);
            resetForm();
          },
          onError: (err) => toast.error(apiErrorMessage(err)),
        }
      );
    } else {
      createSupplier.mutate(formData, {
        onSuccess: () => {
          toast.success("Proveedor creado");
          setShowAddModal(false);
          resetForm();
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      contactName: "",
      phone: "",
      email: "",
      address: "",
      rating: 5,
      isActive: true,
    });
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactName: supplier.contactName,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      rating: supplier.rating,
      isActive: supplier.isActive,
    });
    setShowAddModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1>Gestión de Proveedores</h1>
          <p className="text-muted-foreground mt-1">
            Directorio, evaluación e historial de órdenes de compra
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setEditingSupplier(null);
            setShowAddModal(true);
          }}
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Añadir Proveedor
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, contacto o email..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredSuppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className={`p-4 border rounded-lg transition-colors cursor-pointer ${
                      selectedSupplierId === supplier.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedSupplierId(supplier.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          {supplier.name}
                          {!supplier.isActive && (
                            <Badge variant="destructive">Inactivo</Badge>
                          )}
                        </h3>
                        <p className="text-muted-foreground">{supplier.contactName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center text-warning">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < supplier.rating
                                  ? "fill-current"
                                  : "text-muted-foreground opacity-30"
                              }`}
                            />
                          ))}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(supplier);
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4" /> {supplier.phone}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4" /> {supplier.email}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4" /> {supplier.address}
                      </div>
                    </div>
                  </div>
                ))}

                {filteredSuppliers.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No se encontraron proveedores
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>
                {selectedSupplierId ? "Historial de Órdenes" : "Selecciona un proveedor"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedSupplierId ? (
                <div className="space-y-4">
                  {supplierOrders.length > 0 ? (
                    supplierOrders.map((order) => (
                      <div
                        key={order.id}
                        className="p-3 border border-border rounded-lg bg-card"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">Orden #{order.id}</span>
                          <Badge
                            variant={
                              order.status === "received"
                                ? "success"
                                : order.status === "sent"
                                  ? "secondary"
                                  : "warning"
                            }
                          >
                            {order.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          {formatDate(order.date)}
                        </div>
                        <div className="text-right font-bold">
                          {formatCurrency(order.total)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      Este proveedor no tiene órdenes previas
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Haz clic en un proveedor para ver su historial de compras
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        title={editingSupplier ? "Editar Proveedor" : "Nuevo Proveedor"}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">Nombre Empresa</label>
              <Input
                required
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Razón Social"
              />
            </div>
            <div>
              <label className="block mb-2">Nombre Contacto</label>
              <Input
                required
                value={formData.contactName}
                onChange={(e) =>
                  setFormData({ ...formData, contactName: e.target.value })
                }
                placeholder="Persona de contacto"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">Teléfono</label>
              <Input
                required
                value={formData.phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Número celular/fijo"
              />
            </div>
            <div>
              <label className="block mb-2">Correo Electrónico</label>
              <Input
                type="email"
                required
                value={formData.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contacto@empresa.com"
              />
            </div>
          </div>

          <div>
            <label className="block mb-2">Dirección Física</label>
            <Input
              required
              value={formData.address}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Dirección completa"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">Evaluación (Estrellas)</label>
              <Input
                type="number"
                min="1"
                max="5"
                required
                value={formData.rating}
                onChange={(e) =>
                  setFormData({ ...formData, rating: Number(e.target.value) })
                }
              />
            </div>
            <div className="flex items-center gap-2 pt-8">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="w-4 h-4 cursor-pointer"
              />
              <label htmlFor="isActive" className="cursor-pointer">
                Proveedor Activo
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              className="flex-1"
              disabled={createSupplier.isPending || updateSupplier.isPending}
            >
              {editingSupplier ? "Actualizar Proveedor" : "Crear Proveedor"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                resetForm();
                setEditingSupplier(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
