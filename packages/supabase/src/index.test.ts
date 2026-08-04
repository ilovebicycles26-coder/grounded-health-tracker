import { AuthApiError, type Session } from '@supabase/supabase-js';
import type { UserId } from '@grounded/domain';
import type { OutboxOperation } from '@grounded/local-store';
import { weightEntityTypes } from '@grounded/weight';
import { describe, expect, it, vi } from 'vitest';

import {
  type GroundedSupabaseClient,
  SupabaseAuthService,
  SupabasePersonalAccessService,
  SupabaseProfileRepository,
  SupabaseWeightSyncTransport,
} from './index';

describe('SupabaseAuthService', () => {
  it('maps a Supabase session into the application contract', async () => {
    const session = {
      user: { id: 'user-1', email: 'person@example.com' },
      expires_at: 1_800_000_000,
    } as Session;
    const client = {
      auth: { getSession: () => Promise.resolve({ data: { session }, error: null }) },
    } as unknown as GroundedSupabaseClient;

    const result = await new SupabaseAuthService(client).getSession();

    expect(result).toEqual({
      ok: true,
      value: {
        user: { id: 'user-1', email: 'person@example.com' },
        expiresAt: 1_800_000_000,
      },
    });
  });

  it('does not leak raw authentication errors to the UI', async () => {
    const client = {
      auth: {
        signInWithPassword: () =>
          Promise.resolve({
            data: { session: null, user: null },
            error: new AuthApiError('provider detail', 400, 'invalid_credentials'),
          }),
      },
    } as unknown as GroundedSupabaseClient;

    const result = await new SupabaseAuthService(client).signIn('person@example.com', 'wrong');

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'invalid_credentials',
        message: 'The email or password is not correct.',
      },
    });
  });
});

describe('SupabasePersonalAccessService', () => {
  it('continues only when the database allowlist approves the caller', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: true, error: null }));
    const client = {
      rpc,
    } as unknown as GroundedSupabaseClient;

    const result = await new SupabasePersonalAccessService(client).hasAccess();

    expect(rpc).toHaveBeenCalledWith('has_personal_access');
    expect(result).toEqual({ ok: true, value: true });
  });
});

describe('SupabaseProfileRepository', () => {
  it('maps and updates account-scoped settings through the owner-filtered profile row', async () => {
    const row = {
      user_id: 'user-1',
      display_name: 'Richard',
      timezone: 'Europe/London',
      locale: 'en-GB',
      unit_system: 'metric' as const,
      week_starts_on: 1 as const,
      calorie_display: true,
      analytics_consent: false,
      onboarding_completed: false,
      created_at: '2026-08-03T09:00:00.000Z',
      updated_at: '2026-08-03T09:00:00.000Z',
    };
    const single = vi.fn(() => Promise.resolve({ data: row, error: null }));
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const client = {
      from: vi.fn(() => ({ update })),
    } as unknown as GroundedSupabaseClient;

    const result = await new SupabaseProfileRepository(client).updateForUser('user-1', {
      unitSystem: 'metric',
      weekStartsOn: 1,
      calorieDisplay: true,
      analyticsConsent: false,
    });

    expect(update).toHaveBeenCalledWith({
      unit_system: 'metric',
      week_starts_on: 1,
      calorie_display: true,
      analytics_consent: false,
    });
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(result).toEqual({
      ok: true,
      value: {
        userId: 'user-1',
        displayName: 'Richard',
        timezone: 'Europe/London',
        locale: 'en-GB',
        unitSystem: 'metric',
        weekStartsOn: 1,
        calorieDisplay: true,
        analyticsConsent: false,
        onboardingCompleted: false,
      },
    });
  });
});

describe('SupabaseWeightSyncTransport', () => {
  it('acknowledges an operation already applied by its stable idempotency key', async () => {
    const ownerId = '00000000-0000-0000-0000-000000000001' as UserId;
    const row = {
      id: '10000000-0000-0000-0000-000000000001',
      user_id: ownerId,
      measured_on: '2026-08-04',
      weight_kg: 105,
      note: null,
      revision: 2,
      last_operation_id: '20000000-0000-0000-0000-000000000001',
      deleted_at: null,
      created_at: '2026-08-04T08:00:00.000Z',
      updated_at: '2026-08-04T08:05:00.000Z',
    };
    class ReplayQuery {
      public eq(): this {
        return this;
      }
      public maybeSingle() {
        return Promise.resolve({ data: row, error: null });
      }
    }
    const query = new ReplayQuery();
    const client = {
      from: () => ({ select: () => query }),
    } as unknown as GroundedSupabaseClient;
    const operation: OutboxOperation = {
      operationId: row.last_operation_id,
      ownerId,
      entityType: weightEntityTypes.entry,
      entityId: row.id,
      kind: 'upsert',
      payload: { measuredOn: row.measured_on, kilograms: row.weight_kg, note: null },
      basePayload: null,
      baseRevision: 0,
      attempts: 1,
      nextAttemptAt: row.created_at,
      createdAt: row.created_at,
    };

    await expect(
      new SupabaseWeightSyncTransport(client, ownerId).push([operation]),
    ).resolves.toEqual([
      {
        kind: 'ack',
        operationId: row.last_operation_id,
        revision: 2,
        updatedAt: row.updated_at,
      },
    ]);
  });
});
