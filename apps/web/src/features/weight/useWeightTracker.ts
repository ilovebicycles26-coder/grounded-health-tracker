import type { Clock, IdGenerator } from '@grounded/application';
import type { DomainError, EntityId, Result, UserId } from '@grounded/domain';
import { SyncCoordinator } from '@grounded/sync';
import {
  calculateWeightSummary,
  type SaveWeightEntryInput,
  type SaveWeightGoalInput,
  type WeightEntry,
  type WeightGoal,
  WeightService,
} from '@grounded/weight';
import { LocalFirstWeightRepository } from '@grounded/weight-local';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { syncState } from '../sync/SyncStatusIndicator';
import { createAccountSyncTransport } from '../sync/runtime';
import { localStoreManager } from '../../platform/local/runtime';

const clock: Clock = { now: () => new Date() };
const ids: IdGenerator = { create: () => crypto.randomUUID() };

interface Runtime {
  readonly ownerId: UserId;
  readonly service: WeightService;
  readonly synchronize: () => Promise<void>;
}

export interface WeightTracker {
  readonly status: 'loading' | 'ready' | 'error';
  readonly error: DomainError | null;
  readonly entries: readonly WeightEntry[];
  readonly goal: WeightGoal | null;
  readonly summary: ReturnType<typeof calculateWeightSummary>;
  saveEntry(input: Omit<SaveWeightEntryInput, 'ownerId'>): Promise<Result<WeightEntry>>;
  removeEntry(id: EntityId): Promise<Result<void>>;
  saveGoal(input: Omit<SaveWeightGoalInput, 'ownerId'>): Promise<Result<WeightGoal>>;
  refresh(): Promise<void>;
}

function unavailable(): Result<never> {
  return { ok: false, error: { kind: 'unavailable', code: 'weight_tracker_not_ready' } };
}

export function useWeightTracker(): WeightTracker {
  const auth = useAuth();
  const ownerId = auth.session?.user.id as UserId | undefined;
  const runtime = useRef<Runtime | null>(null);
  const [status, setStatus] = useState<WeightTracker['status']>('loading');
  const [error, setError] = useState<DomainError | null>(null);
  const [entries, setEntries] = useState<readonly WeightEntry[]>([]);
  const [goal, setGoal] = useState<WeightGoal | null>(null);

  const readLocal = useCallback(async (active: Runtime): Promise<void> => {
    const [entryResult, goalResult] = await Promise.all([
      active.service.listEntries(active.ownerId),
      active.service.getGoal(active.ownerId),
    ]);
    if (!entryResult.ok) {
      setError(entryResult.error);
      setStatus('error');
      return;
    }
    if (!goalResult.ok) {
      setError(goalResult.error);
      setStatus('error');
      return;
    }
    setEntries(entryResult.value);
    setGoal(goalResult.value);
    setError(null);
    setStatus('ready');
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const active = runtime.current;
    if (!active) return;
    await active.synchronize();
    await readLocal(active);
  }, [readLocal]);

  useEffect(() => {
    const lifecycle = { active: true };
    runtime.current = null;
    if (!ownerId) return () => undefined;
    void localStoreManager.switchTo(ownerId).then(async (database) => {
      if (!lifecycle.active) return;
      const repository = new LocalFirstWeightRepository(database, clock, ids);
      const service = new WeightService(repository, clock, ids);
      const transport = createAccountSyncTransport(ownerId);
      const coordinator = transport
        ? new SyncCoordinator(database, transport, syncState, clock, ids)
        : null;
      const active: Runtime = {
        ownerId,
        service,
        synchronize: async () => {
          if (coordinator) await coordinator.run(navigator.onLine);
        },
      };
      runtime.current = active;
      await active.synchronize();
      if (runtime.current === active) await readLocal(active);
    });
    const handleOnline = () => void refresh();
    window.addEventListener('online', handleOnline);
    return () => {
      lifecycle.active = false;
      window.removeEventListener('online', handleOnline);
    };
  }, [ownerId, readLocal, refresh]);

  const saveEntry = useCallback(
    async (input: Omit<SaveWeightEntryInput, 'ownerId'>): Promise<Result<WeightEntry>> => {
      const active = runtime.current;
      if (!active) return unavailable();
      const result = await active.service.saveEntry({ ...input, ownerId: active.ownerId });
      await readLocal(active);
      if (result.ok) void active.synchronize().then(() => readLocal(active));
      return result;
    },
    [readLocal],
  );

  const removeEntry = useCallback(
    async (id: EntityId): Promise<Result<void>> => {
      const active = runtime.current;
      if (!active) return unavailable();
      const result = await active.service.removeEntry(active.ownerId, id);
      await readLocal(active);
      if (result.ok) void active.synchronize().then(() => readLocal(active));
      return result;
    },
    [readLocal],
  );

  const saveGoal = useCallback(
    async (input: Omit<SaveWeightGoalInput, 'ownerId'>): Promise<Result<WeightGoal>> => {
      const active = runtime.current;
      if (!active) return unavailable();
      const result = await active.service.saveGoal({ ...input, ownerId: active.ownerId });
      await readLocal(active);
      if (result.ok) void active.synchronize().then(() => readLocal(active));
      return result;
    },
    [readLocal],
  );

  return {
    status,
    error,
    entries,
    goal,
    summary: useMemo(() => calculateWeightSummary(entries, goal), [entries, goal]),
    saveEntry,
    removeEntry,
    saveGoal,
    refresh,
  };
}
