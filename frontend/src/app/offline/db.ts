import Dexie, { type Table } from "dexie";

export interface PendingMutation {
  id?: number;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  payload: unknown;
  createdAt: number;
}

class MotoStockOfflineDB extends Dexie {
  pendingMutations!: Table<PendingMutation, number>;

  constructor() {
    super("motostock-offline");
    this.version(1).stores({
      pendingMutations: "++id, endpoint, method, createdAt",
    });
  }
}

export const offlineDb = new MotoStockOfflineDB();
