import { createContext, useContext, useState, ReactNode } from "react";

type Language = "en" | "es";

interface Translations {
  [key: string]: {
    en: string;
    es: string;
  };
}

const translations: Translations = {
  // Navigation
  "nav.dashboard": { en: "Dashboard", es: "Panel" },
  "nav.inventory": { en: "Inventory", es: "Inventario" },
  "nav.sales": { en: "Sales", es: "Ventas" },
  "nav.credit": { en: "Store Credit", es: "Crédito" },
  "nav.clients": { en: "Clients", es: "Clientes" },
  "nav.reports": { en: "Reports", es: "Reportes" },
  "nav.orders": { en: "Orders", es: "Pedidos" },

  // Dashboard
  "dashboard.title": { en: "Dashboard", es: "Panel de Control" },
  "dashboard.subtitle": { en: "Welcome back to MotoStock", es: "Bienvenido a MotoStock" },
  "dashboard.todayRevenue": { en: "Today's Revenue", es: "Ingresos de Hoy" },
  "dashboard.monthSales": { en: "Month Sales", es: "Ventas del Mes" },
  "dashboard.lowStockAlerts": { en: "Low Stock Alerts", es: "Alertas de Stock Bajo" },
  "dashboard.pendingOrders": { en: "Pending Orders", es: "Pedidos Pendientes" },
  "dashboard.revenueOverview": { en: "Revenue Overview", es: "Resumen de Ingresos" },
  "dashboard.recentSales": { en: "Recent Sales", es: "Ventas Recientes" },
  "dashboard.viewItems": { en: "View items", es: "Ver artículos" },
  "dashboard.manageOrders": { en: "Manage orders", es: "Gestionar pedidos" },
  "dashboard.fromYesterday": { en: "from yesterday", es: "desde ayer" },
  "dashboard.allStocked": { en: "All products are well stocked", es: "Todos los productos tienen buen stock" },
  "dashboard.walkInCustomer": { en: "Walk-in Customer", es: "Cliente sin registro" },

  // Buttons
  "btn.newSale": { en: "New Sale", es: "Nueva Venta" },
  "btn.addInventory": { en: "Add Inventory", es: "Añadir Inventario" },
  "btn.addProduct": { en: "Add Product", es: "Añadir Producto" },
  "btn.addClient": { en: "Add Client", es: "Añadir Cliente" },
  "btn.newOrder": { en: "New Order", es: "Nuevo Pedido" },
  "btn.save": { en: "Save", es: "Guardar" },
  "btn.cancel": { en: "Cancel", es: "Cancelar" },
  "btn.close": { en: "Close", es: "Cerrar" },
  "btn.export": { en: "Export", es: "Exportar" },
  "btn.autoRestock": { en: "Auto-Generate Restock", es: "Auto-Generar Reposición" },
  "btn.completeSale": { en: "Complete Sale", es: "Completar Venta" },
  "btn.createOrder": { en: "Create Order", es: "Crear Pedido" },
  "btn.updateProduct": { en: "Update Product", es: "Actualizar Producto" },
  "btn.updateClient": { en: "Update Client", es: "Actualizar Cliente" },
  "btn.addCredit": { en: "Add Credit", es: "Añadir Crédito" },
  "btn.deductCredit": { en: "Deduct Credit", es: "Deducir Crédito" },
  "btn.markSent": { en: "Mark as Sent", es: "Marcar como Enviado" },
  "btn.markReceived": { en: "Mark as Received", es: "Marcar como Recibido" },

  // Periods
  "period.daily": { en: "Daily", es: "Diario" },
  "period.weekly": { en: "Weekly", es: "Semanal" },
  "period.monthly": { en: "Monthly", es: "Mensual" },

  // Inventory
  "inventory.title": { en: "Inventory Management", es: "Gestión de Inventario" },
  "inventory.subtitle": { en: "Manage products and stock levels", es: "Administrar productos y niveles de stock" },
  "inventory.search": { en: "Search products by name, code, or brand...", es: "Buscar productos por nombre, código o marca..." },
  "inventory.addProduct": { en: "Add New Product", es: "Añadir Nuevo Producto" },
  "inventory.editProduct": { en: "Edit Product", es: "Editar Producto" },
  "inventory.productName": { en: "Product Name", es: "Nombre del Producto" },
  "inventory.productCode": { en: "Product Code", es: "Código del Producto" },
  "inventory.category": { en: "Category", es: "Categoría" },
  "inventory.brand": { en: "Brand", es: "Marca" },
  "inventory.stock": { en: "Stock", es: "Stock" },
  "inventory.salePrice": { en: "Sale Price", es: "Precio de Venta" },
  "inventory.costPrice": { en: "Cost Price", es: "Precio de Costo" },
  "inventory.reorderThreshold": { en: "Reorder Threshold", es: "Umbral de Reorden" },
  "inventory.stockQuantity": { en: "Stock Quantity", es: "Cantidad en Stock" },
  "inventory.noProducts": { en: "No products found", es: "No se encontraron productos" },
  "inventory.inStock": { en: "in stock", es: "en stock" },
  "inventory.enterProductName": { en: "Enter product name", es: "Nombre del producto" },
  "inventory.enterCode": { en: "e.g., MOT7100", es: "ej., MOT7100" },
  "inventory.enterCategory": { en: "e.g., Oil & Lubricants", es: "ej., Aceites y Lubricantes" },
  "inventory.enterBrand": { en: "e.g., Motul", es: "ej., Motul" },

  // Stock Status
  "stock.outOfStock": { en: "Out of Stock", es: "Sin Stock" },
  "stock.critical": { en: "Critical", es: "Crítico" },
  "stock.lowStock": { en: "Low Stock", es: "Stock Bajo" },
  "stock.inStock": { en: "In Stock", es: "En Stock" },

  // Sales
  "sales.title": { en: "Sales & Combos", es: "Ventas y Combos" },
  "sales.subtitle": { en: "Create new sales and manage combo packages", es: "Crear nuevas ventas y gestionar paquetes combo" },
  "sales.productSearch": { en: "Product Search", es: "Búsqueda de Productos" },
  "sales.searchPlaceholder": { en: "Search by product name or code...", es: "Buscar por nombre o código de producto..." },
  "sales.cart": { en: "Shopping Cart", es: "Carrito de Compras" },
  "sales.cartEmpty": { en: "Cart is empty", es: "El carrito está vacío" },
  "sales.discount": { en: "Discount (%)", es: "Descuento (%)" },
  "sales.paymentMethod": { en: "Payment Method", es: "Método de Pago" },
  "sales.selectClient": { en: "Select Client", es: "Seleccionar Cliente" },
  "sales.chooseClient": { en: "Choose a client...", es: "Elegir un cliente..." },
  "sales.subtotal": { en: "Subtotal", es: "Subtotal" },
  "sales.total": { en: "Total", es: "Total" },
  "sales.saleComplete": { en: "Sale Complete", es: "Venta Completada" },
  "sales.saleSuccess": { en: "Sale completed successfully", es: "Venta completada exitosamente" },
  "sales.noProducts": { en: "No products found", es: "No se encontraron productos" },
  "sales.startTyping": { en: "Start typing to search products", es: "Comienza a escribir para buscar productos" },

  // Payment Methods
  "payment.cash": { en: "Cash", es: "Efectivo" },
  "payment.card": { en: "Card", es: "Tarjeta" },
  "payment.credit": { en: "Credit", es: "Crédito" },

  // Store Credit
  "credit.title": { en: "Store Credit Management", es: "Gestión de Crédito" },
  "credit.subtitle": { en: "Manage customer credit balances and transactions", es: "Administrar saldos de crédito y transacciones de clientes" },
  "credit.totalOut": { en: "Total Credit Out", es: "Crédito Total Pendiente" },
  "credit.activeCredits": { en: "Active Credits", es: "Créditos Activos" },
  "credit.totalClients": { en: "Total Clients", es: "Total de Clientes" },
  "credit.balances": { en: "Client Credit Balances", es: "Saldos de Crédito de Clientes" },
  "credit.transactions": { en: "Recent Credit Transactions", es: "Transacciones de Crédito Recientes" },
  "credit.withCredit": { en: "clients with credit", es: "clientes con crédito" },
  "credit.outstanding": { en: "Clients with outstanding balance", es: "Clientes con saldo pendiente" },
  "credit.registered": { en: "Registered in system", es: "Registrados en el sistema" },
  "credit.due": { en: "Credit Due", es: "Crédito Pendiente" },
  "credit.clear": { en: "Clear", es: "Sin Deuda" },
  "credit.added": { en: "Credit added", es: "Crédito añadido" },
  "credit.noTransactions": { en: "No credit transactions yet", es: "No hay transacciones de crédito aún" },
  "credit.addTitle": { en: "Add Credit", es: "Añadir Crédito" },
  "credit.deductTitle": { en: "Deduct Credit", es: "Deducir Crédito" },
  "credit.currentBalance": { en: "Current Balance", es: "Saldo Actual" },
  "credit.amount": { en: "Amount", es: "Monto" },
  "credit.newBalance": { en: "New Balance", es: "Nuevo Saldo" },

  // Clients
  "clients.title": { en: "Client Management", es: "Gestión de Clientes" },
  "clients.subtitle": { en: "Track clients and service reminders", es: "Rastrear clientes y recordatorios de servicio" },
  "clients.dueThisWeek": { en: "Oil Change Due This Week", es: "Cambio de Aceite Esta Semana" },
  "clients.dueNextWeek": { en: "Oil Change Due Next Week", es: "Cambio de Aceite Próxima Semana" },
  "clients.noDueThisWeek": { en: "No clients due this week", es: "No hay clientes pendientes esta semana" },
  "clients.noDueNextWeek": { en: "No clients due next week", es: "No hay clientes pendientes la próxima semana" },
  "clients.allClients": { en: "All Clients", es: "Todos los Clientes" },
  "clients.name": { en: "Name", es: "Nombre" },
  "clients.phone": { en: "Phone", es: "Teléfono" },
  "clients.motorcycle": { en: "Motorcycle", es: "Motocicleta" },
  "clients.lastService": { en: "Last Service", es: "Último Servicio" },
  "clients.currentKm": { en: "Current KM", es: "KM Actual" },
  "clients.oilChangeStatus": { en: "Oil Change Status", es: "Estado Cambio de Aceite" },
  "clients.actions": { en: "Actions", es: "Acciones" },
  "clients.addNew": { en: "Add New Client", es: "Añadir Nuevo Cliente" },
  "clients.edit": { en: "Edit Client", es: "Editar Cliente" },
  "clients.model": { en: "Motorcycle Model", es: "Modelo de Motocicleta" },
  "clients.lastServiceDate": { en: "Last Service Date", es: "Fecha Último Servicio" },
  "clients.currentKilometers": { en: "Current Kilometers", es: "Kilómetros Actuales" },
  "clients.oilChangeInterval": { en: "Oil Change Interval (km)", es: "Intervalo Cambio de Aceite (km)" },
  "clients.days": { en: "days", es: "días" },
  "clients.next": { en: "Next", es: "Próximo" },

  // Oil Change Status
  "oil.overdue": { en: "Overdue", es: "Atrasado" },
  "oil.dueSoon": { en: "Due Soon", es: "Próximo" },
  "oil.good": { en: "Good", es: "Bien" },

  // Reports
  "reports.title": { en: "Reports & Analytics", es: "Reportes y Análisis" },
  "reports.subtitle": { en: "View sales and inventory insights", es: "Ver información de ventas e inventario" },
  "reports.dateRange": { en: "Date Range", es: "Rango de Fechas" },
  "reports.from": { en: "From", es: "Desde" },
  "reports.to": { en: "To", es: "Hasta" },
  "reports.sales": { en: "Sales Report", es: "Reporte de Ventas" },
  "reports.inventory": { en: "Inventory Report", es: "Reporte de Inventario" },
  "reports.totalSold": { en: "Total Sold", es: "Total Vendido" },
  "reports.totalProfit": { en: "Total Profit", es: "Ganancia Total" },
  "reports.averageTicket": { en: "Average Ticket", es: "Ticket Promedio" },
  "reports.transactions": { en: "Transactions", es: "Transacciones" },
  "reports.topProducts": { en: "Top Selling Products", es: "Productos Más Vendidos" },
  "reports.stockValue": { en: "Stock Value Overview", es: "Resumen de Valor de Stock" },
  "reports.currentStock": { en: "Current Stock Value", es: "Valor de Stock Actual" },
  "reports.totalProducts": { en: "Total Products", es: "Total de Productos" },
  "reports.totalUnits": { en: "Total Units", es: "Unidades Totales" },
  "reports.slowMovers": { en: "Slow Moving Items", es: "Artículos de Movimiento Lento" },
  "reports.exportPDF": { en: "Export PDF", es: "Exportar PDF" },
  "reports.exportCSV": { en: "Export CSV", es: "Exportar CSV" },
  "reports.margin": { en: "margin", es: "margen" },
  "reports.perTransaction": { en: "Per transaction", es: "Por transacción" },
  "reports.totalSales": { en: "Total sales", es: "Ventas totales" },
  "reports.unitsSold": { en: "units sold", es: "unidades vendidas" },
  "reports.revenue": { en: "Revenue", es: "Ingresos" },
  "reports.noSales": { en: "No sales in selected period", es: "No hay ventas en el período seleccionado" },
  "reports.movingWell": { en: "All products moving well", es: "Todos los productos se mueven bien" },
  "reports.lowSales": { en: "Low sales", es: "Ventas bajas" },

  // Purchase Orders
  "orders.title": { en: "Purchase Orders", es: "Órdenes de Compra" },
  "orders.subtitle": { en: "Manage supplier orders and inventory restocking", es: "Administrar pedidos de proveedores y reposición de inventario" },
  "orders.pending": { en: "Pending", es: "Pendiente" },
  "orders.sent": { en: "Sent", es: "Enviado" },
  "orders.received": { en: "Received", es: "Recibido" },
  "orders.awaiting": { en: "Awaiting confirmation", es: "Esperando confirmación" },
  "orders.inTransit": { en: "In transit", es: "En tránsito" },
  "orders.completed": { en: "Completed", es: "Completado" },
  "orders.all": { en: "All Orders", es: "Todos los Pedidos" },
  "orders.create": { en: "Create Purchase Order", es: "Crear Orden de Compra" },
  "orders.supplier": { en: "Supplier Name", es: "Nombre del Proveedor" },
  "orders.addProducts": { en: "Add Products", es: "Añadir Productos" },
  "orders.selectProduct": { en: "Select a product...", es: "Seleccionar un producto..." },
  "orders.noProducts": { en: "No products added", es: "No se añadieron productos" },
  "orders.orderTotal": { en: "Order Total", es: "Total del Pedido" },
  "orders.noOrders": { en: "No purchase orders yet", es: "No hay órdenes de compra aún" },
  "orders.remove": { en: "Remove", es: "Eliminar" },

  // Common
  "common.code": { en: "Code", es: "Código" },
  "common.product": { en: "Product", es: "Producto" },
  "common.status": { en: "Status", es: "Estado" },
  "common.client": { en: "Client", es: "Cliente" },
  "common.date": { en: "Date", es: "Fecha" },
  "common.quantity": { en: "Qty", es: "Cant" },
  "common.units": { en: "units", es: "unidades" },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
