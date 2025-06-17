
import { User, Sale, SaleProductItem, PaymentMethod, PaymentStatus, Product as AppProduct, AuditLogEntry, ProductCheckoutCustomization, OrderBumpOffer, UpsellOffer, Coupon } from '@/types';
import { supabase } from '@/supabaseClient';
import { Database, Json } from '@/types/supabase';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type SaleRow = Database['public']['Tables']['sales']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row']; 
type AuditLogEntryRow = Database['public']['Tables']['audit_log_entries']['Row']; 

const parseJsonField = <T>(field: Json | null | undefined, defaultValue: T): T => {
  if (field === null || field === undefined) return defaultValue;
  if (typeof field === 'string') {
    try { return JSON.parse(field) as T; }
    catch (e) { console.warn('Failed to parse JSON string field:', field, e); return defaultValue; }
  }
  return field as T;
};

// fromSupabaseProfileRowToUser was removed as it's unused

const fromSupabaseSaleRow = (row: SaleRow): Sale => { 
  return {
    id: row.id,
    platformUserId: row.platform_user_id,
    pushInPayTransactionId: row.push_in_pay_transaction_id,
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
    checkoutCustomization: parseJsonField<ProductCheckoutCustomization>(row.checkout_customization, {}),
    deliveryUrl: row.delivery_url || undefined,
    totalSales: row.total_sales || 0,
    clicks: row.clicks || 0,
    checkoutViews: row.checkout_views || 0,
    conversionRate: row.conversion_rate || 0,
    abandonmentRate: row.abandonment_rate || 0,
    orderBump: parseJsonField<OrderBumpOffer | undefined>(row.order_bump, undefined),
    upsell: parseJsonField<UpsellOffer | undefined>(row.upsell, undefined),
    coupons: parseJsonField<Coupon[]>(row.coupons, []),
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
    getAllPlatformUsers: async (token: string): Promise<User[]> => {
        if (!token) throw new Error("Token de autenticação de super admin é necessário.");
        const { data: usersList, error: usersError } = await supabase.auth.admin.listUsers();
        if (usersError) throw new Error(usersError.message || "Falha ao buscar usuários da plataforma.");
        
        const profilePromises = usersList.users.map(user => 
            supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<ProfileRow>()
        );
        const profileResults = await Promise.all(profilePromises);

        return usersList.users.map((user, index) => {
            const profileData = profileResults[index].data;
            return {
                id: user.id,
                email: user.email || '',
                name: profileData?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
                isSuperAdmin: profileData?.is_super_admin || false,
                isActive: profileData?.is_active === null || profileData?.is_active === undefined ? true : profileData.is_active,
                createdAt: user.created_at,
            };
        });
    },

    getAllPlatformSales: async (token: string): Promise<Sale[]> => {
        if (!token) throw new Error("Token de autenticação de super admin é necessário.");
        const { data, error } = await supabase.from('sales').select('*');
        if (error) throw new Error(error.message || "Falha ao buscar todas as vendas da plataforma.");
        return data ? data.map(fromSupabaseSaleRow) : [];
    },

    getAllPlatformProducts: async (token: string): Promise<AppProduct[]> => {
        if (!token) throw new Error("Token de autenticação de super admin é necessário.");
        const { data, error } = await supabase.from('products').select('*');
        if (error) throw new Error(error.message || "Falha ao buscar todos os produtos da plataforma.");
        return data ? data.map(fromSupabaseProductRow) : [];
    },
    
    getAllAuditLogs: async (token: string): Promise<AuditLogEntry[]> => {
        if (!token) throw new Error("Token de autenticação de super admin é necessário.");
        const { data, error } = await supabase.from('audit_log_entries').select('*').order('timestamp', { ascending: false });
        if (error) {
            if (error.code === '42P01') { // table does not exist
                console.warn("Audit log table 'audit_log_entries' does not exist.");
                return []; // Return empty if table is missing, as it might be an optional feature
            }
            throw new Error(error.message || "Falha ao buscar logs de auditoria.");
        }
        return data ? data.map(fromSupabaseAuditLogRow) : [];
    },

    updateUserProfileAsSuperAdmin: async (
        userIdToUpdate: string, 
        updates: Partial<Pick<User, 'name' | 'isActive' | 'isSuperAdmin'>>,
        adminToken: string
    ): Promise<{ success: boolean, message?: string }> => {
        if (!adminToken) return { success: false, message: "Token de autenticação de super admin é necessário." };
        
        const profileUpdates: Partial<Database['public']['Tables']['profiles']['Update']> = {};
        if(updates.name !== undefined) profileUpdates.name = updates.name;
        if(updates.isActive !== undefined) profileUpdates.is_active = updates.isActive;
        if(updates.isSuperAdmin !== undefined) profileUpdates.is_super_admin = updates.isSuperAdmin;
        
        if (Object.keys(profileUpdates).length === 0) {
            return { success: true, message: "Nenhuma alteração para aplicar ao perfil." };
        }

        profileUpdates.updated_at = new Date().toISOString();

        const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('id', userIdToUpdate);

        if (profileUpdateError) {
            console.error(`[SuperAdminService] Error updating profile for ${userIdToUpdate}:`, profileUpdateError);
            return { success: false, message: profileUpdateError.message || "Erro ao atualizar perfil do usuário." };
        }
        
        // If name was updated in Supabase Auth user_metadata (not directly supported by profile updates here)
        // it would be:
        // if (updates.name) {
        //   const { error: authUserUpdateError } = await supabase.auth.admin.updateUserById(userIdToUpdate, {
        //     user_metadata: { name: updates.name }
        //   });
        //   if (authUserUpdateError) {
        //     console.warn(`[SuperAdminService] Error updating auth user_metadata for ${userIdToUpdate}:`, authUserUpdateError);
        //     // Non-critical, so don't fail the whole operation.
        //   }
        // }

        return { success: true, message: "Usuário atualizado com sucesso." };
    }
};
