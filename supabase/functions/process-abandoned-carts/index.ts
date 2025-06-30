
// supabase/functions/process-abandoned-carts/index.ts
// @ts-ignore
import { serve } from "std_http_server";
// @ts-ignore
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';
import { Database, Json } from '../_shared/db_types.ts';

declare const Deno: any;

// Use types directly from Database definition
type AppSettingsDbRow = Database['public']['Tables']['app_settings']['Row'];
type AbandonedCartDbRow = Database['public']['Tables']['abandoned_carts']['Row'];

interface AbandonedCartEmailConfig {
  enabled: boolean;
  delayMinutes: number; // Changed from delayHours
  subject: string;
  bodyHtml: string;
}

const parseJsonField = <T>(field: Json | null | undefined, defaultValue: T): T => {
  if (field === null || field === undefined) return defaultValue;
  if (typeof field === 'object' && field !== null) return field as T;
  if (typeof field === 'string') {
    try {
      return JSON.parse(field) as T;
    } catch (e) {
      console.warn(`[process-abandoned-carts] Failed to parse JSON field: ${field}`, e);
      return defaultValue;
    }
  }
  return defaultValue;
};

const defaultAbandonedCartConfig: AbandonedCartEmailConfig = {
  enabled: false,
  delayMinutes: 360, // Default delay 6 hours
  subject: 'Você esqueceu algo!',
  bodyHtml: '<p>Olá {{customer_name}}, parece que você deixou {{product_name}} no seu carrinho. <a href="{{abandoned_checkout_link}}">Finalize sua compra!</a></p>',
};

// Type for carts fetched with product slug
type CartWithProductSlug = AbandonedCartDbRow & {
  products: {
    slug: string;
  } | null;
};

serve(async (req: Request) => {
  // Log da requisição para debug
  console.log(`[process-abandoned-carts] Received ${req.method} request from ${req.headers.get('user-agent') || 'unknown'}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Handle GET requests for testing/health check
  if (req.method === 'GET') {
    console.log("[process-abandoned-carts] GET request received - returning function info");
    return new Response(JSON.stringify({
      success: true,
      message: "Process abandoned carts function is active. Use POST to trigger processing.",
      endpoint: "process-abandoned-carts",
      expectedMethod: "POST",
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }

  // --- Bloco de Autorização CORRIGIDO ---
  try {
      const functionSecret = Deno.env.get('FUNCTION_SECRET');
      if (!functionSecret) {
        throw new Error("A variável de ambiente FUNCTION_SECRET não está configurada.");
      }
      
      // Usamos um header customizado para não conflitar com a validação de JWT do Supabase
      const secretHeader = req.headers.get('X-Function-Secret');
      
      // Comparamos o valor do header diretamente com o nosso segredo
      if (secretHeader !== functionSecret) {
        console.warn("[process-abandoned-carts] Tentativa de acesso não autorizado ou chave inválida.");
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
  } catch(authError: any) {
      console.error("[process-abandoned-carts] Erro de autorização:", authError.message);
      return new Response(JSON.stringify({ success: false, error: authError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
  }
  // --- Fim do Bloco de Autorização ---

  // Handle all methods including POST
  console.log("[process-abandoned-carts] Autorizado. Iniciando processamento de carrinhos abandonados...");

  try {
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const functionUrl = Deno.env.get('SUPABASE_FUNCTION_URL');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.");
    }

    if (!functionUrl) {
      console.warn("[process-abandoned-carts] SUPABASE_FUNCTION_URL não configurado, usando URL padrão");
    }

    const rootDomain = functionUrl ? new URL(functionUrl).origin : `https://${supabaseUrl.split('//')[1]}`;
    console.log(`[process-abandoned-carts] Using root domain: ${rootDomain}`);

    const adminClient: SupabaseClient<Database> = createClient<Database>(supabaseUrl, serviceRoleKey);

    // 1. Buscar todos os usuários que têm a recuperação habilitada
    console.log("[process-abandoned-carts] Buscando configurações de usuários...");
    const { data: usersWithSettings, error: usersSettingsError } = await adminClient
      .from('app_settings')
      .select('platform_user_id, abandoned_cart_recovery_config, checkout_identity');

    if (usersSettingsError) {
      console.error("[process-abandoned-carts] Erro ao buscar app_settings:", usersSettingsError);
      throw new Error(`Erro ao buscar app_settings: ${usersSettingsError.message}`);
    }

    if (!usersWithSettings || usersWithSettings.length === 0) {
      console.log("[process-abandoned-carts] Nenhum usuário com app_settings encontrado. Finalizando.");
      return new Response(JSON.stringify({
        success: true,
        message: "Nenhuma configuração de usuário para processar.",
        emailsSent: 0,
        cartsProcessed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log(`[process-abandoned-carts] Encontradas ${usersWithSettings.length} configurações de usuário`);

    let emailsSentCount = 0;
    let cartsProcessedCount = 0;
    let errorCount = 0;

    for (const userSetting of usersWithSettings as AppSettingsDbRow[]) {
      const platformUserId = userSetting.platform_user_id;

      try {
        const config = parseJsonField<AbandonedCartEmailConfig>(
          userSetting.abandoned_cart_recovery_config,
          defaultAbandonedCartConfig
        );

        const checkoutIdentity = parseJsonField<{ brandName?: string } | null>(
          userSetting.checkout_identity,
          null
        );

        const shopName = checkoutIdentity?.brandName || "Nossa Loja";

        if (!config.enabled) {
          console.log(`[process-abandoned-carts] Recuperação desabilitada para usuário ${platformUserId}. Pulando.`);
          continue;
        }

        console.log(`[process-abandoned-carts] Processando para usuário ${platformUserId} com delay de ${config.delayMinutes}min.`);

        // 2. Buscar carrinhos abandonados elegíveis para este usuário
        const delayInMilliseconds = config.delayMinutes * 60 * 1000;
        const cutoffTime = new Date(Date.now() - delayInMilliseconds).toISOString();

        const { data: abandonedCartsResult, error: cartsError } = await adminClient
          .from('abandoned_carts')
          .select('*, products(slug)')
          .eq('platform_user_id', platformUserId)
          .eq('status', 'not_contacted')
          .is('recovery_email_sent_at', null)
          .lt('last_interaction_at', cutoffTime);

        if (cartsError) {
          console.error(`[process-abandoned-carts] Erro ao buscar carrinhos para ${platformUserId}:`, cartsError);
          errorCount++;
          continue;
        }

        const abandonedCarts = abandonedCartsResult as CartWithProductSlug[] | null;

        if (!abandonedCarts || abandonedCarts.length === 0) {
          console.log(`[process-abandoned-carts] Nenhum carrinho elegível para ${platformUserId}.`);
          continue;
        }

        console.log(`[process-abandoned-carts] Encontrados ${abandonedCarts.length} carrinhos para processar do usuário ${platformUserId}`);
        cartsProcessedCount += abandonedCarts.length;

        for (const cart of abandonedCarts) {
          try {
            console.log(`[process-abandoned-carts] Processando carrinho ID ${cart.id} para ${cart.customer_email}...`);

            const productSlug = cart.products?.slug;
            if (!productSlug) {
              console.warn(`[process-abandoned-carts] Slug do produto não encontrado para carrinho ${cart.id}. Pulando.`);
              continue;
            }

            const checkoutLink = `${rootDomain}/checkout/${productSlug}?csid=${cart.id}`;

            const emailBody = config.bodyHtml
              .replace(/{{customer_name}}/g, cart.customer_name || 'Cliente')
              .replace(/{{product_name}}/g, cart.product_name || 'o produto de seu interesse')
              .replace(/{{abandoned_checkout_link}}/g, checkoutLink)
              .replace(/{{shop_name}}/g, shopName);

            const emailPayload = {
              userId: platformUserId,
              to: cart.customer_email,
              subject: config.subject.replace(/{{product_name}}/g, cart.product_name || ''),
              htmlBody: emailBody,
              fromName: shopName,
            };

            console.log(`[process-abandoned-carts] Tentando enviar e-mail para ${cart.customer_email} para carrinho ${cart.id}.`);

            const { data: sendEmailResponse, error: sendEmailError } = await adminClient.functions.invoke('send-email', {
              body: emailPayload
            });

            if (sendEmailError || (sendEmailResponse && !sendEmailResponse.success)) {
              console.error(`[process-abandoned-carts] Falha ao enviar e-mail para ${cart.customer_email} (carrinho ${cart.id}):`, sendEmailError || sendEmailResponse?.error);
              errorCount++;
            } else {
              console.log(`[process-abandoned-carts] E-mail enviado com sucesso para ${cart.customer_email} (carrinho ${cart.id}). Atualizando carrinho...`);

              const { error: updateCartError } = await adminClient
                .from('abandoned_carts')
                .update({
                  status: 'recovery_email_sent',
                  recovery_email_sent_at: new Date().toISOString()
                })
                .eq('id', cart.id);

              if (updateCartError) {
                console.error(`[process-abandoned-carts] Falha ao atualizar status do carrinho ${cart.id}:`, updateCartError);
                errorCount++;
              } else {
                emailsSentCount++;
                console.log(`[process-abandoned-carts] Carrinho ${cart.id} atualizado para RECOVERY_EMAIL_SENT.`);
              }
            }
          } catch (cartError: any) {
            console.error(`[process-abandoned-carts] Erro ao processar carrinho ${cart.id}:`, cartError.message);
            errorCount++;
          }
        }
      } catch (userError: any) {
        console.error(`[process-abandoned-carts] Erro ao processar usuário ${platformUserId}:`, userError.message);
        errorCount++;
      }
    }

    const summary = `Finalizado. Total de ${cartsProcessedCount} carrinhos processados, ${emailsSentCount} e-mails enviados, ${errorCount} erros encontrados.`;
    console.log(`[process-abandoned-carts] ${summary}`);

    return new Response(JSON.stringify({
      success: true,
      message: summary,
      emailsSent: emailsSentCount,
      cartsProcessed: cartsProcessedCount,
      errors: errorCount,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("[process-abandoned-carts] Erro geral na função:", error.message);
    console.error("Stack trace:", error.stack);

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
