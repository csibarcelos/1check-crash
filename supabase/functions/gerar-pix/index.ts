
// Caminho: supabase/functions/gerar-pix/index.ts

// @ts-ignore
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2' // Certifique-se que a versão é compatível com seu projeto
import { corsHeaders } from '../_shared/cors.ts'
import { Database } from '../_shared/db_types.ts' // Tipos gerados pelo Supabase

// Declare Deno para o TypeScript, pois ele é global no ambiente Deno.
declare const Deno: any;

interface FrontendPixPayload {
  value: number; // Valor total da transação em centavos
  originalValueBeforeDiscount: number;
  webhook_url: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  products: {
    productId: string;
    name: string;
    quantity: number;
    priceInCents: number;
    originalPriceInCents: number;
    isOrderBump?: boolean;
    isUpsell?: boolean;
  }[];
  trackingParameters?: Record<string, string>;
  couponCodeUsed?: string;
  discountAppliedInCents?: number;
  isUpsellTransaction?: boolean;
  originalSaleId?: string;
}

interface RequestBody {
  payload: FrontendPixPayload;
  productOwnerUserId: string;
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

// Interface para os campos essenciais da resposta PIX
interface PushInPayEssentialPixData {
    id: string;
    qr_code: string;
    qr_code_base64: string;
    status: string;
    value: number;
}

// Interface para a resposta completa da PushInPay (pode ser aninhada ou plana)
interface PushInPayFullApiResponse {
    data?: PushInPayEssentialPixData; // Para estrutura aninhada
    id?: string;                      // Para estrutura plana
    qr_code?: string;
    qr_code_base64?: string;
    status?: string;
    value?: number;
    webhook_url?: string;
    success?: boolean;
    message?: string;
    errors?: any;
}


serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let productOwnerUserIdForLogging: string | undefined;

  try {
    const requestBody: RequestBody = await req.json();
    const { payload: frontendPayload, productOwnerUserId } = requestBody;
    productOwnerUserIdForLogging = productOwnerUserId;

    console.log(`[gerar-pix] Iniciando para productOwnerUserId: ${productOwnerUserId}`);
    console.log("[gerar-pix] Payload recebido do frontend:", JSON.stringify(frontendPayload, null, 2));


    if (!productOwnerUserId) {
      throw new Error("ID do vendedor (productOwnerUserId) é obrigatório na requisição.");
    }
    if (!frontendPayload || typeof frontendPayload.value !== 'number' || frontendPayload.value <= 0) {
      throw new Error("Payload da requisição inválido ou valor do PIX (payload.value) ausente/inválido.");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas na Edge Function.");
    }

    const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);

    console.log(`[gerar-pix] Buscando app_settings para vendedor: ${productOwnerUserId}`);
    const { data: sellerSettings, error: sellerSettingsError } = await adminClient
      .from('app_settings')
      .select('api_tokens')
      .eq('platform_user_id', productOwnerUserId)
      .single();

    if (sellerSettingsError) {
      console.error(`[gerar-pix] Erro ao buscar app_settings do vendedor ${productOwnerUserId}:`, sellerSettingsError);
      throw new Error(`Erro ao buscar configurações do vendedor: ${sellerSettingsError.message}`);
    }
    if (!sellerSettings) {
      throw new Error(`Configurações de API não encontradas para o vendedor ${productOwnerUserId}.`);
    }
    
    const sellerApiTokens = sellerSettings.api_tokens as any;
    const pushinPayToken = sellerApiTokens?.pushinPay;
    const isPushinPayEnabled = sellerApiTokens?.pushinPayEnabled;
    
    if (!isPushinPayEnabled) {
      throw new Error('Pagamento PIX (PushInPay) não está habilitado para este vendedor.');
    }
    if (!pushinPayToken || typeof pushinPayToken !== 'string' || pushinPayToken.trim() === '') {
      throw new Error('Token da API PushInPay não configurado ou inválido para este vendedor.');
    }
    console.log(`[gerar-pix] Token PushInPay do vendedor obtido. PushInPay habilitado: ${isPushinPayEnabled}`);

    console.log("[gerar-pix] Buscando platform_settings globais...");
    const { data: platformSettingsData, error: platformSettingsError } = await adminClient
      .from('platform_settings')
      .select('platform_commission_percentage, platform_fixed_fee_in_cents, platform_account_id_push_in_pay')
      .eq('id', 'global')
      .single();

    if (platformSettingsError) {
      console.error("[gerar-pix] Erro ao buscar platform_settings:", platformSettingsError);
      throw new Error(`Erro ao buscar configurações da plataforma: ${platformSettingsError.message}`);
    }
    if (!platformSettingsData) {
      throw new Error('Configurações globais da plataforma não encontradas (id=global).');
    }
    console.log("[gerar-pix] Configurações da plataforma obtidas:", JSON.stringify(platformSettingsData, null, 2));

    const platformAccountIdPushInPay = platformSettingsData.platform_account_id_push_in_pay;

    const pushInPayApiRequestBody: PushInPayApiRequestBody = {
      value: frontendPayload.value,
      webhook_url: frontendPayload.webhook_url,
    };

    if (platformAccountIdPushInPay && typeof platformAccountIdPushInPay === 'string' && platformAccountIdPushInPay.trim() !== '') {
      const totalAmount = frontendPayload.value;
      const commissionPercentage = platformSettingsData.platform_commission_percentage ?? 0;
      const fixedFeeInCents = platformSettingsData.platform_fixed_fee_in_cents ?? 0;

      let platformCommission = Math.round(totalAmount * commissionPercentage) + fixedFeeInCents;
      platformCommission = Math.min(platformCommission, totalAmount);
      platformCommission = Math.max(0, platformCommission);

      if (platformCommission > 0) {
        pushInPayApiRequestBody.split_rules = [
          {
            account_id: platformAccountIdPushInPay,
            value: platformCommission,
          },
        ];
        console.log(`[gerar-pix] Split rules aplicado. Comissão da plataforma: ${platformCommission} centavos para conta ${platformAccountIdPushInPay}`);
      } else {
        console.log("[gerar-pix] Comissão da plataforma calculada como zero ou negativa. Nenhum split será aplicado.");
      }
    } else {
      console.warn("[gerar-pix] ID da conta PushInPay da plataforma não configurado em platform_settings ou inválido. O split de pagamento não será realizado.");
    }
    
    console.log("[gerar-pix] Payload final para PushInPay:", JSON.stringify(pushInPayApiRequestBody, null, 2));

    const pushinPayResponse = await fetch('https://api.pushinpay.com.br/api/pix/cashIn', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${pushinPayToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(pushInPayApiRequestBody)
    });

    const pushinPayParsedResponse: PushInPayFullApiResponse = await pushinPayResponse.json();
    console.log(`[gerar-pix] Resposta da PushInPay (Status ${pushinPayResponse.status}):`, JSON.stringify(pushinPayParsedResponse, null, 2));

    if (!pushinPayResponse.ok) {
        const errorDetail = pushinPayParsedResponse.message || (pushinPayParsedResponse.errors ? JSON.stringify(pushinPayParsedResponse.errors) : 'Erro desconhecido do gateway de pagamento.');
        console.error(`[gerar-pix] Erro da API PushInPay (Status ${pushinPayResponse.status}): ${errorDetail}`);
        throw new Error(`Gateway de Pagamento: ${errorDetail}`);
    }
    
    let extractedData: PushInPayEssentialPixData | null = null;

    if (pushinPayParsedResponse.data && typeof pushinPayParsedResponse.data === 'object' &&
        pushinPayParsedResponse.data.id && pushinPayParsedResponse.data.qr_code && pushinPayParsedResponse.data.qr_code_base64 &&
        pushinPayParsedResponse.data.status && typeof pushinPayParsedResponse.data.value === 'number') {
        extractedData = pushinPayParsedResponse.data;
        console.log("[gerar-pix] Dados PIX extraídos da estrutura aninhada 'data'.");
    } 
    else if (pushinPayParsedResponse.id && pushinPayParsedResponse.qr_code && pushinPayParsedResponse.qr_code_base64 &&
               pushinPayParsedResponse.status && typeof pushinPayParsedResponse.value === 'number') {
        extractedData = {
            id: pushinPayParsedResponse.id,
            qr_code: pushinPayParsedResponse.qr_code,
            qr_code_base64: pushinPayParsedResponse.qr_code_base64,
            status: pushinPayParsedResponse.status,
            value: pushinPayParsedResponse.value,
        };
        console.log("[gerar-pix] Dados PIX extraídos da estrutura plana (raiz).");
    }

    if (!extractedData) {
        console.error("[gerar-pix] Resposta da PushInPay não contém os campos essenciais (id, qr_code, qr_code_base64, status, value) em nenhuma estrutura reconhecida:", pushinPayParsedResponse);
        throw new Error('Resposta inválida do gateway de pagamento após geração do PIX. Dados essenciais ausentes.');
    }

    // Strip data URI prefix if present in qr_code_base64
    let rawBase64String = extractedData.qr_code_base64;
    const dataUriPrefix = "data:image/png;base64,";
    if (rawBase64String.startsWith(dataUriPrefix)) {
      rawBase64String = rawBase64String.substring(dataUriPrefix.length);
      console.log("[gerar-pix] Prefixo 'data:image/png;base64,' removido do qr_code_base64.");
    }


    const finalFrontendResponse = {
        success: true,
        data: {
            id: extractedData.id,
            qr_code: extractedData.qr_code,
            qr_code_base64: rawBase64String, // Use the potentially stripped string
            status: extractedData.status,
            value: extractedData.value,
        },
        message: "PIX gerado com sucesso."
    };
    console.log("[gerar-pix] Resposta final para o frontend:", JSON.stringify(finalFrontendResponse, null, 2));

    return new Response(JSON.stringify(finalFrontendResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (err: any) {
    console.error(`[gerar-pix] Erro CAPTURADO na Edge Function para vendedor ${productOwnerUserIdForLogging || 'desconhecido'}:`, err.message, err.stack);
    const clientErrorMessage = err.message || "Ocorreu um erro interno ao tentar gerar o PIX.";
    return new Response(JSON.stringify({ success: false, message: clientErrorMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
    });
  }
})
