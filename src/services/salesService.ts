
import { Sale, SaleProductItem, PaymentMethod, PaymentStatus } from '@/types'; 
import { supabase, getSupabaseUserId } from '@/supabaseClient'; 
import { Database, Json } from '@/types/supabase'; 
// import { DEFAULT_CURRENCY } from '../constants.tsx'; // Commission calculation moved to backend

type SaleRow = Database['public']['Tables']['sales']['Row'];
type SaleInsert = Database['public']['Tables']['sales']['Insert'];
type SaleUpdate = Database['public']['Tables']['sales']['Update']; 

const parseJsonField = <T>(field: Json | null | undefined, defaultValue: T): T => { 
  if (field === null || field === undefined) return defaultValue;
  if (typeof field === 'string') {
    try { return JSON.parse(field) as T; }
    catch (e) { console.warn('Failed to parse JSON string field:', field, e); return defaultValue; }
  }
  return field as T;
};

const fromSupabaseSaleRow = (row: SaleRow): Sale => { 
  return {
    id: row.id,
    buyerId: row.buyer_id || undefined, 
    platformUserId: row.platform_user_id, pushInPayTransactionId: row.push_in_pay_transaction_id,
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
  };
};

export interface CreateSaleRecordPayload {
  buyerId: string;
  platformUserId: string;
  products: SaleProductItem[];
  customer: {
    name: string;
    email: string;
    ip?: string;
    whatsapp: string;
  };
  paymentMethod: PaymentMethod;
  status: PaymentStatus; // Should typically be 'waiting_payment'
  totalAmountInCents: number;
  originalAmountBeforeDiscountInCents: number;
  discountAppliedInCents?: number;
  couponCodeUsed?: string;
  trackingParameters?: Record<string, string>;
  // pushInPayTransactionId will be set by the EF later
}


export const salesService = {
  getSales: async (_token: string | null): Promise<Sale[]> => { 
    const userId = await getSupabaseUserId();
    if (!userId) { console.warn("salesService.getSales: User ID não encontrado. Retornando lista vazia."); return []; }
    try {
      const { data, error } = await supabase.from('sales').select('*').eq('platform_user_id', userId); 
      if (error) {
        const isMissingTableError = error.code === '42P01' || (typeof error.message === 'string' && error.message.toLowerCase().includes('relation') && error.message.toLowerCase().includes('does not exist'));
        if (isMissingTableError) { console.warn(`Supabase getSales: Tabela "sales" não encontrada (code: ${error.code}). Retornando lista vazia.`); return []; }
        console.error('Supabase getSales error:', error); throw new Error(error.message || 'Falha ao buscar vendas.');
      }
      return data ? data.map(fromSupabaseSaleRow) : [];
    } catch (genericError: any) {
      console.error('Exception in getSales:', genericError);
      const isMissingTableInGenericError = typeof genericError.message === 'string' && genericError.message.toLowerCase().includes('relation') && genericError.message.toLowerCase().includes('does not exist');
      if (genericError.code === '42P01' || isMissingTableInGenericError) { console.warn('Supabase getSales: Tabela "sales" não encontrada (capturado em exceção). Retornando lista vazia.'); return []; }
      throw new Error(genericError.message || 'Falha geral ao buscar vendas.');
    }
  },
  getSaleById: async (id: string, _token: string | null): Promise<Sale | undefined> => { 
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
      return data ? fromSupabaseSaleRow(data) : undefined;
    } catch (genericError: any) {
      console.error('Exception in getSaleById:', genericError);
      const isMissingTableInGenericError = typeof genericError.message === 'string' && genericError.message.toLowerCase().includes('relation') && genericError.message.toLowerCase().includes('does not exist');
      if (genericError.code === '42P01' || isMissingTableInGenericError) { console.warn(`Supabase getSaleById: Tabela "sales" não encontrada ao buscar ID ${id} (capturado em exceção). Retornando undefined.`); return undefined; }
      throw new Error(genericError.message || 'Falha geral ao buscar venda.');
    }
  },

  createSaleRecord: async (
    saleData: CreateSaleRecordPayload,
    _token: string | null // Token can be used for RLS if needed, but user_id is in saleData
  ): Promise<Sale> => {
    if (!saleData.platformUserId) {
      throw new Error("platformUserId (do dono do produto) é obrigatório para criar a venda.");
    }
    if (!saleData.buyerId) {
        throw new Error("buyerId é obrigatório para criar a venda.");
    }

    const initialSaleData: SaleInsert = {
      // id will be generated by Supabase or is uuid_generate_v4() default
      buyer_id: saleData.buyerId,
      platform_user_id: saleData.platformUserId,
      // push_in_pay_transaction_id will be set by EF, made optional in type definition
      products: saleData.products as unknown as Json,
      customer_name: saleData.customer.name,
      customer_email: saleData.customer.email,
      customer_ip: saleData.customer.ip,
      customer_whatsapp: saleData.customer.whatsapp,
      payment_method: saleData.paymentMethod,
      status: saleData.status, // Should be 'waiting_payment'
      total_amount_in_cents: saleData.totalAmountInCents,
      original_amount_before_discount_in_cents: saleData.originalAmountBeforeDiscountInCents,
      discount_applied_in_cents: saleData.discountAppliedInCents,
      coupon_code_used: saleData.couponCodeUsed,
      tracking_parameters: saleData.trackingParameters as unknown as Json,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Commission fields are intentionally omitted, to be set by backend EF
    };

    try {
      const { data, error } = await supabase
        .from('sales')
        .insert(initialSaleData)
        .select()
        .single<SaleRow>();

      if (error) {
        console.error('Supabase createSaleRecord error:', error);
        throw new Error(error.message || 'Falha ao criar registro de venda');
      }
      if (!data) {
        throw new Error('Falha ao criar registro de venda, dados não retornados.');
      }
      return fromSupabaseSaleRow(data);
    } catch (error: any) {
      console.error('Exception in createSaleRecord:', error);
      throw new Error(error.message || 'Falha geral ao criar registro de venda.');
    }
  },

  updateSaleFields: async (
    saleId: string,
    updates: Partial<Pick<Sale, 'status' | 'paidAt' | 'upsellPushInPayTransactionId' | 'upsellStatus' | 'totalAmountInCents' | 'upsellAmountInCents' | 'products'>>,
    _token: string | null 
  ): Promise<Sale | undefined> => {
    const updatePayload: Partial<SaleUpdate> = { 
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
      return fromSupabaseSaleRow(data);
    } catch (genericError: any) {
      console.error(`[salesService.ts] Exception in updateSaleFields for sale ${saleId}:`, genericError);
      throw new Error(genericError.message || `Falha geral ao atualizar campos da venda ${saleId}.`);
    }
  },
};
