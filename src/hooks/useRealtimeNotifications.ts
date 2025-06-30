

import { useEffect, useRef } from 'react';
import { useRealtime } from './useRealtime';
import { useToast } from '../contexts/ToastContext';
import { useData } from '../contexts/DataContext';
import { NotificationSettings, Sale, AbandonedCart, PaymentStatus } from '../types';
import { fromSupabaseSaleRow } from '../services/salesService';
import { fromSupabaseAbandonedCartRow } from '../services/abandonedCartService';

// Helper to play sound
const playSound = (soundUrl: string) => {
  try {
    const audio = new Audio(soundUrl);
    audio.play().catch(error => console.error("Audio play failed", error));
  } catch (error) {
    console.error("Failed to create audio element", error);
  }
};

const formatCurrency = (valueInCents: number) => {
    return `R$ ${(valueInCents / 100).toFixed(2).replace('.', ',')}`;
};

export const useRealtimeNotifications = () => {
  const { showToast } = useToast();
  const { appSettings } = useData();
  
  // Use a ref to store settings to avoid stale closures in callbacks
  const settingsRef = useRef<NotificationSettings | null>(null);

  // 1. Update settings ref when context changes
  useEffect(() => {
    if (appSettings?.notificationSettings) {
      settingsRef.current = appSettings.notificationSettings;
      console.log('Notification settings updated from DataContext:', settingsRef.current);
    }
  }, [appSettings]);

  // 2. Define stable callbacks using useCallback
  const handleSaleUpdate = (updatedSaleRow: any) => {
    const settings = settingsRef.current;
    if (!settings) return;

    const updatedSale = fromSupabaseSaleRow(updatedSaleRow);
    
    // Logic for sale approved notification
    if (settings.notifyOnSaleApproved && updatedSale.status === PaymentStatus.PAID) {
      showToast({
        title: 'Venda Aprovada!',
        description: `Cliente: ${updatedSale.customer.name} - Valor: ${formatCurrency(updatedSale.totalAmountInCents)}`,
        variant: 'success',
      });
      if (settings.playSaleSound) {
        playSound('/assets/sounds/cha-ching.mp3');
      }
    }
  };

  const handleSaleInsert = (newSaleRow: any) => {
    const settings = settingsRef.current;
    if (!settings) return;
    
    const newSale = fromSupabaseSaleRow(newSaleRow);

    // Logic for order placed notification
    if (settings.notifyOnOrderPlaced) {
        showToast({
            title: 'Novo Pedido Realizado!',
            description: `Cliente: ${newSale.customer.name} - Valor: ${formatCurrency(newSale.totalAmountInCents)}`,
            variant: 'info',
        });
    }

    // Also handle if a sale is inserted as already 'approved'
    if (settings.notifyOnSaleApproved && newSale.status === PaymentStatus.PAID) {
        handleSaleUpdate(newSaleRow);
    }
  };

  const handleAbandonedCartInsert = (newCartRow: any) => {
    const settings = settingsRef.current;
    if (!settings || !settings.notifyOnAbandonedCart) return;

    const newCart = fromSupabaseAbandonedCartRow(newCartRow);
    showToast({
      title: 'Carrinho Abandonado',
      description: `Cliente: ${newCart.customerEmail} - Valor: ${formatCurrency(newCart.potentialValueInCents)}`,
      variant: 'warning',
    });
  };


  // 3. Setup realtime listeners, always enabled.
  // The logic inside the callbacks will control if a toast is shown.
  useRealtime<Sale>({
    table: 'sales',
    enabled: true,
    onInsert: handleSaleInsert,
    onUpdate: handleSaleUpdate,
  });

  useRealtime<AbandonedCart>({
    table: 'abandoned_carts',
    enabled: true,
    onInsert: handleAbandonedCartInsert,
  });
};