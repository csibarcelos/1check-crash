
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
  transactionId: string;
  productOwnerUserId: string;
}

// Interface para os campos essenciais da resposta PIX de status
interface PushInPayStatusEssentialData {
    id: string;
    status: string;
    value?: number; // Value might not always be present in status checks, but status is key
    paid_at?: string;
    // Add any other fields you expect directly within the data object for status
}

// Interface para a resposta completa da PushInPay para consulta de status
interface PushInPayFullStatusApiResponse {
    data?: PushInPayStatusEssentialData; // Para estrutura aninhada (conforme docs)
    id?: string;                          // Para estrutura plana (como fallback)
    status?: string;
    value?: number;
    paid_at?: string;
    // Outros campos que a PushInPay pode retornar no nível raiz para status
    success?: boolean; // Se a API da PushInPay usa isso
    message?: string;
    errors?: any;
}


serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let productOwnerUserIdForLogging: string | undefined;
  let transactionIdForLogging: string | undefined;

  try {
    const { transactionId, productOwnerUserId }: RequestBody = await req.json();
    productOwnerUserIdForLogging = productOwnerUserId;
    transactionIdForLogging = transactionId;

    console.log(`[verificar-status-pix] Iniciando para transactionId: ${transactionId}, productOwnerUserId: ${productOwnerUserId}`);

    if (!transactionId || !productOwnerUserId) {
      throw new Error("ID da transação e ID do vendedor são obrigatórios.");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas na Edge Function.");
    }
    
    const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);

    const { data: settings, error: settingsError } = await adminClient
      .from('app_settings')
      .select('api_tokens')
      .eq('platform_user_id', productOwnerUserId)
      .single();

    if (settingsError) {
      console.error(`[verificar-status-pix] Erro ao buscar app_settings do vendedor ${productOwnerUserId}:`, settingsError);
      throw new Error(`Erro ao buscar configurações do vendedor: ${settingsError.message}`);
    }
    if (!settings) {
      throw new Error(`Configurações de API não encontradas para o vendedor ${productOwnerUserId}.`);
    }
    
    const apiTokens = settings.api_tokens as any; // Cast to any for dynamic access
    const pushinPayToken = apiTokens?.pushinPay;
    const isPushinPayEnabled = apiTokens?.pushinPayEnabled;

    if (!isPushinPayEnabled) {
      throw new Error('Consulta de status PIX (PushInPay) não está habilitada para este vendedor.');
    }
    if (!pushinPayToken || typeof pushinPayToken !== 'string' || pushinPayToken.trim() === '') {
      throw new Error('Token da API PushInPay não configurado ou inválido para este vendedor.');
    }
    console.log(`[verificar-status-pix] Token PushInPay do vendedor obtido.`);

    const pushinPayApiUrl = `https://api.pushinpay.com.br/api/transactions/${transactionId}`;
    console.log(`[verificar-status-pix] Consultando PushInPay: ${pushinPayApiUrl}`);

    const statusResponse = await fetch(pushinPayApiUrl, {
        headers: { 
            'Authorization': `Bearer ${pushinPayToken}`,
            'Accept': 'application/json'
        }
    });

    const statusDataText = await statusResponse.text();
    let statusData: PushInPayFullStatusApiResponse;
    try {
        statusData = JSON.parse(statusDataText);
    } catch (parseError) {
        console.error("[verificar-status-pix] Erro ao fazer parse da resposta JSON da PushInPay:", statusDataText, parseError);
        throw new Error("Resposta inválida (não JSON) do gateway de pagamento ao verificar status.");
    }
    
    console.log(`[verificar-status-pix] RAW Response from PushInPay for status check (Status ${statusResponse.status}):`, JSON.stringify(statusData, null, 2));

    if (!statusResponse.ok) {
        const errorMessage = statusData.message || (statusData.errors ? JSON.stringify(statusData.errors) : `Erro ${statusResponse.status} do gateway de pagamento.`);
        console.error(`[verificar-status-pix] Erro da API PushInPay (Status ${statusResponse.status}): ${errorMessage}`);
        throw new Error(`Gateway de Pagamento: ${errorMessage}`);
    }
    
    let responseDataToFrontend: PushInPayStatusEssentialData | null = null;

    // Prioritize statusData.data if it looks valid for a status response
    if (statusData && statusData.data && typeof statusData.data === 'object' && statusData.data.id && statusData.data.status) {
      responseDataToFrontend = statusData.data;
      console.log("[verificar-status-pix] Usando dados do sub-objeto 'data' da PushInPay para o frontend.");
    } 
    // Fallback to root if it looks valid for a status response
    else if (statusData && statusData.id && statusData.status) {
      responseDataToFrontend = {
          id: statusData.id,
          status: statusData.status,
          value: statusData.value,
          paid_at: statusData.paid_at,
          // Map other relevant fields from root to responseDataToFrontend if needed
      };
      console.log("[verificar-status-pix] Usando dados da raiz da resposta da PushInPay para o frontend.");
    }

    if (!responseDataToFrontend) {
      console.error("[verificar-status-pix] Resposta da PushInPay não contém os campos essenciais (id, status) em nenhuma estrutura reconhecida:", statusData);
      throw new Error('Resposta inválida do gateway de pagamento ao verificar status. Dados essenciais ausentes.');
    }

    console.log("[verificar-status-pix] Dados que serão enviados ao frontend:", JSON.stringify(responseDataToFrontend, null, 2));

    return new Response(JSON.stringify({ success: true, data: responseDataToFrontend }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (err: any) {
    console.error(`[verificar-status-pix] Erro CAPTURADO na Edge Function (transactionId: ${transactionIdForLogging}, productOwnerUserId: ${productOwnerUserIdForLogging}):`, err.message, err.stack);
    const clientErrorMessage = err.message || "Ocorreu um erro interno ao tentar verificar o status do PIX.";
    return new Response(JSON.stringify({ success: false, message: clientErrorMessage, errorDetail: err.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
    });
  }
})
