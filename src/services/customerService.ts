
import { Customer, FunnelStage, Sale, PaymentStatus } from '@/types'; // Ajustado para alias @
import { supabase, getSupabaseUserId } from '@/supabaseClient'; // Ajustado para alias @
import { Database } from '@/types/supabase'; // Ajustado para alias @
import { v4 as uuidv4 } from 'uuid';

// --- START: CACHE MANAGEMENT ---
const customersCache = new Map<string, { customers: Customer[], timestamp: number }>();
const customerByIdCache = new Map<string, { customer: Customer, timestamp: number }>();
const CACHE_TTL = 2 * 1000; // Cache de 2 segundos

const getCustomersFromCache = (userId: string): Customer[] | null => {
  const cached = customersCache.get(userId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.customers;
  }
  customersCache.delete(userId);
  return null;
};

const setCustomersInCache = (userId: string, customers: Customer[]) => {
  customersCache.set(userId, { customers, timestamp: Date.now() });
};

const invalidateCustomersCache = (userId: string) => {
  customersCache.delete(userId);
};

const getCustomerByIdFromCache = (customerId: string): Customer | null => {
  const cached = customerByIdCache.get(customerId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.customer;
  }
  customerByIdCache.delete(customerId);
  return null;
};

const setCustomerByIdInCache = (customerId: string, customer: Customer) => {
  customerByIdCache.set(customerId, { customer, timestamp: Date.now() });
};


// --- END: CACHE MANAGEMENT ---

type CustomerRow = Database['public']['Tables']['customers']['Row'];
type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
type CustomerUpdate = Database['public']['Tables']['customers']['Update'];


export const fromSupabaseCustomerRow = (row: CustomerRow): Customer => {
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
  getCustomers: async (): Promise<Customer[]> => { 
    const userId = await getSupabaseUserId();
    if (!userId) {
        console.warn("customerService.getCustomers: User ID não encontrado. Retornando lista vazia.");
        return [];
    }

    const cached = getCustomersFromCache(userId);
    if (cached) return cached;

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
      const customers = data ? data.map(fromSupabaseCustomerRow) : [];
      setCustomersInCache(userId, customers);
      return customers;
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

  getCustomerById: async (id: string): Promise<Customer | undefined> => { 
    const userId = await getSupabaseUserId(); 
    if (!userId) {
        console.warn("customerService.getCustomerById: User ID não encontrado.");
        return undefined;
    }

    const cached = getCustomerByIdFromCache(id);
    if (cached) return cached;

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
      const customer = data ? fromSupabaseCustomerRow(data) : undefined;
      if (customer) setCustomerByIdInCache(id, customer);
      return customer;
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

  upsertCustomerOnSale: async (sale: Sale): Promise<Customer | null> => { 
    const { platformUserId, customer, products, totalAmountInCents, id: saleId, createdAt, paidAt, status } = sale;
    const logPrefix = `[customerService.upsertCustomerOnSale(saleId: ${saleId?.substring(0,8) || 'N/A'})]`;
    console.log(`${logPrefix} Iniciando upsert para venda.`);


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
    
    // Use paidAt if sale is PAID and paidAt is available, otherwise fallback to createdAt
    let saleEffectiveDate: string;
    if (status === PaymentStatus.PAID && paidAt) {
      saleEffectiveDate = paidAt;
      console.log(`${logPrefix} Usando paidAt (${paidAt}) como saleEffectiveDate.`);
    } else {
      saleEffectiveDate = createdAt;
      console.log(`${logPrefix} Usando createdAt (${createdAt}) como saleEffectiveDate (status: ${status}, paidAt: ${paidAt}).`);
    }


    if (existingCustomerData) {
      console.log(`${logPrefix} Atualizando cliente existente ID: ${existingCustomerData.id}`);
      const updatedSaleIds = Array.from(new Set([...(existingCustomerData.sale_ids || []), saleId]));
      const updatedProductsPurchased = Array.from(new Set([...(existingCustomerData.products_purchased || []), ...purchasedProductIds]));

      const updates: CustomerUpdate = {
        name: customer.name || existingCustomerData.name,
        whatsapp: customer.whatsapp || existingCustomerData.whatsapp,
        products_purchased: updatedProductsPurchased,
        funnel_stage: FunnelStage.CUSTOMER, // Always update to customer on a new sale for an existing record
        last_purchase_date: saleEffectiveDate,
        total_orders: (existingCustomerData.total_orders || 0) + 1,
        total_spent_in_cents: (existingCustomerData.total_spent_in_cents || 0) + totalAmountInCents,
        sale_ids: updatedSaleIds,
        updated_at: new Date().toISOString(),
      };
      
      // Only set first_purchase_date if it's not already set.
      if (!existingCustomerData.first_purchase_date) {
        updates.first_purchase_date = saleEffectiveDate;
        console.log(`${logPrefix} Definindo first_purchase_date para ${saleEffectiveDate}`);
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
      if (updatedData) {
        const updatedCustomer = fromSupabaseCustomerRow(updatedData);
        setCustomerByIdInCache(updatedCustomer.id, updatedCustomer);
        invalidateCustomersCache(updatedCustomer.platformUserId);
        return updatedCustomer;
      }
      return null;
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
      if (insertedData) {
        const newCustomer = fromSupabaseCustomerRow(insertedData);
        setCustomerByIdInCache(newCustomer.id, newCustomer);
        invalidateCustomersCache(newCustomer.platformUserId);
        return newCustomer;
      }
      return null;
    }
  }
};
