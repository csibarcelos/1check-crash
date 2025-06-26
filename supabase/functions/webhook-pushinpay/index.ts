// supabase/functions/webhook-pushinpay/index.ts
// @ts-ignore
import { serve } from "std_http_server";
// @ts-ignore
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';
import { Database } from '../_shared/db_types.ts';

declare const Deno: any;

// Expected payload structure from PushInPay (simplified assumption)
interface PushInPayWebhookPayload {
  event_type?: string; // e.g., "transaction.status.updated"
  transaction?: {
    id: string; // This is the PushInPay transaction ID
    status: string; // e.g., "PAID", "PENDING", "EXPIRED"
    // ... other fields
  };
  // It might be nested differently, adjust based on actual PushInPay docs
  id?: string; // Fallback if transaction.id is not present directly
  status?: string; // Fallback for status
}

serve(async (req: Request) => {
  // Log da requisição para debug
  console.log(`[webhook-pushinpay] Received ${req.method} request from ${req.headers.get('user-agent') || 'unknown'}`);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Handle GET requests for testing/health check
  if (req.method === 'GET') {
    console.log("[webhook-pushinpay] GET request received - returning webhook info");
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Webhook endpoint is active. Use POST to send webhook data.",
      endpoint: "webhook-pushinpay",
      expectedMethod: "POST"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200
    });
  }

  // Explicitly handle POST requests
  if (req.method !== 'POST') {
    console.warn(`[webhook-pushinpay] Received non-POST request: ${req.method}. Rejecting.`);
    return new Response(JSON.stringify({ 
      success: false, 
      message: `Method ${req.method} not allowed. Please use POST.` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 405
    });
  }

  let webhookTxIdForLogging: string | undefined;

  try {
    // Check if body exists
    const contentLength = req.headers.get('content-length');
    if (contentLength === '0' || contentLength === null) {
      console.warn("[webhook-pushinpay] Received POST with empty body");
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Empty request body received." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
      });
    }

    const payload: PushInPayWebhookPayload = await req.json();
    console.log("[webhook-pushinpay] Received webhook payload:", JSON.stringify(payload, null, 2));

    const transactionId = payload.transaction?.id || payload.id;
    const transactionStatus = payload.transaction?.status || payload.status;

    webhookTxIdForLogging = transactionId;

    if (!transactionId) {
      console.warn("[webhook-pushinpay] Transaction ID missing from webhook payload.");
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Transaction ID missing." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      });
    }

    console.log(`[webhook-pushinpay] Processing transaction ID: ${transactionId}, Status: ${transactionStatus}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase URL or Service Role Key not configured.");
    }

    const adminClient: SupabaseClient<Database> = createClient<Database>(supabaseUrl, serviceRoleKey);

    // Improved query with better error handling
    const { data: sale, error: saleFetchError } = await adminClient
      .from('sales')
      .select('id, platform_user_id, push_in_pay_transaction_id, upsell_push_in_pay_transaction_id')
      .or(`push_in_pay_transaction_id.eq.${transactionId},upsell_push_in_pay_transaction_id.eq.${transactionId}`)
      .maybeSingle();

    if (saleFetchError) {
      console.error(`[webhook-pushinpay] Error fetching sale for PushInPay TX ID ${transactionId}:`, saleFetchError);
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Internal error fetching sale." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 // Acknowledge to PushInPay
      });
    }

    if (!sale) {
      console.warn(`[webhook-pushinpay] No sale found for PushInPay TX ID ${transactionId}. Webhook ignored.`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Webhook received, no matching sale." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200
      });
    }

    const isUpsell = sale.upsell_push_in_pay_transaction_id === transactionId;
    console.log(`[webhook-pushinpay] Sale found: ID ${sale.id}, Owner ${sale.platform_user_id}, IsUpsell: ${isUpsell}. Triggering 'verificar-status-pix'.`);

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
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Error invoking payment verification." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 // Acknowledge to PushInPay
      });
    }

    console.log(`[webhook-pushinpay] 'verificar-status-pix' invoked successfully for sale ${sale.id}.`);
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Webhook processed successfully.",
      transactionId: transactionId,
      saleId: sale.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200
    });

  } catch (error: any) {
    // Better error handling for JSON parsing
    if (error instanceof SyntaxError) {
      console.warn(`[webhook-pushinpay] JSON parsing error. TX ID: ${webhookTxIdForLogging || 'N/A'}. Error: ${error.message}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid JSON payload received." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
      });
    }

    console.error(`[webhook-pushinpay] Error processing webhook (TX ID: ${webhookTxIdForLogging || 'N/A'}):`, error.message);
    console.error("Stack trace:", error.stack);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: "Internal server error processing webhook." 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 // Acknowledge to PushInPay
    });
  }
})