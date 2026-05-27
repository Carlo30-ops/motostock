import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { store, Sale } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";
import { useProducts, useClients, useCreateSale } from "@/api/hooks";
import { playSaleSuccessSound } from "@/lib/feedback";
import { Button } from "@shared/ui/Button";

// Module imports
import { useCart } from "../hooks/useCart";
import { ProductSearch } from "../components/ProductSearch";
import { CartTable } from "../components/CartTable";
import { ClientSelector } from "../components/ClientSelector";
import { SalesSummary } from "../components/SalesSummary";
import { ReceiptModal } from "../components/ReceiptModal";
import { ExitTabletModal } from "../components/ExitTabletModal";
import { CrossSellingSuggestions } from "../components/CrossSellingSuggestions";
import { SaleReceipt } from "../types";
import { salesService } from "../services/salesService";

export function SalesPage() {
  const { t } = useLanguage();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: clients = [] } = useClients();
  const createSale = useCreateSale();
  
  const tabletMode = store((state) => state.tabletMode);
  const setTabletMode = store((state) => state.setTabletMode);

  const cart = useCart();

  // Local UI state
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSaleReceipt, setLastSaleReceipt] = useState<SaleReceipt | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);

  const finishSaleUi = (createdSale: Sale) => {
    setLastSaleReceipt({
      saleId: createdSale.id,
      date: new Date(),
      client: cart.selectedClient,
      items: [...cart.cart],
      subtotal: cart.subtotal,
      discountAmount: cart.discountAmount,
      ivaAmount: cart.ivaAmount,
      total: createdSale.total,
      paymentMethod: createdSale.paymentMethod,
      received: Number(cart.cashReceived),
      vuelto: cart.paymentMethod === "cash" && Number(cart.cashReceived) >= createdSale.total ? Number(cart.cashReceived) - createdSale.total : 0,
    });
    cart.clearCart();
    setShowReceipt(true);
  };

  const handleCompleteSale = () => {
    if (cart.cart.length === 0) return;
    
    // Validations
    if (cart.cart.some((item) => item.isCombo)) {
      toast.error("Los combos aún no están disponibles en la API.");
      return;
    }

    if (cart.paymentMethod === "credit" && !cart.selectedClient) {
      toast.error("Selecciona un cliente para dar crédito.");
      return;
    }
    
    if (cart.paymentMethod === "credit" && cart.selectedClient && cart.total > cart.selectedClient.creditBalance) {
      toast.error("Crédito insuficiente.");
      return;
    }
    
    if (cart.paymentMethod === "cash" && (Number(cart.cashReceived) < cart.total || cart.cashReceived === "")) {
      toast.error("Monto recibido insuficiente.");
      return;
    }

    const sale: Omit<Sale, "id"> = {
      offlineId: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      items: cart.cart.map((item) => {
        const volumeDiscount = item.quantity >= 5 ? 0.9 : 1;
        return {
          productId: item.product.id,
          quantity: item.quantity,
          price: item.product.salePrice * volumeDiscount,
        };
      }),
      total: cart.total,
      paymentMethod: cart.paymentMethod,
      ...(cart.selectedClient ? { clientId: cart.selectedClient.id } : {}),
    };

    createSale.mutate(
      { data: sale, discountPct: cart.discountPercent },
      {
        onSuccess: (created) => {
          toast.success("Venta registrada");
          playSaleSuccessSound();
          finishSaleUi(created);
        },
        onError: (error) => toast.error(salesService.apiErrorMessage(error)),
      }
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto h-[calc(100vh-80px)] md:h-auto overflow-y-auto">
      {tabletMode && (
        <Button 
          variant="destructive" 
          size="sm" 
          onClick={() => setShowExitModal(true)}
          className="fixed top-4 right-4 z-50 shadow-lg rounded-full"
        >
          <LogOut className="w-4 h-4 mr-2" /> Salir de Caja
        </Button>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("sales.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("sales.subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Side: Search & Cart */}
        <div className="w-full lg:w-[60%] flex flex-col gap-6">
          <ProductSearch products={products} onSelect={cart.addToCart} isLoading={productsLoading} />
          <CartTable 
            items={cart.cart} 
            onUpdateQuantity={cart.updateQuantity} 
            onRemove={cart.removeFromCart} 
          />
          <CrossSellingSuggestions 
            cart={cart.cart} 
            allProducts={products} 
            onAdd={cart.addToCart} 
          />
        </div>

        {/* Right Side: Client & Summary */}
        <div className="w-full lg:w-[40%] flex flex-col gap-6">
          <ClientSelector 
            clients={clients} 
            selectedClient={cart.selectedClient} 
            onSelect={cart.setSelectedClient} 
          />
          <SalesSummary 
            subtotal={cart.subtotal}
            discountPercent={cart.discountPercent}
            discountAmount={cart.discountAmount}
            ivaAmount={cart.ivaAmount}
            total={cart.total}
            paymentMethod={cart.paymentMethod}
            cashReceived={cart.cashReceived}
            onDiscountChange={cart.handleDiscountChange}
            onPaymentMethodChange={cart.setPaymentMethod}
            onCashReceivedChange={cart.setCashReceived}
            onComplete={handleCompleteSale}
            isProcessing={createSale.isPending}
            canComplete={cart.cart.length > 0}
          />
        </div>
      </div>

      <ReceiptModal 
        open={showReceipt} 
        onOpenChange={setShowReceipt} 
        receipt={lastSaleReceipt} 
        t={t} 
      />

      <ExitTabletModal 
        open={showExitModal} 
        onOpenChange={setShowExitModal} 
        onSuccess={() => setTabletMode(false)} 
      />
    </div>
  );
}
