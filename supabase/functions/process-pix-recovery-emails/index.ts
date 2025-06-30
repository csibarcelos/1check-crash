
// supabase/functions/process-pix-recovery-emails/index.ts
// @ts-ignore
import { serve } from "std_http_server";
// @ts-ignore
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';
import { Database, Json } from '../_shared/db_types.ts';

declare const Deno: any;

interface PixRecoveryEmail {
  enabled: boolean;
  delayMinutes: 15 | 30 | 60;
  subject: string;
  bodyHtml: string;
}

interface PixRecoveryConfig {
  email1: PixRecoveryEmail;
  email2: PixRecoveryEmail;
  email3: PixRecoveryEmail;
}

type SaleDbRow = Database['public']['Tables']['sales']['Row'];
type AppSettingsDbRow = Database['public']['Tables']['app_settings']['Row'];

const parseJsonField = <T>(field: Json | null | undefined, defaultValue: T): T => {
  if (field === null || field === undefined) return defaultValue;
  if (typeof field === 'object' && field !== null) return field as T;
  if (typeof field === 'string') {
    try { return JSON.parse(field) as T; }
    catch (e) { return defaultValue; }
  }
  return defaultValue;
};

const defaultPixRecoveryConfig: PixRecoveryConfig = {
  email1: { enabled: false, delayMinutes: 15, subject: '', bodyHtml: '' },
  email2: { enabled: false, delayMinutes: 30, subject: '', bodyHtml: '' },
  email3: { enabled: false, delayMinutes: 60, subject: '', bodyHtml: '' },
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const functionSecret = Deno.env.get('FUNCTION_SECRET');
    const secretHeader = req.headers.get('X-Function-Secret');
    if (!functionSecret || secretHeader !== functionSecret) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (authError: any) {
    return new Response(JSON.stringify({ success: false, error: authError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log("[process-pix-recovery] Authorized. Starting PIX recovery process...");

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase credentials not configured.");

    const adminClient: SupabaseClient<Database> = createClient<Database>(supabaseUrl, serviceRoleKey);
    const now = new Date();

    const { data: salesToProcess, error: salesError } = await adminClient
      .from('sales')
      .select('*') 
      .eq('status', 'waiting_payment');

    if (salesError) throw new Error(`Error fetching pending sales: ${salesError.message}`);
    if (!salesToProcess || salesToProcess.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No pending PIX sales to process." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    console.log(`[process-pix-recovery] Found ${salesToProcess.length} pending sales to check.`);

    let emailsSentCount = 0;
    const settingsCache = new Map<string, AppSettingsDbRow>();

    for (const sale of salesToProcess as SaleDbRow[]) {
      const { platform_user_id, created_at, pix_recovery_emails_sent, id: saleId, customer_name, customer_email, products } = sale;
      
      let userSettings = settingsCache.get(platform_user_id);
      if (!userSettings) {
        const { data, error } = await adminClient.from('app_settings').select('*').eq('platform_user_id', platform_user_id).single();
        if (error || !data) {
          console.warn(`[process-pix-recovery] Could not fetch settings for user ${platform_user_id}. Skipping sale ${saleId}.`);
          continue;
        }
        userSettings = data as AppSettingsDbRow;
        settingsCache.set(platform_user_id, userSettings);
      }

      const recoveryConfig = parseJsonField<PixRecoveryConfig>(userSettings.pix_recovery_config, defaultPixRecoveryConfig);
      const emailsSentStatus = parseJsonField<Record<string, boolean>>(pix_recovery_emails_sent, {});

      const emailConfigs = [
        { key: 'email1', config: recoveryConfig.email1 },
        { key: 'email2', config: recoveryConfig.email2 },
        { key: 'email3', config: recoveryConfig.email3 },
      ];

      for (const { key, config } of emailConfigs) {
        if (config.enabled && !emailsSentStatus[key]) {
          const saleCreatedAt = new Date(created_at).getTime();
          const delayMs = config.delayMinutes * 60 * 1000;

          if (now.getTime() > saleCreatedAt + delayMs) {
            console.log(`[process-pix-recovery] Sending ${key} for sale ${saleId}.`);
            
            const checkoutIdentity = parseJsonField<{ brandName?: string } | null>(userSettings.checkout_identity, null);
            const shopName = checkoutIdentity?.brandName || "Nossa Loja";
            const saleProducts = products as unknown as Array<{name: string}>;
            const mainProductName = saleProducts[0]?.name || 'seu produto';

            const emailBody = config.bodyHtml
              .replace(/{{customer_name}}/g, customer_name || 'Cliente')
              .replace(/{{product_name}}/g, mainProductName)
              .replace(/{{order_id}}/g, saleId)
              .replace(/{{shop_name}}/g, shopName);
            
            const emailSubject = config.subject
              .replace(/{{product_name}}/g, mainProductName);
            
            const emailPayload = { userId: platform_user_id, to: customer_email, subject: emailSubject, htmlBody: emailBody, fromName: shopName };

            const { error: sendError } = await adminClient.functions.invoke('send-email', { body: emailPayload });
            if (sendError) {
              console.error(`[process-pix-recovery] Failed to send ${key} for sale ${saleId}:`, sendError);
            } else {
              const updatedSentStatus = { ...emailsSentStatus, [key]: true };
              await adminClient.from('sales').update({ pix_recovery_emails_sent: updatedSentStatus }).eq('id', saleId);
              emailsSentCount++;
              console.log(`[process-pix-recovery] Successfully sent and marked ${key} for sale ${saleId}.`);
            }
          }
        }
      }
    }

    const summary = `Process finished. Sent ${emailsSentCount} PIX recovery emails.`;
    console.log(`[process-pix-recovery] ${summary}`);
    return new Response(JSON.stringify({ success: true, message: summary, emailsSent: emailsSentCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error: any) {
    console.error("[process-pix-recovery] Critical error in function:", error.message, error.stack);
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
