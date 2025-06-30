
import { AbandonedCart, AbandonedCartStatus, Json } from '@/types'; // Ajustado para alias @
import { supabase, getSupabaseUserId } from '@/supabaseClient'; // Ajustado para alias @
import { Database } from '@/types/supabase'; // Ajustado para alias @

// --- START: CACHE MANAGEMENT ---
const abandonedCartsCache = new Map<string, { carts: AbandonedCart[], timestamp: number }>();
const abandonedCartByIdCache = new Map<string, { cart: AbandonedCart, timestamp: number }>();
const CACHE_TTL = 2 * 1000; // Cache de 2 segundos

const getAbandonedCartsFromCache = (userId: string): AbandonedCart[] | null => {
  const cached = abandonedCartsCache.get(userId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.carts;
  }
  abandonedCartsCache.delete(userId);
  return null;
};

const setAbandonedCartsInCache = (userId: string, carts: AbandonedCart[]) => {
  abandonedCartsCache.set(userId, { carts, timestamp: Date.now() });
};

const invalidateAbandonedCartsCache = (userId: string) => {
  abandonedCartsCache.delete(userId);
};

const getAbandonedCartByIdFromCache = (cartId: string): AbandonedCart | null => {
  const cached = abandonedCartByIdCache.get(cartId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.cart;
  }
  abandonedCartByIdCache.delete(cartId);
  return null;
};

const setAbandonedCartByIdInCache = (cartId: string, cart: AbandonedCart) => {
  abandonedCartByIdCache.set(cartId, { cart, timestamp: Date.now() });
};

const invalidateAbandonedCartByIdCache = (cartId: string) => {
  abandonedCartByIdCache.delete(cartId);
};


// --- END: CACHE MANAGEMENT ---

type AbandonedCartRow = Database['public']['Tables']['abandoned_carts']['Row'];
type AbandonedCartInsert = Database['public']['Tables']['abandoned_carts']['Insert'];
type AbandonedCartUpdate = Database['public']['Tables']['abandoned_carts']['Update'];


const parseJsonField = <T>(field: Json | null | undefined, defaultValue: T): T => {
  if (field === null || field === undefined) {
    return defaultValue;
  }
  if (typeof field === 'string') {
    try {
      return JSON.parse(field) as T;
    } catch (e) {
      console.warn('Failed to parse JSON string field:', field, e);
      return defaultValue;
    }
  }
  return field as T;
};

export const fromSupabaseAbandonedCartRow = (row: AbandonedCartRow): AbandonedCart => ({
  id: row.id,
  platformUserId: row.platform_user_id,
  customerName: row.customer_name,
  customerEmail: row.customer_email,
  customerWhatsapp: row.customer_whatsapp,
  productId: row.product_id,
  productName: row.product_name,
  potentialValueInCents: row.potential_value_in_cents,
  date: row.created_at, 
  lastInteractionAt: row.last_interaction_at,
  status: row.status as AbandonedCartStatus,
  trackingParameters: parseJsonField<Record<string, string> | undefined>(row.tracking_parameters, undefined),
});

export interface CreateAbandonedCartPayload {
  productId?: string;
  productName?: string;
  potentialValueInCents?: number;
  customerName?: string;
  customerEmail?: string;
  customerWhatsapp?: string;
  platformUserId?: string; 
  trackingParameters?: Record<string, string>;
  status?: AbandonedCartStatus;
}

export const abandonedCartService = {
  createAbandonedCartAttempt: async (payload: CreateAbandonedCartPayload): Promise<AbandonedCart> => {
    if (!payload.platformUserId) {
        throw new Error('Platform User ID é obrigatório para criar carrinho abandonado.');
    }
    if (!payload.productId) {
        throw new Error('Product ID é obrigatório para criar carrinho abandonado.');
    }
    if (!payload.customerEmail) {
        throw new Error('Customer Email é obrigatório para criar carrinho abandonado.');
    }

    const newCartData: AbandonedCartInsert = {
      platform_user_id: payload.platformUserId,
      customer_name: payload.customerName || payload.customerEmail.split('@')[0],
      customer_email: payload.customerEmail,
      customer_whatsapp: payload.customerWhatsapp || '', 
      product_id: payload.productId,
      product_name: payload.productName || 'Produto Desconhecido',
      potential_value_in_cents: payload.potentialValueInCents || 0,
      status: AbandonedCartStatus.NOT_CONTACTED,
      created_at: new Date().toISOString(),
      last_interaction_at: new Date().toISOString(),
      tracking_parameters: payload.trackingParameters as Json | undefined,
    };

    try {
      const { data, error } = await supabase 
        .from('abandoned_carts')
        .insert(newCartData)
        .select()
        .single<AbandonedCartRow>();

      if (error) throw error;
      if (!data) throw new Error('Falha ao registrar carrinho abandonado, dados não retornados.');
      const newCart = fromSupabaseAbandonedCartRow(data);
      invalidateAbandonedCartsCache(newCart.platformUserId);
      return newCart;
    } catch (error: any) {
      console.error('Supabase createAbandonedCartAttempt error:', error);
      throw new Error(error.message || 'Falha ao registrar tentativa de carrinho abandonado');
    }
  },

  updateAbandonedCartAttempt: async (cartId: string, payload: Partial<CreateAbandonedCartPayload>): Promise<AbandonedCart> => {
    
    const updates: AbandonedCartUpdate = {
        ...(payload.customerName && { customer_name: payload.customerName }),
        ...(payload.customerEmail && { customer_email: payload.customerEmail }),
        ...(payload.customerWhatsapp !== undefined && { customer_whatsapp: payload.customerWhatsapp }),
        ...(payload.potentialValueInCents !== undefined && { potential_value_in_cents: payload.potentialValueInCents }),
        ...(payload.trackingParameters && { tracking_parameters: payload.trackingParameters as Json | undefined }),
        ...(payload.status && { status: payload.status }),
        last_interaction_at: new Date().toISOString(),
    };

    if (payload.platformUserId) delete (updates as any).platform_user_id;
    if (payload.productId) delete (updates as any).product_id;

    if (Object.keys(updates).length <= 1 && !updates.last_interaction_at) { 
        console.log("No meaningful updates for abandoned cart, skipping Supabase call.");
        const currentCart = await abandonedCartService.getAbandonedCartById(cartId);
        if (!currentCart) throw new Error('Carrinho não encontrado para "atualização" sem alterações.');
        return currentCart;
    }
    
    try {
        const { data, error } = await supabase 
            .from('abandoned_carts')
            .update(updates)
            .eq('id', cartId)
            .select()
            .single<AbandonedCartRow>();

        if (error) throw error;
        if (!data) throw new Error('Carrinho não encontrado para atualização.');
        const updatedCart = fromSupabaseAbandonedCartRow(data);
        invalidateAbandonedCartByIdCache(cartId);
        invalidateAbandonedCartsCache(updatedCart.platformUserId);
        return updatedCart;
    } catch (error: any) {
        console.error('Supabase updateAbandonedCartAttempt error:', error);
        throw new Error(error.message || 'Falha ao atualizar tentativa de carrinho abandonado');
    }
  },

  getAbandonedCartById: async (cartId: string): Promise<AbandonedCart | null> => {
    const userId = await getSupabaseUserId(); 
    if (!userId) { 
        console.warn("getAbandonedCartById: User ID needed.");
        return null;
    }

    const cached = getAbandonedCartByIdFromCache(cartId);
    if (cached) return cached;

    try {
        const query = supabase 
            .from('abandoned_carts')
            .select('*')
            .eq('id', cartId);
        
        const { data, error } = await query.single<AbandonedCartRow>();

        if (error) {
            if (error.code === 'PGRST116') return null; 
            throw error;
        }
        const cart = data ? fromSupabaseAbandonedCartRow(data) : null;
        if (cart) setAbandonedCartByIdInCache(cartId, cart);
        return cart;
    } catch (error: any) {
        console.error(`Supabase getAbandonedCartById (${cartId}) error:`, error);
        throw new Error(error.message || `Falha ao buscar carrinho abandonado ${cartId}`);
    }
  },

  getAbandonedCarts: async (): Promise<AbandonedCart[]> => {
    const userId = await getSupabaseUserId();
    if (!userId) throw new Error('Usuário não autenticado para buscar carrinhos abandonados.');

    const cached = getAbandonedCartsFromCache(userId);
    if (cached) return cached;

    try {
      const { data, error } = await supabase 
        .from('abandoned_carts')
        .select('*')
        .eq('platform_user_id', userId)
        .order('last_interaction_at', { ascending: false });

      if (error) throw error;
      const carts = data ? data.map(fromSupabaseAbandonedCartRow) : [];
      setAbandonedCartsInCache(userId, carts);
      return carts;
    } catch (error: any) {
      console.error('Supabase getAbandonedCarts error:', error);
      throw new Error(error.message || 'Falha ao buscar carrinhos abandonados');
    }
  },

  updateAbandonedCartStatus: async (cartId: string, status: AbandonedCartStatus): Promise<AbandonedCart> => {
    const userId = await getSupabaseUserId();
    if (!userId) throw new Error('Usuário não autenticado para atualizar carrinho.');

    try {
      const { data, error } = await supabase 
        .from('abandoned_carts')
        .update({ status: status, last_interaction_at: new Date().toISOString() })
        .eq('id', cartId)
        .eq('platform_user_id', userId) 
        .select()
        .single<AbandonedCartRow>();

      if (error) throw error;
      if (!data) throw new Error('Carrinho não encontrado ou não pertence ao usuário.');
      const updatedCart = fromSupabaseAbandonedCartRow(data);
      invalidateAbandonedCartByIdCache(cartId);
      invalidateAbandonedCartsCache(updatedCart.platformUserId);
      return updatedCart;
    } catch (error: any) {
      console.error('Supabase updateAbandonedCartStatus error:', error);
      throw new Error(error.message || 'Falha ao atualizar status do carrinho abandonado');
    }
  },

  deleteAbandonedCart: async (cartId: string): Promise<{ success: boolean }> => {
    const userId = await getSupabaseUserId();
    if (!userId) throw new Error('Usuário não autenticado para deletar carrinho.');

    try {
      const { error, count } = await supabase 
        .from('abandoned_carts')
        .delete({ count: 'exact' })
        .eq('id', cartId)
        .eq('platform_user_id', userId); 

      if (error) throw error;
      if (count === 0) throw new Error('Carrinho não encontrado ou não pertence ao usuário.');
      invalidateAbandonedCartByIdCache(cartId);
      invalidateAbandonedCartsCache(userId);
      return { success: true };
    } catch (error: any) {
      console.error('Supabase deleteAbandonedCart error:', error);
      throw new Error(error.message || 'Falha ao deletar carrinho abandonado');
    }
  },
};