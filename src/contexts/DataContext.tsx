
import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { AppSettings, Product, Sale, Customer, AbandonedCart, PaymentStatus } from '../types';
import { settingsService } from '../services/settingsService';
import { productService, fromSupabaseProductRow } from '../services/productService';
import { salesService, fromSupabaseSaleRow } from '../services/salesService';
import { customerService, fromSupabaseCustomerRow } from '../services/customerService';
import { abandonedCartService, fromSupabaseAbandonedCartRow } from '../services/abandonedCartService';
import { useRealtime } from '../hooks/useRealtime';
import { useToast } from './ToastContext';

// Helper function to dispatch sound event
const playSound = () => {
  try {
    // Dispatch a global event that App.tsx can listen for.
    // This centralizes audio playback and helps manage browser autoplay policies.
    const event = new CustomEvent('playSaleSound');
    window.dispatchEvent(event);
  } catch (error) {
    console.error("Failed to dispatch play sound event", error);
  }
};

const formatCurrency = (valueInCents: number) => {
  return `R$ ${(valueInCents / 100).toFixed(2).replace('.', ',')}`;
};

interface DataContextType {
  appSettings: AppSettings | null;
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  abandonedCarts: AbandonedCart[];
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const defaultAppSettings: AppSettings = {
    checkoutIdentity: { logoUrl: '', faviconUrl: '', brandColor: '#0D9488' },
    apiTokens: { pushinPay: '', utmify: '', pushinPayEnabled: false, utmifyEnabled: false },
    notificationSettings: { notifyOnAbandonedCart: true, notifyOnOrderPlaced: true, notifyOnSaleApproved: true, playSaleSound: true },
    abandonedCartRecoveryConfig: { enabled: false, delayMinutes: 360, subject: '', bodyHtml: '' },
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { showToast } = useToast();
  const [appSettings, setAppSettings] = useState<AppSettings | null>(defaultAppSettings);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const settingsRef = useRef<AppSettings | null>(null);
  useEffect(() => {
    settingsRef.current = appSettings;
  }, [appSettings]);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    console.log('[DataContext] Fetching all initial data...');
    setIsLoading(true);
    setError(null);
    try {
      const [settingsData, productsData, salesData, customersData, cartsData] = await Promise.all([
        settingsService.getAppSettings(),
        productService.getProducts(),
        salesService.getSales(),
        customerService.getCustomers(),
        abandonedCartService.getAbandonedCarts()
      ]);
      setAppSettings(settingsData);
      setProducts(productsData.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1)));
      setSales(salesData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setCustomers(customersData.sort((a,b) => new Date(b.lastPurchaseDate || 0).getTime() - new Date(a.lastPurchaseDate || 0).getTime()));
      setAbandonedCarts(cartsData.sort((a,b) => new Date(b.lastInteractionAt).getTime() - new Date(a.lastInteractionAt).getTime()));
    } catch (err: any) {
      console.error('[DataContext] Error fetching initial data:', err);
      setError('Falha ao carregar dados da aplicação.');
    } finally {
      setIsLoading(false);
      console.log('[DataContext] Initial data fetch complete.');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthLoading) {
      fetchData();
    }
  }, [isAuthLoading, fetchData]);

  // --- START: Realtime Callbacks ---
  const handleSaleInsert = useCallback((newRecord: any) => {
    console.log('[DataContext] Realtime: New Sale Inserted', newRecord.id);
    const newSale = fromSupabaseSaleRow(newRecord);
    setSales(prev => [newSale, ...prev].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    
    const settings = settingsRef.current;
    if (!settings?.notificationSettings) return;

    if (settings.notificationSettings.notifyOnOrderPlaced) {
      showToast({
        title: 'Novo Pedido Realizado!',
        description: `Cliente: ${newSale.customer.name} - Valor: ${formatCurrency(newSale.totalAmountInCents)}`,
        variant: 'info'
      });
    }
    if (settings.notificationSettings.notifyOnSaleApproved && newSale.status === PaymentStatus.PAID) {
      showToast({
        title: 'Venda Aprovada!',
        description: `Cliente: ${newSale.customer.name} - Valor: ${formatCurrency(newSale.totalAmountInCents)}`,
        variant: 'success'
      });
      if (settings.notificationSettings.playSaleSound) playSound();
    }
  }, [showToast]);

  const handleSaleUpdate = useCallback((updatedRecord: any) => {
    console.log('[DataContext] Realtime: Sale Updated', updatedRecord.id);
    let wasPaid = false;
    const updatedSale = fromSupabaseSaleRow(updatedRecord);
    
    setSales(prev => prev.map(s => {
      if (s.id === updatedSale.id) {
        if (s.status !== PaymentStatus.PAID && updatedSale.status === PaymentStatus.PAID) {
          wasPaid = true;
        }
        return updatedSale;
      }
      return s;
    }));

    const settings = settingsRef.current;
    if (wasPaid && settings?.notificationSettings?.notifyOnSaleApproved) {
      showToast({
        title: 'Venda Aprovada!',
        description: `Cliente: ${updatedSale.customer.name} - Valor: ${formatCurrency(updatedSale.totalAmountInCents)}`,
        variant: 'success'
      });
      if (settings.notificationSettings.playSaleSound) playSound();
    }
  }, [showToast]);

  const handleSaleDelete = useCallback((deletedRecord: any) => {
    console.log('[DataContext] Realtime: Sale Deleted', deletedRecord.id);
    setSales(prev => prev.filter(s => s.id !== deletedRecord.id));
  }, []);

  const handleProductInsert = useCallback((newRecord: any) => {
    console.log('[DataContext] Realtime: New Product Inserted', newRecord.id);
    const newProduct = fromSupabaseProductRow(newRecord);
    setProducts(prev => [...prev, newProduct].sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1)));
  }, []);

  const handleProductUpdate = useCallback((updatedRecord: any) => {
    console.log('[DataContext] Realtime: Product Updated', updatedRecord.id);
    const updatedProduct = fromSupabaseProductRow(updatedRecord);
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
  }, []);

  const handleProductDelete = useCallback((deletedRecord: any) => {
    console.log('[DataContext] Realtime: Product Deleted', deletedRecord.id);
    setProducts(prev => prev.filter(p => p.id !== deletedRecord.id));
  }, []);

  const handleCustomerInsert = useCallback((newRecord: any) => {
    console.log('[DataContext] Realtime: New Customer Inserted', newRecord.id);
    const newCustomer = fromSupabaseCustomerRow(newRecord);
    setCustomers(prev => [newCustomer, ...prev].sort((a,b) => new Date(b.lastPurchaseDate || 0).getTime() - new Date(a.lastPurchaseDate || 0).getTime()));
  }, []);
  
  const handleCustomerUpdate = useCallback((updatedRecord: any) => {
    console.log('[DataContext] Realtime: Customer Updated', updatedRecord.id);
    const updatedCustomer = fromSupabaseCustomerRow(updatedRecord);
    setCustomers(prev => {
      const exists = prev.some(c => c.id === updatedCustomer.id);
      if (exists) {
        return prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c);
      }
      return [updatedCustomer, ...prev].sort((a,b) => new Date(b.lastPurchaseDate || 0).getTime() - new Date(a.lastPurchaseDate || 0).getTime());
    });
  }, []);

  const handleCustomerDelete = useCallback((deletedRecord: any) => {
    console.log('[DataContext] Realtime: Customer Deleted', deletedRecord.id);
    setCustomers(prev => prev.filter(c => c.id !== deletedRecord.id));
  }, []);

  const handleAbandonedCartInsert = useCallback((newRecord: any) => {
    console.log('[DataContext] Realtime: New Abandoned Cart Inserted', newRecord.id);
    const newCart = fromSupabaseAbandonedCartRow(newRecord);
    setAbandonedCarts(prev => [newCart, ...prev].sort((a,b) => new Date(b.lastInteractionAt).getTime() - new Date(a.lastInteractionAt).getTime()));
    
    const settings = settingsRef.current;
    if (settings?.notificationSettings?.notifyOnAbandonedCart) {
      showToast({
        title: 'Carrinho Abandonado',
        description: `Cliente: ${newCart.customerEmail} - Valor: ${formatCurrency(newCart.potentialValueInCents)}`,
        variant: 'warning'
      });
    }
  }, [showToast]);
  
  const handleAbandonedCartUpdate = useCallback((updatedRecord: any) => {
    console.log('[DataContext] Realtime: Abandoned Cart Updated', updatedRecord.id);
    const updatedCart = fromSupabaseAbandonedCartRow(updatedRecord);
    setAbandonedCarts(prev => prev.map(c => c.id === updatedCart.id ? updatedCart : c));
  }, []);
  
  const handleAbandonedCartDelete = useCallback((deletedRecord: any) => {
    console.log('[DataContext] Realtime: Abandoned Cart Deleted', deletedRecord.id);
    setAbandonedCarts(prev => prev.filter(c => c.id !== deletedRecord.id));
  }, []);
  // --- END: Realtime Callbacks ---


  // Realtime Listeners
  useRealtime<any>({
    table: 'sales',
    enabled: isAuthenticated,
    onInsert: handleSaleInsert,
    onUpdate: handleSaleUpdate,
    onDelete: handleSaleDelete
  });

  useRealtime<any>({
    table: 'products',
    enabled: isAuthenticated,
    onInsert: handleProductInsert,
    onUpdate: handleProductUpdate,
    onDelete: handleProductDelete
  });
  
  useRealtime<any>({
    table: 'abandoned_carts',
    enabled: isAuthenticated,
    onInsert: handleAbandonedCartInsert,
    onUpdate: handleAbandonedCartUpdate,
    onDelete: handleAbandonedCartDelete,
  });
  
   useRealtime<any>({
    table: 'customers',
    enabled: isAuthenticated,
    onInsert: handleCustomerInsert,
    onUpdate: handleCustomerUpdate,
    onDelete: handleCustomerDelete,
  });

  const value = {
    appSettings,
    products,
    sales,
    customers,
    abandonedCarts,
    isLoading: isLoading || isAuthLoading,
    error,
    refreshData: fetchData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
