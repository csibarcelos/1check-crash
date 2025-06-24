import { AppSettings, PlatformSettings, PixelIntegration } from '@/types'; 
import { supabase, getSupabaseUserId } from '@/supabaseClient'; 
import { Database, Json } from '@/types/supabase'; 
import { COLOR_PALETTE_OPTIONS } from '../constants.tsx'; 

type AppSettingsRow = Database['public']['Tables']['app_settings']['Row'];
type AppSettingsInsert = Database['public']['Tables']['app_settings']['Insert']; 
type PlatformSettingsRow = Database['public']['Tables']['platform_settings']['Row'];

// Cache simples para configurações da plataforma (dados globais)
let platformSettingsCache: { data: PlatformSettings | null; timestamp: number } | null = null;
const PLATFORM_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

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

const getDefaultAppSettings = (): AppSettings => ({
  checkoutIdentity: { 
    logoUrl: '', 
    faviconUrl: '', 
    brandColor: COLOR_PALETTE_OPTIONS[0].value 
  },
  customDomain: '',
  smtpSettings: { 
    host: '', 
    port: 587, 
    user: '', 
    pass: '' 
  },
  apiTokens: { 
    pushinPay: '', 
    utmify: '', 
    pushinPayEnabled: false, 
    utmifyEnabled: false 
  },
  pixelIntegrations: [],
});

const getDefaultPlatformSettings = (): PlatformSettings => ({
  id: 'global', 
  platformCommissionPercentage: 0.01,
  platformFixedFeeInCents: 100, 
  platformAccountIdPushInPay: '',
});

const fromSupabaseAppSettingsRow = (row: AppSettingsRow | null): AppSettings => {
  const defaults = getDefaultAppSettings();
  if (!row) return defaults;

  const storedCheckoutIdentity = parseJsonField(row.checkout_identity, defaults.checkoutIdentity);
  const storedSmtpSettings = parseJsonField(row.smtp_settings, defaults.smtpSettings);
  const storedApiTokens = parseJsonField(row.api_tokens, defaults.apiTokens);
  const storedPixelIntegrations = parseJsonField<PixelIntegration[]>(row.pixel_integrations, defaults.pixelIntegrations);

  return {
    customDomain: row.custom_domain ?? defaults.customDomain,
    checkoutIdentity: {
      logoUrl: storedCheckoutIdentity?.logoUrl ?? defaults.checkoutIdentity.logoUrl,
      faviconUrl: storedCheckoutIdentity?.faviconUrl ?? defaults.checkoutIdentity.faviconUrl,
      brandColor: storedCheckoutIdentity?.brandColor ?? defaults.checkoutIdentity.brandColor,
    },
    smtpSettings: {
      host: storedSmtpSettings?.host ?? defaults.smtpSettings.host,
      port: storedSmtpSettings?.port ?? defaults.smtpSettings.port,
      user: storedSmtpSettings?.user ?? defaults.smtpSettings.user,
      pass: storedSmtpSettings?.pass ?? defaults.smtpSettings.pass,
    },
    apiTokens: {
      pushinPay: storedApiTokens?.pushinPay ?? defaults.apiTokens.pushinPay,
      utmify: storedApiTokens?.utmify ?? defaults.apiTokens.utmify,
      pushinPayEnabled: storedApiTokens?.pushinPayEnabled ?? defaults.apiTokens.pushinPayEnabled,
      utmifyEnabled: storedApiTokens?.utmifyEnabled ?? defaults.apiTokens.utmifyEnabled,
    },
    pixelIntegrations: storedPixelIntegrations,
  };
};

const toSupabaseAppSettingsDbObjectForUpsert = (userId: string, settings: Partial<AppSettings>): AppSettingsInsert => {
  const dbObject: AppSettingsInsert = {
    platform_user_id: userId,
    updated_at: new Date().toISOString(),
  };
  
  // Só incluir campos que foram realmente fornecidos
  if (settings.customDomain !== undefined) {
    dbObject.custom_domain = settings.customDomain;
  }
  if (settings.checkoutIdentity !== undefined) {
    dbObject.checkout_identity = settings.checkoutIdentity as unknown as Json;
  }
  if (settings.smtpSettings !== undefined) {
    dbObject.smtp_settings = settings.smtpSettings as unknown as Json;
  }
  if (settings.apiTokens !== undefined) {
    dbObject.api_tokens = settings.apiTokens as unknown as Json;
  }
  if (settings.pixelIntegrations !== undefined) {
    dbObject.pixel_integrations = settings.pixelIntegrations as unknown as Json;
  }
  
  return dbObject;
};

const fromSupabasePlatformSettingsRow = (row: PlatformSettingsRow | null): PlatformSettings => {
  const defaults = getDefaultPlatformSettings();
  if (!row) return defaults;
  
  return {
    id: 'global',
    platformCommissionPercentage: row.platform_commission_percentage ?? defaults.platformCommissionPercentage,
    platformFixedFeeInCents: row.platform_fixed_fee_in_cents ?? defaults.platformFixedFeeInCents,
    platformAccountIdPushInPay: row.platform_account_id_push_in_pay ?? defaults.platformAccountIdPushInPay,
  };
};

export const settingsService = {
  getAppSettings: async (_token?: string | null): Promise<AppSettings> => {
    const userId = await getSupabaseUserId();
    const logPrefix = `[settingsService.getAppSettings(user: ${userId?.substring(0,8) || 'current'})]`;
    
    if (!userId) {
      console.warn(`${logPrefix} User not authenticated. Returning default settings.`);
      return getDefaultAppSettings();
    }

    try {
      const { data, error, status } = await supabase
        .from('app_settings')
        .select('*')
        .eq('platform_user_id', userId)
        .maybeSingle(); // Use maybeSingle() em vez de single() para evitar erro quando não há dados
      
      if (error) {
        console.error(`${logPrefix} Supabase error (Status: ${status}, Code: ${error.code}):`, error.message, error.details, error.hint);
        throw new Error(error.message || 'Falha ao buscar configurações do usuário');
      }
      
      if (!data) {
        console.info(`${logPrefix} No settings found for user. Returning default settings.`);
        return getDefaultAppSettings();
      }
      
      console.log(`${logPrefix} Settings fetched successfully.`);
      return fromSupabaseAppSettingsRow(data as AppSettingsRow);
    } catch (error: any) {
      console.error(`${logPrefix} General exception:`, error);
      throw new Error(error.message || 'Falha geral ao buscar configurações do usuário');
    }
  },

  getAppSettingsByUserId: async (targetUserId: string, _token?: string | null, options?: { useServiceRole?: boolean }): Promise<AppSettings> => {
    const logPrefix = `[settingsService.getAppSettingsByUserId(targetUser: ${targetUserId.substring(0,8)})]`;
    const currentAuthUserId = await getSupabaseUserId();
    
    console.log(`${logPrefix} Attempting to fetch. Current auth user ID: ${currentAuthUserId?.substring(0,8) || 'Anonymous'}`);

    try {
      // Se useServiceRole for true, usar o cliente com service role para bypass do RLS
      const client = options?.useServiceRole ? supabase : supabase;
      
      const { data, error, status } = await client
        .from('app_settings')
        .select('*')
        .eq('platform_user_id', targetUserId)
        .maybeSingle(); // Use maybeSingle() para não dar erro quando não há dados

      if (error) {
        console.error(`${logPrefix} Supabase error (Status: ${status}, Code: ${error.code}):`, error.message, error.details, error.hint);
        
        // Se for erro de RLS, sugerir usar service role
        if (error.code === '42501' || error.message.includes('permission denied')) {
          console.warn(`${logPrefix} RLS permission denied. Consider using service role for admin operations.`);
        }
        
        throw new Error(error.message || `Falha ao buscar configurações para o usuário ${targetUserId}`);
      }

      if (!data) {
        console.info(`${logPrefix} No settings found for target user ${targetUserId} (Status: ${status}). Creating default settings entry.`);
        
        // Tentar criar configurações padrão para o usuário se não existirem
        try {
          const defaultSettings = getDefaultAppSettings();
          const newSettings = await settingsService.saveAppSettingsForUser(targetUserId, defaultSettings, _token, options);
          console.log(`${logPrefix} Created default settings for user.`);
          return newSettings;
        } catch (createError) {
          console.warn(`${logPrefix} Failed to create default settings. Returning defaults:`, createError);
          return getDefaultAppSettings();
        }
      }
      
      console.log(`${logPrefix} Settings fetched successfully for target user.`);
      return fromSupabaseAppSettingsRow(data as AppSettingsRow);
    } catch (error: any) {
      console.error(`${logPrefix} General exception:`, error);
      throw new Error(error.message || `Falha geral ao buscar configurações para o usuário ${targetUserId}`);
    }
  },

  saveAppSettings: async (settings: Partial<AppSettings>, _token?: string | null): Promise<AppSettings> => {
    const userId = await getSupabaseUserId();
    if (!userId) {
      throw new Error('Usuário não autenticado para salvar configurações.');
    }
    
    return settingsService.saveAppSettingsForUser(userId, settings, _token);
  },

  // Nova função para salvar configurações de um usuário específico (útil para admin)
  saveAppSettingsForUser: async (
    targetUserId: string, 
    settings: Partial<AppSettings>, 
    _token?: string | null,
    options?: { useServiceRole?: boolean }
  ): Promise<AppSettings> => {
    const logPrefix = `[settingsService.saveAppSettingsForUser(targetUser: ${targetUserId.substring(0,8)})]`;
    const dbObject = toSupabaseAppSettingsDbObjectForUpsert(targetUserId, settings);

    try {
      const client = options?.useServiceRole ? supabase : supabase;
      
      const { data, error } = await client
        .from('app_settings')
        .upsert(dbObject, { onConflict: 'platform_user_id' })
        .select()
        .single();
        
      if (error) {
        console.error(`${logPrefix} Supabase error:`, error.message, `Details: ${error.details}`, `Hint: ${error.hint}`, `Code: ${error.code}`);
        throw new Error(error.message || 'Falha ao salvar configurações do usuário');
      }
      
      if (!data) {
        throw new Error('Falha ao salvar configurações, dados não retornados.');
      }
      
      console.log(`${logPrefix} Settings saved successfully.`);
      return fromSupabaseAppSettingsRow(data as AppSettingsRow);
    } catch (error: any) {
      console.error(`${logPrefix} Exception:`, error);
      throw new Error(error.message || 'Falha geral ao salvar configurações do usuário');
    }
  },

  getPlatformSettings: async (_token?: string | null, useCache: boolean = true): Promise<PlatformSettings> => {
    const logPrefix = '[settingsService.getPlatformSettings]';
    
    // Verificar cache
    if (useCache && platformSettingsCache) {
      const now = Date.now();
      if (now - platformSettingsCache.timestamp < PLATFORM_CACHE_TTL && platformSettingsCache.data) {
        console.log(`${logPrefix} Returning cached platform settings.`);
        return platformSettingsCache.data;
      }
    }

    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('id', 'global')
        .maybeSingle();
      
      if (error) {
        console.error(`${logPrefix} Supabase error:`, error.message, `Details: ${error.details}`, `Hint: ${error.hint}`, `Code: ${error.code}`);
        throw new Error(error.message || 'Falha ao buscar configurações da plataforma');
      }
      
      const settings = fromSupabasePlatformSettingsRow(data as PlatformSettingsRow | null);
      
      // Atualizar cache
      if (useCache) {
        platformSettingsCache = {
          data: settings,
          timestamp: Date.now()
        };
      }
      
      console.log(`${logPrefix} Platform settings fetched successfully.`);
      return settings;
    } catch (error: any) {
      console.error(`${logPrefix} Exception:`, error);
      throw new Error(error.message || 'Falha geral ao buscar configurações da plataforma');
    }
  },

  savePlatformSettings: async (settings: Partial<PlatformSettings>, _token?: string | null): Promise<PlatformSettings> => {
    const logPrefix = '[settingsService.savePlatformSettings]';
    const dataForUpsert: Database['public']['Tables']['platform_settings']['Insert'] = { 
      id: 'global',
      platform_commission_percentage: settings.platformCommissionPercentage,
      platform_fixed_fee_in_cents: settings.platformFixedFeeInCents,       
      platform_account_id_push_in_pay: settings.platformAccountIdPushInPay, 
      updated_at: new Date().toISOString(),
    };
    
    try {
      const { data, error } = await supabase 
        .from('platform_settings')
        .upsert(dataForUpsert, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.error(`${logPrefix} Supabase error:`, error.message, `Details: ${error.details}`, `Hint: ${error.hint}`, `Code: ${error.code}`);
        throw new Error(error.message || 'Falha ao salvar configurações da plataforma');
      }
      
      if (!data) {
        throw new Error('Falha ao salvar configurações da plataforma, dados não retornados.');
      }
      
      // Limpar cache após salvar
      platformSettingsCache = null;
      
      console.log(`${logPrefix} Platform settings saved successfully.`);
      return fromSupabasePlatformSettingsRow(data as PlatformSettingsRow);
    } catch (error: any) {
      console.error(`${logPrefix} Exception:`, error);
      throw new Error(error.message || 'Falha geral ao salvar configurações da plataforma');
    }
  },

  // Função para limpar cache (útil para testes ou refresh manual)
  clearCache: () => {
    platformSettingsCache = null;
    console.log('[settingsService.clearCache] Cache cleared.');
  },

  // Função para verificar se um usuário tem configurações
  hasUserSettings: async (targetUserId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('platform_user_id')
        .eq('platform_user_id', targetUserId)
        .maybeSingle();
      
      if (error) {
        console.warn(`[settingsService.hasUserSettings] Error checking user settings:`, error);
        return false;
      }
      
      return !!data;
    } catch (error) {
      console.warn(`[settingsService.hasUserSettings] Exception:`, error);
      return false;
    }
  },
};