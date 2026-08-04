import type { Clock, IdGenerator } from '@grounded/application';
import type { DomainError, EntityId, Result, UserId } from '@grounded/domain';
import {
  HabitService,
  starterHabits,
  type HabitCategory,
  type HabitCompletion,
  type HabitDefinition,
  type WellbeingCheckin,
} from '@grounded/habits';
import { LocalFirstHabitRepository } from '@grounded/habits-local';
import { SyncCoordinator } from '@grounded/sync';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { syncState } from '../sync/SyncStatusIndicator';
import { createAccountSyncTransport } from '../sync/runtime';
import { localStoreManager } from '../../platform/local/runtime';
const clock: Clock = { now: () => new Date() };
const ids: IdGenerator = { create: () => crypto.randomUUID() };
interface Runtime {
  readonly ownerId: UserId;
  readonly service: HabitService;
  readonly synchronize: () => Promise<void>;
}
export function useHabitTracker() {
  const auth = useAuth();
  const ownerId = auth.session?.user.id as UserId | undefined;
  const runtime = useRef<Runtime | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<DomainError | null>(null);
  const [habits, setHabits] = useState<readonly HabitDefinition[]>([]);
  const [completions, setCompletions] = useState<readonly HabitCompletion[]>([]);
  const [checkins, setCheckins] = useState<readonly WellbeingCheckin[]>([]);
  const readLocal = useCallback(async (active: Runtime) => {
    const [h, c, w] = await Promise.all([
      active.service.listDefinitions(active.ownerId),
      active.service.listCompletions(active.ownerId),
      active.service.listCheckins(active.ownerId),
    ]);
    const failed = [h, c, w].find((r) => !r.ok);
    if (failed) {
      setError(failed.error);
      setStatus('error');
      return;
    }
    if (h.ok && c.ok && w.ok) {
      setHabits(h.value);
      setCompletions(c.value);
      setCheckins(w.value);
      setStatus('ready');
      setError(null);
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
      const service = new HabitService(
        new LocalFirstHabitRepository(database, clock, ids),
        clock,
        ids,
      );
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
      return { ok: false, error: { kind: 'unavailable', code: 'habit_tracker_not_ready' } };
    const result = await operation(active);
    await readLocal(active);
    if (result.ok) void active.synchronize().then(() => readLocal(active));
    return result;
  }
  return {
    status,
    error,
    habits,
    completions,
    checkins,
    refresh,
    saveHabit: (input: {
      readonly id?: EntityId;
      readonly name: string;
      readonly category: HabitCategory;
      readonly weekdays: readonly number[];
      readonly reminderTime?: string | null;
    }) => perform((a) => a.service.saveDefinition({ ...input, ownerId: a.ownerId })),
    archiveHabit: (id: EntityId) => perform((a) => a.service.archiveDefinition(a.ownerId, id)),
    setCompleted: (habitId: EntityId, date: string, completed: boolean) =>
      perform((a) => a.service.setCompleted(a.ownerId, habitId, date, completed)),
    saveCheckin: (input: {
      readonly checkedOn: string;
      readonly mood: number;
      readonly energy: number;
      readonly sleepQuality: number;
      readonly note?: string | null;
    }) => perform((a) => a.service.saveCheckin({ ...input, ownerId: a.ownerId })),
    addStarters: async () => {
      const active = runtime.current;
      if (!active) return false;
      for (const starter of starterHabits) {
        const result = await active.service.saveDefinition({ ...starter, ownerId: active.ownerId });
        if (!result.ok) return false;
      }
      await readLocal(active);
      void active.synchronize().then(() => readLocal(active));
      return true;
    },
  };
}
