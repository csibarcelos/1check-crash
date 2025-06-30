import { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeProps<T> {
  table: string;
  enabled?: boolean;
  onInsert?: (newRecord: T) => void;
  onUpdate?: (updatedRecord: T) => void;
  onDelete?: (deletedRecord: T) => void;
}

export function useRealtime<T extends { [key: string]: any; }>({ 
  table, 
  enabled = true, 
  onInsert, 
  onUpdate, 
  onDelete 
}: UseRealtimeProps<T>) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel(`public:${table}`)
      .on<T>(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload: RealtimePostgresChangesPayload<T>) => {
          if (payload.eventType === 'INSERT' && onInsert) {
            onInsert(payload.new as T);
          }
          if (payload.eventType === 'UPDATE' && onUpdate) {
            onUpdate(payload.new as T);
          }
          if (payload.eventType === 'DELETE' && onDelete) {
            onDelete(payload.old as T);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [table, enabled, onInsert, onUpdate, onDelete]);
}