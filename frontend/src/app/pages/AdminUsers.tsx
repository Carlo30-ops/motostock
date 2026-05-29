import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus, Loader2 } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Modal } from "../components/ui/modal";
import { Badge } from "../components/ui/badge";
import { api } from "../api/client";
import { toast } from "sonner";
import { useAuth } from "../lib/auth-rbac";

export function AdminUsers() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "cashier",
    max_discount: 0.0,
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.get<any[]>("/users").then((res) => res.data),
  });

  const createUser = useMutation({
    mutationFn: (data: typeof formData) => api.post("/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Usuario creado exitosamente");
      setShowAddModal(false);
      setFormData({ username: "", email: "", password: "", role: "cashier", max_discount: 0.0 });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Error al crear usuario");
    },
  });

  const deleteUser = useMutation({
    mutationFn: (userId: number) => api.delete(`/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Usuario eliminado");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Error al eliminar usuario");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createUser.mutate(formData);
  };

  const handleDelete = (userId: number, username: string) => {
    if (window.confirm(`¿Estás seguro de eliminar al usuario ${username}?`)) {
      deleteUser.mutate(userId);
    }
  };

  const roles = [
    { value: "cashier", label: "Cajero" },
    { value: "mechanic", label: "Mecánico" },
    { value: "accountant", label: "Contador" },
    { value: "supervisor", label: "Supervisor" },
    { value: "admin", label: "Administrador" },
    { value: "superadmin", label: "Superadministrador" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Administra los accesos y roles de tu sucursal.</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          Nuevo Usuario
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium">{user.username}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={user.role === "superadmin" || user.role === "admin" ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.id !== currentUser?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(user.id, user.username)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal open={showAddModal} onOpenChange={setShowAddModal} title="Crear Nuevo Usuario">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre de usuario</label>
            <Input
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="ej: jdoe"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Correo electrónico</label>
            <Input
              required
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="ej: juan@taller.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Contraseña</label>
            <Input
              required
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Rol</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              {roles
                .filter(r => r.value !== "superadmin" || currentUser?.role === "superadmin")
                .map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
            </select>
          </div>
          {formData.role === "cashier" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Descuento Máximo (%)</label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.max_discount}
                onChange={(e) => setFormData({ ...formData, max_discount: parseFloat(e.target.value) })}
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar Usuario
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
