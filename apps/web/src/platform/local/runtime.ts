import type { UserId } from '@grounded/domain';
import { AccountScopedStoreManager } from '@grounded/local-store';

import { DexieLocalDatabase } from './DexieLocalDatabase';

export const localStoreManager = new AccountScopedStoreManager((ownerId: UserId) =>
  Promise.resolve(new DexieLocalDatabase(ownerId)),
);
