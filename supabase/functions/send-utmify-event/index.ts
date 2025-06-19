// @ts-ignore
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { Database } from '../_shared/db_types.ts'; // Assuming you have this from your local setup

// Declare Deno for TypeScript
declare const Deno: any;

// --- Tipos internos para esta função, alinhados com os requisitos da UTMify ---
interface UtmifyCustomer {
  name: string;
  email: string;
  whatsapp: string; // Mantido para uso interno como fallback
  phone: string | null; // OBRIGATÓRIO para UTMify
  document: string | null; // OBRIGATÓRIO para UTMify
  ip?: string;
}

interface UtmifyProduct {
  id: string;
  name: string;
  quantity: number;
  priceInCents: number;
  planId: string; // OBRIGATÓRIO para UTMify
  planName: string; // OBRIGATÓRIO para UTMify
}

interface UtmifyCommission {
  totalPriceInCents: number;
  gatewayFeeInCents: number;
  userCommissionInCents: number;
  currency: string;
}

interface UtmifyTrackingParameters {
  utm_campaign: string | null;
  utm_content: string | null;
  utm_medium: string | null;
  utm_source: string | null;
  utm_term: string | null;
}

interface UtmifyOrderPayloadFromFrontend { // Payload como chega do frontend
  orderId: string;
  platform: string;
  paymentMethod: "pix" | "credit_card" | "boleto";
  status: string;
  createdAt: string;
  approvedDate?: string | null; // Frontend pode ou não enviar
  customer: { // Estrutura do frontend
    name: string;
    email: string;
    whatsapp: string;
    ip?: string; // Frontend pode ou não enviar, será sobrescrito
    // 'phone' e 'document' podem estar ausentes no payload do frontend
    phone?: string | null;
    document?: string | null;
  };
  products: Array<{ // Estrutura do frontend
    id: string;
    name: string;
    quantity: number;
    priceInCents: number;
    // 'planId' e 'planName' podem estar ausentes
    planId?: string | null;
    planName?: string | null;
  }>;
  trackingParameters?: Record<string, string | null>; // Frontend envia o que tem
  commission?: UtmifyCommission;
  refundedAt?: string | null;
  isTest?: boolean;
  couponCodeUsed?: string;
  discountAppliedInCents?: number;
  originalAmountBeforeDiscountInCents?: number;
  isUpsellTransaction?: boolean;
  originalSaleId?: string;
}

// Payload final para a API da UTMify
interface FinalUtmifyApiPayload {
  orderId: string;
  platform: string;
  paymentMethod: "pix" | "credit_card" | "boleto";
  status: string;
  createdAt: string;
  approvedDate: string | null; // OBRIGATÓRIO
  customer: UtmifyCustomer; // Com phone e document OBRIGATÓRIOS (string | null)
  products: UtmifyProduct[]; // Com planId e planName OBRIGATÓRIOS
  trackingParameters: UtmifyTrackingParameters; // Com todos os 5 UTMs OBRIGATÓRIOS (string | null)
  commission?: UtmifyCommission;
  refundedAt?: string | null;
  isTest?: boolean;
  couponCodeUsed?: string;
  discountAppliedInCents?: number;
  originalAmountBeforeDiscountInCents?: number;
  isUpsellTransaction?: boolean;
  originalSaleId?: string;
}

interface ApiTokens {
  pushinPay: string;
  utmify: string;
  pushinPayEnabled: boolean;
  utmifyEnabled: boolean;
}

interface RequestBody {
  payload: UtmifyOrderPayloadFromFrontend; // Recebe o payload do frontend
  productOwnerUserId: string;
}

const UTMIFY_API_ENDPOINT = 'https://api.utmify.com.br/api-credentials/orders';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let productOwnerUserIdForLogging: string | undefined;

  try {
    const requestBody: RequestBody = await req.json();
    const { payload: frontendPayload, productOwnerUserId } = requestBody;
    productOwnerUserIdForLogging = productOwnerUserId;

    console.log(`[send-utmify-event] Iniciando para productOwnerUserId: ${productOwnerUserId}`);

    if (!productOwnerUserId) {
      throw new Error("ID do vendedor (productOwnerUserId) é obrigatório na requisição.");
    }
    if (!frontendPayload) {
      throw new Error("Payload do pedido é obrigatório.");
    }

    // 1. Construir o payload final para a API UTMify
    const finalPayload: FinalUtmifyApiPayload = {
      ...frontendPayload,
      approvedDate: frontendPayload.status === 'paid' && !frontendPayload.approvedDate
        ? new Date().toISOString() // Se status é 'paid' e approvedDate não veio, usar data atual
        : frontendPayload.approvedDate || null, // Garante que seja null se não definido
      customer: {
        name: frontendPayload.customer.name,
        email: frontendPayload.customer.email,
        whatsapp: frontendPayload.customer.whatsapp,
        phone: frontendPayload.customer.phone || frontendPayload.customer.whatsapp || null, // Usa whatsapp como fallback para phone
        document: frontendPayload.customer.document || null, // Default para null
        ip: req.headers.get("x-forwarded-for")?.split(',')[0].trim() ||
            req.headers.get("x-real-ip") ||
            req.headers.get("cf-connecting-ip") ||
            frontendPayload.customer.ip || // Mantém IP do frontend se nenhum header encontrado
            null,
      },
      products: frontendPayload.products.map(p => ({
        id: p.id,
        name: p.name,
        quantity: p.quantity,
        priceInCents: p.priceInCents,
        planId: p.planId || p.id, // Usa product ID como fallback
        planName: p.planName || p.name, // Usa product name como fallback
      })),
      trackingParameters: {
        utm_source: frontendPayload.trackingParameters?.utm_source?.trim() || null,
        utm_medium: frontendPayload.trackingParameters?.utm_medium?.trim() || null,
        utm_campaign: frontendPayload.trackingParameters?.utm_campaign?.trim() || null,
        utm_term: frontendPayload.trackingParameters?.utm_term?.trim() || null,
        utm_content: frontendPayload.trackingParameters?.utm_content?.trim() || null,
      },
    };
    
    // Remove quaisquer chaves UTM que não sejam as 5 esperadas do objeto trackingParameters
    const allowedUtmKeys: (keyof UtmifyTrackingParameters)[] = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    for (const key in finalPayload.trackingParameters) {
      if (!allowedUtmKeys.includes(key as keyof UtmifyTrackingParameters)) {
        // @ts-ignore
        delete finalPayload.trackingParameters[key];
      }
    }


    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas na Edge Function.");
    }

    const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);

    console.log(`[send-utmify-event] Buscando app_settings para vendedor: ${productOwnerUserId}`);
    const { data: sellerSettingsData, error: sellerSettingsError } = await adminClient
      .from('app_settings')
      .select('api_tokens') 
      .eq('platform_user_id', productOwnerUserId)
      .single();

    if (sellerSettingsError) {
      console.error(`[send-utmify-event] Erro ao buscar app_settings do vendedor ${productOwnerUserId}:`, sellerSettingsError);
      throw new Error(`Erro ao buscar configurações do vendedor: ${sellerSettingsError.message}`);
    }

    if (!sellerSettingsData || !sellerSettingsData.api_tokens) {
      console.warn(`[send-utmify-event] Configurações de API (api_tokens) não encontradas para o vendedor ${productOwnerUserId}.`);
      return new Response(JSON.stringify({ success: false, message: "UTMify não configurado para este vendedor." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, 
      });
    }
    
    const apiTokens = sellerSettingsData.api_tokens as ApiTokens; 
    const utmifyToken = apiTokens?.utmify;
    const isUtmifyEnabled = apiTokens?.utmifyEnabled;
    
    if (!isUtmifyEnabled) {
      console.log(`[send-utmify-event] UTMify desabilitado para o vendedor ${productOwnerUserId}.`);
      return new Response(JSON.stringify({ success: true, message: "UTMify desabilitado para este vendedor." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (!utmifyToken || typeof utmifyToken !== 'string' || utmifyToken.trim() === '') {
      console.warn(`[send-utmify-event] Token da API UTMify não configurado para o vendedor ${productOwnerUserId}.`);
       return new Response(JSON.stringify({ success: false, message: "Token UTMify não configurado para este vendedor." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, 
      });
    }

    console.log("[send-utmify-event] Payload final para UTMify API:", JSON.stringify(finalPayload, null, 2));

    const utmifyApiResponse = await fetch(UTMIFY_API_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-token': utmifyToken,
        },
        body: JSON.stringify(finalPayload),
    });

    const utmifyApiResultText = await utmifyApiResponse.text();
    let utmifyApiResultJson;
    try {
        utmifyApiResultJson = JSON.parse(utmifyApiResultText);
    } catch(e) {
        utmifyApiResultJson = { message: utmifyApiResultText};
    }

    console.log(`[send-utmify-event] Resposta da UTMify API (Status ${utmifyApiResponse.status}):`, JSON.stringify(utmifyApiResultJson, null, 2));

    if (!utmifyApiResponse.ok) {
        const errorDetail = utmifyApiResultJson.message || `Erro ${utmifyApiResponse.status} da API UTMify.`;
        console.error(`[send-utmify-event] Erro da API UTMify: ${errorDetail}`);
        return new Response(JSON.stringify({ 
            success: false, 
            message: `Erro ao enviar dados para UTMify: ${errorDetail}`,
            utmifyResponse: utmifyApiResultJson 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200, 
        });
    }

    return new Response(JSON.stringify({ 
        success: true, 
        message: "Evento enviado para UTMify com sucesso.",
        utmifyResponse: utmifyApiResultJson 
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (err: any) {
    console.error(`[send-utmify-event] Erro CAPTURADO na Edge Function para productOwnerUserId ${productOwnerUserIdForLogging || 'desconhecido'}:`, err.message, err.stack);
    return new Response(JSON.stringify({ success: false, message: err.message || "Erro interno na função UTMify." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500, 
    });
  }
})
