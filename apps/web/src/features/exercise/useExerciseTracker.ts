import type { Clock, IdGenerator } from '@grounded/application';
import type { DomainError, EntityId, Result, UserId } from '@grounded/domain';
import {
  curateRoutineInputs,
  ExerciseService,
  type ActivityType,
  type ExercisePreference,
  type ExerciseRoutine,
  type SaveRoutineInput,
  type WorkoutSession,
} from '@grounded/exercise';
import { LocalFirstExerciseRepository } from '@grounded/exercise-local';
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
  readonly service: ExerciseService;
  readonly synchronize: () => Promise<void>;
}

export function useExerciseTracker() {
  const auth = useAuth();
  const ownerId = auth.session?.user.id as UserId | undefined;
  const runtime = useRef<Runtime | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<DomainError | null>(null);
  const [routines, setRoutines] = useState<readonly ExerciseRoutine[]>([]);
  const [sessions, setSessions] = useState<readonly WorkoutSession[]>([]);
  const [preference, setPreference] = useState<ExercisePreference | null>(null);
  const readLocal = useCallback(async (active: Runtime) => {
    const [routineResult, sessionResult, preferenceResult] = await Promise.all([
      active.service.listRoutines(active.ownerId),
      active.service.listSessions(active.ownerId),
      active.service.getPreference(active.ownerId),
    ]);
    const failed = [routineResult, sessionResult, preferenceResult].find((result) => !result.ok);
    if (failed) {
      setError(failed.error);
      setStatus('error');
      return;
    }
    if (routineResult.ok && sessionResult.ok && preferenceResult.ok) {
      setRoutines(routineResult.value);
      setSessions(sessionResult.value);
      setPreference(preferenceResult.value);
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
      const service = new ExerciseService(
        new LocalFirstExerciseRepository(database, clock, ids),
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
      return { ok: false, error: { kind: 'unavailable', code: 'exercise_tracker_not_ready' } };
    const result = await operation(active);
    await readLocal(active);
    if (result.ok) void active.synchronize().then(() => readLocal(active));
    return result;
  }
  return {
    status,
    error,
    routines,
    sessions,
    preference,
    refresh,
    saveRoutine: (input: Omit<SaveRoutineInput, 'ownerId'>) =>
      perform((active) => active.service.saveRoutine({ ...input, ownerId: active.ownerId })),
    archiveRoutine: (id: EntityId) =>
      perform((active) => active.service.archiveRoutine(active.ownerId, id)),
    completeSession: (input: {
      readonly routine?: ExerciseRoutine;
      readonly activityType: ActivityType;
      readonly durationMinutes: number;
      readonly perceivedEffort?: number | null;
      readonly note?: string | null;
    }) =>
      perform((active) => active.service.completeSession({ ...input, ownerId: active.ownerId })),
    curate: async (
      activities: readonly ActivityType[],
      daysPerWeek: number,
      sessionMinutes: number,
    ) => {
      const active = runtime.current;
      if (!active) return false;
      const savedPreference = await active.service.savePreference(
        active.ownerId,
        activities,
        daysPerWeek,
        sessionMinutes,
      );
      if (!savedPreference.ok) return false;
      for (const routine of curateRoutineInputs(activities, daysPerWeek)) {
        const result = await active.service.saveRoutine({ ...routine, ownerId: active.ownerId });
        if (!result.ok) return false;
      }
      await readLocal(active);
      void active.synchronize().then(() => readLocal(active));
      return true;
    },
  };
}
