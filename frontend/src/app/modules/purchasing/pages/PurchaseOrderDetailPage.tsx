import React, { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { 
  ArrowLeft, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Truck, 
  History,
  FileText,
  AlertCircle
} from "lucide-react";
import { 
  useOrder, 
  useSubmitOrder, 
  useApproveOrder, 
  useRejectOrder, 
  useMarkAsOrdered, 
  useReceiveItems, 
  useCancelOrder,
  useProducts
} from "../../../api/hooks";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { StatusStepper } from "../components/StatusStepper";
import { ReceiveItemsTable } from "../components/ReceiveItemsTable";
import { formatCurrency, formatDate } from "../../../lib/utils";
import { toast } from "sonner";
import { Can, useAuth } from "../../../lib/auth-rbac";
import { Modal } from "../../../components/ui/modal";
import { Separator } from "../../../components/ui/separator";

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: order, isLoading: isOrderLoading } = useOrder(id!);
  const { data: products } = useProducts();

  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  const submitOrder = useSubmitOrder();
  const approveOrder = useApproveOrder();
  const rejectOrder = useRejectOrder();
  const markAsOrdered = useMarkAsOrdered();
  const receiveItems = useReceiveItems();
  const cancelOrder = useCancelOrder();

  if (isOrderLoading) return <div className="p-8 text-center">Cargando detalles de la orden...</div>;
  if (!order) return <div className="p-8 text-center text-red-500">Orden no encontrada</div>;

  const handleAction = async (action: any, successMsg: string) => {
    try {
      await action.mutateAsync(id!);
      toast.success(successMsg);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al procesar acción");
    }
  };

  const handleReject = async () => {
    try {
      await rejectOrder.mutateAsync({ id: id!, notes: rejectNotes });
      toast.success("Orden rechazada");
      setShowRejectModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al rechazar");
    }
  };

  const handleReceive = async (items: { productId: string; quantity: number }[]) => {
    try {
      await receiveItems.mutateAsync({ id: id!, items });
      toast.success("Recepción registrada correctamente");
      setShowReceiveModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Error al recibir");
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/purchase-orders")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Orden #{order.id}</h1>
          <p className="text-muted-foreground">{order.supplier}</p>
        </div>
        <div className="flex gap-2">
          {/* Workflow Actions */}
          {order.status === "draft" && (
            <Can permission="orders:create">
              <Button onClick={() => handleAction(submitOrder, "Orden enviada para aprobación")}>
                <Send className="w-4 h-4 mr-2" />
                Enviar para Aprobación
              </Button>
            </Can>
          )}

          {order.status === "pending_approval" && (
            <Can permission="orders:approve">
              <Button variant="outline" className="text-red-600" onClick={() => setShowRejectModal(true)}>
                <XCircle className="w-4 h-4 mr-2" />
                Rechazar
              </Button>
              <Button onClick={() => handleAction(approveOrder, "Orden aprobada")}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Aprobar Orden
              </Button>
            </Can>
          )}

          {order.status === "approved" && (
            <Can permission="orders:create">
              <Button onClick={() => handleAction(markAsOrdered, "Orden marcada como pedida")}>
                <Truck className="w-4 h-4 mr-2" />
                Marcar como Pedido
              </Button>
            </Can>
          )}

          {(order.status === "ordered" || order.status === "partially_received") && (
            <Can permission="orders:receive">
              <Button onClick={() => setShowReceiveModal(true)}>
                <History className="w-4 h-4 mr-2" />
                Registrar Recepción
              </Button>
            </Can>
          )}

          {["draft", "pending_approval", "approved", "ordered"].includes(order.status) && (
            <Can permission="orders:cancel">
               <Button variant="ghost" className="text-muted-foreground" onClick={() => handleAction(cancelOrder, "Orden cancelada")}>
                Anular
              </Button>
            </Can>
          )}
        </div>
      </div>

      <StatusStepper status={order.status} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Items de la Orden
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item) => {
                  const product = products?.find(p => String(p.id) === item.productId);
                  const progress = (item.receivedQuantity / item.quantity) * 100;
                  
                  return (
                    <div key={item.productId} className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{product?.name || "Producto"}</p>
                          <p className="text-xs text-muted-foreground">Código: {product?.code}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{item.quantity} unidades</p>
                          <p className="text-xs text-muted-foreground">Costo: {formatCurrency(item.unitCost)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 transition-all" 
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium whitespace-nowrap">
                          {item.receivedQuantity} / {item.quantity} recibidos
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Notas y Observaciones</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumen Financiero</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t pt-2">
                <span>Total Orden</span>
                <span className="text-lg text-blue-600">{formatCurrency(order.total)}</span>
              </div>
              <Separator />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Sucursal: {order.branchId}</p>
                <p>Creada: {formatDate(order.createdAt)}</p>
                {order.approvedAt && (
                   <div className="flex items-center gap-1 text-green-600 font-medium mt-2">
                     <CheckCircle2 className="w-3 h-3" />
                     <span>Aprobada el {formatDate(order.approvedAt)}</span>
                   </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-100">
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                 <AlertCircle className="w-4 h-4" />
                 Impacto en Inventario
               </CardTitle>
             </CardHeader>
             <CardContent>
               <p className="text-xs text-blue-700">
                 Al completar la recepción, el stock se incrementará automáticamente y se recalculará el costo promedio ponderado de los {order.items.length} productos incluidos.
               </p>
             </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal para Recibir Items */}
      <Modal 
        open={showReceiveModal} 
        onOpenChange={setShowReceiveModal} 
        title="Registrar Recepción de Mercancía"
        className="max-w-4xl"
      >
        <ReceiveItemsTable 
          order={order} 
          onReceive={handleReceive} 
          isLoading={receiveItems.isPending} 
        />
      </Modal>

      {/* Modal para Rechazar */}
      <Modal
        open={showRejectModal}
        onOpenChange={setShowRejectModal}
        title="Rechazar Orden de Compra"
      >
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">Indica el motivo del rechazo para que el supervisor pueda corregir la orden.</p>
          <textarea 
            className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
            placeholder="Motivo del rechazo..."
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectNotes || rejectOrder.isPending}>
              {rejectOrder.isPending ? "Rechazando..." : "Confirmar Rechazo"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
