import type { EntityId, UserId } from '@grounded/domain';
import { describe, expect, it } from 'vitest';
import {
  curateRoutineInputs,
  ExerciseService,
  type ExercisePreference,
  type ExerciseRepository,
  type ExerciseRoutine,
  type WorkoutSession,
} from './index';

class Repository implements ExerciseRepository {
  routines: ExerciseRoutine[] = [];
  sessions: WorkoutSession[] = [];
  preference: ExercisePreference | null = null;
  getRoutine(_owner: UserId, id: EntityId) {
    return Promise.resolve({
      ok: true as const,
      value: this.routines.find((item) => item.id === id) ?? null,
    });
  }
  listRoutines() {
    return Promise.resolve({ ok: true as const, value: this.routines });
  }
  saveRoutine(routine: ExerciseRoutine) {
    this.routines.push(routine);
    return Promise.resolve({ ok: true as const, value: routine });
  }
  archiveRoutine() {
    return Promise.resolve({ ok: true as const, value: undefined });
  }
  hasCompletedSessions(_owner: UserId, id: EntityId) {
    return Promise.resolve({
      ok: true as const,
      value: this.sessions.some((item) => item.routineId === id),
    });
  }
  listSessions() {
    return Promise.resolve({ ok: true as const, value: this.sessions });
  }
  saveSession(session: WorkoutSession) {
    this.sessions.push(session);
    return Promise.resolve({ ok: true as const, value: session });
  }
  getPreference() {
    return Promise.resolve({ ok: true as const, value: this.preference });
  }
  savePreference(preference: ExercisePreference) {
    this.preference = preference;
    return Promise.resolve({ ok: true as const, value: preference });
  }
}

describe('exercise planning', () => {
  it('curates hula hooping when that is what a person enjoys', () => {
    expect(curateRoutineInputs(['hula_hoop'], 3)).toHaveLength(3);
    expect(curateRoutineInputs(['hula_hoop'], 3)[0]?.steps[0]?.activityType).toBe('hula_hoop');
  });
  it('creates a new routine version after the original has history', async () => {
    const repository = new Repository();
    let id = 0;
    const service = new ExerciseService(
      repository,
      { now: () => new Date('2026-08-04T08:00:00Z') },
      { create: () => `id-${++id}` },
    );
    const ownerId = 'owner' as UserId;
    const first = await service.saveRoutine({
      ownerId,
      name: 'Ride',
      steps: [{ activityType: 'cycling', title: 'Easy ride', durationMinutes: 30 }],
    });
    if (!first.ok) throw new Error('fixture failed');
    await service.completeSession({
      ownerId,
      routine: first.value,
      activityType: 'cycling',
      durationMinutes: 30,
    });
    const edited = await service.saveRoutine({
      ownerId,
      id: first.value.id,
      name: 'Longer ride',
      steps: [{ activityType: 'cycling', title: 'Easy ride', durationMinutes: 45 }],
    });
    expect(edited.ok && edited.value.version).toBe(2);
    expect(edited.ok && edited.value.id).not.toBe(first.value.id);
  });
});
