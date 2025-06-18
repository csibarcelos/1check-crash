
import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { AuthUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/supabaseClient';
import { User as BaseUser } from '../types'; // Changed from '@/types' to relative path
import { SUPER_ADMIN_EMAIL } from '../constants.tsx'; 

export interface AppUser extends BaseUser {
  isSuperAdmin: boolean;
  isActive: boolean;
  isFallback?: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password_not_name: string) => Promise<void>;
  register: (data: RegisterData) => Promise<{ success: boolean; needsEmailConfirmation?: boolean }>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_FETCH_TIMEOUT = 8000; 
const PROFILE_CACHE_DURATION = 10 * 60 * 1000; 
const MAX_RETRIES = 2; 

const activeProfileFetches = new Map<string, Promise<AppUser | null>>();
const profileCache = new Map<string, { profile: AppUser | null; timestamp: number }>();
const retryCount = new Map<string, number>();

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);
  const isInitialized = useRef(false);

  const createFallbackProfile = useCallback((supabaseUser: AuthUser, reason: string): AppUser => {
    const userEmail = supabaseUser?.email || '';
    // Prioritize user_metadata.name, then user_metadata.full_name, then split email
    const fallbackName = supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || userEmail.split('@')[0] || 'Usuário';

    const fallbackProfile: AppUser = {
      id: supabaseUser.id,
      email: userEmail,
      name: `${fallbackName} (${reason})`,
      isSuperAdmin: userEmail === SUPER_ADMIN_EMAIL,
      isActive: true,
      createdAt: supabaseUser.created_at,
      isFallback: true,
    };
    return fallbackProfile;
  }, []);

  const fetchUserProfile = useCallback(async (supabaseUser: AuthUser | null, sourceCall: string): Promise<AppUser | null> => {
    const userId = supabaseUser?.id;
    const logPrefix = `AuthContext:fetchUserProfile(${userId?.substring(0,8)}, ${sourceCall})`;

    console.log(`${logPrefix} - Iniciado`);

    if (!userId || !supabaseUser) {
      console.log(`${logPrefix} - Sem usuário Supabase`);
      return null;
    }

    const cachedEntry = profileCache.get(userId);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < PROFILE_CACHE_DURATION)) {
      console.log(`${logPrefix} - Retornando do cache`);
      return cachedEntry.profile;
    }

    if (activeProfileFetches.has(userId)) {
      console.log(`${logPrefix} - Reutilizando requisição ativa`);
      return activeProfileFetches.get(userId)!;
    }

    const currentRetries = retryCount.get(userId) || 0;
    if (currentRetries >= MAX_RETRIES) {
      console.warn(`${logPrefix} - Máximo de tentativas atingido, usando fallback`);
      const fallback = createFallbackProfile(supabaseUser, 'MAX_RETRIES');
      profileCache.set(userId, { profile: fallback, timestamp: Date.now() });
      return fallback;
    }

    const fetchPromise = (async (): Promise<AppUser | null> => {
      const controller = new AbortController();
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      try {
        console.log(`${logPrefix} - Consultando Supabase...`);

        timeoutId = setTimeout(() => {
          console.warn(`${logPrefix} - Timeout de ${PROFILE_FETCH_TIMEOUT}ms`);
          controller.abort();
        }, PROFILE_FETCH_TIMEOUT);

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, name, is_super_admin, is_active, created_at')
          .eq('id', userId)
          .abortSignal(controller.signal)
          .maybeSingle(); 

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        if (profileError) {
          console.warn(`${logPrefix} - Erro na consulta:`, profileError);

          if (profileError.name === 'AbortError' || profileError.message?.includes('aborted')) {
            retryCount.set(userId, currentRetries + 1);
            console.warn(`${logPrefix} - Timeout, tentativa ${currentRetries + 1}/${MAX_RETRIES}`);

            if (currentRetries + 1 < MAX_RETRIES) {
              setTimeout(() => {
                activeProfileFetches.delete(userId);
                fetchUserProfile(supabaseUser, `${sourceCall}:RETRY_${currentRetries + 1}`);
              }, 2000); 
            }
            return createFallbackProfile(supabaseUser, 'TIMEOUT');
          }
          return createFallbackProfile(supabaseUser, `ERROR_${profileError.code || 'UNKNOWN'}`);
        }

        retryCount.delete(userId);
        let fetchedUser: AppUser;

        if (!profileData) {
          console.log(`${logPrefix} - Perfil não encontrado, criando novo`);
          fetchedUser = createFallbackProfile(supabaseUser, 'NOT_FOUND');
        } else {
          console.log(`${logPrefix} - Perfil encontrado com sucesso`);
          fetchedUser = {
            id: userId, 
            email: supabaseUser.email || '', 
            name: profileData.name || supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'Usuário', 
            isSuperAdmin: (profileData.is_super_admin ?? false) || (supabaseUser.email === SUPER_ADMIN_EMAIL), 
            isActive: profileData.is_active ?? true, 
            createdAt: profileData.created_at || supabaseUser.created_at, 
            isFallback: false, 
          };
        }
        profileCache.set(userId, { profile: fetchedUser, timestamp: Date.now() });
        return fetchedUser;

      } catch (error: any) {
        if (timeoutId) clearTimeout(timeoutId);
        console.error(`${logPrefix} - Exceção capturada:`, error);
        if (error.name === 'AbortError') {
          retryCount.set(userId, currentRetries + 1);
          return createFallbackProfile(supabaseUser, 'ABORT_ERROR');
        }
        return createFallbackProfile(supabaseUser, 'EXCEPTION');
      } finally {
        activeProfileFetches.delete(userId);
        console.log(`${logPrefix} - Finalizado`);
      }
    })();

    activeProfileFetches.set(userId, fetchPromise);
    return fetchPromise;
  }, [createFallbackProfile]);

  const processSessionAndUser = useCallback(async (currentSession: Session | null, source: string) => {
    const logPrefix = `processSessionAndUser(${source})`;
    console.log(`${logPrefix} - Iniciado. Sessão: ${!!currentSession}, Montado: ${mountedRef.current}`);
    if (!mountedRef.current) {
      console.log(`${logPrefix} - Componente desmontado, abortando`);
      return;
    }
    try {
      let newAppProfile: AppUser | null = null;
      if (currentSession?.user) {
        console.log(`${logPrefix} - Buscando perfil do usuário...`);
        newAppProfile = await fetchUserProfile(currentSession.user, source);
        console.log(`${logPrefix} - Perfil obtido:`, { email: newAppProfile?.email, name: newAppProfile?.name, isFallback: newAppProfile?.isFallback });
      }
      if (mountedRef.current) {
        setSession(currentSession);
        setUser(prevUser => {
          if (source.includes('TOKEN_REFRESHED') && prevUser && !prevUser.isFallback && newAppProfile?.isFallback) {
            console.log(`${logPrefix} - TOKEN_REFRESHED: mantendo perfil válido existente`);
            return prevUser;
          }
          console.log(`${logPrefix} - Usuário atualizado. Autenticado: ${!!(currentSession && newAppProfile && newAppProfile.isActive)}`);
          return newAppProfile;
        });
      }
    } catch (error: any) {
      console.error(`${logPrefix} - Erro:`, error);
      if (mountedRef.current) {
        setUser(null);
        setSession(null);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        console.log(`${logPrefix} - isLoading = false`);
      }
    }
  }, [fetchUserProfile]);

  useEffect(() => {
    if (isInitialized.current) {
      console.log("AuthProvider - Já inicializado, ignorando");
      return;
    }
    isInitialized.current = true;
    mountedRef.current = true;
    console.log("AuthProvider - Inicializando...");
    let cleanupFunctions: (() => void)[] = [];
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("AuthProvider - Erro ao obter sessão inicial:", error);
          if (mountedRef.current) setIsLoading(false);
          return;
        }
        console.log("AuthProvider - Sessão inicial:", !!initialSession);
        if (mountedRef.current) await processSessionAndUser(initialSession, "initialGetSession");
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          console.log(`AuthProvider - Evento: ${event}, Nova sessão: ${!!newSession}`);
          if (!mountedRef.current) {
            console.log("AuthProvider - Componente desmontado, ignorando evento");
            return;
          }
          if (event === 'TOKEN_REFRESHED' && newSession?.user?.id === session?.user?.id && user && !user.isFallback) {
            console.log("AuthProvider - TOKEN_REFRESHED para usuário válido, apenas atualizando sessão");
            setSession(newSession);
            return;
          }
          await processSessionAndUser(newSession, `onAuthStateChange:${event}`);
        });
        cleanupFunctions.push(() => authListener?.subscription?.unsubscribe());
        console.log("AuthProvider - Listener configurado");
      } catch (error) {
        console.error("AuthProvider - Erro na inicialização:", error);
        if (mountedRef.current) setIsLoading(false);
      }
    };
    initializeAuth();
    return () => {
      console.log("AuthProvider - Cleanup");
      isInitialized.current = false;
      mountedRef.current = false;
      cleanupFunctions.forEach(cleanup => cleanup());
      activeProfileFetches.clear();
      retryCount.clear();
    };
  }, []); 

  const login = useCallback(async (email: string, password: string) => {
    console.log("AuthContext:login - Iniciando login para", email);
    if (!mountedRef.current) {
      console.log("AuthContext:login - Componente não montado");
      return;
    }
    setIsLoading(true);
    try {
      const { error, data: loginData } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      console.log("AuthContext:login - Login realizado com sucesso", loginData);
      // processSessionAndUser será chamado pelo onAuthStateChange
    } catch (error: any) {
      console.error("AuthContext:login - Erro:", error);
      if (mountedRef.current) setIsLoading(false);
      let displayMessage = 'Falha no login.';
      if (error.message === 'Invalid login credentials') {
          displayMessage = 'Credenciais inválidas. Verifique seu e-mail e senha.';
      } else {
          displayMessage = error.message || displayMessage;
      }
      throw new Error(displayMessage);
    }
  }, []);

  const register = async (
    data: RegisterData
  ): Promise<{ success: boolean; needsEmailConfirmation?: boolean }> => {
    try {
      console.log(`AuthContext:register - Iniciando registro para ${data.email}`);

      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              full_name: data.full_name,
              phone: data.phone,
            },
          },
        });

      if (signUpError) {
        console.error('AuthContext:register - Erro no signUp:', signUpError.message);
        // Verifica se o erro é de usuário já registrado
        if (signUpError.message.toLowerCase().includes("user already registered")) {
          throw new Error("Este e-mail já está cadastrado.");
        }
        throw signUpError;
      }
      
      console.log('AuthContext:register - signUpData:', signUpData);

      if (signUpData.user && !signUpData.session) {
         console.log('AuthContext:register - Usuário criado, confirmação de e-mail pendente:', signUpData.user.email);
         return { success: true, needsEmailConfirmation: true };
      }

      if (signUpData.user && signUpData.session) {
         console.log('AuthContext:register - Usuário registrado e logado (auto-confirmação):', signUpData.user.email);
         await processSessionAndUser(signUpData.session, 'register');
         return { success: true, needsEmailConfirmation: false };
      }
      
      // Este caso pode ocorrer se o usuário existir, mas não está confirmado, e tenta se registrar novamente.
      // O Supabase pode reenviar o e-mail de confirmação.
      if (signUpData.user && !signUpData.session && signUpData.user.email_confirmed_at === null) {
          console.log('AuthContext:register - Tentativa de registro de usuário existente não confirmado. E-mail de confirmação pode ter sido reenviado para:', signUpData.user.email);
          return { success: true, needsEmailConfirmation: true };
      }
      
      console.warn('AuthContext:register - Cenário de registro não esperado:', signUpData);
      return { success: true, needsEmailConfirmation: true };

    } catch (error: any) {
      console.error(`AuthContext:register - Erro capturado:`, error);
      let displayMessage = 'Falha no registro.';
      if (error.message) {
        if (error.message.toLowerCase().includes("user already registered") || error.message === "Este e-mail já está cadastrado.") {
          displayMessage = "Este e-mail já está cadastrado.";
        } else if (error.message.includes("Password should be at least 6 characters")) {
          displayMessage = "A senha deve ter no mínimo 6 caracteres.";
        } else if (error.message.includes("Unable to validate email address")) {
          displayMessage = "E-mail inválido.";
        } else if (error.message.includes("Database error saving new user")) {
          displayMessage = "Ocorreu um erro ao finalizar seu cadastro. Tente novamente ou contate o suporte.";
        } else {
          displayMessage = error.message; // Use the Supabase error message directly if not one of the common ones
        }
      }
      throw new Error(displayMessage);
    }
  };


  const logout = useCallback(async () => {
    console.log("AuthContext:logout - Iniciando logout");
    if (!mountedRef.current) return;
    setIsLoading(true); 
    try {
      if (session?.user?.id) {
        const userId = session.user.id;
        activeProfileFetches.delete(userId);
        profileCache.delete(userId);
        retryCount.delete(userId);
      }
      const { error } = await supabase.auth.signOut();
      if (error) console.error("AuthContext:logout - Erro:", error);
      console.log("AuthContext:logout - Logout realizado");
      // processSessionAndUser será chamado pelo onAuthStateChange
    } catch (error: any) {
      console.error("AuthContext:logout - Exceção:", error);
       if (mountedRef.current) { // Garante que o estado só é atualizado se montado
        setUser(null);
        setSession(null);
        setIsLoading(false);
      }
    }
  }, [session?.user?.id]);

  const requestPasswordReset = useCallback(async (email: string) => {
    console.log("AuthContext:requestPasswordReset - Solicitando para", email);
    if (!mountedRef.current) return;
    try {
      // O redirectTo deve ser o URL da sua página de autenticação onde o usuário pode definir uma nova senha.
      // Se você não tem uma rota específica para reset de senha, redirecione para a página de login e
      // trate o evento de 'PASSWORD_RECOVERY' lá.
      const redirectTo = `${window.location.origin}/auth#type=recovery`; 
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      console.log("AuthContext:requestPasswordReset - E-mail enviado com redirect para:", redirectTo);
    } catch (error: any) {
      console.error("AuthContext:requestPasswordReset - Erro:", error);
      throw new Error(error.message || 'Falha ao solicitar redefinição de senha.');
    }
  }, []);

  const isAuthenticatedValue = useMemo(() => !!(session && user && user.isActive && !user.isFallback), [session, user]);
  const isSuperAdminValue = useMemo(() => isAuthenticatedValue && (user?.isSuperAdmin ?? false), [isAuthenticatedValue, user?.isSuperAdmin]);
  const accessTokenValue = useMemo(() => session?.access_token || null, [session?.access_token]);

  const contextValue = useMemo(() => ({
    user, session, accessToken: accessTokenValue, isAuthenticated: isAuthenticatedValue,
    isSuperAdmin: isSuperAdminValue, login, register, logout, requestPasswordReset, isLoading,
  }), [
    user, session, accessTokenValue, isAuthenticatedValue, isSuperAdminValue, login, register, logout, requestPasswordReset, isLoading,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
