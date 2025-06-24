
// Caminho: supabase/functions/gerar-pix/index.ts

// @ts-ignore
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2' 
import { corsHeaders } from '../_shared/cors.ts'
import { Database, Json as DbJson } from '../_shared/db_types.ts' 

// Declare Deno para o TypeScript, pois ele é global no ambiente Deno.
declare const Deno: any;

// Tipos para o payload recebido do frontend (CheckoutPage)
interface SaleProductItemFromFrontend {
  productId: string;
  name: string;
  quantity: number;
  priceInCents: number; 
  originalPriceInCents: number; 
  isOrderBump?: boolean; 
  isUpsell?: boolean; 
  deliveryUrl?: string;
  slug?: string; 
}

interface FrontendPixAndSalePayload {
  value: number; // Valor total da transação em centavos (já com descontos, order bumps)
  originalValueBeforeDiscount: number; // Valor original antes de descontos, mas com order bumps
  webhook_url: string; // Para PushInPay
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  products: SaleProductItemFromFrontend[]; 
  trackingParameters?: Record<string, string>;
  couponCodeUsed?: string;
  discountAppliedInCents?: number; // Valor do desconto total aplicado
  // --- Campos adicionais para criar o registro de Sale ---
  platformUserId: string; // ID do dono do produto/venda
  paymentMethod: "pix"; // Fixo para esta função
  ip?: string; // Opcional, IP do cliente
  // isUpsellTransaction e originalSaleId são para o fluxo de upsell, não tratados aqui primariamente mas podem vir no payload.
  isUpsellTransaction?: boolean; 
  originalSaleId?: string;  
}

interface RequestBody {
  payload: FrontendPixAndSalePayload;
  productOwnerUserId: string; // Redundante se já estiver em payload.platformUserId, mas mantemos por consistência com o request atual
}

// --- Tipos para a PushInPay ---
interface PushInPaySplitRule {
  account_id: string;
  value: number; // em centavos
}
interface PushInPayApiRequestBody {
  value: number; // em centavos
  webhook_url: string;
  split_rules?: PushInPaySplitRule[];
}
interface PushInPayEssentialPixData {
    id: string; // ID da transação PIX
    qr_code: string;
    qr_code_base64: string;
    status: string; // Status inicial da PushInPay
    value: number;  // Valor do PIX gerado
}
interface PushInPayFullApiResponse { // Resposta completa da PushInPay
    data?: PushInPayEssentialPixData; 
    id?: string; qr_code?: string; qr_code_base64?: string; status?: string; value?: number;
    success?: boolean; message?: string; errors?: any;
}

// --- Tipos para a resposta da Edge Function ---
interface GerarPixFunctionResponse {
  success: boolean;
  data?: PushInPayEssentialPixData; // Dados do PIX
  saleId?: string;                   // ID da venda criada no DB
  message?: string;
}

// Helper para obter a constante de moeda padrão
const DEFAULT_CURRENCY_CONST = "BRL";

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let productOwnerUserIdForLogging: string | undefined;

  try {
    const requestBody: RequestBody = await req.json();
    const { payload: frontendPayload, productOwnerUserId } = requestBody;
    // Se productOwnerUserId não vier no corpo, usar o de payload.platformUserId
    productOwnerUserIdForLogging = productOwnerUserId || frontendPayload.platformUserId;

    console.log(`[gerar-pix] Iniciando para productOwnerUserId: ${productOwnerUserIdForLogging}`);
    console.log("[gerar-pix] Payload recebido do frontend:", JSON.stringify(frontendPayload, null, 2));

    if (!productOwnerUserIdForLogging) {
      throw new Error("ID do vendedor (productOwnerUserId ou payload.platformUserId) é obrigatório.");
    }
    if (!frontendPayload || typeof frontendPayload.value !== 'number' || frontendPayload.value <= 0) {
      throw new Error("Payload da requisição inválido ou valor do PIX (payload.value) ausente/inválido.");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");
    const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);

    // 1. Buscar configurações do vendedor e da plataforma (paralelamente)
    const [sellerSettingsResult, platformSettingsResult] = await Promise.all([
        adminClient.from('app_settings').select('api_tokens').eq('platform_user_id', productOwnerUserIdForLogging).single(),
        adminClient.from('platform_settings').select('platform_commission_percentage, platform_fixed_fee_in_cents, platform_account_id_push_in_pay').eq('id', 'global').single()
    ]);

    if (sellerSettingsResult.error) throw new Error(`Erro ao buscar config. do vendedor: ${sellerSettingsResult.error.message}`);
    if (!sellerSettingsResult.data) throw new Error(`Config. de API não encontradas para vendedor ${productOwnerUserIdForLogging}.`);
    const sellerApiTokens = sellerSettingsResult.data.api_tokens as any;
    const pushinPayToken = sellerApiTokens?.pushinPay;
    if (!(sellerApiTokens?.pushinPayEnabled)) throw new Error('Pagamento PIX (PushInPay) não habilitado para este vendedor.');
    if (!pushinPayToken) throw new Error('Token PushInPay não configurado para este vendedor.');

    if (platformSettingsResult.error) throw new Error(`Erro ao buscar config. da plataforma: ${platformSettingsResult.error.message}`);
    if (!platformSettingsResult.data) throw new Error('Config. globais da plataforma não encontradas.');
    const platformSettingsData = platformSettingsResult.data;

    // 2. Preparar e chamar API da PushInPay para gerar PIX
    const pushInPayApiRequestBody: PushInPayApiRequestBody = { value: frontendPayload.value, webhook_url: frontendPayload.webhook_url };
    if (platformSettingsData.platform_account_id_push_in_pay) {
      const totalAmount = frontendPayload.value;
      let platformCommission = Math.round(totalAmount * (platformSettingsData.platform_commission_percentage ?? 0)) + (platformSettingsData.platform_fixed_fee_in_cents ?? 0);
      platformCommission = Math.min(platformCommission, totalAmount);
      platformCommission = Math.max(0, platformCommission);
      if (platformCommission > 0) {
        pushInPayApiRequestBody.split_rules = [{ account_id: platformSettingsData.platform_account_id_push_in_pay, value: platformCommission }];
      }
    }
    
    const pushinPayResponse = await fetch('https://api.pushinpay.com.br/api/pix/cashIn', {
        method: 'POST', headers: { 'Authorization': `Bearer ${pushinPayToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(pushInPayApiRequestBody)
    });
    const pushinPayParsedResponse: PushInPayFullApiResponse = await pushinPayResponse.json();
    if (!pushinPayResponse.ok) throw new Error(`Gateway de Pagamento: ${pushinPayParsedResponse.message || JSON.stringify(pushinPayParsedResponse.errors || 'Erro desconhecido')}`);
    
    let extractedPixData: PushInPayEssentialPixData | null = null;
    if (pushinPayParsedResponse.data?.id) extractedPixData = pushinPayParsedResponse.data;
    else if (pushinPayParsedResponse.id) extractedPixData = { id: pushinPayParsedResponse.id, qr_code: pushinPayParsedResponse.qr_code!, qr_code_base64: pushinPayParsedResponse.qr_code_base64!, status: pushinPayParsedResponse.status!, value: pushinPayParsedResponse.value! };
    if (!extractedPixData) throw new Error('Resposta inválida do gateway ao gerar PIX (dados essenciais ausentes).');
    
    let rawBase64String = extractedPixData.qr_code_base64;
    const dataUriPrefix = "data:image/png;base64,";
    if (rawBase64String.startsWith(dataUriPrefix)) rawBase64String = rawBase64String.substring(dataUriPrefix.length);

    // 3. Calcular comissão e preparar dados da venda para inserção
    const gatewayFeeInCents = 0; // Assumindo que não há taxa de gateway separada da PushInPay para este cálculo
    const platformCommissionBase = frontendPayload.value - gatewayFeeInCents;
    const platformCommissionCalculated = Math.round(platformCommissionBase * (platformSettingsData.platform_commission_percentage ?? 0)) + (platformSettingsData.platform_fixed_fee_in_cents ?? 0);
    const userNetRevenue = platformCommissionBase - platformCommissionCalculated;

    const saleToInsert: Database['public']['Tables']['sales']['Insert'] = {
      platform_user_id: productOwnerUserIdForLogging,
      push_in_pay_transaction_id: extractedPixData.id,
      // upsell_push_in_pay_transaction_id: Não aplicável aqui, seria em outra chamada
      // order_id_urmify: Será preenchido após envio para UTMify, se aplicável
      products: frontendPayload.products as unknown as DbJson, // Cast necessário
      customer_name: frontendPayload.customerName,
      customer_email: frontendPayload.customerEmail,
      customer_ip: frontendPayload.ip,
      customer_whatsapp: frontendPayload.customerWhatsapp,
      payment_method: frontendPayload.paymentMethod,
      status: "waiting_payment", // Status inicial
      // upsell_status: Não aplicável aqui
      total_amount_in_cents: frontendPayload.value,
      // upsell_amount_in_cents: Não aplicável aqui
      original_amount_before_discount_in_cents: frontendPayload.originalValueBeforeDiscount,
      discount_applied_in_cents: frontendPayload.discountAppliedInCents,
      coupon_code_used: frontendPayload.couponCodeUsed,
      tracking_parameters: frontendPayload.trackingParameters as unknown as DbJson,
      platform_commission_in_cents: platformCommissionCalculated,
      commission_total_price_in_cents: platformCommissionBase,
      commission_gateway_fee_in_cents: gatewayFeeInCents,
      commission_user_commission_in_cents: userNetRevenue,
      commission_currency: DEFAULT_CURRENCY_CONST,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log("[gerar-pix] Dados para inserção na tabela 'sales':", JSON.stringify(saleToInsert, null, 2));

    const { data: createdSaleRecord, error: saleInsertError } = await adminClient
      .from('sales')
      .insert(saleToInsert)
      .select('id') // Seleciona apenas o ID da venda criada
      .single();

    if (saleInsertError) {
      console.error("[gerar-pix] Erro ao inserir venda no banco de dados:", saleInsertError);
      // Considerar lógica de compensação se PIX foi gerado mas venda falhou (ex: cancelar PIX?)
      throw new Error(`Falha ao registrar a venda no sistema: ${saleInsertError.message}`);
    }
    if (!createdSaleRecord || !createdSaleRecord.id) {
      throw new Error("Falha ao registrar a venda: ID da venda não retornado após inserção.");
    }
    console.log(`[gerar-pix] Venda registrada com sucesso. ID da Venda: ${createdSaleRecord.id}`);
    
    // 4. Retornar dados do PIX e ID da venda para o frontend
    const finalFrontendResponse: GerarPixFunctionResponse = {
        success: true,
        data: { ...extractedPixData, qr_code_base64: rawBase64String },
        saleId: createdSaleRecord.id,
        message: "PIX gerado e venda registrada com sucesso."
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
        status: err.message.startsWith("Gateway de Pagamento:") ? 402 : (err.message.includes("não encontrado") ? 404 : 400) 
    });
  }
})
