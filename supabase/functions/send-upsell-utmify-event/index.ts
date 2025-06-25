
// DENTRO DE supabase/functions/send-upsell-utmify-event/index.ts (SUBSTITUIR TODO O CONTEÚDO)
// @ts-ignore
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts';
import { Database } from '../_shared/db_types.ts';

// Declare Deno for TypeScript
declare const Deno: any;

const PUSH_IN_PAY_FIXED_FEE_IN_CENTS = 30; // Taxa fixa da PushInPay

// Interface para o payload que esta função espera receber do front-end
interface UpsellTriggerPayload {
  originalSaleId: string;
  upsellProductId: string;
  upsellPriceInCents: number;
}

// --- Helper function to format dates for UTMify ---
const formatDateForUtmify = (isoDateString: string | null | undefined): string | null => {
    if (!isoDateString) {
      return null;
    }
    try {
      const date = new Date(isoDateString);
      if (isNaN(date.getTime())) {
        console.warn(`[formatDateForUtmify-Upsell] Invalid date string received: ${isoDateString}`);
        return null; 
      }
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const seconds = String(date.getUTCSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (e) {
      console.warn(`[formatDateForUtmify-Upsell] Error formatting date: ${isoDateString}`, e);
      return null;
    }
  };

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: UpsellTriggerPayload = await req.json();

    if (!payload.originalSaleId || !payload.upsellProductId || typeof payload.upsellPriceInCents !== 'number' || payload.upsellPriceInCents <= 0) {
      throw new Error('Dados do gatilho de upsell estão incompletos ou inválidos (originalSaleId, upsellProductId, upsellPriceInCents).');
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");
    }

    const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);

    const { data: originalSale, error: saleError } = await adminClient
      .from('sales')
      .select('id, platform_user_id, customer_name, customer_email, customer_whatsapp, tracking_parameters, created_at, paid_at, customer_ip')
      .eq('id', payload.originalSaleId)
      .single();

    if (saleError || !originalSale) {
      console.error('Error fetching original sale:', saleError);
      throw new Error(`Venda original não encontrada (ID: ${payload.originalSaleId}): ${saleError?.message || 'Registro não localizado.'}`);
    }

    const { data: upsellProduct, error: productError } = await adminClient
      .from('products')
      .select('name')
      .eq('id', payload.upsellProductId)
      .single();

    if (productError || !upsellProduct) {
      console.error('Error fetching upsell product:', productError);
      throw new Error(`Produto do upsell não encontrado (ID: ${payload.upsellProductId}): ${productError?.message || 'Registro não localizado.'}`);
    }
    
    const [sellerSettingsResult, platformSettingsResult] = await Promise.all([
        adminClient.from('app_settings').select('api_tokens').eq('platform_user_id', originalSale.platform_user_id).single(),
        adminClient.from('platform_settings').select('platform_commission_percentage, platform_fixed_fee_in_cents').eq('id', 'global').single()
    ]);
      
    if (sellerSettingsResult.error || !sellerSettingsResult.data) {
      console.error('Error fetching seller settings:', sellerSettingsResult.error);
      throw new Error(`Configurações do vendedor não encontradas para ID ${originalSale.platform_user_id}: ${sellerSettingsResult.error?.message || 'Registro não localizado.'}`);
    }
    
    if (platformSettingsResult.error || !platformSettingsResult.data) {
        console.error('Error fetching platform settings:', platformSettingsResult.error);
        throw new Error(`Configurações da plataforma não encontradas: ${platformSettingsResult.error?.message || 'Registro não localizado.'}`);
    }
    
    const apiTokens = sellerSettingsResult.data.api_tokens as any; 
    const utmifyToken = apiTokens?.utmify;

    if (!apiTokens?.utmifyEnabled || !utmifyToken) {
        console.log(`UTMify desabilitado ou sem token para o vendedor ${originalSale.platform_user_id}. Evento de upsell não enviado.`);
        return new Response(JSON.stringify({ success: true, message: 'UTMify desabilitado, nenhum evento enviado.' }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const platformSettingsData = platformSettingsResult.data;
    const basePlatformCommissionOnUpsell = Math.round(payload.upsellPriceInCents * (platformSettingsData.platform_commission_percentage ?? 0)) + (platformSettingsData.platform_fixed_fee_in_cents ?? 0);
    let totalPlatformShareForUpsellGatewayFee = basePlatformCommissionOnUpsell + PUSH_IN_PAY_FIXED_FEE_IN_CENTS;
    totalPlatformShareForUpsellGatewayFee = Math.max(0, Math.min(totalPlatformShareForUpsellGatewayFee, payload.upsellPriceInCents));

    const utmifyPayload = {
      orderId: `${originalSale.id}-upsell-${Date.now()}`, 
      platform: "1Checkout", 
      paymentMethod: "pix", 
      status: "paid", 
      createdAt: formatDateForUtmify(originalSale.created_at), 
      approvedDate: formatDateForUtmify(new Date().toISOString()), 
      refundedAt: null,
      customer: {
        name: originalSale.customer_name,
        email: originalSale.customer_email,
        phone: originalSale.customer_whatsapp || null, 
        document: null,
        ip: originalSale.customer_ip || req.headers.get("x-forwarded-for")?.split(',')[0].trim() || req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip") || null,
      },
      products: [{ 
        id: payload.upsellProductId,
        name: upsellProduct.name,
        planId: payload.upsellProductId, 
        planName: upsellProduct.name,   
        quantity: 1,
        priceInCents: payload.upsellPriceInCents
      }],
      trackingParameters: { 
        src: (originalSale.tracking_parameters as any)?.src || null,
        sck: (originalSale.tracking_parameters as any)?.sck || null,
        utm_source: (originalSale.tracking_parameters as any)?.utm_source || null,
        utm_campaign: (originalSale.tracking_parameters as any)?.utm_campaign || null,
        utm_medium: (originalSale.tracking_parameters as any)?.utm_medium || null,
        utm_content: (originalSale.tracking_parameters as any)?.utm_content || null,
        utm_term: (originalSale.tracking_parameters as any)?.utm_term || null,
      },
      commission: { 
        totalPriceInCents: payload.upsellPriceInCents,
        gatewayFeeInCents: totalPlatformShareForUpsellGatewayFee, 
        userCommissionInCents: payload.upsellPriceInCents - totalPlatformShareForUpsellGatewayFee,
        currency: "BRL"
      },
      isUpsellTransaction: true,
      originalSaleId: originalSale.id,
    };

    console.log("[send-upsell-utmify-event] Payload final a ser enviado para UTMify API:", JSON.stringify(utmifyPayload, null, 2));

    const utmifyApiResponse = await fetch('https://api.utmify.com.br/api-credentials/orders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-token': utmifyToken,
        },
        body: JSON.stringify(utmifyPayload),
    });
    
    const utmifyResponseText = await utmifyApiResponse.text();
    let utmifyResponseJson;
    try {
        utmifyResponseJson = JSON.parse(utmifyResponseText);
    } catch(e) {
        console.warn("[send-upsell-utmify-event] UTMify API response was not valid JSON:", utmifyResponseText);
        utmifyResponseJson = { message: utmifyResponseText.substring(0, 500) }; 
    }


    if (!utmifyApiResponse.ok) {
        console.error(`[send-upsell-utmify-event] Erro da API UTMify (${utmifyApiResponse.status}):`, utmifyResponseJson);
        throw new Error(`Erro da API UTMify: ${utmifyApiResponse.status} - ${utmifyResponseJson.message || utmifyResponseText}`);
    }
    
    console.log("[send-upsell-utmify-event] Evento de upsell enviado para UTMify com sucesso! Resposta:", utmifyResponseJson);
    return new Response(JSON.stringify({ success: true, message: 'Evento de upsell rastreado.', data: utmifyResponseJson }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[send-upsell-utmify-event] Erro na função:', error.message, error.stack);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, 
    });
  }
})
