import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { AuthUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/supabaseClient';
import { User as BaseUser } from '../types'; 
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
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 🚀 OTIMIZAÇÕES DE CACHE E PERFORMANCE
const PROFILE_FETCH_TIMEOUT = 5000; // Reduzido de 8s para 5s
const PROFILE_CACHE_DURATION = 15 * 60 * 1000; // Aumentado para 15 min
const SESSION_CACHE_DURATION = 5 * 60 * 1000; // Cache de sessão por 5 min
const MAX_RETRIES = 1; // Reduzido para ser mais rápido
const DEBOUNCE_DELAY = 100; // Para debounce de chamadas

// Cache global aprimorado com TTL automático
class OptimizedCache<T> {
  private cache = new Map<string, { data: T; timestamp: number; ttl: number }>();
  private cleanupInterval: number; // Changed from NodeJS.Timeout to number

  constructor(cleanupIntervalMs = 60000) {
    this.cleanupInterval = window.setInterval(() => this.cleanup(), cleanupIntervalMs); // Used window.setInterval
  }

  set(key: string, data: T, ttl: number = PROFILE_CACHE_DURATION): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  destroy(): void {
    window.clearInterval(this.cleanupInterval); // Used window.clearInterval
    this.cache.clear();
  }
}

// Instâncias de cache otimizadas
const profileCache = new OptimizedCache<AppUser | null>();
const sessionCache = new OptimizedCache<Session | null>();
const activeProfileFetches = new Map<string, Promise<AppUser | null>>();
const retryCount = new Map<string, number>();

// 🚀 DEBOUNCE UTILITY
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: number; // Changed from NodeJS.Timeout to number
  return (...args: Parameters<T>) => {
    window.clearTimeout(timeoutId); // Used window.clearTimeout
    timeoutId = window.setTimeout(() => func(...args), delay); // Used window.setTimeout
  };
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);
  const isInitialized = useRef(false);
  const logoutSignalRef = useRef(false);
  const lastProfileFetchRef = useRef<string>(''); // Para evitar fetches desnecessários

  // 🚀 FALLBACK PROFILE OTIMIZADO COM MEMOIZAÇÃO
  const createFallbackProfile = useCallback((supabaseUser: AuthUser, reason: string): AppUser => {
    const userEmail = supabaseUser?.email || '';
    const fallbackName = supabaseUser.user_metadata?.name || 
                        supabaseUser.user_metadata?.full_name || 
                        userEmail.split('@')[0] || 'Usuário';

    return {
      id: supabaseUser.id,
      email: userEmail,
      name: `${fallbackName} (${reason})`,
      isSuperAdmin: userEmail === SUPER_ADMIN_EMAIL,
      isActive: true,
      createdAt: supabaseUser.created_at,
      isFallback: true,
    };
  }, []);

  // 🚀 FETCH PROFILE SUPER OTIMIZADO
  const fetchUserProfile = useCallback(async (
    supabaseUser: AuthUser | null, 
    sourceCall: string,
    forceRefresh = false
  ): Promise<AppUser | null> => {
    if (logoutSignalRef.current || !supabaseUser?.id) return null;

    const userId = supabaseUser.id;
    const cacheKey = `${userId}_${sourceCall}`;
    
    // Evita fetches duplicados para o mesmo usuário/contexto
    if (!forceRefresh && lastProfileFetchRef.current === cacheKey) {
      const cached = profileCache.get(userId);
      if (cached) return cached;
    }

    // Cache hit - retorna imediatamente
    if (!forceRefresh && profileCache.has(userId)) {
      return profileCache.get(userId);
    }

    // Reutiliza fetch ativo
    if (activeProfileFetches.has(userId)) {
      return activeProfileFetches.get(userId)!;
    }

    // Verifica limite de retries
    const currentRetries = retryCount.get(userId) || 0;
    if (currentRetries >= MAX_RETRIES) {
      const fallback = createFallbackProfile(supabaseUser, 'MAX_RETRIES');
      profileCache.set(userId, fallback);
      return fallback;
    }

    lastProfileFetchRef.current = cacheKey;

    const fetchPromise = (async (): Promise<AppUser | null> => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), PROFILE_FETCH_TIMEOUT);

      try {
        // 🚀 QUERY OTIMIZADA - apenas campos necessários
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('id, name, is_super_admin, is_active, created_at')
          .eq('id', userId)
          .abortSignal(controller.signal)
          .limit(1) // Garante que retorna apenas 1 registro
          .single(); // Mais eficiente que maybeSingle para casos esperados

        window.clearTimeout(timeoutId);

        if (error) {
          if (error.code === 'PGRST116') { // No rows returned
            const fallback = createFallbackProfile(supabaseUser, 'NOT_FOUND');
            profileCache.set(userId, fallback);
            return fallback;
          }

          if (error.name === 'AbortError') {
            retryCount.set(userId, currentRetries + 1);
            return createFallbackProfile(supabaseUser, 'TIMEOUT');
          }

          return createFallbackProfile(supabaseUser, `ERROR_${error.code || 'UNKNOWN'}`);
        }

        retryCount.delete(userId);

        const fetchedUser: AppUser = {
          id: userId,
          email: supabaseUser.email || '',
          name: profileData.name || 
                supabaseUser.user_metadata?.name || 
                supabaseUser.user_metadata?.full_name || 
                supabaseUser.email?.split('@')[0] || 'Usuário',
          isSuperAdmin: (profileData.is_super_admin ?? false) || (supabaseUser.email === SUPER_ADMIN_EMAIL),
          isActive: profileData.is_active ?? true,
          createdAt: profileData.created_at || supabaseUser.created_at,
          isFallback: false,
        };

        // Cache com TTL estendido para perfis válidos
        profileCache.set(userId, fetchedUser, PROFILE_CACHE_DURATION);
        return fetchedUser;

      } catch (error: any) {
        window.clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          retryCount.set(userId, currentRetries + 1);
          return createFallbackProfile(supabaseUser, 'ABORT_ERROR');
        }
        return createFallbackProfile(supabaseUser, 'EXCEPTION');
      } finally {
        activeProfileFetches.delete(userId);
      }
    })();

    activeProfileFetches.set(userId, fetchPromise);
    return fetchPromise;
  }, [createFallbackProfile]);

  // 🚀 REFRESH PROFILE MANUAL (para updates em tempo real)
  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      const freshProfile = await fetchUserProfile(session.user, 'manual_refresh', true);
      if (mountedRef.current && freshProfile) {
        setUser(freshProfile);
      }
    }
  }, [session?.user, fetchUserProfile]);

  // 🚀 PROCESS SESSION DEBOUNCED PARA EVITAR CHAMADAS EXCESSIVAS
  const processSessionAndUser = useCallback(async (currentSession: Session | null, source: string) => {
    if (logoutSignalRef.current && source.includes('SIGNED_IN')) {
      return; // Ignora logins durante logout
    }

    if (!mountedRef.current) return;

    // Cache de sessão para evitar processamento desnecessário
    const sessionCacheKey = `${currentSession?.user?.id || 'null'}_${source}`;
    if (sessionCache.has(sessionCacheKey) && !source.includes('manual_refresh')) {
      const cachedSession = sessionCache.get(sessionCacheKey);
      if (cachedSession === currentSession) return;
    }

    setIsLoading(true);

    try {
      let newAppProfile: AppUser | null = null;
      
      if (currentSession?.user) {
        // Usa cache agressivo para TOKEN_REFRESHED se o usuário for válido
        if (source.includes('TOKEN_REFRESHED') && user && !user.isFallback) {
          newAppProfile = user; // Reutiliza perfil existente
        } else {
          newAppProfile = await fetchUserProfile(currentSession.user, source);
        }
      }

      if (mountedRef.current) {
        setSession(currentSession);
        setUser(newAppProfile);
        
        // Cache da sessão processada
        sessionCache.set(sessionCacheKey, currentSession, SESSION_CACHE_DURATION);
      }
    } catch (error) {
      console.error(`processSessionAndUser(${source}) - Erro:`, error);
      if (mountedRef.current) {
        setUser(null);
        setSession(null);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchUserProfile, user]);

  // Debounced version para evitar spam
  const debouncedProcessSession = useMemo(
    () => debounce(processSessionAndUser, DEBOUNCE_DELAY),
    [processSessionAndUser]
  );

  // 🚀 INICIALIZAÇÃO OTIMIZADA
  useEffect(() => {
    if (isInitialized.current) return;
    
    isInitialized.current = true;
    mountedRef.current = true;

    let authListenerCleanup: (() => void) | undefined;

    const initializeAuth = async () => {
      try {
        // Tentativa de recuperar sessão do cache primeiro
        const cachedSession = sessionCache.get('initial_session');
        if (cachedSession) {
          await processSessionAndUser(cachedSession, 'cached_session');
          // Não retorne aqui, pois o listener ainda precisa ser configurado
        }

        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Erro ao obter sessão inicial:", error);
          if (mountedRef.current) setIsLoading(false);
          return;
        }

        if (initialSession && !cachedSession) { // Só salva no cache se não veio do cache
          sessionCache.set('initial_session', initialSession, SESSION_CACHE_DURATION);
        }
        
        // Processa a sessão (ou a do cache ou a recém-buscada), mas só se não foi processada pelo cache
        if (!cachedSession && mountedRef.current) {
             await processSessionAndUser(initialSession, "initial_session");
        }


        // Listener otimizado
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if (!mountedRef.current) return;

          // Usa debounced para eventos que podem vir em rajada
          if (event === 'TOKEN_REFRESHED') {
            debouncedProcessSession(newSession, `onAuthStateChange:${event}`);
          } else {
            await processSessionAndUser(newSession, `onAuthStateChange:${event}`);
          }
        });
        authListenerCleanup = () => authListener?.subscription?.unsubscribe();


      } catch (error) {
        console.error("Erro na inicialização:", error);
        if (mountedRef.current) setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isInitialized.current = false;
      mountedRef.current = false;
      authListenerCleanup?.();
      activeProfileFetches.clear();
      retryCount.clear();
      // profileCache.clear(); // A classe OptimizedCache tem seu próprio destroy
      // sessionCache.clear();
      profileCache.destroy(); // Chamar destroy para limpar o intervalo
      sessionCache.destroy(); // Chamar destroy para limpar o intervalo
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Dependências devem ser mínimas para evitar re-inicialização

  // 🚀 LOGIN OTIMIZADO
  const login = useCallback(async (email: string, password: string) => {
    logoutSignalRef.current = false;
    if (!mountedRef.current) return;
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // processSessionAndUser será chamado pelo listener
    } catch (error: any) {
      if (mountedRef.current) setIsLoading(false);
      
      const errorMessages: Record<string, string> = {
        'Invalid login credentials': 'Credenciais inválidas. Verifique seu e-mail e senha.',
        'Email not confirmed': 'E-mail não confirmado. Verifique sua caixa de entrada.',
        'Too many requests': 'Muitas tentativas. Tente novamente em alguns minutos.',
      };
      
      const displayMessage = errorMessages[error.message] || error.message || 'Falha no login.';
      throw new Error(displayMessage);
    }
  }, []);

  // 🚀 REGISTER OTIMIZADO (sem mudanças significativas, mas com melhor tratamento de erro)
  const register = useCallback(async (data: RegisterData): Promise<{ success: boolean; needsEmailConfirmation?: boolean }> => {
    logoutSignalRef.current = false;
    
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
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
        const errorMessages: Record<string, string> = {
          'user already registered': 'Este e-mail já está cadastrado.',
          'Password should be at least 6 characters': 'A senha deve ter no mínimo 6 caracteres.',
          'Unable to validate email address': 'E-mail inválido.',
          'Database error saving new user': 'Erro ao finalizar cadastro. Tente novamente.',
        };
        
        let displayMessage = signUpError.message; // Default to original message
        Object.keys(errorMessages).forEach(key => {
          if (signUpError.message.toLowerCase().includes(key.toLowerCase())) {
            displayMessage = errorMessages[key];
          }
        });
        
        throw new Error(displayMessage);
      }

      if (signUpData.user && signUpData.session) {
        await processSessionAndUser(signUpData.session, 'register_autologin');
        return { success: true, needsEmailConfirmation: false };
      }

      return { success: true, needsEmailConfirmation: true };

    } catch (error: any) {
      throw new Error(error.message || 'Falha no registro.');
    }
  }, [processSessionAndUser]);

  // 🚀 LOGOUT SUPER OTIMIZADO
  const logout = useCallback(async () => {
    if (!mountedRef.current) return;
    
    logoutSignalRef.current = true;
    setIsLoading(true);

    try {
      // Limpa caches imediatamente
      if (session?.user?.id) {
        const userId = session.user.id;
        activeProfileFetches.delete(userId);
        profileCache.delete(userId);
        retryCount.delete(userId);
      }
      
      // Limpa todos os caches de sessão
      sessionCache.clear();
      sessionCache.delete('initial_session');


      const { error } = await supabase.auth.signOut();
      if (error) console.warn("Aviso no signOut:", error.message);

    } catch (error: any) {
      console.error("Erro inesperado no logout:", error);
    } finally {
      if (mountedRef.current) {
        setUser(null);
        setSession(null);
        setIsLoading(false);
      }
      
      // Reset do sinal com timeout
      window.setTimeout(() => { // Use window.setTimeout for browser
        logoutSignalRef.current = false;
      }, 1000);
    }
  }, [session?.user?.id]);

  const requestPasswordReset = useCallback(async (email: string) => {
    logoutSignalRef.current = false;
    
    try {
      const redirectTo = `${window.location.origin}/auth#type=recovery`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
    } catch (error: any) {
      throw new Error(error.message || 'Falha ao solicitar redefinição de senha.');
    }
  }, []);

  // 🚀 VALORES MEMOIZADOS OTIMIZADOS
  const isAuthenticatedValue = useMemo(() => 
    !!(session && user && user.isActive && !user.isFallback), 
    [session, user]
  );
  
  const isSuperAdminValue = useMemo(() => 
    isAuthenticatedValue && (user?.isSuperAdmin ?? false), 
    [isAuthenticatedValue, user?.isSuperAdmin]
  );
  
  const accessTokenValue = useMemo(() => 
    session?.access_token || null, 
    [session?.access_token]
  );

  const contextValue = useMemo(() => ({
    user,
    session,
    accessToken: accessTokenValue,
    isAuthenticated: isAuthenticatedValue,
    isSuperAdmin: isSuperAdminValue,
    login,
    register,
    logout,
    requestPasswordReset,
    refreshProfile,
    isLoading,
  }), [
    user,
    session,
    accessTokenValue,
    isAuthenticatedValue,
    isSuperAdminValue,
    login,
    register,
    logout,
    requestPasswordReset,
    refreshProfile,
    isLoading,
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
