
import { User, Sale, SaleProductItem, PaymentMethod, PaymentStatus, Product as AppProduct, AuditLogEntry } from '@/types';
import { supabase } from '@/supabaseClient';
import { Database, Json } from '@/types/supabase';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type SaleRow = Database['public']['Tables']['sales']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row']; 
type AuditLogEntryRow = Database['public']['Tables']['audit_log_entries']['Row']; 

// This function might still be useful if other parts of the super admin service fetch profiles directly
// and need to map them to the User type, ensuring email comes from auth.users if available.
// However, for getAllPlatformUsers, the Edge Function now handles the data combination.
const fromSupabaseProfileRowToUser = (row: ProfileRow): User => ({
  id: row.id,
  email: '', // This will be populated by the Edge Function primarily from auth.users
  name: row.name || undefined,
  isSuperAdmin: row.is_super_admin || false,
  isActive: row.is_active || false,
  createdAt: row.created_at || undefined,
});

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
    id: row.id, platformUserId: row.platform_user_id, pushInPayTransactionId: row.push_in_pay_transaction_id,
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

// Adicionado: fromSupabaseProductRow
const fromSupabaseProductRow = (row: ProductRow): AppProduct => ({
  id: row.id,
  platformUserId: row.platform_user_id,
  slug: row.slug,
  name: row.name,
  description: row.description,
  priceInCents: row.price_in_cents,
  imageUrl: row.image_url || undefined,
  checkoutCustomization: parseJsonField(row.checkout_customization, {}),
  deliveryUrl: row.delivery_url || undefined,
  totalSales: row.total_sales || 0,
  clicks: row.clicks || 0,
  checkoutViews: row.checkout_views || 0,
  conversionRate: row.conversion_rate || 0,
  abandonmentRate: row.abandonment_rate || 0,
  orderBump: parseJsonField(row.order_bump, undefined),
  upsell: parseJsonField(row.upsell, undefined),
  coupons: parseJsonField(row.coupons, []),
});

// Adicionado: fromSupabaseAuditLogEntryRow
const fromSupabaseAuditLogEntryRow = (row: AuditLogEntryRow): AuditLogEntry => ({
  id: row.id,
  timestamp: row.timestamp,
  actorUserId: row.actor_user_id,
  actorEmail: row.actor_email,
  actionType: row.action_type,
  targetEntityType: row.target_entity_type || undefined,
  targetEntityId: row.target_entity_id || undefined,
  description: row.description,
  details: parseJsonField(row.details, undefined),
});


export const superAdminService = {
  getAllPlatformUsers: async (accessToken: string | null): Promise<User[]> => {
    if (!accessToken) {
      console.warn("superAdminService.getAllPlatformUsers: Access token não fornecido.");
      throw new Error("Autenticação de super admin necessária.");
    }
    try {
      const { data, error } = await supabase.functions.invoke<{ users: User[] }>('get-all-platform-users');

      if (error) {
        console.error('Error invoking get-all-platform-users function:', error);
        throw new Error(error.message || 'Falha ao buscar usuários da plataforma via Edge Function.');
      }
      
      if (!data || !data.users) {
        console.warn('No users data returned from get-all-platform-users function.');
        return [];
      }

      return data.users;

    } catch (genericError: any) {
      console.error('Exception in getAllPlatformUsers:', genericError);
      throw new Error(genericError.message || 'Falha geral ao buscar todos os usuários.');
    }
  },

  updateUserProfileAsSuperAdmin: async (
    userIdToUpdate: string,
    updates: Partial<Pick<User, 'name' | 'isActive' | 'isSuperAdmin'>>,
    accessToken: string | null
  ): Promise<{ success: boolean; message?: string }> => {
    if (!accessToken) {
      throw new Error("Autenticação de super admin necessária para atualizar usuário.");
    }
    console.log(`[superAdminService] Attempting to update user ${userIdToUpdate} with updates:`, updates);
    try {
      const { data, error } = await supabase.functions.invoke<{ success: boolean; message?: string; error?: string }>(
        'update-platform-user',
        { 
          headers: { Authorization: `Bearer ${accessToken}` },
          body: { userIdToUpdate, updates }
        }
      );

      if (error) {
        console.error(`[superAdminService] Error invoking update-platform-user function for ${userIdToUpdate}:`, error);
        throw new Error(error.message || 'Falha ao chamar a função de atualização de usuário.');
      }
      
      if (!data) {
        console.error(`[superAdminService] No data returned from update-platform-user function for ${userIdToUpdate}.`);
        throw new Error('Resposta vazia da função de atualização de usuário.');
      }

      if (!data.success) {
        console.error(`[superAdminService] Edge function reported failure for ${userIdToUpdate}:`, data.error || data.message);
        throw new Error(data.error || data.message || 'Falha ao atualizar usuário na Edge Function.');
      }

      console.log(`[superAdminService] User ${userIdToUpdate} update reported success by Edge Function.`);
      return { success: true, message: data.message || "Usuário atualizado com sucesso." };

    } catch (err: any) {
      console.error(`[superAdminService] Exception in updateUserProfileAsSuperAdmin for ${userIdToUpdate}:`, err);
      throw new Error(err.message || 'Falha geral ao atualizar perfil do usuário.');
    }
  },

  getAllPlatformSales: async (accessToken: string | null): Promise<Sale[]> => {
    if (!accessToken) {
      console.warn("superAdminService.getAllPlatformSales: Access token não fornecido.");
      throw new Error("Autenticação de super admin necessária.");
    }
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*');
      
      if (error) {
        console.error('Supabase getAllPlatformSales error:', error);
        throw new Error(error.message || 'Falha ao buscar todas as vendas da plataforma.');
      }
      return data ? data.map(fromSupabaseSaleRow) : [];
    } catch (genericError: any) {
      console.error('Exception in getAllPlatformSales:', genericError);
      throw new Error(genericError.message || 'Falha geral ao buscar todas as vendas.');
    }
  },

  getAllAuditLogs: async (accessToken: string | null): Promise<AuditLogEntry[]> => {
    if (!accessToken) {
      console.warn("superAdminService.getAllAuditLogs: Access token não fornecido.");
      throw new Error("Autenticação de super admin necessária.");
    }
    try {
      const { data, error } = await supabase
        .from('audit_log_entries')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Supabase getAllAuditLogs error:', error);
        throw new Error(error.message || 'Falha ao buscar logs de auditoria.');
      }
      return data ? data.map(fromSupabaseAuditLogEntryRow) : [];
    } catch (genericError: any) {
      console.error('Exception in getAllAuditLogs:', genericError);
      throw new Error(genericError.message || 'Falha geral ao buscar logs de auditoria.');
    }
  },

  getAllPlatformProducts: async (accessToken: string | null): Promise<AppProduct[]> => {
    if (!accessToken) {
      console.warn("superAdminService.getAllPlatformProducts: Access token não fornecido.");
      throw new Error("Autenticação de super admin necessária.");
    }
    
    const columnsToSelect = 'id, platform_user_id, slug, name, description, price_in_cents, image_url, checkout_customization, delivery_url, total_sales, clicks, checkout_views, conversion_rate, abandonment_rate, order_bump, upsell, coupons, created_at, updated_at';
    console.log(`[superAdminService] Attempting to select columns for products: ${columnsToSelect}`);

    try {
      const { data, error } = await supabase
        .from('products')
        .select(columnsToSelect); 

      if (error) {
        console.error('Supabase getAllPlatformProducts error:', error);
        throw new Error(String(error.message || 'Falha ao buscar todos os produtos da plataforma.'));
      }
      return data ? data.map(fromSupabaseProductRow) : [];
    } catch (genericError: any) {
      console.error('Exception in getAllPlatformProducts:', genericError);
      throw new Error(String(genericError.message || 'Falha geral ao buscar todos os produtos.'));
    }
  },
};