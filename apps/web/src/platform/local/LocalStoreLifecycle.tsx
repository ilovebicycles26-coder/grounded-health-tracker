import type { UserId } from '@grounded/domain';
import { type ReactNode, useEffect } from 'react';

import { useAuth } from '../../features/auth/AuthProvider';
import { localStoreManager } from './runtime';

export function LocalStoreLifecycle({ children }: { readonly children: ReactNode }) {
  const userId = useAuth().session?.user.id;

  useEffect(() => {
    if (userId) void localStoreManager.switchTo(userId as UserId);
    else void localStoreManager.close();
    return () => {
      void localStoreManager.close();
    };
  }, [userId]);

  return children;
}
