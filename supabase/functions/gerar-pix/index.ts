
// Caminho: supabase/functions/gerar-pix/index.ts

// @ts-ignore
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts';
import { Database, Json } from '../_shared/db_types.ts'

declare const Deno: any;

const PUSH_IN_PAY_FIXED_FEE_IN_CENTS = 30;

interface PixGeneratedEmailConfig {
  enabled: boolean;
  subject: string;
  bodyHtml: string;
}

interface PixGenerationRequestPayload {
  value: number;
  originalValueBeforeDiscount: number;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  products: Array<{
    productId: string; name: string; quantity: number; priceInCents: number;
    originalPriceInCents: number; isUpsell?: boolean; isTraditionalOrderBump?: boolean;
    isPostClickOffer?: boolean; deliveryUrl?: string | null; slug?: string | null;
  }>;
  trackingParameters?: Record<string, string | null>;
  couponCodeUsed?: string; discountAppliedInCents?: number;
  isUpsellTransaction?: boolean; originalSaleId?: string; buyerId?: string;
}
interface EdgeFunctionRequestBody {
  payload: PixGenerationRequestPayload;
  productOwnerUserId: string;
}
interface PushInPaySplitRule {
  account_id: string; value: number;
}
interface PushInPayApiRequestBody {
  value: number; webhook_url: string; split_rules?: PushInPaySplitRule[];
}
interface PushInPayEssentialPixData {
  id: string; qr_code: string; qr_code_base64: string; status: string; value: number;
}
interface PushInPayFullApiResponse {
  data?: PushInPayEssentialPixData;
  id?: string; qr_code?: string; qr_code_base64?: string; status?: string; value?: number;
  success?: boolean; message?: string; errors?: any;
}
interface GerarPixEdgeFunctionResponse {
  success: boolean; data?: PushInPayEssentialPixData; saleId?: string; message?: string;
}
interface UtmifyOrderPayloadForWaitingPayment {
  orderId: string; platform: string; paymentMethod: "pix" | "credit_card" | "boleto";
  status: "waiting_payment" | "paid" | "refused" | "refunded" | "chargedback";
  createdAt: string; approvedDate: string | null;
  customer: {
    name: string; email: string; whatsapp: string; phone: string | null;
    document: string | null; ip?: string | null;
  };
  products: Array<{
    id: string; name: string; quantity: number; priceInCents: number;
    planId: string; planName: string;
  }>;
  trackingParameters: {
    src: string | null; sck: string | null; utm_campaign: string | null;
    utm_content: string | null; utm_medium: string | null; utm_source: string | null;
    utm_term: string | null;
  };
  commission?: {
    totalPriceInCents: number; gatewayFeeInCents: number;
    userCommissionInCents: number; currency: string;
  };
  isTest?: boolean; couponCodeUsed?: string | null;
  discountAppliedInCents?: number | null;
  originalAmountBeforeDiscountInCents?: number; isUpsellTransaction?: boolean;
  originalSaleId?: string;
}


serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let productOwnerUserIdForLogging: string | undefined;

  try {
    const requestBody: EdgeFunctionRequestBody = await req.json();
    const { payload, productOwnerUserId } = requestBody;
    const { value: amountForPixFromPayload, isUpsellTransaction = false } = payload;
    
    productOwnerUserIdForLogging = productOwnerUserId;

    console.log(`[gerar-pix EF] Iniciando. Dono: ${productOwnerUserId}, Valor (Payload): ${amountForPixFromPayload}, É Upsell: ${isUpsellTransaction}`);
    
    if (!productOwnerUserId) throw new Error("ID do vendedor (productOwnerUserId) é obrigatório.");
    if (typeof amountForPixFromPayload !== 'number' || amountForPixFromPayload <= 0) throw new Error("Valor do PIX (payload.value) ausente/inválido.");
    if (!payload.customerName || !payload.customerEmail || !payload.customerWhatsapp) throw new Error("Detalhes do cliente obrigatórios.");

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");
    const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);

    const actualWebhookUrl = `${supabaseUrl}/functions/v1/webhook-pushinpay`;

    const initialSaleRecord: Database['public']['Tables']['sales']['Insert'] = {
        buyer_id: payload.buyerId, platform_user_id: productOwnerUserId,
        push_in_pay_transaction_id: `PENDING_${crypto.randomUUID()}`, products: payload.products as unknown as Json,
        customer_name: payload.customerName, customer_email: payload.customerEmail,
        customer_ip: req.headers.get("x-forwarded-for")?.split(',')[0].trim() || req.headers.get("x-real-ip") || null,
        customer_whatsapp: payload.customerWhatsapp, payment_method: 'pix', status: 'waiting_payment',
        total_amount_in_cents: payload.value, original_amount_before_discount_in_cents: payload.originalValueBeforeDiscount,
        discount_applied_in_cents: payload.discountAppliedInCents, coupon_code_used: payload.couponCodeUsed,
        tracking_parameters: payload.trackingParameters as unknown as Json,
    };
    
    const { data: createdSale, error: insertError } = await adminClient
      .from('sales').insert(initialSaleRecord).select().single();

    if (insertError) throw new Error(`Erro ao criar registro de venda: ${insertError.message}`);
    if (!createdSale) throw new Error('Falha ao criar venda, nenhum dado retornado.');
    
    const saleId = createdSale.id;
    console.log(`[gerar-pix EF] Registro de venda criado com sucesso. ID: ${saleId}`);

    const [sellerSettingsResult, platformSettingsResult] = await Promise.all([
      adminClient.from('app_settings').select('api_tokens, checkout_identity, pix_generated_email_config').eq('platform_user_id', productOwnerUserId).single(),
      adminClient.from('platform_settings').select('platform_commission_percentage, platform_fixed_fee_in_cents, platform_account_id_push_in_pay').eq('id', 'global').single()
    ]);

    if (sellerSettingsResult.error || !sellerSettingsResult.data) throw new Error(`Erro/Config. do vendedor não encontradas: ${sellerSettingsResult.error?.message}`);
    
    const sellerSettingsData = sellerSettingsResult.data;
    const sellerApiTokens = sellerSettingsData.api_tokens as any;
    if (!sellerApiTokens?.pushinPayEnabled || !sellerApiTokens?.pushinPay) {
      throw new Error('PushInPay não habilitado ou token não configurado para o vendedor.');
    }
    const pushInPayToken = sellerApiTokens.pushinPay;

    if (platformSettingsResult.error || !platformSettingsResult.data) throw new Error(`Erro/Config. da plataforma não encontradas: ${platformSettingsResult.error?.message}`);
    const platformSettingsData = platformSettingsResult.data;

    const pushInPayApiRequestBody: PushInPayApiRequestBody = { value: amountForPixFromPayload, webhook_url: actualWebhookUrl };
    
    const basePlatformCommission = Math.round(amountForPixFromPayload * (platformSettingsData.platform_commission_percentage ?? 0)) + (platformSettingsData.platform_fixed_fee_in_cents ?? 0);
    let totalPlatformShareForPushInPay = basePlatformCommission + PUSH_IN_PAY_FIXED_FEE_IN_CENTS;
    totalPlatformShareForPushInPay = Math.max(0, Math.min(totalPlatformShareForPushInPay, amountForPixFromPayload));

    if (platformSettingsData.platform_account_id_push_in_pay && totalPlatformShareForPushInPay > 0) {
      pushInPayApiRequestBody.split_rules = [{ account_id: platformSettingsData.platform_account_id_push_in_pay, value: totalPlatformShareForPushInPay }];
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

    const txIdToSave = extractedPixData.id.toLowerCase();
    
    const saleUpdatePayload: Partial<Database['public']['Tables']['sales']['Update']> = {
      push_in_pay_transaction_id: txIdToSave,
      platform_commission_in_cents: totalPlatformShareForPushInPay,
      updated_at: new Date().toISOString(),
    };
    
    const { error: saleUpdateError } = await adminClient
      .from('sales').update(saleUpdatePayload).eq('id', saleId);

    if (saleUpdateError) {
      console.error(`[gerar-pix EF] Erro ao atualizar venda ${saleId}:`, saleUpdateError);
      throw new Error(`Falha ao atualizar a venda com informações do PIX: ${saleUpdateError.message}`);
    }
    
    console.log(`[gerar-pix EF] Venda ${saleId} atualizada. Iniciando verificação para txId ${txIdToSave}...`);
    const { data: verifiedSale, error: verificationError } = await adminClient
      .from('sales').select('id, push_in_pay_transaction_id').eq('push_in_pay_transaction_id', txIdToSave).single();

    if (verificationError || !verifiedSale) {
      console.error(`[gerar-pix EF] FALHA DE VERIFICAÇÃO. A venda com txId ${txIdToSave} não foi encontrada. Erro:`, verificationError);
      const { data: saleByIdForDebug } = await adminClient.from('sales').select('*').eq('id', saleId).single();
      console.error(`[gerar-pix EF] DEBUG: Estado atual da venda pelo ID ${saleId}:`, saleByIdForDebug ? JSON.stringify(saleByIdForDebug) : 'Não encontrada.');
      throw new Error(`Falha de consistência: A venda atualizada não foi encontrada. O webhook falhará.`);
    }

    console.log(`[gerar-pix EF] SUCESSO DE VERIFICAÇÃO. Venda ${verifiedSale.id} encontrada com txId ${verifiedSale.push_in_pay_transaction_id}.`);

    try {
      console.log(`[gerar-pix EF] Enviando evento 'waiting_payment' para UTMify para a venda ID: ${saleId}`);
      const utmifyPayloadForWaiting: UtmifyOrderPayloadForWaitingPayment = {
        orderId: saleId,
        platform: "1Checkout",
        paymentMethod: "pix",
        status: "waiting_payment",
        createdAt: createdSale.created_at,
        approvedDate: null,
        customer: {
          name: payload.customerName, email: payload.customerEmail,
          whatsapp: payload.customerWhatsapp, phone: payload.customerWhatsapp,
          document: null, ip: req.headers.get("x-forwarded-for")?.split(',')[0].trim() || req.headers.get("x-real-ip") || null,
        },
        products: payload.products.map(p => ({
          id: p.productId, name: p.name, quantity: p.quantity,
          priceInCents: p.priceInCents, planId: p.productId, planName: p.name,
        })),
        trackingParameters: {
          src: payload.trackingParameters?.src || null, sck: payload.trackingParameters?.sck || null,
          utm_campaign: payload.trackingParameters?.utm_campaign || null, utm_content: payload.trackingParameters?.utm_content || null,
          utm_medium: payload.trackingParameters?.utm_medium || null, utm_source: payload.trackingParameters?.utm_source || null,
          utm_term: payload.trackingParameters?.utm_term || null,
        },
        commission: {
            totalPriceInCents: payload.value,
            gatewayFeeInCents: totalPlatformShareForPushInPay, 
            userCommissionInCents: payload.value - totalPlatformShareForPushInPay,
            currency: "BRL"
        },
        couponCodeUsed: payload.couponCodeUsed || null,
        discountAppliedInCents: payload.discountAppliedInCents || null,
        originalAmountBeforeDiscountInCents: payload.originalValueBeforeDiscount,
        isTest: false,
      };

      adminClient.functions.invoke('send-utmify-event', {
        body: { payload: utmifyPayloadForWaiting, productOwnerUserId: productOwnerUserId }
      }).then(({ data, error }) => {
        if (error) console.error(`[gerar-pix EF] ERRO (não bloqueante) ao invocar 'send-utmify-event':`, error);
        else console.log(`[gerar-pix EF] 'send-utmify-event' para venda pendente invocado com sucesso. Resposta:`, data);
      });
    } catch (utmifyError) {
      console.error(`[gerar-pix EF] ERRO (não bloqueante) ao construir ou disparar evento para UTMify:`, utmifyError);
    }
    
    // --- START: NEW PIX GENERATED EMAIL LOGIC ---
    try {
        const pixGeneratedEmailConfig = sellerSettingsData.pix_generated_email_config as PixGeneratedEmailConfig | null;
        if (pixGeneratedEmailConfig?.enabled) {
            console.log(`[gerar-pix EF] E-mail de PIX Gerado habilitado para vendedor ${productOwnerUserId}. Preparando para enviar.`);
            const checkoutIdentity = sellerSettingsData.checkout_identity as { brandName?: string } | null;
            const shopName = checkoutIdentity?.brandName || "Nossa Loja";
            const mainProductName = payload.products[0]?.name || 'seu produto';

            const emailBody = pixGeneratedEmailConfig.bodyHtml
              .replace(/{{customer_name}}/g, payload.customerName || 'Cliente')
              .replace(/{{product_name}}/g, mainProductName)
              .replace(/{{order_id}}/g, saleId)
              .replace(/{{pix_copy_paste_code}}/g, extractedPixData.qr_code)
              .replace(/{{pix_qr_code_image_url}}/g, `data:image/png;base64,${rawBase64String}`)
              .replace(/{{shop_name}}/g, shopName);

            const emailSubject = pixGeneratedEmailConfig.subject
              .replace(/{{customer_name}}/g, payload.customerName || 'Cliente')
              .replace(/{{product_name}}/g, mainProductName)
              .replace(/{{order_id}}/g, saleId)
              .replace(/{{shop_name}}/g, shopName);

            const emailPayload = {
              userId: productOwnerUserId,
              to: payload.customerEmail,
              subject: emailSubject,
              htmlBody: emailBody,
              fromName: shopName,
            };
            
            adminClient.functions.invoke('send-email', { body: emailPayload })
              .then(({ data, error }) => {
                  if (error) console.error(`[gerar-pix EF] ERRO (não bloqueante) ao invocar 'send-email' para PIX Gerado:`, error);
                  else console.log(`[gerar-pix EF] 'send-email' para PIX Gerado invocado com sucesso. Resposta:`, data);
              });

        } else {
             console.log(`[gerar-pix EF] E-mail de PIX Gerado desabilitado para vendedor ${productOwnerUserId}.`);
        }
    } catch (emailError) {
        console.error(`[gerar-pix EF] ERRO (não bloqueante) ao preparar e-mail de PIX Gerado:`, emailError);
    }
    // --- END: NEW PIX GENERATED EMAIL LOGIC ---
    
    const finalFrontendResponse: GerarPixEdgeFunctionResponse = {
        success: true, data: { ...extractedPixData, qr_code_base64: rawBase64String },
        saleId: saleId, message: "PIX gerado e venda criada com sucesso."
    };
    return new Response(JSON.stringify(finalFrontendResponse), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (err: any) {
    console.error(`[gerar-pix EF] ERRO CAPTURADO (Owner: ${productOwnerUserIdForLogging || 'N/A'}):`, err.message, err.stack);
    const clientErrorMessage = err.message || "Ocorreu um erro interno.";
    return new Response(JSON.stringify({ success: false, message: clientErrorMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: err.message.startsWith("Gateway de Pagamento:") ? 402 : (err.message.includes("não encontrado") || err.message.includes("obrigatório") || err.message.includes("mal formatada")) ? 400 : 500
    });
  }
})
