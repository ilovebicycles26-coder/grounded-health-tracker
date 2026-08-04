import { ObservableSyncState, type SyncPhase } from '@grounded/sync';
import { useSyncExternalStore } from 'react';

export const syncState = new ObservableSyncState();

const labels: Record<SyncPhase, string> = {
  synced: 'Saved',
  offline: 'Offline — saved on this device',
  syncing: 'Syncing…',
  action_required: 'Review sync changes',
};

export function SyncStatusIndicator() {
  const snapshot = useSyncExternalStore(
    (listener) => syncState.subscribe(listener),
    () => syncState.get(),
    () => syncState.get(),
  );
  return (
    <span className={`sync-status sync-status--${snapshot.phase}`} role="status">
      {labels[snapshot.phase]}
    </span>
  );
}
