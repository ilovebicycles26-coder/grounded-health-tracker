import type { EntityId } from '@grounded/domain';
import { SharingService, type SharingRepository } from './index';
import { expect, it, vi } from 'vitest';
it('normalises valid invite codes and rejects malformed ones', async () => {
  const acceptInvite = vi.fn().mockResolvedValue({ ok: true, value: 'p' as EntityId });
  const repository = {
    acceptInvite,
  } as unknown as SharingRepository;
  const service = new SharingService(repository, { create: () => 'id' });
  expect((await service.acceptInvite(' ab12cd34ef ')).ok).toBe(true);
  expect(acceptInvite).toHaveBeenCalledWith('AB12CD34EF');
  expect((await service.acceptInvite('bad')).ok).toBe(false);
});
