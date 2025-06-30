
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/supabaseClient';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LiveViewIcon, ShoppingCartIcon, CurrencyDollarIcon, UserGroupIcon } from '../constants.tsx';
import { motion, AnimatePresence } from 'framer-motion'; 
import type { RealtimeChannel } from '@supabase/supabase-js'; // Added type import
import { LIVE_VIEW_CHANNEL_NAME, LIVE_STATS_EXPIRATION_MS, LIVE_STATS_UPDATE_INTERVAL_MS, LIVE_PIX_AWAITING_TIMEOUT_MS } from '../constants';
import type { LiveViewEvent } from '../types';

const MotionDiv = motion.div as any;
const MotionSpan = motion.span as any;

interface LiveStatItem {
  id: string; 
  timestamp: number;
}

interface PixPendingItem {
  checkoutSessionId: string; 
  timestamp: number;
}

const cardVariants = { 
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: "circOut" as const } }, 
};

const numberVariants = { 
  initial: { opacity: 0.5, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "circOut" as const } }, 
  exit: { opacity: 0.5, y: -10, transition: { duration: 0.2, ease: "circIn" as const } }, 
};

const LiveViewPage: React.FC = () => {
  const [checkoutVisitors, setCheckoutVisitors] = useState<LiveStatItem[]>([]);
  const [pixPendingUsers, setPixPendingUsers] = useState<PixPendingItem[]>([]);
  const [recentSales, setRecentSales] = useState<LiveStatItem[]>([]);
  
  const [isLoading, setIsLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);

  const updateLiveStats = useCallback(() => {
    const now = Date.now();
    setCheckoutVisitors(prev => prev.filter(item => now - item.timestamp < LIVE_STATS_EXPIRATION_MS));
    setPixPendingUsers(prev => prev.filter(item => now - item.timestamp < LIVE_PIX_AWAITING_TIMEOUT_MS));
    setRecentSales(prev => prev.filter(item => now - item.timestamp < LIVE_STATS_EXPIRATION_MS));
  }, []);

  useEffect(() => {
    console.log('[LiveViewPage] Attempting to connect to Realtime channel...');
    setIsLoading(true);
    setError(null);
    
    const channel = supabase.channel(LIVE_VIEW_CHANNEL_NAME, {
      config: {
        broadcast: {
          self: true, 
        },
      },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'live_view_event' }, (message: { payload: LiveViewEvent }) => {
        console.log('[LiveViewPage] Received live_view_event:', message.payload);
        const { type, payload } = message.payload;
        const now = Date.now();
        const newItemId = payload?.checkoutSessionId || `${payload?.userId || 'anon'}_${now}`;

        switch (type) {
          case 'checkout_enter':
            setCheckoutVisitors(prev => [...prev, { id: newItemId, timestamp: now }]);
            break;
          case 'pix_pending_enter':
            if (payload?.checkoutSessionId) {
              setPixPendingUsers(prev => {
                if (prev.some(p => p.checkoutSessionId === payload.checkoutSessionId)) return prev;
                return [...prev, { checkoutSessionId: payload.checkoutSessionId!, timestamp: now }];
              });
            }
            break;
          case 'pix_pending_leave':
            if (payload?.checkoutSessionId) {
              setPixPendingUsers(prev => prev.filter(p => p.checkoutSessionId !== payload.checkoutSessionId));
            }
            break;
          case 'sale_confirmed_recent':
             setRecentSales(prev => [...prev, { id: newItemId, timestamp: now }]);
            if (payload?.checkoutSessionId) {
              setPixPendingUsers(prev => prev.filter(p => p.checkoutSessionId !== payload.checkoutSessionId));
            }
            break;
        }
        updateLiveStats(); 
      })
      .subscribe((status, err) => {
        console.log(`[LiveViewPage] Channel subscription status: ${status}`, err || '');
        if (status === 'SUBSCRIBED') {
          console.log('[LiveViewPage] Successfully subscribed to Live View channel!');
          setIsLoading(false);
          setError(null);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[LiveViewPage] Live View channel error or timeout:', err || status);
          setError(`Erro ao conectar ao Live View: ${err?.message || status}`);
          setIsLoading(false);
        } else if (status === 'CLOSED') {
            console.warn('[LiveViewPage] Live View channel closed.');
            // setError('Conexão com Live View foi fechada.'); // Optionally set an error or attempt reconnect
            setIsLoading(false);
        }
      });

    const intervalId = setInterval(updateLiveStats, LIVE_STATS_UPDATE_INTERVAL_MS);

    return () => {
      console.log('[LiveViewPage] Cleaning up Live View channel subscription.');
      clearInterval(intervalId);
      const currentChannel = channelRef.current;
      if (currentChannel) {
        currentChannel.unsubscribe()
          .then(() => {
            console.log('[LiveViewPage] Unsubscribed from channel.');
            return supabase.removeChannel(currentChannel);
          })
          .then(() => {
            console.log('[LiveViewPage] Removed Live View channel.');
          })
          .catch(unsubError => {
            console.error('[LiveViewPage] Error during channel unsubscribe/remove:', unsubError);
            // Fallback removal attempt if unsubscribe fails or ref changed
            if (channelRef.current === currentChannel) { // Only if it's still the same channel
                 supabase.removeChannel(currentChannel).catch(removeErr => console.error('[LiveViewPage] Fallback removeChannel error:', removeErr));
            }
          })
          .finally(() => {
            if (channelRef.current === currentChannel) {
              channelRef.current = null;
            }
          });
      }
    };
  }, [updateLiveStats]);


  const AnimatedCounter: React.FC<{ value: number }> = ({ value }) => (
    <AnimatePresence mode="popLayout" initial={false}>
      <MotionSpan
        key={value}
        variants={numberVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="inline-block"
      >
        {value}
      </MotionSpan>
    </AnimatePresence>
  );
  
  const statCards = [
    { title: "No Checkout Agora", value: checkoutVisitors.length, icon: UserGroupIcon, description: "Visitantes nos checkouts nos últimos 5 min." },
    { title: "Aguardando Pagamento PIX", value: pixPendingUsers.length, icon: CurrencyDollarIcon, description: "PIX gerados aguardando confirmação (últimos 15 min)." },
    { title: "Vendas Confirmadas", value: recentSales.length, icon: ShoppingCartIcon, description: "Vendas confirmadas nos últimos 5 min." },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-200px)] text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-xl text-text-muted">Conectando ao Live View...</p>
      </div>
    );
  }
  if (error) {
    return <div className="text-center text-status-error p-6 bg-status-error/10 rounded-2xl shadow-lg border border-status-error/30">{error}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-3">
        <LiveViewIcon className="h-8 w-8 text-accent-blue-neon animate-pulse-subtle" />
        <h1 className="text-3xl font-display font-bold text-text-strong">Live View</h1>
      </div>
      
      <MotionDiv 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1 } }
        }}
      >
        {statCards.map(stat => (
          <MotionDiv key={stat.title} variants={cardVariants}>
            <Card className="p-6 flex flex-col justify-between min-h-[180px] shadow-xl hover:shadow-glow-blue-neon/30 transition-all duration-300">
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">{stat.title}</h3>
                <div className="p-2.5 bg-accent-blue-neon/10 rounded-full border border-accent-blue-neon/30">
                  <stat.icon className="h-6 w-6 text-accent-blue-neon" />
                </div>
              </div>
              <div className="mt-auto">
                <p className="text-5xl font-bold font-display text-text-strong">
                  <AnimatedCounter value={stat.value} />
                </p>
                <p className="text-xs text-text-muted mt-1">{stat.description}</p>
              </div>
            </Card>
          </MotionDiv>
        ))}
      </MotionDiv>

      <div className="mt-8 text-center">
        <p className="text-sm text-text-muted">
          Dados atualizados em tempo real.
          <span className="inline-block w-2 h-2 bg-status-success rounded-full ml-2 animate-ping"></span>
        </p>
      </div>
    </div>
  );
};

export default LiveViewPage;
