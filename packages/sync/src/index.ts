import type { Clock, IdGenerator } from '@grounded/application';
import type {
  JsonValue,
  LocalDatabase,
  LocalEntity,
  OutboxOperation,
  RemoteEntity,
  SyncConflict,
} from '@grounded/local-store';

export type SyncPhase = 'synced' | 'offline' | 'syncing' | 'action_required';
export interface SyncSnapshot {
  readonly phase: SyncPhase;
  readonly pendingCount: number;
  readonly conflictCount: number;
  readonly lastSyncedAt: string | null;
}

export class ObservableSyncState {
  private snapshot: SyncSnapshot = {
    phase: 'synced',
    pendingCount: 0,
    conflictCount: 0,
    lastSyncedAt: null,
  };
  private readonly listeners = new Set<(snapshot: SyncSnapshot) => void>();
  public get(): SyncSnapshot {
    return this.snapshot;
  }
  public set(snapshot: SyncSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }
  public subscribe(listener: (snapshot: SyncSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }
}

export type PushOutcome =
  | {
      readonly kind: 'ack';
      readonly operationId: string;
      readonly revision: number;
      readonly updatedAt: string;
    }
  | { readonly kind: 'retry'; readonly operationId: string }
  | {
      readonly kind: 'conflict';
      readonly operationId: string;
      readonly remotePayload: JsonValue | null;
      readonly remoteRevision: number;
      readonly remoteUpdatedAt: string;
    };

export interface SyncTransport {
  push(operations: readonly OutboxOperation[]): Promise<readonly PushOutcome[]>;
  pull?(
    cursor: string | null,
    limit: number,
  ): Promise<{
    readonly entities: readonly RemoteEntity[];
    readonly nextCursor: string | null;
  }>;
}

export interface RoutedSyncTransport extends SyncTransport {
  readonly supportedEntityTypes: readonly string[];
}

type CompositeCursor = Readonly<Record<string, string | null>>;

function parseCompositeCursor(cursor: string | null): CompositeCursor {
  if (!cursor) return {};
  try {
    const parsed: unknown = JSON.parse(cursor);
    return typeof parsed === 'object' && parsed !== null ? (parsed as CompositeCursor) : {};
  } catch {
    return {};
  }
}

export class CompositeSyncTransport implements SyncTransport {
  public constructor(private readonly transports: readonly RoutedSyncTransport[]) {
    const claimed = new Set<string>();
    for (const transport of transports) {
      for (const entityType of transport.supportedEntityTypes) {
        if (claimed.has(entityType)) throw new Error(`Duplicate sync transport for ${entityType}.`);
        claimed.add(entityType);
      }
    }
  }

  public async push(operations: readonly OutboxOperation[]): Promise<readonly PushOutcome[]> {
    const pending = new Map(operations.map((operation) => [operation.operationId, operation]));
    const outcomes: PushOutcome[] = [];
    for (const transport of this.transports) {
      const supported = new Set(transport.supportedEntityTypes);
      const matching = operations.filter((operation) => supported.has(operation.entityType));
      if (!matching.length) continue;
      outcomes.push(...(await transport.push(matching)));
      for (const operation of matching) pending.delete(operation.operationId);
    }
    outcomes.push(
      ...[...pending.keys()].map((operationId) => ({ kind: 'retry' as const, operationId })),
    );
    return outcomes;
  }

  public async pull(
    cursor: string | null,
    limit: number,
  ): Promise<{ readonly entities: readonly RemoteEntity[]; readonly nextCursor: string | null }> {
    const previous = parseCompositeCursor(cursor);
    const next: Record<string, string | null> = { ...previous };
    const entities: RemoteEntity[] = [];
    for (const transport of this.transports) {
      if (!transport.pull) continue;
      const key = [...transport.supportedEntityTypes].sort().join('|');
      const result = await transport.pull(previous[key] ?? null, limit);
      entities.push(...result.entities);
      next[key] = result.nextCursor;
    }
    return { entities, nextCursor: JSON.stringify(next) };
  }
}

function equal(left: JsonValue | null, right: JsonValue | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
function isObject(value: JsonValue | null): value is { readonly [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type MergeResult =
  { readonly kind: 'merged'; readonly payload: JsonValue } | { readonly kind: 'manual' };

export function mergeThreeWay(
  base: JsonValue | null,
  local: JsonValue | null,
  remote: JsonValue | null,
): MergeResult {
  if (equal(local, remote)) return { kind: 'merged', payload: local ?? null };
  if (equal(base, local)) return { kind: 'merged', payload: remote ?? null };
  if (equal(base, remote)) return { kind: 'merged', payload: local ?? null };
  if (!isObject(base) || !isObject(local) || !isObject(remote)) return { kind: 'manual' };
  const merged: Record<string, JsonValue> = {};
  for (const key of new Set([
    ...Object.keys(base),
    ...Object.keys(local),
    ...Object.keys(remote),
  ])) {
    const baseValue = base[key] ?? null;
    const localValue = local[key] ?? null;
    const remoteValue = remote[key] ?? null;
    const localChanged = !equal(baseValue, localValue);
    const remoteChanged = !equal(baseValue, remoteValue);
    if (localChanged && remoteChanged && !equal(localValue, remoteValue)) return { kind: 'manual' };
    merged[key] = localChanged ? localValue : remoteValue;
  }
  return { kind: 'merged', payload: merged };
}

export class ExponentialRetryPolicy {
  public constructor(
    private readonly baseDelayMs = 1_000,
    private readonly maximumDelayMs = 300_000,
  ) {}
  public next(attempts: number, now: Date): string {
    const delay = Math.min(this.baseDelayMs * 2 ** Math.max(0, attempts - 1), this.maximumDelayMs);
    return new Date(now.valueOf() + delay).toISOString();
  }
}

export class SyncCoordinator {
  private pullCursor: string | null = null;
  public constructor(
    private readonly database: LocalDatabase,
    private readonly transport: SyncTransport,
    private readonly state: ObservableSyncState,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly retry = new ExponentialRetryPolicy(),
  ) {}

  public async run(online: boolean, limit = 50): Promise<SyncSnapshot> {
    const now = this.clock.now();
    const due = await this.database.listDueOperations(now.toISOString(), limit);
    const conflictsBefore = await this.database.listConflicts();
    if (!online) return this.publish('offline', due.length, conflictsBefore.length, null);
    if (due.length === 0) {
      try {
        if (this.transport.pull) {
          const page = await this.transport.pull(this.pullCursor, limit);
          await this.database.mergeRemote(page.entities);
          this.pullCursor = page.nextCursor;
        }
      } catch {
        return this.publish('offline', 0, conflictsBefore.length, null);
      }
      return this.publish(
        conflictsBefore.length ? 'action_required' : 'synced',
        0,
        conflictsBefore.length,
        now.toISOString(),
      );
    }
    this.publish('syncing', due.length, conflictsBefore.length, null);
    let retried = false;
    try {
      const outcomes = await this.transport.push(due);
      const byId = new Map(due.map((operation) => [operation.operationId, operation]));
      const processed = new Set<string>();
      for (const outcome of outcomes) {
        const operation = byId.get(outcome.operationId);
        if (!operation) continue;
        processed.add(outcome.operationId);
        if (outcome.kind === 'ack') {
          await this.database.acknowledge(
            outcome.operationId,
            operation.entityId,
            outcome.revision,
            outcome.updatedAt,
          );
        } else if (outcome.kind === 'retry') {
          retried = true;
          await this.retryOperation(operation, now);
        } else {
          await this.handleConflict(operation, outcome, now);
        }
      }
      for (const operation of due) {
        if (!processed.has(operation.operationId)) {
          retried = true;
          await this.retryOperation(operation, now);
        }
      }
      if (this.transport.pull) {
        const page = await this.transport.pull(this.pullCursor, limit);
        await this.database.mergeRemote(page.entities);
        this.pullCursor = page.nextCursor;
      }
    } catch {
      retried = true;
      for (const operation of due) await this.retryOperation(operation, now);
    }
    const pending = await this.database.listDueOperations('9999-12-31T23:59:59.999Z', 10_000);
    const conflicts = await this.database.listConflicts();
    const phase: SyncPhase = conflicts.some((item) => item.status === 'unresolved')
      ? 'action_required'
      : retried
        ? 'offline'
        : pending.length > 0
          ? 'syncing'
          : 'synced';
    return this.publish(
      phase,
      pending.length,
      conflicts.length,
      phase === 'synced' ? now.toISOString() : null,
    );
  }

  private async retryOperation(operation: OutboxOperation, now: Date): Promise<void> {
    const attempts = operation.attempts + 1;
    await this.database.retryOperation(
      operation.operationId,
      attempts,
      this.retry.next(attempts, now),
    );
  }

  private async handleConflict(
    operation: OutboxOperation,
    outcome: Extract<PushOutcome, { kind: 'conflict' }>,
    now: Date,
  ): Promise<void> {
    const merged = mergeThreeWay(operation.basePayload, operation.payload, outcome.remotePayload);
    if (merged.kind === 'merged') {
      const existing = await this.database.getEntity(operation.entityType, operation.entityId);
      if (!existing) return;
      const entity: LocalEntity = {
        ...existing,
        payload: merged.payload,
        revision: outcome.remoteRevision,
        localVersion: existing.localVersion + 1,
        updatedAt: now.toISOString(),
        syncStatus: 'pending',
      };
      await this.database.saveMergedConflict(entity, {
        ...operation,
        payload: merged.payload,
        basePayload: outcome.remotePayload,
        baseRevision: outcome.remoteRevision,
        attempts: 0,
        nextAttemptAt: now.toISOString(),
      });
      return;
    }
    const conflict: SyncConflict = {
      id: this.ids.create(),
      ownerId: operation.ownerId,
      entityType: operation.entityType,
      entityId: operation.entityId,
      basePayload: operation.basePayload,
      localPayload: operation.payload,
      remotePayload: outcome.remotePayload,
      remoteRevision: outcome.remoteRevision,
      detectedAt: now.toISOString(),
      status: 'unresolved',
    };
    await this.database.recordConflict(conflict, operation.operationId);
  }

  private publish(
    phase: SyncPhase,
    pendingCount: number,
    conflictCount: number,
    lastSyncedAt: string | null,
  ): SyncSnapshot {
    const snapshot = { phase, pendingCount, conflictCount, lastSyncedAt } satisfies SyncSnapshot;
    this.state.set(snapshot);
    return snapshot;
  }
}
