
import { AppSettings, PlatformSettings, PixelIntegration, AbandonedCartEmailConfig, NotificationSettings, PixGeneratedEmailConfig, PixRecoveryConfig } from '@/types'; 
import { supabase, getSupabaseUserId } from '@/supabaseClient'; 
import { Database, Json } from '@/types/supabase'; 
import { COLOR_PALETTE_OPTIONS } from '../constants.tsx'; 
import { defaultWhatsappTemplates } from './productService'; 

// --- START: CACHE MANAGEMENT ---
const appSettingsCache = new Map<string, { settings: AppSettings, timestamp: number }>();
const platformSettingsCache = new Map<string, { settings: PlatformSettings, timestamp: number }>();
const CACHE_TTL = 2 * 1000; // Cache de 2 segundos

const getAppSettingsFromCache = (userId: string): AppSettings | null => {
  const cached = appSettingsCache.get(userId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.settings;
  }
  appSettingsCache.delete(userId);
  return null;
};

const setAppSettingsInCache = (userId: string, settings: AppSettings) => {
  appSettingsCache.set(userId, { settings, timestamp: Date.now() });
};



const getPlatformSettingsFromCache = (): PlatformSettings | null => {
  const cached = platformSettingsCache.get('global');
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.settings;
  }
  platformSettingsCache.delete('global');
  return null;
};

const setPlatformSettingsInCache = (settings: PlatformSettings) => {
  platformSettingsCache.set('global', { settings, timestamp: Date.now() });
};


// --- END: CACHE MANAGEMENT ---

type AppSettingsRow = Database['public']['Tables']['app_settings']['Row'];
type AppSettingsInsert = Database['public']['Tables']['app_settings']['Insert']; 

type PlatformSettingsRow = Database['public']['Tables']['platform_settings']['Row'];

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
  console.warn('Unexpected type for JSON field, returning default:', typeof field, field);
  return defaultValue;
};

const defaultAbandonedCartRecoveryConfig: AbandonedCartEmailConfig = {
  enabled: false,
  delayMinutes: 360, // 6 hours
  subject: 'Você esqueceu algo no seu carrinho!',
  bodyHtml: '<p>Olá {{customer_name}},</p><p>Notamos que você deixou alguns itens no seu carrinho. Que tal finalizar sua compra?</p><p><a href="{{abandoned_checkout_link}}">Clique aqui para voltar ao checkout</a></p><p>Produto: {{product_name}}</p>',
};

const defaultPixGeneratedEmailConfig: PixGeneratedEmailConfig = {
  enabled: false,
  subject: 'Seu código PIX para o pedido {{order_id}}',
  bodyHtml: '<p>Olá {{customer_name}},</p><p>Seu código PIX para comprar {{product_name}} foi gerado! Escaneie a imagem ou copie o código abaixo para pagar.</p><p>Código: {{pix_copy_paste_code}}</p><img src="{{pix_qr_code_image_url}}" alt="PIX QR Code"/>',
};

const defaultPixRecoveryConfig: PixRecoveryConfig = {
  email1: { enabled: false, delayMinutes: 15, subject: 'Não se esqueça do seu PIX!', bodyHtml: '<p>Ainda dá tempo de finalizar sua compra de {{product_name}}!</p>' },
  email2: { enabled: false, delayMinutes: 30, subject: 'Sua oferta está expirando...', bodyHtml: '<p>Seu PIX para {{product_name}} está quase expirando. Não perca!</p>' },
  email3: { enabled: false, delayMinutes: 60, subject: 'Última chance para garantir seu produto!', bodyHtml: '<p>Esta é sua última oportunidade de pagar o PIX para {{product_name}}.</p>' },
};

const defaultNotificationSettings: NotificationSettings = {
  notifyOnAbandonedCart: true,
  notifyOnOrderPlaced: true,
  notifyOnSaleApproved: true,
  playSaleSound: true,
};

const fromSupabaseAppSettingsRow = (row: AppSettingsRow | null): AppSettings => {
  const defaults: AppSettings = {
    checkoutIdentity: { logoUrl: '', faviconUrl: '', brandColor: COLOR_PALETTE_OPTIONS[0].value },
    customDomain: '',
    smtpSettings: { host: '', port: 587, user: '', pass: '' },
    apiTokens: { pushinPay: '', utmify: '', pushinPayEnabled: false, utmifyEnabled: false },
    pixelIntegrations: [],
    abandonedCartRecoveryConfig: defaultAbandonedCartRecoveryConfig,
    pixGeneratedEmailConfig: defaultPixGeneratedEmailConfig,
    pixRecoveryConfig: defaultPixRecoveryConfig,
    notificationSettings: defaultNotificationSettings,
    whatsappTemplates: defaultWhatsappTemplates,
  };

  if (!row) return defaults;

  const storedWhatsappTemplates = parseJsonField(row.whatsapp_templates, defaults.whatsappTemplates);

  const storedCheckoutIdentity = parseJsonField(row.checkout_identity, defaults.checkoutIdentity);
  const storedSmtpSettings = parseJsonField(row.smtp_settings, defaults.smtpSettings);
  const storedApiTokens = parseJsonField(row.api_tokens, defaults.apiTokens);
  const storedPixelIntegrations = parseJsonField<PixelIntegration[]>(row.pixel_integrations, defaults.pixelIntegrations || []);
  const storedAbandonedCartConfig = parseJsonField(row.abandoned_cart_recovery_config, defaults.abandonedCartRecoveryConfig);
  const storedPixGeneratedConfig = parseJsonField(row.pix_generated_email_config, defaults.pixGeneratedEmailConfig);
  const storedPixRecoveryConfig = parseJsonField(row.pix_recovery_config, defaults.pixRecoveryConfig);
  const storedNotificationSettings = parseJsonField(row.notification_settings, defaults.notificationSettings);

  return {
    customDomain: row.custom_domain ?? defaults.customDomain,
    checkoutIdentity: {
      logoUrl: storedCheckoutIdentity?.logoUrl ?? defaults.checkoutIdentity.logoUrl,
      faviconUrl: storedCheckoutIdentity?.faviconUrl ?? defaults.checkoutIdentity.faviconUrl,
      brandColor: storedCheckoutIdentity?.brandColor ?? defaults.checkoutIdentity.brandColor,
    },
    smtpSettings: {
      host: storedSmtpSettings?.host ?? defaults.smtpSettings?.host ?? '',
      port: storedSmtpSettings?.port ?? defaults.smtpSettings?.port ?? 587,
      user: storedSmtpSettings?.user ?? defaults.smtpSettings?.user ?? '',
      pass: storedSmtpSettings?.pass ?? defaults.smtpSettings?.pass ?? '',
    },
    apiTokens: {
        pushinPay: storedApiTokens?.pushinPay ?? defaults.apiTokens.pushinPay,
        utmify: storedApiTokens?.utmify ?? defaults.apiTokens.utmify,
        pushinPayEnabled: storedApiTokens?.pushinPayEnabled ?? defaults.apiTokens.pushinPayEnabled,
        utmifyEnabled: storedApiTokens?.utmifyEnabled ?? defaults.apiTokens.utmifyEnabled,
        pushinPayWebhookToken: storedApiTokens?.pushinPayWebhookToken ?? defaults.apiTokens.pushinPayWebhookToken, // Adicionado
    },
    pixelIntegrations: storedPixelIntegrations ?? [],
    abandonedCartRecoveryConfig: {
      ...defaultAbandonedCartRecoveryConfig,
      ...(storedAbandonedCartConfig || {}),
    },
    pixGeneratedEmailConfig: {
        ...defaultPixGeneratedEmailConfig,
        ...(storedPixGeneratedConfig || {}),
    },
    pixRecoveryConfig: {
        ...defaultPixRecoveryConfig,
        email1: { ...defaultPixRecoveryConfig.email1, ...(storedPixRecoveryConfig?.email1 || {}) },
        email2: { ...defaultPixRecoveryConfig.email2, ...(storedPixRecoveryConfig?.email2 || {}) },
        email3: { ...defaultPixRecoveryConfig.email3, ...(storedPixRecoveryConfig?.email3 || {}) },
    },
    notificationSettings: {
      ...defaultNotificationSettings,
      ...(storedNotificationSettings || {}),
    },
    whatsappTemplates: storedWhatsappTemplates,
  };
};

const toSupabaseAppSettingsDbObjectForUpsert = (userId: string, settings: Partial<AppSettings>): AppSettingsInsert => {
  const dbObject: AppSettingsInsert = {
    platform_user_id: userId,
    updated_at: new Date().toISOString(),
    custom_domain: settings.customDomain !== undefined ? settings.customDomain : null,
    checkout_identity: settings.checkoutIdentity !== undefined ? settings.checkoutIdentity as unknown as Json : null,
    smtp_settings: settings.smtpSettings !== undefined ? settings.smtpSettings as unknown as Json : null,
    api_tokens: settings.apiTokens !== undefined ? settings.apiTokens as unknown as Json : null,
    pixel_integrations: settings.pixelIntegrations !== undefined ? settings.pixelIntegrations as unknown as Json : null,
    abandoned_cart_recovery_config: settings.abandonedCartRecoveryConfig !== undefined ? settings.abandonedCartRecoveryConfig as unknown as Json : null,
    pix_generated_email_config: settings.pixGeneratedEmailConfig !== undefined ? settings.pixGeneratedEmailConfig as unknown as Json : null,
    pix_recovery_config: settings.pixRecoveryConfig !== undefined ? settings.pixRecoveryConfig as unknown as Json : null,
    notification_settings: settings.notificationSettings !== undefined ? settings.notificationSettings as unknown as Json : null,
  };
  
  return dbObject;
};

const fromSupabasePlatformSettingsRow = (row: PlatformSettingsRow | null): PlatformSettings => {
    const defaults: PlatformSettings = {
        id: 'global', platformCommissionPercentage: 0.01,
        platformFixedFeeInCents: 100, platformAccountIdPushInPay: '',
    };
    if (!row) return defaults;
    return {
        id: 'global',
        platformCommissionPercentage: row.platform_commission_percentage ?? defaults.platformCommissionPercentage,
        platformFixedFeeInCents: row.platform_fixed_fee_in_cents ?? defaults.platformFixedFeeInCents,
        platformAccountIdPushInPay: row.platform_account_id_push_in_pay ?? defaults.platformAccountIdPushInPay,
    };
};

export const settingsService = {
  getAppSettings: async (): Promise<AppSettings> => {
    const userId = await getSupabaseUserId();
    const logPrefix = `[settingsService.getAppSettings(user: ${userId?.substring(0,8) || 'current'})]`;
    if (!userId) {
        console.warn(`${logPrefix} User not authenticated. Returning default settings.`);
        return fromSupabaseAppSettingsRow(null);
    }

    const cached = getAppSettingsFromCache(userId);
    if (cached) return cached;

    try {
      const { data, error, status } = await supabase.from('app_settings').select('*').eq('platform_user_id', userId).single(); 
      if (error && error.code !== 'PGRST116') { 
        console.error(`${logPrefix} Supabase error (Status: ${status}, Code: ${error.code}):`, error.message, error.details, error.hint); 
        throw new Error(error.message || 'Falha ao buscar configurações do usuário');
      }
      if (!data && error?.code === 'PGRST116') {
        console.warn(`${logPrefix} No settings found for user (PGRST116). Returning default settings.`);
        const defaultSettings = fromSupabaseAppSettingsRow(null);
        setAppSettingsInCache(userId, defaultSettings);
        return defaultSettings;
      }
      if (!data && !error) {
        console.warn(`${logPrefix} Settings data is null/undefined but no Supabase error reported (Status: ${status}). Returning default settings.`);
        const defaultSettings = fromSupabaseAppSettingsRow(null);
        setAppSettingsInCache(userId, defaultSettings);
        return defaultSettings;
      }
      console.log(`${logPrefix} Settings fetched successfully.`);
      const settings = fromSupabaseAppSettingsRow(data as AppSettingsRow | null);
      setAppSettingsInCache(userId, settings);
      return settings;
    } catch (error: any) { 
      console.error(`${logPrefix} General exception:`, error); 
      throw new Error(error.message || 'Falha geral ao buscar configurações do usuário'); 
    }
  },

  getAppSettingsByUserId: async (targetUserId: string): Promise<AppSettings> => {
    const logPrefix = `[settingsService.getAppSettingsByUserId(targetUser: ${targetUserId.substring(0,8)})]`;
    const currentAuthUserId = await getSupabaseUserId(); 
    console.log(`${logPrefix} Attempting to fetch. Current auth user ID (for context): ${currentAuthUserId || 'Anonymous'}`);

    try {
      const { data, error, status } = await supabase 
        .from('app_settings')
        .select('*')
        .eq('platform_user_id', targetUserId)
        .limit(1); 

      if (error) {
        console.error(`${logPrefix} Supabase error (Status: ${status}, Code: ${error.code}):`, error.message, error.details, error.hint);
        throw new Error(error.message || `Falha ao buscar configurações para o usuário ${targetUserId}`);
      }
      const rowData = data && data.length > 0 ? data[0] : null;
      if (!rowData) {
        console.warn(`${logPrefix} No settings found for target user ${targetUserId} (Status: ${status}). This might be due to RLS or no settings existing. Returning default settings.`);
        return fromSupabaseAppSettingsRow(null);
      }
      console.log(`${logPrefix} Settings fetched successfully for target user.`);
      return fromSupabaseAppSettingsRow(rowData as AppSettingsRow | null);
    } catch (error: any) {
      console.error(`${logPrefix} General exception:`, error);
      throw new Error(error.message || `Falha geral ao buscar configurações para o usuário ${targetUserId}`);
    }
  },

  saveAppSettings: async (settings: Partial<AppSettings>): Promise<AppSettings> => {
    const userId = await getSupabaseUserId();
    if (!userId) throw new Error('Usuário não autenticado para salvar configurações.');

    try {
      // 1. Buscar as configurações atuais diretamente do Supabase para evitar recursão.
      const { data: existingData, error: fetchError } = await supabase
        .from('app_settings')
        .select('*')
        .eq('platform_user_id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Falha ao buscar configurações existentes: ${fetchError.message}`);
      }

      const existingSettings = fromSupabaseAppSettingsRow(existingData as AppSettingsRow | null);

      // 2. Mesclar as configurações existentes com as novas (as novas têm precedência)
      const mergedSettings: AppSettings = {
        ...existingSettings,
        ...settings,
        checkoutIdentity: Object.assign({}, existingSettings.checkoutIdentity, settings.checkoutIdentity),
        smtpSettings: Object.assign({}, existingSettings.smtpSettings, settings.smtpSettings),
        apiTokens: Object.assign({}, existingSettings.apiTokens, settings.apiTokens),
        abandonedCartRecoveryConfig: Object.assign({}, existingSettings.abandonedCartRecoveryConfig, settings.abandonedCartRecoveryConfig),
        pixGeneratedEmailConfig: Object.assign({}, existingSettings.pixGeneratedEmailConfig, settings.pixGeneratedEmailConfig),
        pixRecoveryConfig: Object.assign({}, existingSettings.pixRecoveryConfig, settings.pixRecoveryConfig),
        notificationSettings: Object.assign({}, existingSettings.notificationSettings, settings.notificationSettings),
        pixelIntegrations: settings.pixelIntegrations !== undefined ? settings.pixelIntegrations : existingSettings.pixelIntegrations,
      };
      
      const dbObject = toSupabaseAppSettingsDbObjectForUpsert(userId, mergedSettings);

      // 3. Salvar o objeto mesclado
      const { data, error } = await supabase 
        .from('app_settings')
        .upsert(dbObject, { onConflict: 'platform_user_id' }) 
        .select()
        .single();
        
      if (error) { 
        console.error('Supabase saveAppSettings error:', error.message, `Details: ${error.details}`, `Hint: ${error.hint}`, `Code: ${error.code}`); 
        throw new Error(error.message || 'Falha ao salvar configurações do usuário'); 
      }
      if (!data) throw new Error('Falha ao salvar configurações, dados não retornados.');
      
      const savedSettings = fromSupabaseAppSettingsRow(data as AppSettingsRow);
      setAppSettingsInCache(userId, savedSettings);
      return savedSettings;

    } catch (error: any) { 
      console.error('Exception in saveAppSettings:', error); 
      throw new Error(error.message || 'Falha geral ao salvar configurações do usuário'); 
    }
  },

  getPlatformSettings: async (): Promise<PlatformSettings> => {
    const cached = getPlatformSettingsFromCache();
    if (cached) return cached;

    try {
      const { data, error } = await supabase.from('platform_settings').select('*').eq('id', 'global').single(); 
      if (error && error.code !== 'PGRST116') { 
        console.error('Supabase getPlatformSettings error:', error.message, `Details: ${error.details}`, `Hint: ${error.hint}`, `Code: ${error.code}`); 
        throw new Error(error.message || 'Falha ao buscar configurações da plataforma'); 
      }
      const settings = fromSupabasePlatformSettingsRow(data as PlatformSettingsRow | null);
      setPlatformSettingsInCache(settings);
      return settings;
    } catch (error: any) { 
      console.error('Exception in getPlatformSettings:', error); 
      throw new Error(error.message || 'Falha geral ao buscar configurações da plataforma'); 
    }
  },

  savePlatformSettings: async (settings: Partial<PlatformSettings>): Promise<PlatformSettings> => {
    const dataForUpsert: Database['public']['Tables']['platform_settings']['Insert'] = { 
        id: 'global',
        platform_commission_percentage: settings.platformCommissionPercentage ?? 0,
        platform_fixed_fee_in_cents: settings.platformFixedFeeInCents ?? 0,       
        platform_account_id_push_in_pay: settings.platformAccountIdPushInPay ?? "", 
        updated_at: new Date().toISOString(),
    };
    
    try {
      const { data, error } = await supabase 
        .from('platform_settings')
        .upsert(dataForUpsert, { onConflict: 'id' }) 
        .select()
        .single();

      if (error) { 
        console.error('Supabase savePlatformSettings error:', error.message, `Details: ${error.details}`, `Hint: ${error.hint}`, `Code: ${error.code}`); 
        if (error.details) console.error('Supabase error details:', error.details);
        if (error.hint) console.error('Supabase error hint:', error.hint);
        throw new Error(error.message || 'Falha ao salvar configurações da plataforma');
      }
      if (!data) throw new Error('Falha ao salvar configurações da plataforma, dados não retornados.');
      const savedSettings = fromSupabasePlatformSettingsRow(data as PlatformSettingsRow);
      setPlatformSettingsInCache(savedSettings);
      return savedSettings;
    } catch (error: any) { 
      console.error('Exception in savePlatformSettings:', error); 
      throw new Error(error.message || 'Falha geral ao salvar configurações da plataforma');
    }
  },
};
