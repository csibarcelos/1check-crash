
import { supabase } from '@/supabaseClient'; 
import { SUPER_ADMIN_EMAIL } from '../constants.tsx'; 
import { AppUser } from '@/contexts/AuthContext'; 
import { AuthUser } from '@supabase/supabase-js'; 

// --- START: CACHE MANAGEMENT ---
const appUserCache = new Map<string, { user: AppUser, timestamp: number }>();
const CACHE_TTL = 5 * 1000; // Cache de 5 segundos para o AppUser

const getAppUserFromCache = (userId: string): AppUser | null => {
  const cached = appUserCache.get(userId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.user;
  }
  appUserCache.delete(userId);
  return null;
};

const setAppUserInCache = (userId: string, user: AppUser) => {
  appUserCache.set(userId, { user, timestamp: Date.now() });
};

const invalidateAppUserCache = (userId: string) => {
  appUserCache.delete(userId);
};

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
    if (session?.user?.id) {
      invalidateAppUserCache(session.user.id);
    } else {
      // If user ID is not available, clear all cache (e.g., on initial sign out)
      appUserCache.clear();
    }
  }
});
// --- END: CACHE MANAGEMENT ---

export const authService = {
  async getCurrentSupabaseUser(): Promise<AuthUser | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user || null;
  },

  async getCurrentAppUser(): Promise<AppUser | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const cachedUser = getAppUserFromCache(session.user.id);
    if (cachedUser) return cachedUser;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (error && error.code !== 'PGRST116'){
          console.error('Error fetching profile for getCurrentAppUser:', error);
          return null; 
      }

      let appUser: AppUser;
      if (!profile) { 
        console.warn(`Profile not found for user ${session.user.id} in getCurrentAppUser.`);
         appUser = { 
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário',
            isSuperAdmin: (session.user.email === SUPER_ADMIN_EMAIL), 
            isActive: true, // Default to true if no profile
            createdAt: session.user.created_at,
         };
      } else {
        appUser = {
          id: session.user.id,
          email: session.user.email || '',
          name: profile.name || session.user.user_metadata?.name,
          isSuperAdmin: profile.is_super_admin ?? false, // Ensure boolean
          isActive: profile.is_active ?? true, // Ensure boolean, default to true if null
          createdAt: profile.created_at || session.user.created_at,
        };
      }
      setAppUserInCache(session.user.id, appUser);
      return appUser;

    } catch (fetchError) {
        console.error('Exception fetching profile for getCurrentAppUser:', fetchError);
        return null;
    }
  },

  async getToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }
};