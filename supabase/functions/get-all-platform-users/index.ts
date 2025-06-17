
// supabase/functions/get-all-platform-users/index.ts
// @ts-ignore
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// @ts-ignore
import { createClient, User as AuthUserSupabase } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { Database } from '../_shared/db_types.ts';

// Declare Deno for TypeScript
declare const Deno: any;

// This should align with the frontend User type in types.ts
interface AppUser {
  id: string;
  email: string;
  name?: string;
  isSuperAdmin?: boolean;
  isActive?: boolean;
  createdAt?: string;
}

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

// It's better to pass SUPER_ADMIN_EMAIL as an environment variable to the function if possible,
// or ensure the logic primarily relies on the is_super_admin flag from the database.
const SUPER_ADMIN_EMAIL_CONST = Deno.env.get('SUPER_ADMIN_EMAIL_CONST') || 'usedonjuan@gmail.com';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase URL or Service Role Key not configured in Edge Function environment.");
    }

    const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });

    // 1. Fetch all users from auth.users
    // For very large user bases, consider pagination. Default limit for listUsers is 50. Max is 1000.
    const { data: authUsersResponse, error: authError } = await adminClient.auth.admin.listUsers({
      perPage: 10000, 
    });

    if (authError) {
      console.error("[get-all-platform-users] Error fetching auth users:", authError);
      throw new Error(`Failed to fetch authentication users: ${authError.message}`);
    }
    const authUsers = authUsersResponse.users;

    // 2. Fetch all profiles from public.profiles
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, name, is_super_admin, is_active, created_at'); // Select only needed fields

    if (profilesError) {
      console.error("[get-all-platform-users] Error fetching profiles:", profilesError);
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    // 3. Combine the data
    const combinedUsers: AppUser[] = authUsers.map((authUser: AuthUserSupabase) => {
      const profile = profiles?.find((p: ProfileRow) => p.id === authUser.id);
      
      const userEmail = authUser.email!; // Email from auth.users is the source of truth and should exist.
      // Fallback for name: profile.name -> authUser.user_metadata.name -> email prefix
      const userName = profile?.name || authUser.user_metadata?.name || userEmail.split('@')[0] || 'Usuário';
      const userCreatedAt = authUser.created_at || profile?.created_at;


      return {
        id: authUser.id,
        email: userEmail,
        name: userName,
        // isSuperAdmin: profile?.is_super_admin ?? (userEmail === SUPER_ADMIN_EMAIL_CONST), // Check profile first
        isSuperAdmin: profile?.is_super_admin === true ? true : (profile?.is_super_admin === false ? false : (userEmail === SUPER_ADMIN_EMAIL_CONST)),
        isActive: profile?.is_active ?? true, // Default to active if not in profiles or if null
        createdAt: userCreatedAt,
      };
    });

    return new Response(JSON.stringify({ users: combinedUsers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("[get-all-platform-users] Error in function:", error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
