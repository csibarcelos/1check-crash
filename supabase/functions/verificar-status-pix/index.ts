
// Caminho: supabase/functions/verificar-status-pix/index.ts

// @ts-ignore
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { Database } from '../_shared/db_types.ts'

// Declare Deno for TypeScript type checking, assuming it's globally available in the Deno runtime.
declare const Deno: any;

interface RequestBody {
  transactionId: string; // PushInPay Transaction ID
  productOwnerUserId: string;
  saleId: string; // <<< NOVO: ID da venda na tabela 'sales'
}

// Interface para os campos essenciais da resposta PIX de status
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

// Interface para a resposta da Edge Function
interface VerifyStatusFunctionResponse {
    success: boolean;
    data?: PushInPayStatusEssentialData; // Status da PushInPay
    saleUpdated?: boolean; // Indica se a venda no DB foi atualizada
    message?: string;
}


serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let productOwnerUserIdForLogging: string | undefined;
  let transactionIdForLogging: string | undefined;
  let saleIdForLogging: string | undefined;

  try {
    const { transactionId, productOwnerUserId, saleId }: RequestBody = await req.json();
    productOwnerUserIdForLogging = productOwnerUserId;
    transactionIdForLogging = transactionId;
    saleIdForLogging = saleId;

    console.log(`[verificar-status-pix] Iniciando para transactionId: ${transactionId}, productOwnerUserId: ${productOwnerUserId}, saleId: ${saleId}`);

    if (!transactionId || !productOwnerUserId || !saleId) { // Verifica saleId
      throw new Error("ID da transação, ID do vendedor e ID da venda são obrigatórios.");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas na Edge Function.");
    }
    
    const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: settings, error: settingsError } = await adminClient
      .from('app_settings')
      .select('api_tokens')
      .eq('platform_user_id', productOwnerUserId)
      .single();

    if (settingsError) throw new Error(`Erro ao buscar configurações do vendedor: ${settingsError.message}`);
    if (!settings) throw new Error(`Configurações de API não encontradas para o vendedor ${productOwnerUserId}.`);
    
    const apiTokens = settings.api_tokens as any;
    const pushinPayToken = apiTokens?.pushinPay;
    const isPushinPayEnabled = apiTokens?.pushinPayEnabled;

    if (!isPushinPayEnabled) throw new Error('Consulta de status PIX (PushInPay) não está habilitada para este vendedor.');
    if (!pushinPayToken || typeof pushinPayToken !== 'string' || pushinPayToken.trim() === '') throw new Error('Token da API PushInPay não configurado ou inválido para este vendedor.');
    
    const pushinPayApiUrl = `https://api.pushinpay.com.br/api/transactions/${transactionId}`;
    console.log(`[verificar-status-pix] Consultando PushInPay: ${pushinPayApiUrl}`);

    const statusResponse = await fetch(pushinPayApiUrl, {
        headers: { 'Authorization': `Bearer ${pushinPayToken}`, 'Accept': 'application/json' }
    });

    const statusDataText = await statusResponse.text();
    let statusDataFromGateway: PushInPayFullStatusApiResponse;
    try { statusDataFromGateway = JSON.parse(statusDataText); } 
    catch (parseError) { throw new Error("Resposta inválida (não JSON) do gateway de pagamento ao verificar status."); }
    
    console.log(`[verificar-status-pix] RAW Response from PushInPay (Status ${statusResponse.status}):`, JSON.stringify(statusDataFromGateway, null, 2));

    if (!statusResponse.ok) {
        const errorMessage = statusDataFromGateway.message || (statusDataFromGateway.errors ? JSON.stringify(statusDataFromGateway.errors) : `Erro ${statusResponse.status} do gateway.`);
        throw new Error(`Gateway de Pagamento: ${errorMessage}`);
    }
    
    let extractedPushInPayData: PushInPayStatusEssentialData | null = null;
    if (statusDataFromGateway.data?.id && statusDataFromGateway.data.status) extractedPushInPayData = statusDataFromGateway.data;
    else if (statusDataFromGateway.id && statusDataFromGateway.status) extractedPushInPayData = { id: statusDataFromGateway.id, status: statusDataFromGateway.status, value: statusDataFromGateway.value, paid_at: statusDataFromGateway.paid_at };
    if (!extractedPushInPayData) throw new Error('Resposta da PushInPay não contém os campos essenciais (id, status).');

    console.log("[verificar-status-pix] Dados extraídos da PushInPay:", JSON.stringify(extractedPushInPayData, null, 2));

    let saleUpdatedInDb = false;
    const pushInPayStatus = extractedPushInPayData.status.toLowerCase();

    if (pushInPayStatus === 'paid' || pushInPayStatus === 'approved') {
        console.log(`[verificar-status-pix] Pagamento confirmado (${pushInPayStatus}). Atualizando venda ID: ${saleId} no banco.`);
        const saleUpdatePayload: Database['public']['Tables']['sales']['Update'] = {
            status: 'paid', // Usar o enum 'paid' da nossa aplicação
            paid_at: extractedPushInPayData.paid_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const { error: dbUpdateError } = await adminClient
            .from('sales')
            .update(saleUpdatePayload)
            .eq('id', saleId);

        if (dbUpdateError) {
            console.error(`[verificar-status-pix] ERRO ao atualizar venda ${saleId} para 'paid':`, dbUpdateError);
            // Não lançar erro aqui, apenas logar e retornar saleUpdatedInDb = false
            // O frontend pode tentar novamente ou alertar o usuário.
        } else {
            saleUpdatedInDb = true;
            console.log(`[verificar-status-pix] Venda ${saleId} atualizada para 'paid' com sucesso.`);
        }
    }

    const finalResponse: VerifyStatusFunctionResponse = {
        success: true,
        data: extractedPushInPayData,
        saleUpdated: saleUpdatedInDb,
        message: saleUpdatedInDb ? "Status verificado e venda atualizada." : "Status verificado."
    };

    return new Response(JSON.stringify(finalResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (err: any) {
    console.error(`[verificar-status-pix] Erro CAPTURADO (transactionId: ${transactionIdForLogging}, productOwnerUserId: ${productOwnerUserIdForLogging}, saleId: ${saleIdForLogging}):`, err.message, err.stack);
    const clientErrorMessage = err.message || "Ocorreu um erro interno ao verificar o status do PIX.";
    return new Response(JSON.stringify({ success: false, message: clientErrorMessage, errorDetail: err.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
    });
  }
})
