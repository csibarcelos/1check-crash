
// supabase/functions/update-platform-user/index.ts
// @ts-ignore
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// @ts-ignore
import { createClient, UserAttributes } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { Database } from '../_shared/db_types.ts';

// Declare Deno for TypeScript
declare const Deno: any;

interface UpdatePayload {
  name?: string | null; // Allow null to signify deleting the name
  isActive?: boolean;
  isSuperAdmin?: boolean;
}

interface RequestBody {
  userIdToUpdate: string;
  updates: UpdatePayload;
}

type ProfileUpdates = Database['public']['Tables']['profiles']['Update'];

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let userIdToUpdateForLogging: string | undefined;

  try {
    const { userIdToUpdate, updates }: RequestBody = await req.json();
    userIdToUpdateForLogging = userIdToUpdate;

    console.log(`[update-platform-user] Iniciando para userIdToUpdate: ${userIdToUpdate}`);
    console.log("[update-platform-user] Updates recebidos:", JSON.stringify(updates, null, 2));

    if (!userIdToUpdate) {
      throw new Error("ID do usuário a ser atualizado (userIdToUpdate) é obrigatório.");
    }
    if (!updates || Object.keys(updates).length === 0) {
      throw new Error("Nenhuma atualização fornecida.");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase URL ou Service Role Key não configuradas no ambiente da Edge Function.");
    }

    const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });

    // --- Verificações de Segurança ---
    const { data: { user: callingUser } } = await adminClient.auth.getUser(req.headers.get('Authorization')?.replace('Bearer ', ''));
    if (!callingUser) {
        throw new Error("Não autorizado: Nenhum usuário autenticado encontrado para esta requisição.");
    }
    
    const { data: callingUserProfile, error: callingUserProfileError } = await adminClient
        .from('profiles')
        .select('is_super_admin')
        .eq('id', callingUser.id)
        .single();

    if (callingUserProfileError || !callingUserProfile) {
        console.error(`[update-platform-user] Erro ao buscar perfil do chamador ${callingUser.id}:`, callingUserProfileError);
        throw new Error("Não autorizado: Falha ao verificar permissões do chamador.");
    }
    if (!callingUserProfile.is_super_admin) {
        throw new Error("Não autorizado: Apenas Super Admins podem atualizar usuários.");
    }
    
    const SUPER_ADMIN_EMAIL_CONST = Deno.env.get('SUPER_ADMIN_EMAIL_CONST') || 'usedonjuan@gmail.com';
    const { data: targetUserAuthDetails, error: targetUserAuthError } = await adminClient.auth.admin.getUserById(userIdToUpdate);
    
    if (targetUserAuthError || !targetUserAuthDetails?.user) { // Check if targetUserAuthDetails.user is null
        console.error(`[update-platform-user] Erro ao buscar detalhes do usuário alvo ${userIdToUpdate} em auth.users:`, targetUserAuthError);
        throw new Error(`Não foi possível obter detalhes do usuário alvo: ${targetUserAuthError?.message || 'Usuário não encontrado.'}`);
    }

    if (targetUserAuthDetails.user.email === SUPER_ADMIN_EMAIL_CONST) {
        if (updates.isSuperAdmin === false || updates.isActive === false) {
            throw new Error(`Alterações no status de super admin ou atividade do usuário Super Admin principal (${SUPER_ADMIN_EMAIL_CONST}) não são permitidas por esta função.`);
        }
    }


    // 1. Atualizar tabela public.profiles
    const profileUpdates: ProfileUpdates = {};
    if (updates.name !== undefined) profileUpdates.name = updates.name; 
    if (updates.isActive !== undefined) profileUpdates.is_active = updates.isActive;
    if (updates.isSuperAdmin !== undefined) profileUpdates.is_super_admin = updates.isSuperAdmin;
    // Removido: profileUpdates.updated_at = new Date().toISOString();
    // Se a coluna updated_at existir e tiver um trigger (ex: moddatetime), ela será atualizada automaticamente.

    // Só atualiza 'profiles' se houver alguma alteração além do 'updated_at' que foi removido.
    // Se 'updated_at' fosse o único campo a ser atualizado, este bloco seria pulado,
    // o que é bom se a coluna tiver trigger.
    const profileUpdateKeys = Object.keys(profileUpdates);
    if (profileUpdateKeys.length > 0) { 
      console.log("[update-platform-user] Atualizando profiles:", JSON.stringify(profileUpdates, null, 2));
      const { error: profileUpdateError } = await adminClient
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userIdToUpdate);

      if (profileUpdateError) {
        console.error(`[update-platform-user] Erro ao atualizar perfil ${userIdToUpdate}:`, profileUpdateError);
        throw new Error(`Falha ao atualizar perfil: ${profileUpdateError.message}`);
      }
      console.log(`[update-platform-user] Perfil ${userIdToUpdate} atualizado com sucesso.`);
    } else {
      console.log("[update-platform-user] Nenhuma atualização de perfil a ser feita na tabela 'profiles' (após remover updated_at explícito).");
    }

    // 2. Atualizar auth.users (user_metadata para nome)
    if (updates.name !== undefined) { 
      const currentMetadata = targetUserAuthDetails.user.user_metadata || {};
      const authUserUpdates: UserAttributes = {
        user_metadata: { 
            ...currentMetadata, 
            name: updates.name 
        }
      };
      console.log("[update-platform-user] Atualizando auth.users user_metadata:", JSON.stringify(authUserUpdates, null, 2));
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
        userIdToUpdate,
        authUserUpdates
      );
      if (authUpdateError) {
        console.error(`[update-platform-user] Erro ao atualizar user_metadata para ${userIdToUpdate}:`, authUpdateError);
        throw new Error(`Falha ao atualizar metadados de autenticação (nome): ${authUpdateError.message}`);
      }
      console.log(`[update-platform-user] User_metadata de ${userIdToUpdate} (nome) atualizado com sucesso.`);
    }
    
    return new Response(JSON.stringify({ success: true, message: "Usuário atualizado com sucesso." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error(`[update-platform-user] Erro CAPTURADO na Edge Function para userIdToUpdate ${userIdToUpdateForLogging || 'desconhecido'}:`, error.message, error.stack);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.message.startsWith("Não autorizado") ? 403 : (error.message.includes("não são permitidas") ? 400 : 500),
    });
  }
})
