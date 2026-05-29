import { useState } from "react";
import { PurchaseOrder } from "../../../lib/store";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "../../../components/ui/table";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { useProducts } from "../../../api/hooks";

interface ReceiveItemsTableProps {
  order: PurchaseOrder;
  onReceive: (items: { productId: string; quantity: number }[]) => void;
  isLoading?: boolean;
}

export function ReceiveItemsTable({ order, onReceive, isLoading }: ReceiveItemsTableProps) {
  const { data: products } = useProducts();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const handleQtyChange = (productId: string, val: string) => {
    const num = parseInt(val) || 0;
    const item = order.items.find(i => i.productId === productId);
    if (!item) return;

    const remaining = item.quantity - (item.receivedQuantity || 0);
    const safeVal = Math.max(0, Math.min(num, remaining));

    setQuantities(prev => ({
      ...prev,
      [productId]: safeVal
    }));
  };

  const handleFullReceive = () => {
    const fullQtys: Record<string, number> = {};
    order.items.forEach(item => {
      fullQtys[item.productId] = item.quantity - (item.receivedQuantity || 0);
    });
    setQuantities(fullQtys);
  };

  const handleSubmit = () => {
    const toReceive = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));

    if (toReceive.length > 0) {
      onReceive(toReceive);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Registrar Recepción</h3>
        <Button variant="outline" size="sm" onClick={handleFullReceive}>
          Recibir Todo lo Pendiente
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead className="text-center">Pedido</TableHead>
            <TableHead className="text-center">Recibido</TableHead>
            <TableHead className="text-center">Pendiente</TableHead>
            <TableHead className="w-[120px]">A Recibir</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.items.map((item) => {
            const product = products?.find(p => String(p.id) === item.productId);
            const remaining = item.quantity - (item.receivedQuantity || 0);

            return (
              <TableRow key={item.productId}>
                <TableCell>
                  <div className="font-medium">{product?.name || "Producto desconocido"}</div>
                  <div className="text-xs text-gray-500">{product?.code}</div>
                </TableCell>
                <TableCell className="text-center">{item.quantity}</TableCell>
                <TableCell className="text-center text-green-600 font-medium">
                  {item.receivedQuantity || 0}
                </TableCell>
                <TableCell className="text-center text-blue-600 font-medium">
                  {remaining}
                </TableCell>
                <TableCell>
                  <Input 
                    type="number" 
                    min={0} 
                    max={remaining}
                    value={quantities[item.productId] ?? 0}
                    onChange={(e) => handleQtyChange(item.productId, e.target.value)}
                    disabled={remaining <= 0 || isLoading}
                    className="h-8"
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex justify-end gap-2">
        <Button 
          onClick={handleSubmit} 
          disabled={isLoading || !Object.values(quantities).some(q => q > 0)}
        >
          {isLoading ? "Procesando..." : "Confirmar Recepción"}
        </Button>
      </div>
    </div>
  );
}

