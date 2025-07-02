import { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeProps<T> {
  table: string;
  enabled?: boolean;
  onInsert?: (newRecord: T) => void;
  onUpdate?: (updatedRecord: T) => void;
  onDelete?: (deletedRecord: T) => void;
  accessToken?: string;
}

export function useRealtime<T extends { [key: string]: any; }>({
  table,
  enabled = true,
  onInsert,
  onUpdate,
  onDelete,
  accessToken
}: UseRealtimeProps<T>) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Store callbacks in refs to avoid re-running the effect unnecessarily
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);

  useEffect(() => {
    onInsertRef.current = onInsert;
    onUpdateRef.current = onUpdate;
    onDeleteRef.current = onDelete;
  }, [onInsert, onUpdate, onDelete]);

  useEffect(() => {
    if (!enabled) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Function to setup and subscribe to the channel
    const setupChannel = () => {
      // If a channel exists, remove it before creating a new one
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase
        .channel(`public:${table}:${Date.now()}`) // Use a unique channel name to force rejoining
        .on<T>(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload: RealtimePostgresChangesPayload<T>) => {
            if (payload.eventType === 'INSERT' && onInsertRef.current) {
              onInsertRef.current(payload.new as T);
            }
            if (payload.eventType === 'UPDATE' && onUpdateRef.current) {
              onUpdateRef.current(payload.new as T);
            }
            if (payload.eventType === 'DELETE' && onDeleteRef.current) {
              onDeleteRef.current(payload.old as T);
            }
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log(`Realtime channel subscribed for table: ${table}`);
          }
          if (status === 'CHANNEL_ERROR') {
            console.error(`Realtime channel error for table: ${table}`, err);
          }
        });

      channelRef.current = channel;
    };

    setupChannel();

    // Re-subscribe when the window becomes visible or online
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page is visible again, ensuring realtime is connected.');
        setupChannel();
      }
    };

    const handleOnline = () => {
      console.log('Browser is online, ensuring realtime is connected.');
      setupChannel();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    // Cleanup
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [table, enabled, accessToken]); // Removed callback dependencies
}
