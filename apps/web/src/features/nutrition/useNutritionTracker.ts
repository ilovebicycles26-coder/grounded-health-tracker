import type { Clock, IdGenerator } from '@grounded/application';
import type { DomainError, EntityId, Result, UserId } from '@grounded/domain';
import {
  calculateDailyNutrition,
  NutritionService,
  type FoodEntry,
  type FoodFavourite,
  type SaveFoodEntryInput,
  type SaveFoodFavouriteInput,
  type SaveNutritionTargetInput,
  type NutritionTarget,
} from '@grounded/nutrition';
import { LocalFirstNutritionRepository } from '@grounded/nutrition-local';
import { SyncCoordinator } from '@grounded/sync';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { syncState } from '../sync/SyncStatusIndicator';
import { createAccountSyncTransport } from '../sync/runtime';
import { localStoreManager } from '../../platform/local/runtime';

const clock: Clock = { now: () => new Date() };
const ids: IdGenerator = { create: () => crypto.randomUUID() };

interface Runtime {
  readonly ownerId: UserId;
  readonly service: NutritionService;
  readonly synchronize: () => Promise<void>;
}

export function useNutritionTracker(date: string) {
  const auth = useAuth();
  const ownerId = auth.session?.user.id as UserId | undefined;
  const runtime = useRef<Runtime | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<DomainError | null>(null);
  const [entries, setEntries] = useState<readonly FoodEntry[]>([]);
  const [targets, setTargets] = useState<readonly NutritionTarget[]>([]);
  const [favourites, setFavourites] = useState<readonly FoodFavourite[]>([]);

  const readLocal = useCallback(async (active: Runtime) => {
    const [entryResult, targetResult, favouriteResult] = await Promise.all([
      active.service.listEntries(active.ownerId),
      active.service.listTargets(active.ownerId),
      active.service.listFavourites(active.ownerId),
    ]);
    const failed = [entryResult, targetResult, favouriteResult].find((result) => !result.ok);
    if (failed) {
      setError(failed.error);
      setStatus('error');
      return;
    }
    if (entryResult.ok && targetResult.ok && favouriteResult.ok) {
      setEntries(entryResult.value);
      setTargets(targetResult.value);
      setFavourites(favouriteResult.value);
      setError(null);
      setStatus('ready');
    }
  }, []);

  const refresh = useCallback(async () => {
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
      const repository = new LocalFirstNutritionRepository(database, clock, ids);
      const transport = createAccountSyncTransport(ownerId);
      const coordinator = transport
        ? new SyncCoordinator(database, transport, syncState, clock, ids)
        : null;
      const active: Runtime = {
        ownerId,
        service: new NutritionService(repository, clock, ids),
        synchronize: async () => {
          if (coordinator) await coordinator.run(navigator.onLine);
        },
      };
      runtime.current = active;
      await active.synchronize();
      if (runtime.current === active) await readLocal(active);
    });
    const online = () => void refresh();
    window.addEventListener('online', online);
    return () => {
      lifecycle.active = false;
      window.removeEventListener('online', online);
    };
  }, [ownerId, readLocal, refresh]);

  async function perform<T>(
    operation: (active: Runtime) => Promise<Result<T>>,
  ): Promise<Result<T>> {
    const active = runtime.current;
    if (!active)
      return { ok: false, error: { kind: 'unavailable', code: 'nutrition_tracker_not_ready' } };
    const result = await operation(active);
    await readLocal(active);
    if (result.ok) void active.synchronize().then(() => readLocal(active));
    return result;
  }

  return {
    status,
    error,
    entries,
    targets,
    favourites,
    summary: useMemo(
      () => calculateDailyNutrition(entries, targets, date as never),
      [date, entries, targets],
    ),
    refresh,
    saveEntry: (input: Omit<SaveFoodEntryInput, 'ownerId'>) =>
      perform((active) => active.service.saveEntry({ ...input, ownerId: active.ownerId })),
    removeEntry: (id: EntityId) =>
      perform((active) => active.service.removeEntry(active.ownerId, id)),
    saveTarget: (input: Omit<SaveNutritionTargetInput, 'ownerId'>) =>
      perform((active) => active.service.saveTarget({ ...input, ownerId: active.ownerId })),
    saveFavourite: (input: Omit<SaveFoodFavouriteInput, 'ownerId'>) =>
      perform((active) => active.service.saveFavourite({ ...input, ownerId: active.ownerId })),
    removeFavourite: (id: EntityId) =>
      perform((active) => active.service.removeFavourite(active.ownerId, id)),
  };
}
