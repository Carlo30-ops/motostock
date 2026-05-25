import { create } from "zustand";

export interface Product {
  id: string;
  name: string;
  category: string;
  brand: string;
  stock: number;
  salePrice: number;
  costPrice: number;
  reorderThreshold: number;
  code: string;
  barcode?: string;
  taxRate?: number;
}

export interface Combo {
  id: string;
  name: string;
  productIds: string[];
  price: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  motorcycleModel: string;
  lastServiceDate: string;
  oilChangeIntervalKm: number;
  currentKm: number;
  creditLimit: number;
  creditBalance: number;
}

export interface Sale {
  id: string;
  offlineId?: string;
  date: string;
  items: { productId: string; quantity: number; price: number }[];
  total: number;
  paymentMethod: "cash" | "card" | "credit" | "nequi";
  clientId?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  rating: number; // 1-5
  isActive: boolean;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  items: { productId: string; quantity: number; cost: number }[];
  status: "pending" | "sent" | "received";
  date: string;
  total: number;
}

export interface Vehicle {
  id: string;
  clientId: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
}

export interface ServiceTemplate {
  id: string;
  name: string;
  description: string;
  estimatedPrice: number;
  estimatedHours: number;
}

export interface WorkOrder {
  id: string;
  vehicleId: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  scheduledDate: string; // ISO date
  serviceIds: string[]; // references ServiceTemplate.id
  notes: string;
}

interface StoreState {
  tabletMode: boolean;
  products: Product[];
  combos: Combo[];
  clients: Client[];
  suppliers: Supplier[];
  vehicles: Vehicle[];
  serviceTemplates: ServiceTemplate[];
  workOrders: WorkOrder[];
  sales: Sale[];
  purchaseOrders: PurchaseOrder[];
  setTabletMode: (tabletMode: boolean) => void;
  addProduct: (product: Omit<Product, "id">) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  addSale: (sale: Omit<Sale, "id">) => void;
  addClient: (client: Omit<Client, "id">) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  addSupplier: (supplier: Omit<Supplier, "id">) => void;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;
  addPurchaseOrder: (order: Omit<PurchaseOrder, "id">) => void;
  updatePurchaseOrderStatus: (id: string, status: PurchaseOrder["status"]) => void;
  receivePurchaseOrder: (id: string) => void;
  getLowStockProducts: () => Product[];
  getTodayRevenue: () => number;
  getMonthRevenue: () => number;
  addVehicle: (vehicle: Omit<Vehicle, "id">) => void;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  addWorkOrder: (order: Omit<WorkOrder, "id">) => void;
  updateWorkOrderStatus: (id: string, status: WorkOrder["status"]) => void;
}

const initialProducts: Product[] = [
    {
      id: "1",
      name: "Motul 7100 10W-40 Engine Oil",
      category: "Oil & Lubricants",
      brand: "Motul",
      stock: 45,
      salePrice: 42.99,
      costPrice: 28.50,
      reorderThreshold: 20,
      code: "MOT7100",
    },
    {
      id: "2",
      name: "NGK Iridium Spark Plug",
      category: "Ignition",
      brand: "NGK",
      stock: 8,
      salePrice: 12.99,
      costPrice: 7.50,
      reorderThreshold: 15,
      code: "NGK-IR",
    },
    {
      id: "3",
      name: "EBC Brake Pads - Front",
      category: "Brakes",
      brand: "EBC",
      stock: 2,
      salePrice: 65.00,
      costPrice: 42.00,
      reorderThreshold: 5,
      code: "EBC-FP",
    },
    {
      id: "4",
      name: "K&N Air Filter",
      category: "Air Intake",
      brand: "K&N",
      stock: 18,
      salePrice: 55.99,
      costPrice: 35.00,
      reorderThreshold: 10,
      code: "KN-AF",
    },
    {
      id: "5",
      name: "DID Chain Kit 520",
      category: "Drive Train",
      brand: "DID",
      stock: 12,
      salePrice: 189.99,
      costPrice: 125.00,
      reorderThreshold: 8,
      code: "DID-520",
    },
    {
      id: "6",
      name: "Michelin Pilot Road 5 Rear Tire",
      category: "Tires",
      brand: "Michelin",
      stock: 0,
      salePrice: 245.00,
      costPrice: 165.00,
      reorderThreshold: 3,
      code: "MICH-PR5R",
    },
];

const initialCombos: Combo[] = [
    {
      id: "c1",
      name: "Oil Change Kit",
      productIds: ["1", "2"],
      price: 49.99,
    },
];

const initialClients: Client[] = [
    {
      id: "cl1",
      name: "John Martinez",
      phone: "(555) 123-4567",
      motorcycleModel: "Yamaha MT-07",
      lastServiceDate: "2026-04-15",
      oilChangeIntervalKm: 5000,
      currentKm: 9800,
      creditLimit: 500000,
      creditBalance: 0,
    },
    {
      id: "cl2",
      name: "Sarah Chen",
      phone: "(555) 234-5678",
      motorcycleModel: "Honda CB650R",
      lastServiceDate: "2026-03-20",
      oilChangeIntervalKm: 6000,
      currentKm: 14500,
      creditLimit: 500000,
      creditBalance: 45.50,
    },
    {
      id: "cl3",
      name: "Mike Johnson",
      phone: "(555) 345-6789",
      motorcycleModel: "Kawasaki Z900",
      lastServiceDate: "2026-05-01",
      oilChangeIntervalKm: 6000,
      currentKm: 18200,
      creditLimit: 500000,
      creditBalance: 0,
    },
];

const initialSales: Sale[] = [
    {
      id: "s1",
      date: "2026-05-07",
      items: [{ productId: "1", quantity: 2, price: 42.99 }],
      total: 85.98,
      paymentMethod: "card",
      clientId: "cl1",
    },
    {
      id: "s2",
      date: "2026-05-06",
      items: [
        { productId: "4", quantity: 1, price: 55.99 },
        { productId: "2", quantity: 2, price: 12.99 },
      ],
      total: 81.97,
      paymentMethod: "cash",
    },
    {
      id: "s3",
      date: "2026-05-05",
      items: [{ productId: "5", quantity: 1, price: 189.99 }],
      total: 189.99,
      paymentMethod: "credit",
      clientId: "cl2",
    },
];

const initialSuppliers: Supplier[] = [
  {
    id: "sup1",
    name: "Motul Distributor",
    contactName: "Carlos Ramirez",
    phone: "3001234567",
    email: "ventas@motuldist.com",
    address: "Calle 45 #12-34, Bogotá",
    rating: 5,
    isActive: true
  },
  {
    id: "sup2",
    name: "EBC Brakes Colombia",
    contactName: "Maria Fernandez",
    phone: "3109876543",
    email: "pedidos@ebcbrakes.co",
    address: "Cra 15 #78-90, Medellín",
    rating: 4,
    isActive: true
  }
];

const initialVehicles: Vehicle[] = [
  {
    id: "v1",
    clientId: "1",
    brand: "Yamaha",
    model: "MT-09",
    year: 2023,
    plate: "XYZ12E"
  }
];

const initialServiceTemplates: ServiceTemplate[] = [
  {
    id: "st1",
    name: "Mantenimiento General",
    description: "Revisión de 15 puntos, lubricación de guayas, ajuste de cadena, revisión de frenos y fluidos.",
    estimatedPrice: 85000,
    estimatedHours: 2.5
  },
  {
    id: "st2",
    name: "Cambio de Aceite Premium",
    description: "Cambio de aceite sintético, reemplazo de filtro y limpieza de tamiz.",
    estimatedPrice: 45000,
    estimatedHours: 0.5
  }
];

const initialWorkOrders: WorkOrder[] = [
  {
    id: "wo1",
    vehicleId: "v1",
    status: "in_progress",
    scheduledDate: new Date().toISOString().split("T")[0] as string,
    serviceIds: ["st1", "st2"],
    notes: "Cliente reporta sonido extraño en la rueda delantera."
  }
];

const initialPurchaseOrders: PurchaseOrder[] = [
    {
      id: "po1",
      supplierId: "sup1",
      items: [{ productId: "1", quantity: 24, cost: 28.50 }],
      status: "sent",
      date: "2026-05-05",
      total: 684.00,
    },
    {
      id: "po2",
      supplierId: "sup2",
      items: [
        { productId: "3", quantity: 10, cost: 42.00 },
        { productId: "6", quantity: 6, cost: 165.00 },
      ],
      status: "pending",
      date: "2026-05-07",
      total: 1410.00,
    },
];

const useStoreBase = create<StoreState>((set, get) => ({
  tabletMode: false,
  products: initialProducts,
  combos: initialCombos,
  clients: initialClients,
  suppliers: initialSuppliers,
  vehicles: initialVehicles,
  serviceTemplates: initialServiceTemplates,
  workOrders: initialWorkOrders,
  sales: initialSales,
  purchaseOrders: initialPurchaseOrders,

  setTabletMode: (tabletMode) => set({ tabletMode }),

  addProduct: (product) =>
    set((state) => ({
      products: [...state.products, { ...product, id: String(state.products.length + 1) }],
    })),

  updateProduct: (id, updates) =>
    set((state) => ({
      products: state.products.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),

  addSale: (sale) =>
    set((state) => {
      const newSale: Sale = { ...sale, id: `s${state.sales.length + 1}` };
      const products = state.products.map((product) => {
        let quantityToDeduct = 0;
        
        sale.items.forEach((item) => {
          if (item.productId === product.id) {
            quantityToDeduct += item.quantity;
          } else if (item.productId.startsWith("c")) {
            // It's a combo, check if this product is part of it
            const combo = state.combos.find(c => c.id === item.productId);
            if (combo && combo.productIds.includes(product.id)) {
              quantityToDeduct += item.quantity;
            }
          }
        });
        
        return quantityToDeduct > 0 ? { ...product, stock: product.stock - quantityToDeduct } : product;
      });
      const clients =
        sale.paymentMethod === "credit" && sale.clientId
          ? state.clients.map((client) =>
              client.id === sale.clientId
                ? { ...client, creditBalance: Math.max(0, client.creditBalance - sale.total) }
                : client
            )
          : state.clients;
      return {
        sales: [...state.sales, newSale],
        products,
        clients,
      };
    }),

  addClient: (client) =>
    set((state) => ({
      clients: [...state.clients, { ...client, id: `cl${state.clients.length + 1}` }],
    })),

  updateClient: (id, updates) =>
    set((state) => ({
      clients: state.clients.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  addSupplier: (supplier) =>
    set((state) => ({
      suppliers: [...state.suppliers, { ...supplier, id: `sup${state.suppliers.length + 1}` }],
    })),

  updateSupplier: (id, updates) =>
    set((state) => ({
      suppliers: state.suppliers.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),

  addVehicle: (vehicle: Omit<Vehicle, "id">) =>
    set((state) => ({
      vehicles: [...state.vehicles, { ...vehicle, id: `v${state.vehicles.length + 1}` }],
    })),

  updateVehicle: (id: string, updates: Partial<Vehicle>) =>
    set((state) => ({
      vehicles: state.vehicles.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    })),

  addWorkOrder: (order: Omit<WorkOrder, "id">) =>
    set((state) => ({
      workOrders: [...state.workOrders, { ...order, id: `wo${state.workOrders.length + 1}` }],
    })),

  updateWorkOrderStatus: (id: string, status: WorkOrder["status"]) =>
    set((state) => ({
      workOrders: state.workOrders.map((w) => (w.id === id ? { ...w, status } : w)),
    })),

  addPurchaseOrder: (order) =>
    set((state) => ({
      purchaseOrders: [...state.purchaseOrders, { ...order, id: `po${state.purchaseOrders.length + 1}` }],
    })),

  updatePurchaseOrderStatus: (id, status) =>
    set((state) => ({
      purchaseOrders: state.purchaseOrders.map((o) => (o.id === id ? { ...o, status } : o)),
    })),

  receivePurchaseOrder: (id) =>
    set((state) => {
      const order = state.purchaseOrders.find((o) => o.id === id);
      if (!order || order.status === "received") {
        return state;
      }
      const purchaseOrders = state.purchaseOrders.map((o) => (o.id === id ? { ...o, status: "received" as const } : o));
      const products = state.products.map((product) => {
        const item = order.items.find((i) => i.productId === product.id);
        return item ? { ...product, stock: product.stock + item.quantity } : product;
      });
      return { purchaseOrders, products };
    }),

  getLowStockProducts: () => {
    const { products } = get();
    return products.filter((p) => p.stock <= p.reorderThreshold);
  },

  getTodayRevenue: () => {
    const { sales } = get();
    const today = "2026-05-07";
    return sales.filter((s) => s.date === today).reduce((sum, s) => sum + s.total, 0);
  },

  getMonthRevenue: () => {
    const { sales } = get();
    const currentMonth = "2026-05";
    return sales.filter((s) => s.date.startsWith(currentMonth)).reduce((sum, s) => sum + s.total, 0);
  },
}));

type StoreHook = typeof useStoreBase & {
  readonly tabletMode: boolean;
  readonly products: Product[];
  readonly combos: Combo[];
  readonly clients: Client[];
  readonly suppliers: Supplier[];
  readonly vehicles: Vehicle[];
  readonly serviceTemplates: ServiceTemplate[];
  readonly workOrders: WorkOrder[];
  readonly sales: Sale[];
  readonly purchaseOrders: PurchaseOrder[];
  setTabletMode: (tabletMode: boolean) => void;
  addProduct: (product: Omit<Product, "id">) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  addSale: (sale: Omit<Sale, "id">) => void;
  addClient: (client: Omit<Client, "id">) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  addSupplier: (supplier: Omit<Supplier, "id">) => void;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;
  addVehicle: (vehicle: Omit<Vehicle, "id">) => void;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  addWorkOrder: (order: Omit<WorkOrder, "id">) => void;
  updateWorkOrderStatus: (id: string, status: WorkOrder["status"]) => void;
  addPurchaseOrder: (order: Omit<PurchaseOrder, "id">) => void;
  updatePurchaseOrderStatus: (id: string, status: PurchaseOrder["status"]) => void;
  receivePurchaseOrder: (id: string) => void;
  getLowStockProducts: () => Product[];
  getTodayRevenue: () => number;
  getMonthRevenue: () => number;
};

export const store = useStoreBase as StoreHook;

Object.defineProperties(store, {
  tabletMode: { get: () => useStoreBase.getState().tabletMode },
  products: { get: () => useStoreBase.getState().products },
  combos: { get: () => useStoreBase.getState().combos },
  clients: { get: () => useStoreBase.getState().clients },
  suppliers: { get: () => useStoreBase.getState().suppliers },
  vehicles: { get: () => useStoreBase.getState().vehicles },
  serviceTemplates: { get: () => useStoreBase.getState().serviceTemplates },
  workOrders: { get: () => useStoreBase.getState().workOrders },
  sales: { get: () => useStoreBase.getState().sales },
  purchaseOrders: { get: () => useStoreBase.getState().purchaseOrders },
});

store.setTabletMode = (tabletMode) => useStoreBase.getState().setTabletMode(tabletMode);
store.addProduct = (product) => useStoreBase.getState().addProduct(product);
store.updateProduct = (id, updates) => useStoreBase.getState().updateProduct(id, updates);
store.addSale = (sale) => useStoreBase.getState().addSale(sale);
store.addClient = (client) => useStoreBase.getState().addClient(client);
store.updateClient = (id, updates) => useStoreBase.getState().updateClient(id, updates);
store.addSupplier = (supplier) => useStoreBase.getState().addSupplier(supplier);
store.updateSupplier = (id, updates) => useStoreBase.getState().updateSupplier(id, updates);
store.addVehicle = (vehicle) => useStoreBase.getState().addVehicle(vehicle);
store.updateVehicle = (id, updates) => useStoreBase.getState().updateVehicle(id, updates);
store.addWorkOrder = (order) => useStoreBase.getState().addWorkOrder(order);
store.updateWorkOrderStatus = (id, status) => useStoreBase.getState().updateWorkOrderStatus(id, status);
store.addPurchaseOrder = (order) => useStoreBase.getState().addPurchaseOrder(order);
store.updatePurchaseOrderStatus = (id, status) => useStoreBase.getState().updatePurchaseOrderStatus(id, status);
store.receivePurchaseOrder = (id) => useStoreBase.getState().receivePurchaseOrder(id);
store.getLowStockProducts = () => useStoreBase.getState().getLowStockProducts();
store.getTodayRevenue = () => useStoreBase.getState().getTodayRevenue();
store.getMonthRevenue = () => useStoreBase.getState().getMonthRevenue();
