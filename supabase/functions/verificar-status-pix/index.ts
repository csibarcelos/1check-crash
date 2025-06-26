
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
            // Add upsell amount to the sale record if not already set (or if it needs to be confirmed)
            // The value from PushInPay (`extractedPushInPayData.value`) is the amount of the upsell transaction.
            saleUpdatePayload.upsell_amount_in_cents = extractedPushInPayData.value; 
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
            
            // ****************************************************************
            // ** INÍCIO DO BLOCO DE ENVIO DE E-MAIL E TRACKING UTMIFY **
            // ****************************************************************
            
            // Buscar dados atualizados da venda para montar o e-mail e payload do UTMify
            const { data: updatedSaleDataForEmailAndUtmify, error: fetchUpdatedSaleError } = await adminClient
                .from('sales')
                .select('id, customer_email, customer_name, products, total_amount_in_cents, platform_user_id, coupon_code_used, discount_applied_in_cents, created_at, paid_at, customer_ip, tracking_parameters, platform_commission_in_cents, original_amount_before_discount_in_cents, customer_whatsapp')
                .eq('id', saleId)
                .single();

            if (fetchUpdatedSaleError || !updatedSaleDataForEmailAndUtmify) {
                console.warn(`[verificar-status-pix] Não foi possível buscar dados atualizados da venda ${saleId} para e-mail/UTMify. Email e UTMify não enviados. Erro: ${fetchUpdatedSaleError?.message}`);
            } else {
                // --- Bloco de Envio de E-mail (APENAS para venda principal) ---
                if (!isUpsellTransaction) {
                    console.log(`[verificar-status-pix] Preparando para enviar email de confirmação para venda principal ${saleId}.`);
                    
                    const emailSubject = `Confirmação do Pedido #${saleId.substring(0, 8)}`;
                    
                    const productsListHtml = (updatedSaleDataForEmailAndUtmify.products as any[])
                        .map((p: { name: string; quantity: number; priceInCents: number; isUpsell?: boolean; isTraditionalOrderBump?: boolean; }) => 
                            `<li>${p.name} ${p.isUpsell ? '(Oferta Extra)' : p.isTraditionalOrderBump ? '(Adicional)' : ''} (Qtd: ${p.quantity}) - R\$ ${(p.priceInCents / 100).toFixed(2).replace('.', ',')}</li>`
                        ).join('');

                    let discountHtml = '';
                    if (updatedSaleDataForEmailAndUtmify.discount_applied_in_cents && updatedSaleDataForEmailAndUtmify.discount_applied_in_cents > 0) {
                        const discountValue = (updatedSaleDataForEmailAndUtmify.discount_applied_in_cents / 100).toFixed(2).replace('.', ',');
                        discountHtml = `<p>Desconto Aplicado (${updatedSaleDataForEmailAndUtmify.coupon_code_used || 'Automático'}): - R$ ${discountValue}</p>`;
                    }

                    const emailHtmlBody = `
                        <h1>Olá ${updatedSaleDataForEmailAndUtmify.customer_name},</h1>
                        <p>Obrigado pelo seu pedido!</p>
                        <p><strong>Detalhes do Pedido:</strong></p>
                        <ul>${productsListHtml}</ul>
                        ${discountHtml}
                        <p><strong>Total: R$ ${(updatedSaleDataForEmailAndUtmify.total_amount_in_cents / 100).toFixed(2).replace('.', ',')}</strong></p>
                        <p>Em breve você receberá mais informações sobre o acesso aos seus produtos.</p>
                        <br/>
                        <p>Atenciosamente,</p>
                        <p>Equipe da Sua Loja</p> 
                    `;

                    let fromNameForEmail = "Sua Loja"; // Nome padrão
                    const { data: ownerAppSettings, error: ownerSettingsError } = await adminClient
                        .from('app_settings')
                        .select('checkout_identity')
                        .eq('platform_user_id', updatedSaleDataForEmailAndUtmify.platform_user_id)
                        .single();
                    
                    if (ownerSettingsError) {
                        console.warn(`[verificar-status-pix] Aviso: Não foi possível buscar checkout_identity para o nome da loja no email (user: ${updatedSaleDataForEmailAndUtmify.platform_user_id}). Usando nome padrão. Erro: ${ownerSettingsError.message}`);
                    } else if (ownerAppSettings && ownerAppSettings.checkout_identity) {
                        const checkoutIdentity = ownerAppSettings.checkout_identity as any;
                        // Tenta usar um campo 'storeName' se existir, ou 'brandName', ou um fallback
                        fromNameForEmail = checkoutIdentity?.storeName || checkoutIdentity?.brandName || fromNameForEmail;
                    }

                    console.log(`[verificar-status-pix] Tentando invocar 'send-email' para ${updatedSaleDataForEmailAndUtmify.customer_email}`);
                    const { data: emailSendData, error: emailSendError } = await adminClient.functions.invoke('send-email', {
                        body: {
                            userId: updatedSaleDataForEmailAndUtmify.platform_user_id,
                            to: updatedSaleDataForEmailAndUtmify.customer_email,
                            subject: emailSubject,
                            htmlBody: emailHtmlBody,
                            fromName: fromNameForEmail,
                        }
                    });

                    if (emailSendError) {
                        console.error(`[verificar-status-pix] Erro ao tentar enviar email de confirmação para ${updatedSaleDataForEmailAndUtmify.customer_email}:`, emailSendError.message, emailSendError);
                    } else {
                        console.log(`[verificar-status-pix] Tentativa de envio de email de confirmação para ${updatedSaleDataForEmailAndUtmify.customer_email} feita. Resposta da função 'send-email':`, emailSendData);
                    }
                }
                // --- Fim do Bloco de Envio de E-mail ---

                // --- Bloco de Envio para UTMify (para VENDA PRINCIPAL PAGA ou UPSELL PAGO) ---
                // Se for upsell, o evento de upsell para UTMify será enviado pela função send-upsell-utmify-event.
                // Aqui, tratamos apenas o evento de "paid" para a venda principal.
                if (!isUpsellTransaction) {
                    console.log(`[verificar-status-pix] Pagamento PRINCIPAL confirmado. Enviando evento para UTMify (venda ${updatedSaleDataForEmailAndUtmify.id}).`);
                    const productsForUtmify = (updatedSaleDataForEmailAndUtmify.products as unknown as Array<{ productId: string; name: string; quantity: number; priceInCents: number; }>).map(p => ({
                        id: p.productId, name: p.name, quantity: p.quantity, priceInCents: p.priceInCents,
                        planId: p.productId, planName: p.name,
                    }));

                    const gatewayFeeForUtmify = updatedSaleDataForEmailAndUtmify.platform_commission_in_cents || 0;
                    const trackingParamsFromDb = updatedSaleDataForEmailAndUtmify.tracking_parameters as any;

                    const utmifyPayloadForPaid: UtmifyOrderPayloadForPaidEvent = {
                        orderId: updatedSaleDataForEmailAndUtmify.id, platform: "1Checkout", paymentMethod: "pix", status: "paid",
                        createdAt: updatedSaleDataForEmailAndUtmify.created_at, approvedDate: updatedSaleDataForEmailAndUtmify.paid_at || paidAtTimestamp, 
                        customer: {
                            name: updatedSaleDataForEmailAndUtmify.customer_name, email: updatedSaleDataForEmailAndUtmify.customer_email,
                            whatsapp: updatedSaleDataForEmailAndUtmify.customer_whatsapp, phone: updatedSaleDataForEmailAndUtmify.customer_whatsapp || null,
                            document: null, ip: updatedSaleDataForEmailAndUtmify.customer_ip || null,
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
                            totalPriceInCents: updatedSaleDataForEmailAndUtmify.total_amount_in_cents,
                            gatewayFeeInCents: gatewayFeeForUtmify,
                            userCommissionInCents: updatedSaleDataForEmailAndUtmify.total_amount_in_cents - gatewayFeeForUtmify,
                            currency: "BRL",
                        },
                        isTest: false,
                        couponCodeUsed: updatedSaleDataForEmailAndUtmify.coupon_code_used || null,
                        discountAppliedInCents: updatedSaleDataForEmailAndUtmify.discount_applied_in_cents || null,
                        originalAmountBeforeDiscountInCents: updatedSaleDataForEmailAndUtmify.original_amount_before_discount_in_cents,
                    };
                    
                    console.log(`[verificar-status-pix] Invocando 'send-utmify-event' para venda PAGA ${updatedSaleDataForEmailAndUtmify.id}...`);
                    const { error: utmifyPaidError } = await adminClient.functions.invoke(
                        'send-utmify-event',
                        { body: { payload: utmifyPayloadForPaid, productOwnerUserId: updatedSaleDataForEmailAndUtmify.platform_user_id } }
                    );
                    if (utmifyPaidError) console.warn(`[verificar-status-pix] Falha ao enviar evento 'paid' para UTMify para venda ${updatedSaleDataForEmailAndUtmify.id}:`, utmifyPaidError.message);
                    else console.log(`[verificar-status-pix] Evento 'paid' para UTMify enviado com sucesso para venda ${updatedSaleDataForEmailAndUtmify.id}.`);
                }
                 // --- Fim do Bloco de Envio para UTMify (VENDA PRINCIPAL) ---
            }
             // ****************************************************************
            // ** FIM DO BLOCO DE ENVIO DE E-MAIL E TRACKING UTMIFY **
            // ****************************************************************
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
