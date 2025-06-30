// Caminho: supabase/functions/verificar-status-pix/index.ts

// @ts-ignore
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts';
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let productOwnerUserIdForLogging: string | undefined;
  let transactionIdForLogging: string | undefined;
  let saleIdForLogging: string | undefined;

  try {
    const { transactionId, productOwnerUserId, saleId, isUpsellTransaction = false }: RequestBody = await req.json();
    productOwnerUserIdForLogging = productOwnerUserId;
    transactionIdForLogging = transactionId;
    saleIdForLogging = saleId;

    console.log(`[verificar-status-pix] Iniciando. TX ID: ${transactionId}, Dono: ${productOwnerUserId}, ID Venda: ${saleId}, É Upsell: ${isUpsellTransaction}`);

    if (!transactionId || !productOwnerUserId || !saleId) {
      throw new Error("ID da transação, ID do vendedor e ID da venda são obrigatórios.");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");

    const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // 1. Obter o token de API da PushInPay do vendedor
    const { data: settings, error: settingsError } = await adminClient.from('app_settings').select('api_tokens').eq('platform_user_id', productOwnerUserId).single();
    if (settingsError || !settings) throw new Error(`Erro ao buscar config. do vendedor: ${settingsError?.message}`);

    const apiTokens = settings.api_tokens as any;
    if (!apiTokens?.pushinPayEnabled || !apiTokens?.pushinPay) throw new Error('PushInPay não habilitado ou token não configurado para o vendedor.');

    // 2. Consultar a API da PushInPay para obter o status AUTORITÁRIO
    const pushinPayApiUrl = `https://api.pushinpay.com.br/api/transactions/${transactionId}`;
    console.log(`[verificar-status-pix] Consultando PushInPay: ${pushinPayApiUrl}`);
    const statusResponse = await fetch(pushinPayApiUrl, { headers: { 'Authorization': `Bearer ${apiTokens.pushinPay}`, 'Accept': 'application/json' } });
    const statusDataFromGateway: PushInPayFullStatusApiResponse = await statusResponse.json();

    console.log(`[verificar-status-pix] Resposta da PushInPay (Status ${statusResponse.status}):`, JSON.stringify(statusDataFromGateway, null, 2));
    if (!statusResponse.ok) throw new Error(`Gateway: ${statusDataFromGateway.message || (statusDataFromGateway.errors ? JSON.stringify(statusDataFromGateway.errors) : `Erro ${statusResponse.status}`)}`);

    const extractedPushInPayData: PushInPayStatusEssentialData | null = statusDataFromGateway.data?.id ? statusDataFromGateway.data : (statusDataFromGateway.id ? { id: statusDataFromGateway.id, status: statusDataFromGateway.status!, value: statusDataFromGateway.value, paid_at: statusDataFromGateway.paid_at } : null);
    if (!extractedPushInPayData) throw new Error('Resposta da PushInPay não contém os campos essenciais.');

    console.log("[verificar-status-pix] Dados extraídos da PushInPay:", JSON.stringify(extractedPushInPayData, null, 2));

    let saleUpdatedInDb = false;
    const pushInPayStatus = extractedPushInPayData.status.toLowerCase();

    // 3. Se o status for PAGO, atualizar o banco de dados e disparar ações
    if (pushInPayStatus === 'paid' || pushInPayStatus === 'approved') {
      const paidAtTimestamp = extractedPushInPayData.paid_at || new Date().toISOString();
      const saleUpdatePayload: Partial<Database['public']['Tables']['sales']['Update']> = { updated_at: new Date().toISOString() };

      if (isUpsellTransaction) {
        console.log(`[verificar-status-pix] Pagamento de UPSELL confirmado. Atualizando upsell_status da venda ${saleId}.`);
        saleUpdatePayload.upsell_status = 'paid';
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

      if (dbUpdateError) {
        console.error(`[verificar-status-pix] ERRO ao atualizar venda ${saleId}:`, dbUpdateError);
      } else {
        saleUpdatedInDb = true;
        console.log(`[verificar-status-pix] Venda ${saleId} atualizada com sucesso no DB.`);

        // 4. Disparar ações pós-pagamento (e-mail, UTMify, etc.)
        const { data: updatedSaleData, error: fetchUpdatedSaleError } = await adminClient
          .from('sales')
          .select('*') // Select all fields for full context
          .eq('id', saleId)
          .single();

        if (fetchUpdatedSaleError || !updatedSaleData) {
          console.warn(`[verificar-status-pix] Não foi possível buscar dados atualizados da venda ${saleId} para ações pós-pagamento. Erro: ${fetchUpdatedSaleError?.message}`);
        } else {
            console.log(`[verificar-status-pix] Ações pós-pagamento para venda ${saleId} (upsell: ${isUpsellTransaction}) serão acionadas...`);
            
            // --- INÍCIO: Lógica para enviar evento PAGO para UTMify ---
            try {
              if (isUpsellTransaction) {
                console.log(`[verificar-status-pix] Disparando evento de UPSELL PAGO para a UTMify para a venda original ID: ${saleId}`);
                const upsellProduct = (updatedSaleData.products as any[]).find(p => p.isUpsell === true);

                if (upsellProduct) {
                  const upsellPayload = {
                    originalSaleId: saleId,
                    upsellProductId: upsellProduct.productId,
                    upsellPriceInCents: updatedSaleData.upsell_amount_in_cents || upsellProduct.priceInCents,
                  };
                  
                  adminClient.functions.invoke('send-upsell-utmify-event', { body: upsellPayload })
                    .then(({ data, error }) => {
                      if (error) console.error(`[verificar-status-pix] ERRO ao invocar 'send-upsell-utmify-event':`, error);
                      else console.log(`[verificar-status-pix] 'send-upsell-utmify-event' invocado com sucesso. Resposta:`, data);
                    });
                } else {
                  console.warn(`[verificar-status-pix] Transação de upsell PAGA, mas nenhum produto de upsell encontrado na venda ${saleId}.`);
                }

              } else {
                console.log(`[verificar-status-pix] Disparando evento de VENDA PRINCIPAL PAGA para a UTMify para a venda ID: ${saleId}`);
                
                // Constrói o payload para UTMify a partir dos dados da venda já atualizados
                const utmifyPayload = {
                  orderId: updatedSaleData.id,
                  platform: "1Checkout",
                  paymentMethod: updatedSaleData.payment_method,
                  status: 'paid',
                  createdAt: updatedSaleData.created_at,
                  approvedDate: updatedSaleData.paid_at || new Date().toISOString(),
                  customer: {
                    name: updatedSaleData.customer_name,
                    email: updatedSaleData.customer_email,
                    whatsapp: updatedSaleData.customer_whatsapp,
                    ip: updatedSaleData.customer_ip,
                  },
                  products: (updatedSaleData.products as any[]).map(p => ({
                    id: p.productId,
                    planId: p.productId,
                    name: p.name,
                    quantity: p.quantity,
                    priceInCents: p.priceInCents,
                    planName: p.name
                  })),
                  trackingParameters: updatedSaleData.tracking_parameters,
                  couponCodeUsed: updatedSaleData.coupon_code_used,
                  discountAppliedInCents: updatedSaleData.discount_applied_in_cents,
                  originalAmountBeforeDiscountInCents: updatedSaleData.original_amount_before_discount_in_cents,
                  commission: {
                      totalPriceInCents: updatedSaleData.total_amount_in_cents,
                      gatewayFeeInCents: updatedSaleData.platform_commission_in_cents || 0,
                      userCommissionInCents: updatedSaleData.total_amount_in_cents - (updatedSaleData.platform_commission_in_cents || 0),
                      currency: "BRL",
                  },
                  isTest: false,
                };
                
                adminClient.functions.invoke('send-utmify-event', {
                  body: { 
                    payload: utmifyPayload, 
                    productOwnerUserId: updatedSaleData.platform_user_id 
                  }
                })
                .then(({ data, error }) => {
                  if (error) console.error(`[verificar-status-pix] ERRO ao invocar 'send-utmify-event':`, error);
                  else console.log(`[verificar-status-pix] 'send-utmify-event' para venda PAGA invocado com sucesso. Resposta:`, data);
                });
              }
            } catch (utmifyError: any) {
                console.error(`[verificar-status-pix] ERRO ao construir ou disparar evento para UTMify:`, utmifyError.message);
            }
            // --- FIM: Lógica UTMify ---

            if (!isUpsellTransaction) {
              console.log("[verificar-status-pix] Verificando e-mails de entrega para venda principal...");
              
              const saleProducts = updatedSaleData.products as unknown as Array<{ productId: string, name: string }>;

              for (const saleProduct of saleProducts) {
                  const { data: productDetails, error: productDetailsError } = await adminClient
                      .from('products')
                      .select('post_purchase_email_config, delivery_url, name')
                      .eq('id', saleProduct.productId)
                      .single();

                  if (productDetailsError || !productDetails) {
                      console.warn(`[verificar-status-pix] Não foi possível buscar detalhes do produto ${saleProduct.productId} para e-mail.`);
                      continue; 
                  }

                  const emailConfig = productDetails.post_purchase_email_config as any;

                  if (emailConfig?.delivery?.enabled) {
                      console.log(`[verificar-status-pix] E-mail de entrega habilitado para o produto ${productDetails.name}. Preparando para enviar.`);

                      const { data: appSettings } = await adminClient.from('app_settings').select('checkout_identity').eq('platform_user_id', updatedSaleData.platform_user_id).single();
                      const shopName = (appSettings?.checkout_identity as any)?.brandName || 'Sua Loja';

                      const emailBody = (emailConfig.delivery.bodyHtml || '')
                          .replace(/{{customer_name}}/g, updatedSaleData.customer_name || 'Cliente')
                          .replace(/{{product_name}}/g, productDetails.name || 'seu produto')
                          .replace(/{{order_id}}/g, updatedSaleData.id)
                          .replace(/{{product_delivery_url}}/g, productDetails.delivery_url || '#')
                          .replace(/{{shop_name}}/g, shopName);
                          
                      const emailSubject = (emailConfig.delivery.subject || '')
                          .replace(/{{customer_name}}/g, updatedSaleData.customer_name || 'Cliente')
                          .replace(/{{product_name}}/g, productDetails.name || 'seu produto')
                          .replace(/{{order_id}}/g, updatedSaleData.id)
                          .replace(/{{shop_name}}/g, shopName);

                      const emailPayload = {
                          userId: updatedSaleData.platform_user_id,
                          to: updatedSaleData.customer_email,
                          subject: emailSubject,
                          htmlBody: emailBody,
                          fromName: shopName,
                      };

                      adminClient.functions.invoke('send-email', { body: emailPayload })
                          .then(({ data, error }) => {
                              if (error) console.error(`[verificar-status-pix] ERRO ao invocar 'send-email' para ${updatedSaleData.customer_email} (Produto: ${productDetails.name}):`, error);
                              else console.log(`[verificar-status-pix] 'send-email' invocado com sucesso para ${updatedSaleData.customer_email} (Produto: ${productDetails.name}). Resposta:`, data);
                          });
                  }
              }

              // --- INÍCIO: Lógica para criar/atualizar cliente ---
              try {
                console.log(`[verificar-status-pix] Iniciando upsert do cliente para a venda ${saleId}.`);
                const { data: existingCustomer, error: fetchCustomerError } = await adminClient
                  .from('customers')
                  .select('*')
                  .eq('platform_user_id', updatedSaleData.platform_user_id)
                  .eq('email', updatedSaleData.customer_email)
                  .maybeSingle();

                if (fetchCustomerError) {
                  console.error(`[verificar-status-pix] Erro ao buscar cliente existente para a venda ${saleId}:`, fetchCustomerError.message);
                } else {
                  const saleEffectiveDate = updatedSaleData.paid_at || new Date().toISOString();
                  const purchasedProductIds = (updatedSaleData.products as any[]).map(p => p.productId);

                  if (existingCustomer) {
                    const updates = {
                      name: updatedSaleData.customer_name || existingCustomer.name,
                      whatsapp: updatedSaleData.customer_whatsapp || existingCustomer.whatsapp,
                      products_purchased: Array.from(new Set([...(existingCustomer.products_purchased || []), ...purchasedProductIds])),
                      last_purchase_date: saleEffectiveDate,
                      total_orders: (existingCustomer.total_orders || 0) + 1,
                      total_spent_in_cents: (existingCustomer.total_spent_in_cents || 0) + updatedSaleData.total_amount_in_cents,
                      sale_ids: Array.from(new Set([...(existingCustomer.sale_ids || []), saleId])),
                      updated_at: new Date().toISOString(),
                    };
                    const { error: updateCustomerError } = await adminClient.from('customers').update(updates).eq('id', existingCustomer.id);
                    if (updateCustomerError) console.error(`[verificar-status-pix] Erro ao ATUALIZAR cliente para a venda ${saleId}:`, updateCustomerError.message);
                    else console.log(`[verificar-status-pix] Cliente ${existingCustomer.id} atualizado com sucesso.`);
                  } else {
                    const { error: createCustomerError } = await adminClient.from('customers').insert({
                      id: crypto.randomUUID(),
                      platform_user_id: updatedSaleData.platform_user_id,
                      name: updatedSaleData.customer_name,
                      email: updatedSaleData.customer_email,
                      whatsapp: updatedSaleData.customer_whatsapp,
                      products_purchased: purchasedProductIds,
                      funnel_stage: 'customer',
                      first_purchase_date: saleEffectiveDate,
                      last_purchase_date: saleEffectiveDate,
                      total_orders: 1,
                      total_spent_in_cents: updatedSaleData.total_amount_in_cents,
                      sale_ids: [saleId],
                    });
                    if (createCustomerError) console.error(`[verificar-status-pix] Erro ao CRIAR cliente para a venda ${saleId}:`, createCustomerError.message);
                    else console.log(`[verificar-status-pix] Novo cliente criado com sucesso para a venda ${saleId}.`);
                  }
                }
              } catch (customerUpsertError: any) {
                console.error(`[verificar-status-pix] ERRO (não bloqueante) durante o upsert do cliente:`, customerUpsertError.message);
              }
              // --- FIM: Lógica para criar/atualizar cliente ---
            }
        }
      }
    }

    const finalResponse: VerifyStatusFunctionResponse = {
      success: true, data: extractedPushInPayData, saleUpdated: saleUpdatedInDb,
      message: saleUpdatedInDb ? "Status verificado e venda atualizada." : "Status verificado, sem alterações necessárias no DB."
    };
    return new Response(JSON.stringify(finalResponse), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (err: any) {
    console.error(`[verificar-status-pix] ERRO CAPTURADO (TX: ${transactionIdForLogging}, Dono: ${productOwnerUserIdForLogging}, Venda: ${saleIdForLogging}):`, err.message, err.stack);
    return new Response(JSON.stringify({ success: false, message: err.message || "Erro interno." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
    });
  }
});
