
import { Customer, FunnelStage, Sale } from '@/types'; // Ajustado para alias @
import { supabase, getSupabaseUserId } from '@/supabaseClient'; // Ajustado para alias @
import { Database, Json } from '@/types/supabase'; // Ajustado para alias @
import { v4 as uuidv4 } from 'uuid';

type CustomerRow = Database['public']['Tables']['customers']['Row'];
type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
type CustomerUpdate = Database['public']['Tables']['customers']['Update'];


const fromSupabaseCustomerRow = (row: CustomerRow): Customer => {
  return {
    id: row.id,
    platformUserId: row.platform_user_id,
    name: row.name,
    email: row.email,
    whatsapp: row.whatsapp,
    productsPurchased: row.products_purchased || [],
    funnelStage: row.funnel_stage as FunnelStage,
    firstPurchaseDate: row.first_purchase_date,
    lastPurchaseDate: row.last_purchase_date,
    totalOrders: row.total_orders,
    totalSpentInCents: row.total_spent_in_cents,
    saleIds: row.sale_ids || [],
  };
};

export const customerService = {
  getCustomers: async (_token: string | null): Promise<Customer[]> => { 
    const userId = await getSupabaseUserId();
    if (!userId) {
        console.warn("customerService.getCustomers: User ID não encontrado. Retornando lista vazia.");
        return [];
    }

    try {
      const { data, error } = await supabase // Use imported supabase
        .from('customers')
        .select('*')
        .eq('platform_user_id', userId);

      if (error) {
        const isMissingTableError = error.code === '42P01' || 
                                  (typeof error.message === 'string' && 
                                   error.message.toLowerCase().includes('relation') && 
                                   error.message.toLowerCase().includes('does not exist'));
        if (isMissingTableError) {
          console.warn(`Supabase getCustomers: Tabela "customers" não encontrada (code: ${error.code}). Retornando lista vazia.`);
          return [];
        }
        console.error('Supabase getCustomers error:', error);
        throw new Error(error.message || 'Falha ao buscar clientes.');
      }
      console.log('[customerService.getCustomers] Data received:', data);
      return data ? data.map(fromSupabaseCustomerRow) : [];
    } catch (genericError: any) {
      console.error('Exception in getCustomers:', genericError);
      const isMissingTableInGenericError = typeof genericError.message === 'string' &&
                                           genericError.message.toLowerCase().includes('relation') &&
                                           genericError.message.toLowerCase().includes('does not exist');
      if (genericError.code === '42P01' || isMissingTableInGenericError) {
        console.warn('Supabase getCustomers: Tabela "customers" não encontrada (capturado em exceção). Retornando lista vazia.');
        return [];
      }
      throw new Error(genericError.message || 'Falha geral ao buscar clientes.');
    }
  },

  getCustomerById: async (id: string, _token: string | null): Promise<Customer | undefined> => { 
    const userId = await getSupabaseUserId(); 
    if (!userId) {
        console.warn("customerService.getCustomerById: User ID não encontrado.");
        return undefined;
    }
    try {
      const { data, error } = await supabase // Use imported supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .eq('platform_user_id', userId) 
        .single<CustomerRow>();

      if (error) {
        if (error.code === 'PGRST116') return undefined; 

        const isMissingTableError = error.code === '42P01' || 
                                  (typeof error.message === 'string' && 
                                   error.message.toLowerCase().includes('relation') && 
                                   error.message.toLowerCase().includes('does not exist'));
        if (isMissingTableError) {
          console.warn(`Supabase getCustomerById: Tabela "customers" não encontrada ao buscar ID ${id} (code: ${error.code}). Retornando undefined.`);
          return undefined;
        }
        console.error('Supabase getCustomerById error:', error);
        throw new Error(error.message || 'Falha ao buscar cliente.');
      }
      return data ? fromSupabaseCustomerRow(data) : undefined;
    } catch (genericError: any) {
      console.error('Exception in getCustomerById:', genericError);
      const isMissingTableInGenericError = typeof genericError.message === 'string' &&
                                           genericError.message.toLowerCase().includes('relation') &&
                                           genericError.message.toLowerCase().includes('does not exist');
      if (genericError.code === '42P01' || isMissingTableInGenericError) {
        console.warn(`Supabase getCustomerById: Tabela "customers" não encontrada ao buscar ID ${id} (capturado em exceção). Retornando undefined.`);
        return undefined;
      }
      throw new Error(genericError.message || 'Falha geral ao buscar cliente.');
    }
  },

  upsertCustomerOnSale: async (sale: Sale, token: string | null): Promise<Customer | null> => { // Added token parameter
    const { platformUserId, customer, products, totalAmountInCents, id: saleId, createdAt, paidAt } = sale;
    const logPrefix = `[customerService.upsertCustomerOnSale(saleId: ${saleId?.substring(0,8) || 'N/A'})]`;
    console.log(`${logPrefix} Iniciando upsert para venda. Token recebido: ${token ? 'Presente' : 'Ausente'}`);


    if (!platformUserId || !customer?.email) {
      console.error(`${logPrefix} Cannot upsert customer: platformUserId or customer email is missing from sale. Sale:`, sale);
      return null;
    }
    console.log(`${logPrefix} Dados da venda: platformUserId=${platformUserId}, customerEmail=${customer.email}`);

    const { data: existingCustomerData, error: fetchError } = await supabase
      .from('customers')
      .select('*')
      .eq('platform_user_id', platformUserId)
      .eq('email', customer.email)
      .maybeSingle<CustomerRow>();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error(`${logPrefix} Erro ao buscar cliente existente:`, fetchError);
      throw new Error(fetchError.message || "Falha ao buscar cliente existente.");
    }
    console.log(`${logPrefix} Cliente existente encontrado:`, existingCustomerData);


    const purchasedProductIds = products.map(p => p.productId);
    const saleEffectiveDate = paidAt || createdAt; 

    if (existingCustomerData) {
      console.log(`${logPrefix} Atualizando cliente existente ID: ${existingCustomerData.id}`);
      const updatedSaleIds = Array.from(new Set([...(existingCustomerData.sale_ids || []), saleId]));
      const updatedProductsPurchased = Array.from(new Set([...(existingCustomerData.products_purchased || []), ...purchasedProductIds]));

      const updates: CustomerUpdate = {
        name: customer.name || existingCustomerData.name,
        whatsapp: customer.whatsapp || existingCustomerData.whatsapp,
        products_purchased: updatedProductsPurchased,
        funnel_stage: FunnelStage.CUSTOMER,
        last_purchase_date: saleEffectiveDate,
        total_orders: (existingCustomerData.total_orders || 0) + 1,
        total_spent_in_cents: (existingCustomerData.total_spent_in_cents || 0) + totalAmountInCents,
        sale_ids: updatedSaleIds,
        updated_at: new Date().toISOString(),
      };
      
      if (!existingCustomerData.first_purchase_date) {
        updates.first_purchase_date = saleEffectiveDate;
      }
      console.log(`${logPrefix} Dados para atualização:`, updates);


      const { data: updatedData, error: updateError } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', existingCustomerData.id)
        .select()
        .single<CustomerRow>();

      if (updateError) {
        console.error(`${logPrefix} Erro ao atualizar cliente:`, updateError);
        throw new Error(updateError.message || "Falha ao atualizar cliente.");
      }
      console.log(`${logPrefix} Cliente atualizado com sucesso:`, updatedData);
      return updatedData ? fromSupabaseCustomerRow(updatedData) : null;
    } else {
      console.log(`${logPrefix} Criando novo cliente para email: ${customer.email}`);
      const newCustomerId = uuidv4();
      const newCustomerPayload: CustomerInsert = {
        id: newCustomerId,
        platform_user_id: platformUserId,
        name: customer.name,
        email: customer.email,
        whatsapp: customer.whatsapp,
        products_purchased: purchasedProductIds,
        funnel_stage: FunnelStage.CUSTOMER,
        first_purchase_date: saleEffectiveDate,
        last_purchase_date: saleEffectiveDate,
        total_orders: 1,
        total_spent_in_cents: totalAmountInCents,
        sale_ids: [saleId],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      console.log(`${logPrefix} Dados para inserção:`, newCustomerPayload);

      const { data: insertedData, error: insertError } = await supabase
        .from('customers')
        .insert(newCustomerPayload)
        .select()
        .single<CustomerRow>();

      if (insertError) {
        console.error(`${logPrefix} Erro ao inserir novo cliente:`, insertError);
        throw new Error(insertError.message || "Falha ao criar novo cliente.");
      }
      console.log(`${logPrefix} Novo cliente criado com sucesso:`, insertedData);
      return insertedData ? fromSupabaseCustomerRow(insertedData) : null;
    }
  }
};
