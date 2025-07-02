// Caminho: supabase/functions/check-pending-pix-sales/index.ts

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Database } from '../_shared/db_types.ts';
import { corsHeaders } from '../_shared/cors.ts';

declare const Deno: any;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log("[check-pending-pix-sales] Iniciando verificação de vendas PIX pendentes...");

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[check-pending-pix-sales] Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");
    return new Response(JSON.stringify({ success: false, message: "Erro de configuração do servidor." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }

  const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    // Define o período para buscar vendas pendentes (ex: últimas 48 horas)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2); // Ajuste conforme a necessidade
    const twoDaysAgoISO = twoDaysAgo.toISOString();
    console.log(`[check-pending-pix-sales] Buscando vendas PIX pendentes criadas após: ${twoDaysAgoISO}`);

    const { data: pendingSales, error: fetchError } = await adminClient
      .from('sales')
      .select('id, platform_user_id, push_in_pay_transaction_id, upsell_push_in_pay_transaction_id')
      .eq('status', 'pending')
      .eq('payment_method', 'pix')
      .gte('created_at', twoDaysAgoISO); // Apenas vendas recentes

    if (fetchError) {
      console.error("[check-pending-pix-sales] Erro ao buscar vendas pendentes:", fetchError.message);
      throw new Error(`Erro ao buscar vendas pendentes: ${fetchError.message}`);
    }

    if (!pendingSales || pendingSales.length === 0) {
      console.log("[check-pending-pix-sales] Nenhuma venda PIX pendente encontrada no período.");
      return new Response(JSON.stringify({ success: true, message: "Nenhuma venda PIX pendente encontrada." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const saleIdsToProcess = pendingSales.map(s => s.id);
    console.log(`[check-pending-pix-sales] Encontradas ${pendingSales.length} vendas PIX pendentes. IDs: ${saleIdsToProcess.join(', ')}. Processando...`);

    let processedCount = 0;
    for (const sale of pendingSales) {
      const transactionId = sale.push_in_pay_transaction_id || sale.upsell_push_in_pay_transaction_id;
      const isUpsell = !!sale.upsell_push_in_pay_transaction_id;

      if (!transactionId) {
        console.warn(`[check-pending-pix-sales] Venda ${sale.id} sem transactionId. Pulando.`);
        continue;
      }

      console.log(`[check-pending-pix-sales] Invocando verificar-status-pix para venda ${sale.id} (TX ID: ${transactionId}, Upsell: ${isUpsell})...`);
      
      const { error: invokeError } = await adminClient.functions.invoke('verificar-status-pix', {
        body: {
          transactionId: transactionId,
          productOwnerUserId: sale.platform_user_id,
          saleId: sale.id,
          isUpsellTransaction: isUpsell
        }
      });

      if (invokeError) {
        console.error(`[check-pending-pix-sales] Erro ao invocar verificar-status-pix para venda ${sale.id}:`, invokeError.message, JSON.stringify(invokeError));
      } else {
        console.log(`[check-pending-pix-sales] verificar-status-pix invocado com sucesso para venda ${sale.id}.`);
        processedCount++;
      }
    }

    console.log(`[check-pending-pix-sales] Processamento concluído. ${processedCount} vendas PIX pendentes verificadas.`);
    return new Response(JSON.stringify({ success: true, message: `Verificação de vendas PIX pendentes concluída. ${processedCount} vendas processadas.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (err: any) {
    console.error("[check-pending-pix-sales] Erro crítico:", err.message, err.stack);
    return new Response(JSON.stringify({ success: false, message: "Erro interno do servidor durante a verificação." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
