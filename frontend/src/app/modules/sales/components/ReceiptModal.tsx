import { Printer } from "lucide-react";
import { Modal } from "@shared/ui/modal";
import { Button } from "@shared/ui/button";
import { formatCurrency } from "@/lib/utils";
import { SaleReceipt } from "../types";

interface ReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: SaleReceipt | null;
  t: (key: string) => string;
}

export function ReceiptModal({ open, onOpenChange, receipt, t }: ReceiptModalProps) {
  if (!receipt) return null;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Recibo de Venta" className="max-w-[400px]">
      <div className="flex flex-col h-full max-h-[85vh]">
        <div className="flex-1 overflow-y-auto px-4 py-6 bg-white text-black" id="receipt-print-area">
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body * { visibility: hidden; }
              #receipt-print-area, #receipt-print-area * { visibility: visible; }
              #receipt-print-area {
                position: absolute; left: 0; top: 0;
                width: 80mm;
                padding: 0; margin: 0;
              }
              .no-print { display: none !important; }
            }
          `}} />
          
          <div className="font-mono text-xs text-center space-y-1 border-b border-dashed border-gray-400 pb-4 mb-4">
            <h2 className="text-lg font-black uppercase">MotoStock</h2>
            <p>NIT: 900.123.456-7</p>
            <p>Av. Principal #45-20, Centro</p>
            <p>Tel: (604) 555-0123</p>
            <div className="mt-2 pt-2 border-t border-dashed border-gray-400">
              <p>Factura: #{receipt.saleId}</p>
              <p>Fecha: {receipt.date.toLocaleString('es-CO')}</p>
              <p>Cajero: CAJA_01</p>
            </div>
          </div>

          <div className="font-mono text-xs mb-4">
            <p className="font-bold">Cliente:</p>
            <p>{receipt.client ? receipt.client.name : "CONSUMIDOR FINAL"}</p>
            {receipt.client && <p>CC/NIT: {receipt.client.id}</p>}
          </div>

          <table className="w-full font-mono text-[10px] mb-4">
            <thead className="border-b border-dashed border-gray-400">
              <tr>
                <th className="text-left py-1">CANT DESCRIPCIÓN</th>
                <th className="text-right py-1">TOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-gray-200">
              {receipt.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-2 pr-2">
                    <div className="font-bold">{item.quantity}x {item.product.name}</div>
                    <div className="text-gray-500">@{formatCurrency(item.product.salePrice)}</div>
                  </td>
                  <td className="py-2 text-right align-top font-bold">
                    {formatCurrency(item.product.salePrice * item.quantity * (item.quantity >= 5 ? 0.9 : 1))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="font-mono text-xs border-t border-dashed border-gray-400 pt-2 space-y-1 text-right">
            <div className="flex justify-between">
              <span>SUBTOTAL:</span>
              <span>{formatCurrency(receipt.subtotal)}</span>
            </div>
            {receipt.discountAmount > 0 && (
              <div className="flex justify-between text-black">
                <span>DESCUENTO:</span>
                <span>-{formatCurrency(receipt.discountAmount)}</span>
              </div>
            )}
            {receipt.ivaAmount > 0 && (
              <div className="flex justify-between">
                <span>IVA:</span>
                <span>{formatCurrency(receipt.ivaAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black mt-2 pt-2 border-t border-dashed border-gray-400">
              <span>TOTAL:</span>
              <span>{formatCurrency(receipt.total)}</span>
            </div>
          </div>

          <div className="font-mono text-xs mt-4 space-y-1">
            <div className="flex justify-between">
              <span>MÉTODO DE PAGO:</span>
              <span className="uppercase">{t(`payment.${receipt.paymentMethod}`)}</span>
            </div>
            {receipt.paymentMethod === 'cash' && (
              <>
                <div className="flex justify-between">
                  <span>RECIBIDO:</span>
                  <span>{formatCurrency(receipt.received)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>CAMBIO/VUELTO:</span>
                  <span>{formatCurrency(receipt.vuelto)}</span>
                </div>
              </>
            )}
          </div>

          <div className="text-center font-mono text-[10px] mt-8 pt-4 border-t border-dashed border-gray-400">
            <p className="font-bold mb-1">¡GRACIAS POR SU COMPRA!</p>
            <p>Software POS por MotoStock</p>
            <p>Impreso el: {new Date().toLocaleString('es-CO')}</p>
          </div>
        </div>
        
        <div className="p-4 bg-muted/20 border-t border-border flex gap-3 no-print">
          <Button onClick={() => window.print()} className="flex-1">
            <Printer className="w-4 h-4 mr-2" /> Imprimir Recibo
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Nueva Venta
          </Button>
        </div>
      </div>
    </Modal>
  );
}
