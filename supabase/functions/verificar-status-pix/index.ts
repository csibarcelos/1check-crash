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
          .select('id, customer_email, customer_name, products, total_amount_in_cents, platform_user_id, coupon_code_used, discount_applied_in_cents, created_at, paid_at, customer_ip, tracking_parameters, platform_commission_in_cents, original_amount_before_discount_in_cents, customer_whatsapp, upsell_amount_in_cents')
          .eq('id', saleId)
          .single();

        if (fetchUpdatedSaleError || !updatedSaleData) {
          console.warn(`[verificar-status-pix] Não foi possível buscar dados atualizados da venda ${saleId} para ações pós-pagamento. Erro: ${fetchUpdatedSaleError?.message}`);
        } else {
           console.log(`[verificar-status-pix] Ações pós-pagamento para venda ${saleId} (upsell: ${isUpsellTransaction}) serão acionadas...`);

            if (!isUpsellTransaction) {
                console.log("[verificar-status-pix] Disparando e-mail de confirmação para venda principal...");
                // Este é um placeholder. A lógica real de montagem do payload do e-mail seria necessária aqui.
                // await adminClient.functions.invoke('send-email', { body: { /* ... payload do email ... */ } }).catch(e => console.error("[verificar-status-pix] Erro ao invocar send-email:", e));
            }
            console.log("[verificar-status-pix] Disparando evento 'paid' para UTMify...");
            // Este é um placeholder. A lógica real de montagem do payload do UTMify seria necessária aqui.
            // await adminClient.functions.invoke('send-utmify-event', { body: { /* ... payload do utmify ... */ } }).catch(e => console.error("[verificar-status-pix] Erro ao invocar send-utmify-event:", e));
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
