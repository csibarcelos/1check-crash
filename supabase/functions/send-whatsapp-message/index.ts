// Caminho: supabase/functions/send-whatsapp-message/index.ts

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { Database } from '../_shared/db_types.ts';

declare const Deno: any;

interface RequestBody {
  userId: string;
  to: string; // WhatsApp number, e.g., "+5511999999999"
  templateName: string;
  templateVariables: { [key: string]: string };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let userIdForLogging: string | undefined;
  let toForLogging: string | undefined;
  let templateNameForLogging: string | undefined;

  try {
    const { userId, to, templateName, templateVariables }: RequestBody = await req.json();
    userIdForLogging = userId;
    toForLogging = to;
    templateNameForLogging = templateName;

    console.log(`[send-whatsapp-message] Iniciando envio de WhatsApp. Usuário: ${userId}, Para: ${to}, Template: ${templateName}`);

    if (!userId || !to || !templateName || !templateVariables) {
      throw new Error("userId, to, templateName e templateVariables são obrigatórios.");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");

    const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // 1. Obter os templates de WhatsApp do usuário
    const { data: appSettings, error: settingsError } = await adminClient
      .from('app_settings')
      .select('whatsapp_templates')
      .eq('platform_user_id', userId)
      .single();

    if (settingsError || !appSettings || !appSettings.whatsapp_templates) {
      console.warn(`[send-whatsapp-message] Não foram encontrados templates de WhatsApp para o usuário ${userId} ou erro: ${settingsError?.message}`);
      throw new Error(`Templates de WhatsApp não configurados para o usuário ${userId}.`);
    }

    const whatsappTemplates = appSettings.whatsapp_templates as any;
    const template = whatsappTemplates[templateName];

    if (!template || !template.enabled || !template.message) {
      console.warn(`[send-whatsapp-message] Template '${templateName}' não encontrado, desabilitado ou sem mensagem para o usuário ${userId}.`);
      throw new Error(`Template '${templateName}' inválido ou desabilitado.`);
    }

    let messageContent = template.message;

    // 2. Substituir variáveis no template
    for (const key in templateVariables) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      messageContent = messageContent.replace(placeholder, templateVariables[key]);
    }

    console.log(`[send-whatsapp-message] Mensagem final para ${to} (Template: ${templateName}):\n${messageContent}`);

    // 3. Lógica de envio para a API de WhatsApp (PLACEHOLDER)
    // AQUI VOCÊ INTEGRARIA COM A API DO SEU PROVEDOR DE WHATSAPP (ex: Twilio, MessageBird, etc.)
    // Exemplo (apenas ilustrativo):
    // const whatsappApiUrl = Deno.env.get('WHATSAPP_API_URL');
    // const whatsappApiKey = Deno.env.get('WHATSAPP_API_KEY');
    // const whatsappResponse = await fetch(whatsappApiUrl, {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${whatsappApiKey}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ to: to, message: messageContent })
    // });
    // if (!whatsappResponse.ok) {
    //   const errorData = await whatsappResponse.json();
    //   throw new Error(`Erro ao enviar WhatsApp: ${whatsappResponse.status} - ${JSON.stringify(errorData)}`);
    // }

    console.log(`[send-whatsapp-message] Mensagem de WhatsApp para ${to} (Template: ${templateName}) processada. (Envio real desabilitado - placeholder)`);

    return new Response(JSON.stringify({ success: true, message: "Mensagem de WhatsApp processada com sucesso (envio real desabilitado)." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (err: any) {
    console.error(`[send-whatsapp-message] ERRO CAPTURADO (Usuário: ${userIdForLogging}, Para: ${toForLogging}, Template: ${templateNameForLogging}):`, err.message, err.stack);
    return new Response(JSON.stringify({ success: false, message: err.message || "Erro interno." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
    });
  }
});