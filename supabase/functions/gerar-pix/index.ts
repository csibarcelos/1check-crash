// Caminho: supabase/functions/gerar-pix/index.ts

// @ts-ignore
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2' 
import { corsHeaders } from '../_shared/cors.ts';
import { Database, Json } from '../_shared/db_types.ts' 

declare const Deno: any;

const PUSH_IN_PAY_FIXED_FEE_IN_CENTS = 30; 

// Interface para o payload DENTRO do corpo da requisição da Edge Function
interface PixGenerationRequestPayload {
  value: number; 
  originalValueBeforeDiscount: number; 
  // webhook_url from frontend is now ignored, the function will set its own.
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  products: Array<{ 
    productId: string;
    name: string;
    quantity: number;
    priceInCents: number;
    originalPriceInCents: number;
    isUpsell?: boolean; 
    deliveryUrl?: string | null; 
    slug?: string | null; 
  }>;
  trackingParameters?: Record<string, string | null>; // Allow null for UTM params
  couponCodeUsed?: string;
  discountAppliedInCents?: number;
  isUpsellTransaction?: boolean; 
  originalSaleId?: string;       
  buyerId?: string; 
}

interface EdgeFunctionRequestBody {
  payload: PixGenerationRequestPayload;
  productOwnerUserId: string;
  saleId: string; 
}

interface PushInPaySplitRule {
  account_id: string;
  value: number; 
}
interface PushInPayApiRequestBody {
  value: number; 
  webhook_url: string;
  split_rules?: PushInPaySplitRule[];
}
interface PushInPayEssentialPixData {
    id: string; 
    qr_code: string;
    qr_code_base64: string;
    status: string; 
    value: number;  
}
interface PushInPayFullApiResponse { 
    data?: PushInPayEssentialPixData; 
    id?: string; qr_code?: string; qr_code_base64?: string; status?: string; value?: number;
    success?: boolean; message?: string; errors?: any;
}

interface GerarPixEdgeFunctionResponse {
  success: boolean;
  data?: PushInPayEssentialPixData; 
  saleId?: string;                   
  message?: string;
}

interface UtmifyOrderPayloadForWaitingPayment {
    orderId: string;
    platform: string;
    paymentMethod: "pix" | "credit_card" | "boleto";
    status: "waiting_payment" | "paid" | "refused" | "refunded" | "chargedback";
    createdAt: string;
    approvedDate: string | null;
    customer: {
        name: string;
        email: string;
        whatsapp: string;
        phone: string | null;
        document: string | null;
        ip?: string | null; 
    };
    products: Array<{
        id: string;
        name: string;
        quantity: number;
        priceInCents: number;
        planId: string; 
        planName: string;
    }>;
    trackingParameters: {
        src: string | null;
        sck: string | null;
        utm_campaign: string | null;
        utm_content: string | null;
        utm_medium: string | null;
        utm_source: string | null;
        utm_term: string | null;
    };
    commission?: {
        totalPriceInCents: number;
        gatewayFeeInCents: number;
        userCommissionInCents: number;
        currency: string;
    };
    isTest?: boolean;
    couponCodeUsed?: string | null;
    discountAppliedInCents?: number | null;
    originalAmountBeforeDiscountInCents?: number;
    isUpsellTransaction?: boolean; 
    originalSaleId?: string;      
}

const parseJsonFromDb = <T>(field: Json | null | undefined, defaultValue: T): T => {
  if (field === null || field === undefined) return defaultValue;
  if (typeof field === 'string') {
    try { return JSON.parse(field) as T; }
    catch (e) { console.warn(`[gerar-pix EF] Failed to parse JSON string from DB field:`, field, e); return defaultValue; }
  }
  // If it's already an object (and not null), assume it's the correct type or a compatible structure.
  if (typeof field === 'object' && field !== null) {
    return field as T;
  }
  return defaultValue; // Fallback for other unexpected types
};


serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let productOwnerUserIdForLogging: string | undefined;
  let saleIdForLogging: string | undefined;

  try {
    const requestBody: EdgeFunctionRequestBody = await req.json();
    const { payload, productOwnerUserId, saleId } = requestBody;
    const { value: amountForPixFromPayload, isUpsellTransaction = false } = payload; // Ensure default for isUpsellTransaction
    
    productOwnerUserIdForLogging = productOwnerUserId;
    saleIdForLogging = saleId; 

    console.log(`[gerar-pix EF] Iniciando. Sale ID (Principal): ${saleId}, Owner: ${productOwnerUserId}, Amount (Payload): ${amountForPixFromPayload}, IsUpsell: ${isUpsellTransaction}`);
    
    if (!saleId) throw new Error("ID da Venda (saleId) é obrigatório.");
    if (!productOwnerUserId) throw new Error("ID do vendedor (productOwnerUserId) é obrigatório.");
    if (typeof amountForPixFromPayload !== 'number' || amountForPixFromPayload <= 0) throw new Error("Valor do PIX (payload.value) ausente/inválido.");
    if (!payload.customerName || !payload.customerEmail || !payload.customerWhatsapp) throw new Error("Detalhes do cliente obrigatórios.");

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");
    const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);

    const actualWebhookUrl = `${supabaseUrl}/functions/v1/webhook-pushinpay`;
    console.log(`[gerar-pix EF] Webhook URL to be used: ${actualWebhookUrl}`);


    const { data: saleRecord, error: saleFetchError } = await adminClient
      .from('sales')
      .select('id, total_amount_in_cents, status, platform_user_id, upsell_status, upsell_push_in_pay_transaction_id, created_at, customer_name, customer_email, customer_whatsapp, customer_ip, tracking_parameters, products, original_amount_before_discount_in_cents, discount_applied_in_cents, coupon_code_used, platform_commission_in_cents')
      .eq('id', saleId)
      .eq('platform_user_id', productOwnerUserId)
      .single();

    if (saleFetchError) throw new Error(`Erro ao buscar registro de venda ${saleId}: ${saleFetchError.message}`);
    if (!saleRecord) throw new Error(`Venda com ID ${saleId} não encontrada para o vendedor ${productOwnerUserId}.`);

    let finalAmountForPix: number;
    let transactionIdFieldToUpdateDb: 'push_in_pay_transaction_id' | 'upsell_push_in_pay_transaction_id';
    let statusFieldToUpdateDb: 'status' | 'upsell_status';
    let amountFieldToStoreInDb: 'total_amount_in_cents' | 'upsell_amount_in_cents' | null = null;

    if (isUpsellTransaction) {
        console.log(`[gerar-pix EF] É uma transação de UPSELL para a venda original ${saleId}.`);
        if (saleRecord.status !== 'paid') throw new Error(`Venda original ${saleId} não está paga (status: ${saleRecord.status}). Não é possível gerar PIX de upsell.`);
        if (saleRecord.upsell_status && !['waiting_payment', 'failed', 'expired', 'cancelled'].includes(saleRecord.upsell_status)) {
            if (saleRecord.upsell_status === 'paid' && saleRecord.upsell_push_in_pay_transaction_id) {
                 console.warn(`[gerar-pix EF] Upsell para a venda ${saleId} já foi pago (TX ID: ${saleRecord.upsell_push_in_pay_transaction_id}). Nova tentativa de PIX bloqueada.`);
                 throw new Error(`Um upsell para esta venda já foi pago.`);
            }
        }
        finalAmountForPix = amountForPixFromPayload;
        transactionIdFieldToUpdateDb = 'upsell_push_in_pay_transaction_id';
        statusFieldToUpdateDb = 'upsell_status';
        amountFieldToStoreInDb = 'upsell_amount_in_cents';
    } else {
        console.log(`[gerar-pix EF] É uma transação de VENDA PRINCIPAL.`);
        if (saleRecord.status !== 'waiting_payment') throw new Error(`Venda ${saleId} não está aguardando pagamento (status: ${saleRecord.status}). Não é possível gerar novo PIX.`);
        finalAmountForPix = saleRecord.total_amount_in_cents;
        if (finalAmountForPix !== amountForPixFromPayload) console.warn(`[gerar-pix EF] Divergência de valor para venda principal ${saleId}. No DB: ${finalAmountForPix}, Recebido: ${amountForPixFromPayload}. Usando valor do DB.`);
        transactionIdFieldToUpdateDb = 'push_in_pay_transaction_id';
        statusFieldToUpdateDb = 'status';
    }

    const [sellerSettingsResult, platformSettingsResult] = await Promise.all([
        adminClient.from('app_settings').select('api_tokens').eq('platform_user_id', productOwnerUserId).single(),
        adminClient.from('platform_settings').select('platform_commission_percentage, platform_fixed_fee_in_cents, platform_account_id_push_in_pay').eq('id', 'global').single()
    ]);

    if (sellerSettingsResult.error || !sellerSettingsResult.data) throw new Error(`Erro/Config. do vendedor não encontradas: ${sellerSettingsResult.error?.message}`);
    
    const sellerApiTokensJson = sellerSettingsResult.data.api_tokens;
    let sellerApiTokens: { pushinPayEnabled?: boolean, pushinPay?: string } | null = null;

    if (typeof sellerApiTokensJson === 'string') {
        try {
            sellerApiTokens = JSON.parse(sellerApiTokensJson);
        } catch (e) {
            console.error("[gerar-pix EF] Failed to parse api_tokens JSON string:", e);
            throw new Error("Configuração de API do vendedor (api_tokens) está mal formatada.");
        }
    } else if (sellerApiTokensJson && typeof sellerApiTokensJson === 'object') {
        sellerApiTokens = sellerApiTokensJson as { pushinPayEnabled?: boolean, pushinPay?: string };
    }
    
    if (!sellerApiTokens?.pushinPayEnabled || !sellerApiTokens?.pushinPay) {
        throw new Error('PushInPay não habilitado ou token não configurado para o vendedor.');
    }
    const pushInPayToken = sellerApiTokens.pushinPay;


    if (platformSettingsResult.error || !platformSettingsResult.data) throw new Error(`Erro/Config. da plataforma não encontradas: ${platformSettingsResult.error?.message}`);
    const platformSettingsData = platformSettingsResult.data;

    const pushInPayApiRequestBody: PushInPayApiRequestBody = { 
      value: finalAmountForPix, 
      webhook_url: actualWebhookUrl 
    };
    
    const basePlatformCommission = Math.round(finalAmountForPix * (platformSettingsData.platform_commission_percentage ?? 0)) + (platformSettingsData.platform_fixed_fee_in_cents ?? 0);
    let totalPlatformShareForPushInPay = basePlatformCommission + PUSH_IN_PAY_FIXED_FEE_IN_CENTS;
    totalPlatformShareForPushInPay = Math.max(0, Math.min(totalPlatformShareForPushInPay, finalAmountForPix)); 

    if (platformSettingsData.platform_account_id_push_in_pay && totalPlatformShareForPushInPay > 0) {
        pushInPayApiRequestBody.split_rules = [{ account_id: platformSettingsData.platform_account_id_push_in_pay, value: totalPlatformShareForPushInPay }];
        console.log(`[gerar-pix EF] Split configurado para PushInPay: ${totalPlatformShareForPushInPay} centavos para conta ${platformSettingsData.platform_account_id_push_in_pay}`);
    }
    
    const pushinPayResponse = await fetch('https://api.pushinpay.com.br/api/pix/cashIn', {
        method: 'POST', headers: { 'Authorization': `Bearer ${pushInPayToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(pushInPayApiRequestBody)
    });
    const pushinPayParsedResponse: PushInPayFullApiResponse = await pushinPayResponse.json();
    if (!pushinPayResponse.ok) throw new Error(`Gateway de Pagamento: ${pushinPayParsedResponse.message || JSON.stringify(pushinPayParsedResponse.errors || 'Erro desconhecido')}`);
    
    let extractedPixData: PushInPayEssentialPixData | null = null;
    if (pushinPayParsedResponse.data?.id) extractedPixData = pushinPayParsedResponse.data;
    else if (pushinPayParsedResponse.id) extractedPixData = { id: pushinPayParsedResponse.id, qr_code: pushinPayParsedResponse.qr_code!, qr_code_base64: pushinPayParsedResponse.qr_code_base64!, status: pushinPayParsedResponse.status!, value: pushinPayParsedResponse.value! };
    if (!extractedPixData) throw new Error('Resposta inválida do gateway ao gerar PIX.');
    
    let rawBase64String = extractedPixData.qr_code_base64;
    const dataUriPrefix = "data:image/png;base64,";
    if (rawBase64String.startsWith(dataUriPrefix)) rawBase64String = rawBase64String.substring(dataUriPrefix.length);

    const saleUpdatePayload: Partial<Database['public']['Tables']['sales']['Update']> = { 
      [transactionIdFieldToUpdateDb]: extractedPixData.id,
      [statusFieldToUpdateDb]: "waiting_payment",
      updated_at: new Date().toISOString(),
    };
    if (amountFieldToStoreInDb && isUpsellTransaction) { 
        saleUpdatePayload[amountFieldToStoreInDb] = finalAmountForPix;
    }
    
    if (!isUpsellTransaction) { 
        saleUpdatePayload.platform_commission_in_cents = totalPlatformShareForPushInPay;
    }
    
    console.log(`[gerar-pix EF] Atualizando venda ${saleId} com:`, saleUpdatePayload);
    const { error: saleUpdateError } = await adminClient
      .from('sales')
      .update(saleUpdatePayload as Database['public']['Tables']['sales']['Update']) 
      .eq('id', saleId);

    if (saleUpdateError) {
      console.error(`[gerar-pix EF] Erro ao atualizar venda ${saleId}:`, saleUpdateError);
      throw new Error(`Falha ao atualizar a venda com informações do PIX: ${saleUpdateError.message}`);
    }
    console.log(`[gerar-pix EF] Venda ${saleId} atualizada com sucesso.`);

    console.log(`[gerar-pix EF] Preparando evento 'waiting_payment' para UTMify (venda ${saleId}, upsell: ${isUpsellTransaction}).`);
    
    // Robustly parse products from saleRecord or payload
    let productsForUtmifySource = isUpsellTransaction ? payload.products : saleRecord.products;
    const parsedSaleRecordProducts = parseJsonFromDb<PixGenerationRequestPayload['products']>(productsForUtmifySource, []);

    const productsForUtmify = parsedSaleRecordProducts.map(p => ({
        id: p.productId, name: p.name, quantity: p.quantity, priceInCents: p.priceInCents,
        planId: p.productId, planName: p.name,    
    }));

    // Robustly parse trackingParameters
    const trackingParamsFromDb = parseJsonFromDb<Record<string, string | null>>(saleRecord.tracking_parameters, {});
    const payloadTrackingParams = payload.trackingParameters || {};


    const utmifyPayloadForWaitingPayment: UtmifyOrderPayloadForWaitingPayment = {
        orderId: isUpsellTransaction ? `${saleRecord.id}-upsell-${Date.now()}` : saleRecord.id,
        platform: "1Checkout", paymentMethod: "pix", status: "waiting_payment",
        createdAt: saleRecord.created_at, approvedDate: null,
        customer: {
            name: saleRecord.customer_name, email: saleRecord.customer_email,
            whatsapp: saleRecord.customer_whatsapp, phone: saleRecord.customer_whatsapp || null,
            document: null, ip: saleRecord.customer_ip || null, 
        },
        products: productsForUtmify,
        trackingParameters: {
            src: payloadTrackingParams?.src || trackingParamsFromDb?.src || null,
            sck: payloadTrackingParams?.sck || trackingParamsFromDb?.sck || null,
            utm_source: payloadTrackingParams?.utm_source || trackingParamsFromDb?.utm_source || null,
            utm_medium: payloadTrackingParams?.utm_medium || trackingParamsFromDb?.utm_medium || null,
            utm_campaign: payloadTrackingParams?.utm_campaign || trackingParamsFromDb?.utm_campaign || null,
            utm_term: payloadTrackingParams?.utm_term || trackingParamsFromDb?.utm_term || null,
            utm_content: payloadTrackingParams?.utm_content || trackingParamsFromDb?.utm_content || null,
        },
        commission: {
            totalPriceInCents: finalAmountForPix, 
            gatewayFeeInCents: totalPlatformShareForPushInPay, 
            userCommissionInCents: finalAmountForPix - totalPlatformShareForPushInPay,
            currency: "BRL",
        },
        isTest: false,
        couponCodeUsed: isUpsellTransaction ? null : saleRecord.coupon_code_used || null, 
        discountAppliedInCents: isUpsellTransaction ? null : saleRecord.discount_applied_in_cents || null, 
        originalAmountBeforeDiscountInCents: isUpsellTransaction ? finalAmountForPix : saleRecord.original_amount_before_discount_in_cents,
        isUpsellTransaction: isUpsellTransaction,
        originalSaleId: isUpsellTransaction ? saleRecord.id : undefined,
    };

    console.log(`[gerar-pix EF] Invocando 'send-utmify-event' para venda ${saleRecord.id} (upsell: ${isUpsellTransaction})...`);
    const { error: utmifyWaitingError } = await adminClient.functions.invoke(
        'send-utmify-event',
        { body: { payload: utmifyPayloadForWaitingPayment, productOwnerUserId: saleRecord.platform_user_id } }
    );
    if (utmifyWaitingError) console.warn(`[gerar-pix EF] Falha ao enviar evento 'waiting_payment' para UTMify (venda ${saleRecord.id}, upsell: ${isUpsellTransaction}):`, utmifyWaitingError.message);
    else console.log(`[gerar-pix EF] Evento 'waiting_payment' para UTMify enviado com sucesso (venda ${saleRecord.id}, upsell: ${isUpsellTransaction}).`);
    
    const finalFrontendResponse: GerarPixEdgeFunctionResponse = {
        success: true, data: { ...extractedPixData, qr_code_base64: rawBase64String },
        saleId: saleId, message: "PIX gerado e venda atualizada com sucesso."
    };
    return new Response(JSON.stringify(finalFrontendResponse), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (err: any) {
    console.error(`[gerar-pix EF] ERRO CAPTURADO (Owner: ${productOwnerUserIdForLogging || 'N/A'}, Sale: ${saleIdForLogging || 'N/A'}):`, err.message, err.stack);
    const clientErrorMessage = err.message || "Ocorreu um erro interno.";
    return new Response(JSON.stringify({ success: false, message: clientErrorMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: err.message.startsWith("Gateway de Pagamento:") ? 402 : (err.message.includes("não encontrado") || err.message.includes("obrigatório") || err.message.includes("mal formatada")) ? 400 : 500 
    });
  }
})