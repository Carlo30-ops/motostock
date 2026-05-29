import axios, { type AxiosError } from "axios";
import { apiClient } from "../api/client";
import { offlineDb, type PendingMutation } from "./db";

export interface FlushResult {
  attempted: number;
  synced: number;
  failed: number;
  remaining: number;
  /** true si el fallo fue 401/403 (conviene volver a iniciar sesión). */
  authFailure: boolean;
  /** Mensaje breve del último error de red o HTTP; vacío si no aplica. */
  lastError: string;
}

export interface OfflineQueuedEventDetail {
  endpoint: string;
  pendingCount: number;
}

export type OfflineFlushedEventDetail = FlushResult;

function flushFailureMeta(caught: unknown): { lastError: string; authFailure: boolean } {
  let lastError = "Error desconocido";
  let authFailure = false;
  if (axios.isAxiosError(caught)) {
    const err = caught as AxiosError;
    const status = err.response?.status;
    const detail = err.response?.data;
    if (typeof detail === "object" && detail !== null && "detail" in detail) {
      lastError = String((detail as { detail: unknown }).detail);
    } else if (err.message) {
      lastError = err.message;
    }
    if (status === 401 || status === 403) {
      authFailure = true;
      lastError = status === 401 ? "Sesion expirada (401)." : "Permiso denegado (403).";
    }
  } else if (caught instanceof Error) {
    lastError = caught.message;
  }
  return { lastError, authFailure };
}

function emitOfflineQueued(detail: OfflineQueuedEventDetail) {
  window.dispatchEvent(new CustomEvent<OfflineQueuedEventDetail>("offline:queued", { detail }));
}

function emitOfflineFlushed(detail: OfflineFlushedEventDetail) {
  window.dispatchEvent(new CustomEvent<OfflineFlushedEventDetail>("offline:flushed", { detail }));
}

export async function enqueueOfflineMutation(mutation: Omit<PendingMutation, "id" | "createdAt">) {
  await offlineDb.pendingMutations.add({
    ...mutation,
    createdAt: Date.now(),
  });
  const pendingCount = await getPendingMutationsCount();
  emitOfflineQueued({ endpoint: mutation.endpoint, pendingCount });
}

export async function getPendingMutationsCount(): Promise<number> {
  return offlineDb.pendingMutations.count();
}

export async function listPendingMutations(): Promise<PendingMutation[]> {
  return offlineDb.pendingMutations.orderBy("createdAt").toArray();
}

export async function clearPendingMutations(): Promise<number> {
  const count = await getPendingMutationsCount();
  await offlineDb.pendingMutations.clear();
  emitOfflineFlushed({
    attempted: 0,
    synced: 0,
    failed: 0,
    remaining: 0,
    authFailure: false,
    lastError: "",
  });
  return count;
}

export async function removePendingMutationById(id: number): Promise<boolean> {
  const existing = await offlineDb.pendingMutations.get(id);
  if (!existing) {
    return false;
  }
  await offlineDb.pendingMutations.delete(id);
  const remaining = await getPendingMutationsCount();
  emitOfflineFlushed({
    attempted: 0,
    synced: 0,
    failed: 0,
    remaining,
    authFailure: false,
    lastError: "",
  });
  return true;
}

export async function flushPendingMutations(): Promise<FlushResult> {
  const pending = await offlineDb.pendingMutations.orderBy("createdAt").toArray();
  if (!pending.length || !navigator.onLine) {
    const result: FlushResult = {
      attempted: pending.length,
      synced: 0,
      failed: 0,
      remaining: pending.length,
      authFailure: false,
      lastError: "",
    };
    emitOfflineFlushed(result);
    return result;
  }

  let synced = 0;
  let failed = 0;
  for (const item of pending) {
    try {
      await apiClient.request({
        url: item.endpoint,
        method: item.method,
        data: item.payload,
      });
      if (item.id !== undefined) {
        await offlineDb.pendingMutations.delete(item.id);
      }
      synced += 1;
    } catch (error: unknown) {
      failed += 1;
      const { lastError, authFailure } = flushFailureMeta(error);
      console.warn("[offline:flush]", item.method, item.endpoint, lastError);
      const remainingAfterFail = await getPendingMutationsCount();
      const failResult: FlushResult = {
        attempted: pending.length,
        synced,
        failed,
        remaining: remainingAfterFail,
        authFailure,
        lastError,
      };
      emitOfflineFlushed(failResult);
      return failResult;
    }
  }

  const remaining = await getPendingMutationsCount();
  const result: FlushResult = {
    attempted: pending.length,
    synced,
    failed,
    remaining,
    authFailure: false,
    lastError: "",
  };
  emitOfflineFlushed(result);
  return result;
}
