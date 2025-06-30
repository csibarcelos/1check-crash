// supabase/functions/send-email/index.ts
// @ts-ignore
import { serve } from "std_http_server";
// @ts-ignore
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
// @ts-ignore
// MUDANÇA FINAL: Usando Nodemailer, a biblioteca padrão da indústria.
import nodemailer from "npm:nodemailer";
import { corsHeaders } from '../_shared/cors.ts';
import { Database, Json } from '../_shared/db_types.ts';

// Declare Deno for TypeScript
declare const Deno: any;

interface UserSmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
}

interface EmailPayload {
  userId: string;
  to: string;
  subject: string;
  htmlBody: string;
  fromName?: string;
  replyTo?: string;
}

const parseJsonField = <T>(field: Json | null | undefined, defaultValue: T): T => {
  if (field === null || field === undefined) return defaultValue;
  if (typeof field === 'object' && field !== null) return field as T;
  if (typeof field === 'string') {
    try { return JSON.parse(field) as T; }
    catch (e) { console.warn('Failed to parse JSON string field:', field, e); return defaultValue; }
  }
  return defaultValue;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let payloadUserIdForLogging: string | undefined;

  try {
    const payload: EmailPayload = await req.json();
    payloadUserIdForLogging = payload.userId;
    const { userId, to, subject, htmlBody, fromName, replyTo } = payload;

    if (!userId || !to || !subject || !htmlBody) {
      throw new Error("Parâmetros 'userId', 'to', 'subject', e 'htmlBody' são obrigatórios.");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase URL ou Service Role Key não configuradas.");
    }

    const adminClient: SupabaseClient<Database> = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: appSettings, error: settingsError } = await adminClient
      .from('app_settings')
      .select('smtp_settings')
      .eq('platform_user_id', userId)
      .single();

    if (settingsError) {
      throw new Error(`Falha ao buscar configurações SMTP: ${settingsError.message}`);
    }
    if (!appSettings || !appSettings.smtp_settings) {
      throw new Error(`Configurações SMTP não encontradas para o usuário ${userId}.`);
    }
    
    const smtpConfig = parseJsonField<UserSmtpSettings | null>(appSettings.smtp_settings, null);

    if (!smtpConfig || !smtpConfig.host || !smtpConfig.port || !smtpConfig.user || !smtpConfig.pass) {
      throw new Error(`Configurações SMTP incompletas. Verifique host, porta, usuário e senha.`);
    }
    
    console.log(`[send-email] Configuração SMTP carregada para usuário ${userId}.`);

    // 1. Criar o "transporter" do Nodemailer. Ele lida com a conexão.
    const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.port === 465, // `true` para porta 465, `false` para as outras (como 587 com STARTTLS)
        auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass, // A Senha de Aplicativo que você gerou no Zoho
        },
    });

    console.log(`[send-email] Transporter criado. Tentando enviar e-mail para ${to}...`);

    // 2. Definir as opções do e-mail
    const mailOptions = {
      from: fromName ? `"${fromName}" <${smtpConfig.user}>` : smtpConfig.user,
      to: to,
      subject: subject,
      html: htmlBody, // Nodemailer usa a propriedade 'html'
      replyTo: replyTo,
    };

    // 3. Enviar o e-mail
    const info = await transporter.sendMail(mailOptions);

    console.log(`[send-email] E-mail enviado com sucesso! Message ID: ${info.messageId}`);

    return new Response(JSON.stringify({ success: true, message: "E-mail enviado com sucesso.", messageId: info.messageId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error(`[send-email] ERRO CRÍTICO (User: ${payloadUserIdForLogging || 'N/A'}):`, error);
    
    return new Response(JSON.stringify({ success: false, error: `Falha na execução: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})