
// @ts-ignore
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { Database } from '../_shared/db_types.ts'; 

// Declare Deno for TypeScript
declare const Deno: any;

// --- Helper function to format dates for UTMify ---
const formatDateForUtmify = (isoDateString: string | null | undefined): string | null => {
  if (!isoDateString) {
    return null;
  }
  try {
    const date = new Date(isoDateString);
    if (isNaN(date.getTime())) {
      console.warn(`[formatDateForUtmify] Invalid date string received: ${isoDateString}`);
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
    console.warn(`[formatDateForUtmify] Error formatting date: ${isoDateString}`, e);
    return null;
  }
};


// --- Tipos internos para esta função, alinhados com os requisitos da UTMify ---
interface UtmifyCustomer {
  name: string;
  email: string;
  whatsapp: string; 
  phone: string | null; 
  document: string | null; 
  ip?: string | null; // Made optional as it's best effort
}

interface UtmifyProduct {
  id: string;
  name: string;
  quantity: number;
  priceInCents: number;
  planId: string; 
  planName: string; 
}

interface UtmifyCommission {
  totalPriceInCents: number;
  gatewayFeeInCents: number;
  userCommissionInCents: number;
  currency: string;
}

interface UtmifyTrackingParameters {
  src: string | null;
  sck: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_medium: string | null;
  utm_source: string | null;
  utm_term: string | null;
}

interface UtmifyOrderPayloadFromFrontend { 
  orderId: string;
  platform: string;
  paymentMethod: "pix" | "credit_card" | "boleto";
  status: string;
  createdAt: string;
  approvedDate?: string | null; 
  customer: { 
    name: string;
    email: string;
    whatsapp: string;
    ip?: string | null; // Made optional
    phone?: string | null;
    document?: string | null;
  };
  products: Array<{ 
    id: string;
    name: string;
    quantity: number;
    priceInCents: number;
    planId?: string | null;
    planName?: string | null;
  }>;
  trackingParameters?: Record<string, string | null>; 
  commission?: UtmifyCommission;
  refundedAt?: string | null;
  isTest?: boolean;
  couponCodeUsed?: string | null;
  discountAppliedInCents?: number | null;
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
  createdAt: string | null; 
  approvedDate: string | null; 
  customer: UtmifyCustomer; 
  products: UtmifyProduct[]; 
  trackingParameters: UtmifyTrackingParameters; 
  commission?: UtmifyCommission;
  refundedAt?: string | null; 
  isTest?: boolean;
  couponCodeUsed?: string | null;
  discountAppliedInCents?: number | null;
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
  payload: UtmifyOrderPayloadFromFrontend; 
  productOwnerUserId: string;
}

const UTMIFY_API_ENDPOINT = 'https://api.utmify.com.br/api-credentials/orders';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let productOwnerUserIdForLogging: string | undefined;
  let orderIdForLogging: string | undefined;

  try {
    const requestBody: RequestBody = await req.json();
    const { payload: frontendPayload, productOwnerUserId } = requestBody;
    productOwnerUserIdForLogging = productOwnerUserId;
    orderIdForLogging = frontendPayload?.orderId;

    console.log(`[send-utmify-event] Iniciando. Owner: ${productOwnerUserId}, OrderID (Payload): ${orderIdForLogging}`);

    if (!productOwnerUserId) throw new Error("ID do vendedor (productOwnerUserId) é obrigatório.");
    if (!frontendPayload) throw new Error("Payload do pedido é obrigatório.");
    if (!frontendPayload.orderId) throw new Error("orderId é obrigatório no payload.");
    if (!frontendPayload.platform) throw new Error("platform é obrigatório no payload.");
    if (!frontendPayload.paymentMethod) throw new Error("paymentMethod é obrigatório no payload.");
    if (!frontendPayload.status) throw new Error("status é obrigatório no payload.");
    if (!frontendPayload.createdAt) throw new Error("createdAt é obrigatório no payload.");
    if (!frontendPayload.customer?.name) throw new Error("customer.name é obrigatório.");
    if (!frontendPayload.customer?.email) throw new Error("customer.email é obrigatório.");
    if (!frontendPayload.products || frontendPayload.products.length === 0) throw new Error("products (array não vazio) é obrigatório.");

    const finalPayload: FinalUtmifyApiPayload = {
      orderId: frontendPayload.orderId,
      platform: frontendPayload.platform,
      paymentMethod: frontendPayload.paymentMethod,
      status: frontendPayload.status,
      createdAt: formatDateForUtmify(frontendPayload.createdAt),
      approvedDate: frontendPayload.status?.toLowerCase() === 'paid' 
        ? (frontendPayload.approvedDate ? formatDateForUtmify(frontendPayload.approvedDate) : formatDateForUtmify(new Date().toISOString()))
        : null,
      refundedAt: formatDateForUtmify(frontendPayload.refundedAt),
      customer: {
        name: frontendPayload.customer.name,
        email: frontendPayload.customer.email,
        whatsapp: frontendPayload.customer.whatsapp || '', 
        phone: frontendPayload.customer.phone || frontendPayload.customer.whatsapp || null, 
        document: frontendPayload.customer.document || null, 
        ip: frontendPayload.customer.ip || 
            req.headers.get("x-forwarded-for")?.split(',')[0].trim() ||
            req.headers.get("x-real-ip") ||
            req.headers.get("cf-connecting-ip") || 
            null,
      },
      products: frontendPayload.products.map(p => ({
        id: p.id,
        name: p.name,
        quantity: p.quantity,
        priceInCents: p.priceInCents,
        planId: p.planId || p.id, 
        planName: p.planName || p.name, 
      })),
      trackingParameters: {
        src: frontendPayload.trackingParameters?.src?.trim() || null,
        sck: frontendPayload.trackingParameters?.sck?.trim() || null,
        utm_source: frontendPayload.trackingParameters?.utm_source?.trim() || null,
        utm_medium: frontendPayload.trackingParameters?.utm_medium?.trim() || null,
        utm_campaign: frontendPayload.trackingParameters?.utm_campaign?.trim() || null,
        utm_term: frontendPayload.trackingParameters?.utm_term?.trim() || null,
        utm_content: frontendPayload.trackingParameters?.utm_content?.trim() || null,
      },
      commission: frontendPayload.commission,
      isTest: frontendPayload.isTest || false,
      couponCodeUsed: frontendPayload.couponCodeUsed || undefined,
      discountAppliedInCents: frontendPayload.discountAppliedInCents || undefined,
      originalAmountBeforeDiscountInCents: frontendPayload.originalAmountBeforeDiscountInCents || undefined,
      isUpsellTransaction: frontendPayload.isUpsellTransaction || false,
      originalSaleId: frontendPayload.originalSaleId || undefined,
    };
    
    const allowedUtmKeys: (keyof UtmifyTrackingParameters)[] = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'src', 'sck'];
    for (const key in finalPayload.trackingParameters) {
      if (!allowedUtmKeys.includes(key as keyof UtmifyTrackingParameters)) { // Type assertion
        delete (finalPayload.trackingParameters as any)[key];
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase URL/Service Key não configurados.");
    const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);

    console.log(`[send-utmify-event] Buscando app_settings para vendedor: ${productOwnerUserId}`);
    const { data: sellerSettingsData, error: sellerSettingsError } = await adminClient
      .from('app_settings').select('api_tokens').eq('platform_user_id', productOwnerUserId).single();

    if (sellerSettingsError) throw new Error(`Erro ao buscar config. do vendedor: ${sellerSettingsError.message}`);
    if (!sellerSettingsData || !sellerSettingsData.api_tokens) {
      console.warn(`[send-utmify-event] Config. de API (api_tokens) não encontradas para vendedor ${productOwnerUserId}.`);
      return new Response(JSON.stringify({ success: false, message: "UTMify não configurado (sem tokens)." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }
    
    const apiTokens = sellerSettingsData.api_tokens as ApiTokens; 
    if (!apiTokens?.utmifyEnabled) {
      console.log(`[send-utmify-event] UTMify desabilitado para vendedor ${productOwnerUserId}.`);
      return new Response(JSON.stringify({ success: true, message: "UTMify desabilitado." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }
    if (!apiTokens?.utmify || typeof apiTokens.utmify !== 'string' || apiTokens.utmify.trim() === '') {
      console.warn(`[send-utmify-event] Token UTMify não configurado para vendedor ${productOwnerUserId}.`);
       return new Response(JSON.stringify({ success: false, message: "Token UTMify não configurado." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    console.log("[send-utmify-event] Payload final para UTMify API:", JSON.stringify(finalPayload, null, 2));
    const utmifyApiResponse = await fetch(UTMIFY_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-token': apiTokens.utmify },
        body: JSON.stringify(finalPayload),
    });

    const utmifyApiResultText = await utmifyApiResponse.text();
    let utmifyApiResultJson;
    try { utmifyApiResultJson = JSON.parse(utmifyApiResultText); } 
    catch(e) { utmifyApiResultJson = { message: utmifyApiResultText.substring(0, 500) }; }

    console.log(`[send-utmify-event] Resposta da UTMify API (Status ${utmifyApiResponse.status}):`, JSON.stringify(utmifyApiResultJson, null, 2));

    if (!utmifyApiResponse.ok) {
        const errorDetail = utmifyApiResultJson.message || `Erro ${utmifyApiResponse.status} da API UTMify.`;
        return new Response(JSON.stringify({ success: false, message: `Erro ao enviar dados para UTMify: ${errorDetail}`, utmifyResponse: utmifyApiResultJson }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    return new Response(JSON.stringify({ success: true, message: "Evento enviado para UTMify.", utmifyResponse: utmifyApiResultJson }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (err: any) {
    const errorDetails = {
        message: err.message || "Erro desconhecido",
        stack: err.stack,
        errorObjectString: JSON.stringify(err, Object.getOwnPropertyNames(err)),
    };
    console.error(`[send-utmify-event] ERRO CAPTURADO (Owner: ${productOwnerUserIdForLogging || 'N/A'}, Order: ${orderIdForLogging || 'N/A'}):`, errorDetails);
    return new Response(JSON.stringify({ success: false, message: "Erro interno na função UTMify." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
})
