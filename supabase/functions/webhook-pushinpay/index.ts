// supabase/functions/webhook-pushinpay/index.ts
// @ts-ignore
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// @ts-ignore
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';
import { Database } from '../_shared/db_types.ts';

declare const Deno: any;

serve(async (req: Request) => {
  console.log(`[webhook-pushinpay] Received ${req.method} request from ${req.headers.get('user-agent') || 'unknown'}`);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: `Method ${req.method} not allowed.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 405
    });
  }

  let webhookTxIdForLogging: string | undefined;

  try {
    const formData = await req.formData();
    const transactionId = formData.get('id')?.toString() || formData.get('transaction_id')?.toString();
    
    webhookTxIdForLogging = transactionId;

    if (!transactionId) {
      console.warn("[webhook-pushinpay] Transaction ID missing from webhook payload (checked 'id' and 'transaction_id').");
      return new Response(JSON.stringify({ message: "Transaction ID missing." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 // Acknowledge to gateway
      });
    }

    console.log(`[webhook-pushinpay] Processing transaction ID: ${transactionId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase URL or Service Role Key not configured.");
    }

    const adminClient: SupabaseClient<Database> = createClient<Database>(supabaseUrl, serviceRoleKey);

    // SOLUÇÃO: MUDADO DE .eq PARA .ilike para busca case-insensitive
    const { data: sale, error: saleFetchError } = await adminClient
      .from('sales')
      .select('id, platform_user_id, push_in_pay_transaction_id, upsell_push_in_pay_transaction_id')
      .or(`push_in_pay_transaction_id.ilike.${transactionId},upsell_push_in_pay_transaction_id.ilike.${transactionId}`)
      .maybeSingle();

    if (saleFetchError) {
      console.error(`[webhook-pushinpay] Error fetching sale for TX ID ${transactionId}:`, saleFetchError);
      return new Response(JSON.stringify({ message: "Internal error fetching sale." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 // Acknowledge to gateway
      });
    }

    if (!sale) {
      console.error(`[webhook-pushinpay] No sale found for TX ID ${transactionId}.`);
      return new Response(JSON.stringify({ message: "Webhook received, no matching sale." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200
      });
    }

    const isUpsell = sale.upsell_push_in_pay_transaction_id?.toLowerCase() === transactionId.toLowerCase();
    console.log(`[webhook-pushinpay] Sale found: ID ${sale.id}. Triggering 'verificar-status-pix'.`);

    // Invocando a outra função. A lógica aqui permanece a mesma.
    const { error: invokeError } = await adminClient.functions.invoke('verificar-status-pix', {
      body: {
        transactionId: transactionId,
        productOwnerUserId: sale.platform_user_id,
        saleId: sale.id,
        isUpsellTransaction: isUpsell
      }
    });

    if (invokeError) {
      console.error(`[webhook-pushinpay] Error invoking 'verificar-status-pix' for sale ${sale.id}:`, invokeError);
      return new Response(JSON.stringify({ message: "Error invoking payment verification." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 // Acknowledge to gateway
      });
    }

    console.log(`[webhook-pushinpay] 'verificar-status-pix' invoked successfully for sale ${sale.id}.`);
    return new Response(JSON.stringify({ success: true, message: "Webhook processed." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200
    });

  } catch (error: any) {
    console.error(`[webhook-pushinpay] CRITICAL ERROR (TX ID: ${webhookTxIdForLogging || 'N/A'}):`, error.message);
    return new Response(JSON.stringify({ error: "Internal server error processing webhook." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 // Acknowledge to gateway
    });
  }
})