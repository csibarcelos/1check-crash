
// Caminho: supabase/functions/verificar-status-pix/index.ts

// @ts-ignore
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { Database } from '../_shared/db_types.ts'

declare const Deno: any;

interface RequestBody {
  transactionId: string; 
  productOwnerUserId: string;
  saleId: string; 
  isUpsellTransaction?: boolean; 
}

interface PushInPayStatusEssentialData {
    id: string;
    status: string;
    value?: number; 
    paid_at?: string;
}

interface PushInPayFullStatusApiResponse {
    data?: PushInPayStatusEssentialData; 
    id?: string;                         
    status?: string;
    value?: number;
    paid_at?: string;
    success?: boolean; 
    message?: string;
    errors?: any;
}

interface VerifyStatusFunctionResponse {
    success: boolean;
    data?: PushInPayStatusEssentialData; 
    saleUpdated?: boolean; 
    message?: string;
}

interface UtmifyOrderPayloadForPaidEvent {
    orderId: string;
    platform: string;
    paymentMethod: "pix" | "credit_card" | "boleto";
    status: "paid"; // Specific to this event
    createdAt: string;
    approvedDate: string; // Specific to this event, not null
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
}


serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let productOwnerUserIdForLogging: string | undefined;
  let transactionIdForLogging: string | undefined;
  let saleIdForLogging: string | undefined;

  try {
    const { transactionId, productOwnerUserId, saleId, isUpsellTransaction = false }: RequestBody = await req.json(); 
    productOwnerUserIdForLogging = productOwnerUserId;
    transactionIdForLogging = transactionId;
    saleIdForLogging = saleId;

    console.log(`[verificar-status-pix] Iniciando. TX ID: ${transactionId}, Owner: ${productOwnerUserId}, SaleID: ${saleId}, IsUpsell: ${isUpsellTransaction}`);

    if (!transactionId || !productOwnerUserId || !saleId) {
      throw new Error("ID da transação, ID do vendedor e ID da venda são obrigatórios.");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");
    
    const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: settings, error: settingsError } = await adminClient.from('app_settings').select('api_tokens').eq('platform_user_id', productOwnerUserId).single();
    if (settingsError || !settings) throw new Error(`Erro/Config. do vendedor não encontradas: ${settingsError?.message}`);
    
    const apiTokens = settings.api_tokens as any;
    if (!apiTokens?.pushinPayEnabled || !apiTokens?.pushinPay) throw new Error('PushInPay não habilitado ou token não configurado para o vendedor.');
    
    const pushinPayApiUrl = `https://api.pushinpay.com.br/api/transactions/${transactionId}`;
    console.log(`[verificar-status-pix] Consultando PushInPay: ${pushinPayApiUrl}`);
    const statusResponse = await fetch(pushinPayApiUrl, { headers: { 'Authorization': `Bearer ${apiTokens.pushinPay}`, 'Accept': 'application/json' } });
    const statusDataText = await statusResponse.text();
    let statusDataFromGateway: PushInPayFullStatusApiResponse;
    try { statusDataFromGateway = JSON.parse(statusDataText); } catch (parseError) { throw new Error("Resposta inválida (não JSON) do gateway."); }
    
    console.log(`[verificar-status-pix] RAW PushInPay Response (Status ${statusResponse.status}):`, JSON.stringify(statusDataFromGateway, null, 2));
    if (!statusResponse.ok) throw new Error(`Gateway: ${statusDataFromGateway.message || (statusDataFromGateway.errors ? JSON.stringify(statusDataFromGateway.errors) : `Erro ${statusResponse.status}`)}`);
    
    let extractedPushInPayData: PushInPayStatusEssentialData | null = null;
    if (statusDataFromGateway.data?.id && statusDataFromGateway.data.status) extractedPushInPayData = statusDataFromGateway.data;
    else if (statusDataFromGateway.id && statusDataFromGateway.status) extractedPushInPayData = { id: statusDataFromGateway.id, status: statusDataFromGateway.status, value: statusDataFromGateway.value, paid_at: statusDataFromGateway.paid_at };
    if (!extractedPushInPayData) throw new Error('PushInPay response missing essential fields.');

    console.log("[verificar-status-pix] Dados extraídos da PushInPay:", JSON.stringify(extractedPushInPayData, null, 2));

    let saleUpdatedInDb = false;
    const pushInPayStatus = extractedPushInPayData.status.toLowerCase();

    if (pushInPayStatus === 'paid' || pushInPayStatus === 'approved') {
        const paidAtTimestamp = extractedPushInPayData.paid_at || new Date().toISOString();
        const saleUpdatePayload: Partial<Database['public']['Tables']['sales']['Update']> = { updated_at: new Date().toISOString() };

        if (isUpsellTransaction) {
            console.log(`[verificar-status-pix] Pagamento de UPSELL confirmado. Atualizando upsell_status da venda ${saleId}.`);
            saleUpdatePayload.upsell_status = 'paid';
        } else {
            console.log(`[verificar-status-pix] Pagamento PRINCIPAL confirmado. Atualizando status e paid_at da venda ${saleId}.`);
            saleUpdatePayload.status = 'paid';
            saleUpdatePayload.paid_at = paidAtTimestamp;
        }

        const { error: dbUpdateError } = await adminClient
            .from('sales')
            .update(saleUpdatePayload as Database['public']['Tables']['sales']['Update'])
            .eq('id', saleId);

        if (dbUpdateError) console.error(`[verificar-status-pix] ERRO ao atualizar venda ${saleId}:`, dbUpdateError);
        else { 
            saleUpdatedInDb = true; 
            console.log(`[verificar-status-pix] Venda ${saleId} atualizada com sucesso.`); 
            
            if (!isUpsellTransaction) {
                console.log(`[verificar-status-pix] Pagamento PRINCIPAL confirmado. Buscando detalhes da venda ${saleId} para enviar à UTMify.`);
                const { data: paidSaleRecord, error: paidSaleFetchError } = await adminClient
                    .from('sales')
                    .select('id, platform_user_id, created_at, paid_at, customer_name, customer_email, customer_whatsapp, customer_ip, tracking_parameters, products, total_amount_in_cents, original_amount_before_discount_in_cents, discount_applied_in_cents, coupon_code_used, platform_commission_in_cents')
                    .eq('id', saleId)
                    .single();

                if (paidSaleFetchError || !paidSaleRecord) {
                    console.error(`[verificar-status-pix] ERRO ao buscar venda PAGA ${saleId} para UTMify:`, paidSaleFetchError?.message);
                } else {
                    const productsForUtmify = (paidSaleRecord.products as unknown as Array<{ productId: string; name: string; quantity: number; priceInCents: number; }>).map(p => ({
                        id: p.productId, name: p.name, quantity: p.quantity, priceInCents: p.priceInCents,
                        planId: p.productId, planName: p.name,
                    }));

                    const gatewayFeeForUtmify = paidSaleRecord.platform_commission_in_cents || 0; // This now includes the 30-cent PushInPay fee
                    const trackingParamsFromDb = paidSaleRecord.tracking_parameters as any;

                    const utmifyPayloadForPaid: UtmifyOrderPayloadForPaidEvent = {
                        orderId: paidSaleRecord.id, platform: "1Checkout", paymentMethod: "pix", status: "paid",
                        createdAt: paidSaleRecord.created_at, approvedDate: paidSaleRecord.paid_at || paidAtTimestamp, 
                        customer: {
                            name: paidSaleRecord.customer_name, email: paidSaleRecord.customer_email,
                            whatsapp: paidSaleRecord.customer_whatsapp, phone: paidSaleRecord.customer_whatsapp || null,
                            document: null, ip: paidSaleRecord.customer_ip || null,
                        },
                        products: productsForUtmify,
                        trackingParameters: {
                            src: trackingParamsFromDb?.src || null,
                            sck: trackingParamsFromDb?.sck || null,
                            utm_source: trackingParamsFromDb?.utm_source || null,
                            utm_medium: trackingParamsFromDb?.utm_medium || null,
                            utm_campaign: trackingParamsFromDb?.utm_campaign || null,
                            utm_term: trackingParamsFromDb?.utm_term || null,
                            utm_content: trackingParamsFromDb?.utm_content || null,
                        },
                        commission: {
                            totalPriceInCents: paidSaleRecord.total_amount_in_cents,
                            gatewayFeeInCents: gatewayFeeForUtmify,
                            userCommissionInCents: paidSaleRecord.total_amount_in_cents - gatewayFeeForUtmify,
                            currency: "BRL",
                        },
                        isTest: false,
                        couponCodeUsed: paidSaleRecord.coupon_code_used || null,
                        discountAppliedInCents: paidSaleRecord.discount_applied_in_cents || null,
                        originalAmountBeforeDiscountInCents: paidSaleRecord.original_amount_before_discount_in_cents,
                    };
                    
                    console.log(`[verificar-status-pix] Invocando 'send-utmify-event' para venda PAGA ${paidSaleRecord.id}...`);
                    const { error: utmifyPaidError } = await adminClient.functions.invoke(
                        'send-utmify-event',
                        { body: { payload: utmifyPayloadForPaid, productOwnerUserId: paidSaleRecord.platform_user_id } }
                    );
                    if (utmifyPaidError) console.warn(`[verificar-status-pix] Falha ao enviar evento 'paid' para UTMify para venda ${paidSaleRecord.id}:`, utmifyPaidError.message);
                    else console.log(`[verificar-status-pix] Evento 'paid' para UTMify enviado com sucesso para venda ${paidSaleRecord.id}.`);
                }
            }
        }
    }

    const finalResponse: VerifyStatusFunctionResponse = {
        success: true, data: extractedPushInPayData, saleUpdated: saleUpdatedInDb,
        message: saleUpdatedInDb ? "Status verificado e venda atualizada." : "Status verificado."
    };
    return new Response(JSON.stringify(finalResponse), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (err: any) {
    console.error(`[verificar-status-pix] ERRO CAPTURADO (TX: ${transactionIdForLogging}, Owner: ${productOwnerUserIdForLogging}, Sale: ${saleIdForLogging}):`, err.message, err.stack);
    return new Response(JSON.stringify({ success: false, message: err.message || "Erro interno.", errorDetail: err.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
})
