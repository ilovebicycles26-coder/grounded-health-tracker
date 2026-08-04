import { useEffect, useState } from 'react';

import { useAuth } from '../features/auth/AuthProvider';
import { TodayView } from '../features/dashboard/TodayView';
import { useWeightTracker } from '../features/weight/useWeightTracker';

export function Component() {
  const auth = useAuth();
  const weight = useWeightTracker();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  return (
    <TodayView
      displayName={auth.profile?.displayName ?? auth.session?.user.email ?? ''}
      isOnline={isOnline}
      onRetry={() => void weight.refresh()}
      unitSystem={auth.profile?.unitSystem ?? 'metric'}
      weight={weight.summary}
      weightStatus={weight.status}
    />
  );
}
