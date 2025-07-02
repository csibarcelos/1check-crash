import { User, Sale, SaleProductItem, PaymentMethod, PaymentStatus, Product as AppProduct, AuditLogEntry, ProductCheckoutCustomization, PostClickOffer, UpsellOffer, Coupon, UtmParams, TraditionalOrderBumpOffer, PostPurchaseEmails } from '@/types';
import { adminSupabase } from '@/adminSupabase';
// Removed: import { supabase } from '@/supabaseClient'; 
// adminSupabase will be used for all super admin operations for consistency and RLS bypass.
import { Database, Json } from '@/types/supabase';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type SaleRow = Database['public']['Tables']['sales']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row'];
type AuditLogEntryRow = Database['public']['Tables']['audit_log_entries']['Row'];

// Cache simples em memória
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

const getCachedData = <T>(key: string): T | null => {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data as T;
  }
  cache.delete(key);
  return null;
};

const setCachedData = <T>(key: string, data: T): void => {
  cache.set(key, {
    data,
    expires: Date.now() + CACHE_DURATION
  });
};

const parseJsonField = <T>(field: Json | null | undefined, defaultValue: T): T => {
  if (field === null || field === undefined) return defaultValue;
  if (typeof field === 'string') {
    try { return JSON.parse(field) as T; }
    catch (e) { console.warn('Failed to parse JSON string field:', field, e); return defaultValue; }
  }
  // If it's already an object (and not null), assume it's the correct type or a compatible structure.
  if (typeof field === 'object' && field !== null) {
    return field as T;
  }
  return defaultValue; // Fallback for other unexpected types
};

const defaultCheckoutCustomizationForSuperAdmin: ProductCheckoutCustomization = {
  primaryColor: '#0D9488',
  logoUrl: '',
  videoUrl: '',
  salesCopy: '',
  testimonials: [],
  guaranteeBadges: [],
  countdownTimer: {
    enabled: false,
    durationMinutes: 15,
    messageBefore: 'Oferta expira em:',
    messageAfter: 'Oferta expirada!',
    backgroundColor: '#EF4444',
    textColor: '#FFFFFF',
  },
  theme: 'light',
  showProductName: true,
};

const defaultUtmParamsForSuperAdmin: UtmParams = {
  source: '', medium: '', campaign: '', term: '', content: ''
};


const fromSupabaseSaleRow = (row: SaleRow): Sale => {
  return {
    id: row.id,
    platformUserId: row.platform_user_id,
    pushInPayTransactionId: row.push_in_pay_transaction_id || '',
    upsellPushInPayTransactionId: row.upsell_push_in_pay_transaction_id || undefined,
    orderIdUrmify: row.order_id_urmify || undefined,
    products: parseJsonField<SaleProductItem[]>(row.products, []),
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      ip: row.customer_ip || undefined,
      whatsapp: row.customer_whatsapp,
    },
    paymentMethod: row.payment_method as PaymentMethod,
    status: row.status as PaymentStatus,
    upsellStatus: row.upsell_status ? row.upsell_status as PaymentStatus : undefined,
    totalAmountInCents: row.total_amount_in_cents,
    upsellAmountInCents: row.upsell_amount_in_cents === null ? undefined : row.upsell_amount_in_cents,
    originalAmountBeforeDiscountInCents: row.original_amount_before_discount_in_cents,
    discountAppliedInCents: row.discount_applied_in_cents === null ? undefined : row.discount_applied_in_cents,
    couponCodeUsed: row.coupon_code_used || undefined,
    createdAt: row.created_at,
    paidAt: row.paid_at || undefined,
    trackingParameters: parseJsonField<Record<string, string> | undefined>(row.tracking_parameters, undefined),
    commission: (row.commission_total_price_in_cents !== null && row.commission_gateway_fee_in_cents !== null && row.commission_user_commission_in_cents !== null && row.commission_currency !== null) ? {
      totalPriceInCents: row.commission_total_price_in_cents,
      gatewayFeeInCents: row.commission_gateway_fee_in_cents,
      userCommissionInCents: row.commission_user_commission_in_cents,
      currency: row.commission_currency,
    } : undefined,
    platformCommissionInCents: row.platform_commission_in_cents === null ? undefined : row.platform_commission_in_cents,
  };
};

const fromSupabaseProductRow = (row: ProductRow): AppProduct => {
  return {
    id: row.id,
    platformUserId: row.platform_user_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceInCents: row.price_in_cents,
    imageUrl: row.image_url || undefined,
    checkoutCustomization: parseJsonField<ProductCheckoutCustomization>(row.checkout_customization, defaultCheckoutCustomizationForSuperAdmin),
    deliveryUrl: row.delivery_url || undefined,
    totalSales: row.total_sales || 0,
    clicks: row.clicks || 0,
    checkoutViews: row.checkout_views || 0,
    conversionRate: row.conversion_rate || 0,
    abandonmentRate: row.abandonment_rate || 0,
    postClickOffer: parseJsonField<PostClickOffer | undefined>(row.order_bump, undefined),
    orderBumps: parseJsonField<TraditionalOrderBumpOffer[] | undefined>(row.order_bumps, undefined),
    upsell: parseJsonField<UpsellOffer | undefined>(row.upsell, undefined),
    coupons: parseJsonField<Coupon[]>(row.coupons, []),
    utmParams: parseJsonField<UtmParams | null>(row.utm_params, defaultUtmParamsForSuperAdmin),
    postPurchaseEmailConfig: parseJsonField<PostPurchaseEmails | undefined>(row.post_purchase_email_config, undefined),
  };
};

const fromSupabaseAuditLogRow = (row: AuditLogEntryRow): AuditLogEntry => ({
    id: row.id,
    timestamp: row.timestamp,
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email,
    actionType: row.action_type,
    targetEntityType: row.target_entity_type || undefined,
    targetEntityId: row.target_entity_id || undefined,
    description: row.description,
    details: row.details ? parseJsonField<Record<string, any>>(row.details, {}) : undefined,
});

export const superAdminService = {
    getAllPlatformUsers: async (token: string, options?: { signal?: AbortSignal }): Promise<User[]> => {
        if (!token) throw new Error("Token de autenticação de super admin é necessário.");

        const cacheKey = 'platform-users';
        const cachedUsers = getCachedData<User[]>(cacheKey);
        if (cachedUsers) return cachedUsers;

        if (options?.signal?.aborted) {
          throw new DOMException('Request aborted by user', 'AbortError');
        }

        try {
            const { data: usersListResponse, error: usersError } = await adminSupabase.auth.admin.listUsers({
                perPage: 10000 
            });

            if (options?.signal?.aborted) {
              throw new DOMException('Request aborted by user', 'AbortError');
            }

            if (usersError) throw new Error(usersError.message || "Falha ao buscar usuários da plataforma.");

            const userIds = usersListResponse.users.map(u => u.id);
            if (userIds.length === 0) {
                setCachedData(cacheKey, []);
                return [];
            }
            
            const { data: profiles, error: profilesError } = await adminSupabase // Changed to adminSupabase
                .from('profiles')
                .select('*')
                .in('id', userIds);
            
            if (options?.signal?.aborted) {
              throw new DOMException('Request aborted by user', 'AbortError');
            }

            if (profilesError) {
                console.warn('Erro ao buscar perfis:', profilesError.message);
            }

            const profilesMap = new Map<string, ProfileRow>();
            profiles?.forEach(profile => {
                profilesMap.set(profile.id, profile);
            });

            const users = usersListResponse.users.map(user => {
                const profileData = profilesMap.get(user.id);
                return {
                    id: user.id,
                    email: user.email || '',
                    name: profileData?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
                    isSuperAdmin: profileData?.is_super_admin || false,
                    isActive: profileData?.is_active === null || profileData?.is_active === undefined ? true : profileData.is_active,
                    createdAt: user.created_at,
                } as User;
            });

            setCachedData(cacheKey, users);
            return users;
        } catch (error: any) {
            console.error('[SuperAdminService] Error in getAllPlatformUsers:', error.message);
            throw error;
        }
    },

    getAllPlatformSales: async (token: string, options?: {
        limit?: number;
        offset?: number;
        dateFrom?: string;
        dateTo?: string;
    }): Promise<Sale[]> => {
        if (!token) throw new Error("Token de autenticação de super admin é necessário.");

        const { limit = 1000, offset = 0, dateFrom, dateTo } = options || {};
        const cacheKey = `platform-sales-all-${limit}-${offset}-${dateFrom}-${dateTo}`;

        const cachedSales = getCachedData<Sale[]>(cacheKey);
        if (cachedSales) return cachedSales;

        try {
            let query = adminSupabase // Changed to adminSupabase
                .from('sales')
                .select('*')
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (dateFrom) query = query.gte('created_at', dateFrom);
            if (dateTo) query = query.lte('created_at', dateTo);

            const { data, error } = await query;

            if (error) throw new Error(error.message || "Falha ao buscar vendas da plataforma.");

            const sales = data ? data.map(fromSupabaseSaleRow) : [];
            setCachedData(cacheKey, sales);
            return sales;
        } catch (error: any) {
            console.error('[SuperAdminService] Error in getAllPlatformSales:', error.message);
            throw error;
        }
    },

    getAllPlatformProducts: async (token: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<AppProduct[]> => {
        if (!token) throw new Error("Token de autenticação de super admin é necessário.");

        const { limit = 1000, offset = 0 } = options || {};
        const cacheKey = `platform-products-${limit}-${offset}`;

        const cachedProducts = getCachedData<AppProduct[]>(cacheKey);
        if (cachedProducts) return cachedProducts;

        try {
            const { data, error } = await adminSupabase // Changed to adminSupabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw new Error(error.message || "Falha ao buscar produtos da plataforma.");

            const products = data ? data.map(fromSupabaseProductRow) : [];
            setCachedData(cacheKey, products);
            return products;
        } catch (error: any) {
            console.error('[SuperAdminService] Error in getAllPlatformProducts:', error.message);
            throw error;
        }
    },

    getAllAuditLogs: async (token: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<AuditLogEntry[]> => {
        if (!token) throw new Error("Token de autenticação de super admin é necessário.");

        const { limit = 500, offset = 0 } = options || {};
        const cacheKey = `audit-logs-${limit}-${offset}`;

        const cachedLogs = getCachedData<AuditLogEntry[]>(cacheKey);
        if (cachedLogs) return cachedLogs;

        try {
            const { data, error } = await adminSupabase // Changed to adminSupabase
                .from('audit_log_entries')
                .select('*')
                .order('timestamp', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                if (error.code === '42P01') { 
                    console.warn("Audit log table 'audit_log_entries' does not exist.");
                    setCachedData(cacheKey, []);
                    return [];
                }
                throw new Error(error.message || "Falha ao buscar logs de auditoria.");
            }

            const logs = data ? data.map(fromSupabaseAuditLogRow) : [];
            setCachedData(cacheKey, logs);
            return logs;
        } catch (error: any) {
            console.error('[SuperAdminService] Error in getAllAuditLogs:', error.message);
            throw error;
        }
    },

    getPlatformSummary: async (token: string): Promise<{
        totalUsers: number;
        totalSales: number; 
        totalProducts: number;
        totalRevenue: number; 
    }> => {
        if (!token) throw new Error("Token de autenticação de super admin é necessário.");

        const cacheKey = 'platform-summary';
        const cachedSummary = getCachedData<any>(cacheKey);
        if (cachedSummary) return cachedSummary;

        try {
            const [usersCountRes, salesRes, productsCountRes] = await Promise.all([
                adminSupabase.from('profiles').select('id', { count: 'exact', head: true }), // Changed to adminSupabase
                adminSupabase.from('sales').select('total_amount_in_cents, status'), // Changed to adminSupabase
                adminSupabase.from('products').select('id', { count: 'exact', head: true }) // Changed to adminSupabase
            ]);
            
            if (usersCountRes.error) throw new Error(usersCountRes.error.message);
            if (salesRes.error) throw new Error(salesRes.error.message);
            if (productsCountRes.error) throw new Error(productsCountRes.error.message);

            const totalRevenue = salesRes.data
                ?.filter(sale => sale.status === PaymentStatus.PAID)
                .reduce((sum, sale) => sum + (sale.total_amount_in_cents || 0), 0) || 0;

            const summary = {
                totalUsers: usersCountRes.count || 0,
                totalSales: salesRes.data?.length || 0, 
                totalProducts: productsCountRes.count || 0,
                totalRevenue
            };

            setCachedData(cacheKey, summary);
            return summary;
        } catch (error: any) {
            console.error('[SuperAdminService] Error in getPlatformSummary:', error.message);
            throw error;
        }
    },

    getPaginatedSales: async (token: string, page: number = 1, pageSize: number = 50, filters: { dateFrom?: string; dateTo?: string } = {}): Promise<{
        data: Sale[];
        totalCount: number;
        hasMore: boolean;
    }> => {
        if (!token) throw new Error("Token de autenticação de super admin é necessário.");
        
        const offset = (page - 1) * pageSize;
        const cacheKey = `platform-sales-paginated-${page}-${pageSize}-${filters.dateFrom}-${filters.dateTo}`;
        const cachedResult = getCachedData<any>(cacheKey);
        if (cachedResult) return cachedResult;
        
        try {
            let salesQuery = adminSupabase // Changed to adminSupabase
                .from('sales')
                .select('*', { count: 'exact' }) 
                .order('created_at', { ascending: false })
                .range(offset, offset + pageSize - 1);

            if (filters.dateFrom) salesQuery = salesQuery.gte('created_at', filters.dateFrom);
            if (filters.dateTo) salesQuery = salesQuery.lte('created_at', filters.dateTo);
            
            const { data, error, count } = await salesQuery;

            if (error) throw new Error(error.message);

            const sales = data ? data.map(fromSupabaseSaleRow) : [];
            const totalCount = count || 0;
            const hasMore = offset + pageSize < totalCount;
            
            const result = { data: sales, totalCount, hasMore };
            setCachedData(cacheKey, result);
            return result;

        } catch (error: any) {
            console.error('[SuperAdminService] Error in getPaginatedSales:', error.message);
            throw error;
        }
    },

    updateUserProfileAsSuperAdmin: async (
        userIdToUpdate: string,
        updates: Partial<Pick<User, 'name' | 'isActive' | 'isSuperAdmin'>>,
        adminToken: string
    ): Promise<{ success: boolean, message?: string }> => {
        if (!adminToken) return { success: false, message: "Token de autenticação de super admin é necessário." };

        try {
            const profileUpdates: Partial<Database['public']['Tables']['profiles']['Update']> = {};
            if (updates.name !== undefined) profileUpdates.name = updates.name;
            if (updates.isActive !== undefined) profileUpdates.is_active = updates.isActive;
            if (updates.isSuperAdmin !== undefined) profileUpdates.is_super_admin = updates.isSuperAdmin;


            const { error: profileUpdateError } = await adminSupabase // Changed to adminSupabase
                .from('profiles')
                .update(profileUpdates)
                .eq('id', userIdToUpdate);

            if (profileUpdateError) {
                console.error(`[SuperAdminService] Error updating profile for ${userIdToUpdate}:`, profileUpdateError);
                return { success: false, message: profileUpdateError.message || "Erro ao atualizar perfil do usuário." };
            }

            cache.delete('platform-users');
            cache.delete('platform-summary'); 

            return { success: true, message: "Usuário atualizado com sucesso." };
        } catch (error: any) {
            console.error('[SuperAdminService] Error in updateUserProfileAsSuperAdmin:', error.message);
            return { success: false, message: "Erro interno ao atualizar usuário." };
        }
    },

    clearCache: (): void => {
        cache.clear();
        console.log('[SuperAdminService] Cache cleared.');
    }
};
