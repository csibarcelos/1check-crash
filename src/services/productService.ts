
import { Product, Coupon, TraditionalOrderBumpOffer, PostClickOffer, UpsellOffer, ProductCheckoutCustomization, UtmParams, PostPurchaseEmails, DeliveryEmailConfig, FollowUpEmailConfig } from '@/types'; 
import { supabase, getSupabaseUserId } from '@/supabaseClient';  
import { Database, Json } from '@/types/supabase'; 

type ProductRow = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

// --- START: CACHE MANAGEMENT ---
const productCache = new Map<string, { product: Product, timestamp: number }>();
const CACHE_TTL = 2 * 1000; // Cache de 2 segundos para leituras rápidas, mas que permite atualizações.

const getFromCache = (key: string): Product | null => {
  const cached = productCache.get(key);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    // console.log(`[productService] Cache HIT for key: ${key}`);
    return cached.product;
  }
  // console.log(`[productService] Cache MISS or EXPIRED for key: ${key}`);
  productCache.delete(key);
  return null;
}

const setInCache = (key: string, product: Product) => {
  // console.log(`[productService] Setting cache for key: ${key}`);
  productCache.set(key, { product, timestamp: Date.now() });
}

const invalidateCache = (productId?: string, slug?: string) => {
  if (productId) productCache.delete(`id_${productId}`);
  if (slug) productCache.delete(`slug_${slug}`);
  // Invalidate list cache on any write operation
  productCache.delete('all_products');
}


// --- END: CACHE MANAGEMENT ---


const generateSlugFromName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-') 
    .replace(/[^\w-]+/g, '') 
    .replace(/--+/g, '-') 
    .substring(0, 50) + `-${Math.random().toString(36).substring(2, 7)}`; 
};

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

export const defaultProductCheckoutCustomization: ProductCheckoutCustomization = {
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
  animateTraditionalOrderBumps: true,
};

export const defaultUtmParams: UtmParams = {
  source: '', medium: '', campaign: '', term: '', content: ''
};

export const defaultDeliveryEmailConfig: DeliveryEmailConfig = {
  enabled: true, // Delivery email is enabled by default.
  subject: 'Seu produto: {{product_name}}',
  bodyHtml: '<p>Olá {{customer_name}},</p><p>Obrigado por sua compra! Você pode acessar seu produto através do link abaixo:</p><p><a href="{{product_delivery_url}}">Acessar {{product_name}}</a></p><p>Atenciosamente,<br>Equipe {{shop_name}}</p>',
};

export const defaultFollowUpEmailConfig: FollowUpEmailConfig = {
  enabled: false,
  delayDays: 3,
  subject: 'O que você achou do {{product_name}}?',
  bodyHtml: '<p>Olá {{customer_name}},</p><p>Esperamos que esteja aproveitando seu produto: {{product_name}}.</p><p>Seu feedback é muito importante para nós!</p><p>Atenciosamente,<br>Equipe {{shop_name}}</p>',
};

export const defaultPostPurchaseEmails: PostPurchaseEmails = {
    delivery: defaultDeliveryEmailConfig,
    followUp: defaultFollowUpEmailConfig,
};


export const fromSupabaseProductRow = (row: ProductRow): Product => {
  const checkoutCustomizationData = parseJsonField<ProductCheckoutCustomization | null>(row.checkout_customization, null);

  const postPurchaseJson = row.post_purchase_email_config;
  
  // Start with a fully-formed default object. This is the safe fallback.
  const finalPostPurchaseConfig: PostPurchaseEmails = {
      delivery: { ...defaultDeliveryEmailConfig },
      followUp: { ...defaultFollowUpEmailConfig },
  };

  if (postPurchaseJson && typeof postPurchaseJson === 'object') {
      // This is the new, correct format which has a 'delivery' or 'followUp' key.
      if ('delivery' in postPurchaseJson || 'followUp' in postPurchaseJson) {
          const parsed = postPurchaseJson as Partial<PostPurchaseEmails>;
          // We merge the saved data over the defaults to ensure all fields are present.
          // If `parsed.delivery` or `parsed.followUp` is null/undefined, it uses the default.
          finalPostPurchaseConfig.delivery = { ...defaultDeliveryEmailConfig, ...(parsed.delivery || {}) };
          finalPostPurchaseConfig.followUp = { ...defaultFollowUpEmailConfig, ...(parsed.followUp || {}) };
      }
      // This handles the legacy format, where the config object was stored directly.
      // We check for a key unique to the old format, like 'delayDays'.
      else if ('delayDays' in postPurchaseJson) {
          // The old data is for the 'followUp' email.
          // The 'delivery' email will be initialized with defaults from above.
          finalPostPurchaseConfig.followUp = { ...defaultFollowUpEmailConfig, ...(postPurchaseJson as any) };
      }
      // If it's an empty object {} or some other unrecognized object, it will just use the defaults initialized above.
  }
  // If postPurchaseJson is null or not an object, the fully-formed default object will be used.
  
  return {
    id: row.id,
    platformUserId: row.platform_user_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceInCents: row.price_in_cents,
    imageUrl: row.image_url || undefined,
    productImageUrl: row.product_image_url || undefined,
    checkoutCustomization: {
        ...defaultProductCheckoutCustomization,
        ...(checkoutCustomizationData || {}),
        animateTraditionalOrderBumps: typeof checkoutCustomizationData?.animateTraditionalOrderBumps === 'boolean' 
            ? checkoutCustomizationData.animateTraditionalOrderBumps 
            : true, 
    },
    deliveryUrl: row.delivery_url || undefined,
    totalSales: row.total_sales || 0,
    clicks: row.clicks || 0,
    checkoutViews: row.checkout_views || 0,
    conversionRate: row.conversion_rate || 0,
    abandonmentRate: row.abandonment_rate || 0,
    orderBumps: parseJsonField<TraditionalOrderBumpOffer[]>(row.order_bumps, [] as TraditionalOrderBumpOffer[]), 
    postClickOffer: parseJsonField<PostClickOffer | undefined>(row.order_bump, undefined),
    upsell: parseJsonField<UpsellOffer | undefined>(row.upsell, undefined),
    coupons: parseJsonField<Coupon[]>(row.coupons, []),
    utmParams: parseJsonField<UtmParams | null>(row.utm_params, defaultUtmParams),
    postPurchaseEmailConfig: finalPostPurchaseConfig,
  };
};

const toSupabaseRow = (productData: Partial<Product>): Partial<ProductUpdate> => {
    const checkoutCustomizationToSave = {
      ...(productData.checkoutCustomization ?? defaultProductCheckoutCustomization),
    };

    return {
        name: productData.name,
        description: productData.description,
        price_in_cents: productData.priceInCents,
        image_url: productData.imageUrl || null,
        product_image_url: productData.productImageUrl || null,
        checkout_customization: checkoutCustomizationToSave as unknown as Json,
        delivery_url: productData.deliveryUrl || null,
        order_bumps: productData.orderBumps ? productData.orderBumps as unknown as Json : null,
        order_bump: productData.postClickOffer ? productData.postClickOffer as unknown as Json : null,
        upsell: productData.upsell ? productData.upsell as unknown as Json : null,
        coupons: productData.coupons ? productData.coupons as unknown as Json : null,
        utm_params: productData.utmParams ? productData.utmParams as unknown as Json : null,
        post_purchase_email_config: productData.postPurchaseEmailConfig ? productData.postPurchaseEmailConfig as unknown as Json : null,
        updated_at: new Date().toISOString(),
    };
};


export const productService = {
  getProducts: async (): Promise<Product[]> => {
    const userId = await getSupabaseUserId();
    if (!userId) {
        console.warn("productService.getProducts: User ID não encontrado. Retornando lista vazia.");
        return [];
    }

    const cached = getFromCache('all_products');
    if (cached) return cached as unknown as Product[];
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('platform_user_id', userId); 

      if (error) throw error;
      const products = data ? data.map(fromSupabaseProductRow) : [];
      setInCache('all_products', products as any);
      return products;
    } catch (error: any) {
      console.error('Supabase getProducts error:', error);
      throw new Error(error.message || 'Falha ao buscar produtos');
    }
  },

  getProductById: async (id: string): Promise<Product | undefined> => {
    const cachedProduct = getFromCache(`id_${id}`);
    if (cachedProduct) return cachedProduct;

    const logPrefix = `[productService.getProductById(${id.substring(0,8)})]`;
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single<ProductRow>();

      if (error) {
        console.error(`${logPrefix} Supabase error:`, error);
        if (error.code === 'PGRST116') { 
            console.warn(`${logPrefix} Product not found (PGRST116).`);
            return undefined; 
        }
        throw error;
      }
      if (!data) {
        console.warn(`${logPrefix} Product data is null but no error reported.`);
        return undefined;
      }
      // console.log(`${logPrefix} Product data fetched successfully.`);
      const product = fromSupabaseProductRow(data);
      setInCache(`id_${id}`, product);
      if (product.slug) setInCache(`slug_${product.slug}`, product);
      return product;
    } catch (error: any) {
      console.error(`${logPrefix} General exception:`, error);
      throw new Error(error.message || 'Falha ao buscar produto');
    }
  },

  getProductBySlug: async (slug: string): Promise<Product | undefined> => {
    const cachedProduct = getFromCache(`slug_${slug}`);
    if (cachedProduct) return cachedProduct;
    
    const logPrefix = `[productService.getProductBySlug(${slug})]`;
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .single<ProductRow>(); 

      if (error) {
        console.warn(`${logPrefix} Supabase error (Code: ${error.code}):`, error.message);
        if (error.code === 'PGRST116') return undefined;
        throw error;
      }
      
      if (!data) return undefined;
      
      const product = fromSupabaseProductRow(data);
      setInCache(`id_${product.id}`, product);
      setInCache(`slug_${slug}`, product);
      return product;
    } catch (error: any) {
      console.error(`${logPrefix} General exception:`, error.message);
      throw new Error(error.message || 'Falha ao buscar produto pelo slug');
    }
  },

  createProduct: async (
    productData: Omit<Product, 'id' | 'platformUserId' | 'slug' | 'totalSales' | 'clicks' | 'checkoutViews' | 'conversionRate' | 'abandonmentRate'>
  ): Promise<Product> => {
    const userId = await getSupabaseUserId();
    if (!userId) throw new Error('Usuário não autenticado para criar produto.');

    const slug = generateSlugFromName(productData.name);
    const newProductData: ProductInsert = {
        ...toSupabaseRow(productData),
        name: productData.name,
        description: productData.description,
        price_in_cents: productData.priceInCents,
        platform_user_id: userId,
        slug: slug,
    };
    delete (newProductData as any).updated_at; // Remove updated_at for insert

    const { data, error } = await supabase
      .from('products')
      .insert(newProductData)
      .select()
      .single<ProductRow>();

    if (error) {
      console.error('Supabase createProduct error:', error);
      throw new Error(error.message || 'Falha ao criar produto');
    }
    if (!data) throw new Error('Falha ao criar produto, dados não retornados.');
    
    invalidateCache(data.id, data.slug);
    return fromSupabaseProductRow(data);
  },

  updateProduct: async (
    productId: string, 
    productData: Omit<Product, 'id' | 'platformUserId' | 'slug' | 'totalSales' | 'clicks' | 'checkoutViews' | 'conversionRate' | 'abandonmentRate'>
  ): Promise<Product> => {
    const userId = await getSupabaseUserId();
    if (!userId) throw new Error('Usuário não autenticado para atualizar produto.');

    const updatedProductData = toSupabaseRow(productData);

    const { data, error } = await supabase
      .from('products')
      .update(updatedProductData)
      .eq('id', productId)
      .eq('platform_user_id', userId)
      .select()
      .single<ProductRow>();

    if (error) {
      console.error('Supabase updateProduct error:', error);
      throw new Error(error.message || 'Falha ao atualizar produto');
    }
    if (!data) throw new Error('Produto não encontrado ou permissão negada para atualização.');
    
    invalidateCache(productId, data.slug);
    return fromSupabaseProductRow(data);
  },

  cloneProduct: async (productId: string): Promise<Product | null> => {
    const productToClone = await productService.getProductById(productId);
    if (!productToClone) {
      throw new Error("Produto a ser clonado não encontrado.");
    }
    const clonedName = `${productToClone.name} (Cópia)`;
    
    const productDataForCreation: Omit<Product, 'id' | 'platformUserId' | 'slug' | 'totalSales' | 'clicks' | 'checkoutViews' | 'conversionRate' | 'abandonmentRate'> = {
        name: clonedName,
        description: productToClone.description,
        priceInCents: productToClone.priceInCents,
        imageUrl: productToClone.imageUrl,
        productImageUrl: productToClone.productImageUrl,
        checkoutCustomization: productToClone.checkoutCustomization,
        deliveryUrl: productToClone.deliveryUrl,
        orderBumps: productToClone.orderBumps,
        postClickOffer: productToClone.postClickOffer,
        upsell: productToClone.upsell,
        coupons: productToClone.coupons,
        utmParams: productToClone.utmParams,
        postPurchaseEmailConfig: productToClone.postPurchaseEmailConfig,
    };
    
    invalidateCache(productToClone.id, productToClone.slug);
    return productService.createProduct(productDataForCreation);
  },

  deleteProduct: async (productId: string): Promise<{ success: boolean }> => {
    const userId = await getSupabaseUserId();
    if (!userId) {
      throw new Error('Usuário não autenticado para deletar produto.');
    }
    const { error, count } = await supabase
        .from('products')
        .delete({ count: 'exact' })
        .eq('id', productId)
        .eq('platform_user_id', userId);

    if (error) throw new Error(error.message || 'Falha ao deletar produto.');
    if (count === 0) throw new Error('Produto não encontrado ou permissão negada.');

    invalidateCache(productId);
    return { success: true };
  }
};
