import React from 'react';
import { Badge } from '../../../components/ui';

interface SyncBannerProps {
  isOnline: boolean;
  syncPending: boolean;
  syncing: boolean;
  onSync: () => void;
}

export const SyncBanner: React.FC<SyncBannerProps> = ({
  isOnline,
  syncPending,
  syncing,
  onSync,
}) => {
  if (!syncPending && isOnline) return null;

  return (
    <Badge
      variant={syncPending && isOnline ? 'success' : 'warning'}
      className="rounded-none border-0"
    >
      {syncing ? (
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          className="animate-spin flex-shrink-0">
          <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
        </svg>
      ) : (
        <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
          <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
        </svg>
      )}
      <span className="flex-1">
        {syncing
          ? 'SYNCING WORKOUT…'
          : syncPending && isOnline ? 'WORKOUT SAVED — SYNCING'
          : syncPending ? 'OFFLINE — WORKOUT SAVED LOCALLY'
          : 'OFFLINE'}
      </span>
      {syncPending && !syncing && isOnline && (
        <button
          onClick={onSync}
          className="bg-[rgba(255,255,255,0.22)] border-none rounded-[5px] text-white font-mono text-[9px] tracking-[0.06em] px-2.5 py-1 cursor-pointer flex-shrink-0 hover:bg-[rgba(255,255,255,0.3)] transition-colors"
        >
          SYNC NOW
        </button>
      )}
    </Badge>
  );
};
