import type { UserId } from '@grounded/domain';
import {
  shareableResources,
  SharingService,
  type Partner,
  type SharedWeightSummary,
  type SharingGrant,
  type ShareableResource,
} from '@grounded/sharing';
import { SupabaseSharingRepository } from '@grounded/supabase';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabaseClient } from '../auth/runtime';

export function useSharing() {
  const auth = useAuth();
  const ownerId = auth.session?.user.id as UserId | undefined;
  const service = useMemo(
    () =>
      ownerId && supabaseClient
        ? new SharingService(new SupabaseSharingRepository(supabaseClient, ownerId), {
            create: () => crypto.randomUUID(),
          })
        : null,
    [ownerId],
  );
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [partners, setPartners] = useState<readonly Partner[]>([]);
  const [grants, setGrants] = useState<readonly SharingGrant[]>([]);
  const [summaries, setSummaries] = useState<Readonly<Record<string, SharedWeightSummary | null>>>(
    {},
  );
  const load = useCallback(async () => {
    if (!service || !ownerId) return null;
    const [p, g] = await Promise.all([service.listPartners(), service.listGrants(ownerId)]);
    if (!p.ok || !g.ok) return null;
    const pairs = await Promise.all(
      p.value.map(async (partner) => {
        const result = await service.getSharedWeightSummary(partner.userId);
        return [partner.userId, result.ok ? result.value : null] as const;
      }),
    );
    return { partners: p.value, grants: g.value, summaries: Object.fromEntries(pairs) };
  }, [ownerId, service]);
  const apply = useCallback((snapshot: Awaited<ReturnType<typeof load>>) => {
    if (!snapshot) {
      setStatus('error');
      return;
    }
    setPartners(snapshot.partners);
    setGrants(snapshot.grants);
    setSummaries(snapshot.summaries);
    setStatus('ready');
  }, []);
  const refresh = useCallback(async () => apply(await load()), [apply, load]);
  useEffect(() => {
    let cancelled = false;
    void load().then((snapshot) => {
      if (!cancelled) apply(snapshot);
    });
    return () => {
      cancelled = true;
    };
  }, [apply, load]);
  return {
    status,
    partners,
    grants,
    summaries,
    resources: shareableResources,
    refresh,
    createInvite: () => service?.createInvite(),
    acceptInvite: async (code: string) => {
      if (!service) return false;
      const result = await service.acceptInvite(code);
      if (result.ok) await refresh();
      return result.ok;
    },
    setGrant: async (partnerId: UserId, resource: ShareableResource, active: boolean) => {
      if (!service || !ownerId) return false;
      const existing = grants.find(
        (item) => item.recipientId === partnerId && item.resource === resource,
      );
      const result = await service.setGrant(ownerId, partnerId, resource, active, existing);
      if (result.ok) await refresh();
      return result.ok;
    },
  };
}
