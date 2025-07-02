
import { Sale, SaleProductItem, PaymentMethod, PaymentStatus, SaleTransaction } from '@/types';
import { supabase, getSupabaseUserId } from '@/supabaseClient';
import { Database, Json } from '@/types/supabase';

type SaleRow = Database['public']['Tables']['sales']['Row'];


// --- START: CACHE MANAGEMENT ---
const salesCache = new Map<string, { sales: Sale[], timestamp: number }>();
const saleByIdCache = new Map<string, { sale: Sale, timestamp: number }>();
const CACHE_TTL = 2 * 1000; // Cache de 2 segundos

const getSalesFromCache = (userId: string): Sale[] | null => {
  const cached = salesCache.get(userId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.sales;
  }
  salesCache.delete(userId);
  return null;
};

const setSalesInCache = (userId: string, sales: Sale[]) => {
  salesCache.set(userId, { sales, timestamp: Date.now() });
};

const invalidateSalesCache = (userId: string) => {
  salesCache.delete(userId);
};

const getSaleByIdFromCache = (saleId: string): Sale | null => {
  const cached = saleByIdCache.get(saleId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.sale;
  }
  saleByIdCache.delete(saleId);
  return null;
};

const setSaleByIdInCache = (saleId: string, sale: Sale) => {
  saleByIdCache.set(saleId, { sale, timestamp: Date.now() });
};

const invalidateSaleByIdCache = (saleId: string) => {
  saleByIdCache.delete(saleId);
};


// --- END: CACHE MANAGEMENT ---

const parseJsonField = <T>(field: Json | null | undefined, defaultValue: T): T => {
  if (field === null || field === undefined) {
    return defaultValue;
  }
  if (typeof field === 'object' && field !== null) {
      return field as T;
  }
  if (typeof field === 'string') {
    try {
      return JSON.parse(field) as T;
    } catch (e) {
      console.warn('Failed to parse JSON string field:', field, e);
      return defaultValue;
    }
  }
  return defaultValue;
};

export const fromSupabaseSaleRow = (row: SaleRow): Sale => { 
  return {
    id: row.id,
    platformUserId: row.platform_user_id,
    pushInPayTransactionId: row.push_in_pay_transaction_id || '', // Assuming it's always present or can be empty string
    buyerId: row.buyer_id || undefined,
    upsellPushInPayTransactionId: row.upsell_push_in_pay_transaction_id || undefined,
    orderIdUrmify: row.order_id_urmify || undefined,
    products: parseJsonField<SaleProductItem[]>(row.products, []),
    customer: { name: row.customer_name, email: row.customer_email, ip: row.customer_ip || undefined, whatsapp: row.customer_whatsapp, },
    paymentMethod: row.payment_method as PaymentMethod, status: row.status as PaymentStatus,
    upsellStatus: row.upsell_status ? row.upsell_status as PaymentStatus : undefined,
    totalAmountInCents: row.total_amount_in_cents, upsellAmountInCents: row.upsell_amount_in_cents || undefined,
    originalAmountBeforeDiscountInCents: row.original_amount_before_discount_in_cents,
    discountAppliedInCents: row.discount_applied_in_cents || undefined, couponCodeUsed: row.coupon_code_used || undefined,
    createdAt: row.created_at, paidAt: row.paid_at || undefined,
    trackingParameters: parseJsonField<Record<string, string> | undefined>(row.tracking_parameters, undefined),
    commission: (row.commission_total_price_in_cents !== null && row.commission_gateway_fee_in_cents !== null && row.commission_user_commission_in_cents !== null && row.commission_currency !== null) ? {
      totalPriceInCents: row.commission_total_price_in_cents, gatewayFeeInCents: row.commission_gateway_fee_in_cents,
      userCommissionInCents: row.commission_user_commission_in_cents, currency: row.commission_currency,
    } : undefined,
    platformCommissionInCents: row.platform_commission_in_cents || undefined,
    pixQrCode: row.pix_qr_code || undefined,
    pixQrCodeBase64: row.pix_qr_code_base64 || undefined,
  };
};

export const salesService = {
  getSales: async (): Promise<Sale[]> => { 
    const userId = await getSupabaseUserId();
    if (!userId) { console.warn("salesService.getSales: User ID não encontrado. Retornando lista vazia."); return []; }

    const cached = getSalesFromCache(userId);
    if (cached) return cached;

    try {
      const { data, error } = await supabase.from('sales').select('*').eq('platform_user_id', userId); 
      if (error) {
        const isMissingTableError = error.code === '42P01' || (typeof error.message === 'string' && error.message.toLowerCase().includes('relation') && error.message.toLowerCase().includes('does not exist'));
        if (isMissingTableError) { console.warn(`Supabase getSales: Tabela "sales" não encontrada (code: ${error.code}). Retornando lista vazia.`); return []; }
        console.error('Supabase getSales error:', error); throw new Error(error.message || 'Falha ao buscar vendas.');
      }
      const sales = data ? data.map(fromSupabaseSaleRow) : [];
      setSalesInCache(userId, sales);
      return sales;
    } catch (genericError: any) {
      console.error('Exception in getSales:', genericError);
      const isMissingTableInGenericError = typeof genericError.message === 'string' && genericError.message.toLowerCase().includes('relation') && genericError.message.toLowerCase().includes('does not exist');
      if (genericError.code === '42P01' || isMissingTableInGenericError) { console.warn('Supabase getSales: Tabela "sales" não encontrada (capturado em exceção). Retornando lista vazia.'); return []; }
      throw new Error(genericError.message || 'Falha geral ao buscar vendas.');
    }
  },
  getSaleById: async (id: string): Promise<Sale | undefined> => { 
    const cached = getSaleByIdFromCache(id);
    if (cached) return cached;

    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .or(`id.eq.${id},push_in_pay_transaction_id.eq.${id},upsell_push_in_pay_transaction_id.eq.${id}`)
        .maybeSingle<SaleRow>();  
      if (error) {
        if (error.code === 'PGRST116') return undefined; 
        const isMissingTableError = error.code === '42P01' || (typeof error.message === 'string' && error.message.toLowerCase().includes('relation') && error.message.toLowerCase().includes('does not exist'));
        if (isMissingTableError) { console.warn(`Supabase getSaleById: Tabela "sales" não encontrada ao buscar ID ${id} (code: ${error.code}). Retornando undefined.`); return undefined; }
        console.error('Supabase getSaleById error:', error); throw new Error(error.message || 'Falha ao buscar venda.');
      }
      const sale = data ? fromSupabaseSaleRow(data) : undefined;
      if (sale) setSaleByIdInCache(id, sale);
      return sale;
    } catch (genericError: any) {
      console.error('Exception in getSaleById:', genericError);
      const isMissingTableInGenericError = typeof genericError.message === 'string' && genericError.message.toLowerCase().includes('relation') && genericError.message.toLowerCase().includes('does not exist');
      if (genericError.code === '42P01' || isMissingTableInGenericError) { console.warn(`Supabase getSaleById: Tabela "sales" não encontrada ao buscar ID ${id} (capturado em exceção). Retornando undefined.`); return undefined; }
      throw new Error(genericError.message || 'Falha geral ao buscar venda.');
    }
  },

  getSaleTransactionById: async (transactionId: string, productOwnerUserId: string, saleId: string): Promise<SaleTransaction | undefined> => {
    try {
      const { data, error } = await supabase.functions.invoke('verificar-status-pix', {
        body: { transactionId, productOwnerUserId, saleId },
      });

      if (error) {
        console.error(`Supabase function call 'verificar-status-pix' error for transaction ${transactionId}:`, error);
        throw new Error(error.message || 'Falha ao buscar detalhes da transação via função.');
      }

      // A resposta da função já deve vir no formato SaleTransaction
      return data as SaleTransaction;

    } catch (genericError: any) {
      console.error(`Exception in getSaleTransactionById for transaction ${transactionId}:`, genericError);
      throw new Error(genericError.message || `Falha geral ao buscar detalhes da transação ${transactionId}.`);
    }
  },

  updateSaleFields: async (
    saleId: string,
    updates: Partial<Pick<Sale, 'status' | 'paidAt' | 'upsellPushInPayTransactionId' | 'upsellStatus' | 'totalAmountInCents' | 'upsellAmountInCents' | 'products'>>
  ): Promise<Sale | undefined> => {
    const updatePayload: Partial<Database['public']['Tables']['sales']['Update']> = { 
      updated_at: new Date().toISOString(),
    };

    if (updates.status !== undefined) updatePayload.status = updates.status;
    if (updates.paidAt !== undefined) updatePayload.paid_at = updates.paidAt;
    if (updates.upsellPushInPayTransactionId !== undefined) updatePayload.upsell_push_in_pay_transaction_id = updates.upsellPushInPayTransactionId;
    if (updates.upsellStatus !== undefined) updatePayload.upsell_status = updates.upsellStatus;
    if (updates.totalAmountInCents !== undefined) updatePayload.total_amount_in_cents = updates.totalAmountInCents;
    if (updates.upsellAmountInCents !== undefined) updatePayload.upsell_amount_in_cents = updates.upsellAmountInCents;
    if (updates.products !== undefined) updatePayload.products = updates.products as unknown as Json;
    
    try {
      const { data, error } = await supabase
        .from('sales')
        .update(updatePayload)
        .eq('id', saleId)
        .select()
        .single<SaleRow>();

      if (error) {
        console.error(`Supabase updateSaleFields error for sale ${saleId}:`, error);
        if (error.code === 'PGRST116') { 
          console.warn(`[salesService.ts] Venda ${saleId} não encontrada para atualização de campos (PGRST116). Isso pode ser um problema de RLS ou o ID está incorreto.`);
          return undefined;
        }
        throw new Error(error.message || `Falha ao atualizar campos da venda ${saleId}. Verifique as permissões RLS.`);
      }
      if (!data) {
        console.warn(`[salesService.ts] Atualização da venda ${saleId} não retornou dados, mas sem erro.`);
        return undefined; 
      }
      console.log(`[salesService.ts] Venda ${saleId} atualizada com sucesso:`, data);
      invalidateSaleByIdCache(saleId);
      const userId = await getSupabaseUserId();
      if (userId) invalidateSalesCache(userId);
      return fromSupabaseSaleRow(data);
    } catch (genericError: any) {
      console.error(`[salesService.ts] Exception in updateSaleFields for sale ${saleId}:`, genericError);
      throw new Error(genericError.message || `Falha geral ao buscar dados da venda ${saleId}.`);
    }
  },
};
