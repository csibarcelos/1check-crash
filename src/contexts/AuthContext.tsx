
import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { AuthUser } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js'; // Changed to type-only import
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
  updatePasswordFromRecovery: (password: string) => Promise<void>;
  updateUserPassword: (password: string) => Promise<void>;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  authEvent: string | null;
  setAuthEvent: (event: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// OTIMIZAÇÕES DE CACHE E PERFORMANCE
const PROFILE_FETCH_TIMEOUT = 5000; 
const PROFILE_CACHE_DURATION = 15 * 60 * 1000; 
const SESSION_CACHE_DURATION = 5 * 60 * 1000; 
const MAX_RETRIES = 2; 
const DEBOUNCE_DELAY = 100;
const INITIALIZATION_TIMEOUT = 10000; // Timeout para inicialização

class OptimizedCache<T> {
  private cache = new Map<string, { data: T; timestamp: number; ttl: number }>();
  private cleanupInterval: number; 

  constructor(cleanupIntervalMs = 60000) {
    this.cleanupInterval = window.setInterval(() => this.cleanup(), cleanupIntervalMs); 
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
    if (this.cleanupInterval) {
      window.clearInterval(this.cleanupInterval); 
    }
    this.cache.clear(); 
  }
}

// Instâncias globais de cache
let profileCache: OptimizedCache<AppUser | null> | null = null;
let sessionCache: OptimizedCache<Session | null> | null = null;
const activeProfileFetches = new Map<string, Promise<AppUser | null>>();
const retryCount = new Map<string, number>();

const debounce = <T extends (...args: any[]) => any>(
  func: T, 
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: number; 
  return (...args: Parameters<T>) => { 
    if (timeoutId) window.clearTimeout(timeoutId); 
    timeoutId = window.setTimeout(() => func(...args), delay); 
  };
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authEvent, setAuthEvent] = useState<string | null>(null);
  const [initializationComplete, setInitializationComplete] = useState(false);
  
  const mountedRef = useRef(true);
  const isInitialized = useRef(false);
  const logoutSignalRef = useRef(false);
  const lastProfileFetchRef = useRef<string>(''); 
  const userRef = useRef<AppUser | null>(user);
  const initTimeoutRef = useRef<number | undefined>(undefined);

  // Inicializar caches se não existirem
  if (!profileCache) profileCache = new OptimizedCache<AppUser | null>(60000);
  if (!sessionCache) sessionCache = new OptimizedCache<Session | null>(60000);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

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

  const fetchUserProfile = useCallback(async (
    supabaseUser: AuthUser | null, 
    sourceCall: string, 
    forceRefresh = false
  ): Promise<AppUser | null> => {
    if (logoutSignalRef.current || !supabaseUser?.id || !profileCache) return null;
    
    const userId = supabaseUser.id;
    const cacheKey = `${userId}_${sourceCall}`;
    
    if (!forceRefresh && lastProfileFetchRef.current === cacheKey) { 
      const cached = profileCache.get(userId); 
      if (cached) return cached; 
    }
    
    if (!forceRefresh && profileCache.has(userId)) { 
      return profileCache.get(userId); 
    }
    
    if (activeProfileFetches.has(userId)) { 
      return activeProfileFetches.get(userId)!; 
    }
    
    const currentRetries = retryCount.get(userId) || 0;
    if (currentRetries >= MAX_RETRIES) { 
      const fallback = createFallbackProfile(supabaseUser, 'MAX_RETRIES'); 
      profileCache.set(userId, fallback, PROFILE_CACHE_DURATION); 
      return fallback; 
    }
    
    lastProfileFetchRef.current = cacheKey;
    
    const fetchPromise = (async (): Promise<AppUser | null> => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(new DOMException('Profile fetch timeout', 'AbortError')), PROFILE_FETCH_TIMEOUT);
      
      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('id, name, is_super_admin, is_active, created_at')
          .eq('id', userId)
          .abortSignal(controller.signal)
          .limit(1) 
          .single(); 
        
        window.clearTimeout(timeoutId);
        
        if (error) {
          if (error.code === 'PGRST116') { 
            const fallback = createFallbackProfile(supabaseUser, 'NOT_FOUND'); 
            profileCache!.set(userId, fallback, PROFILE_CACHE_DURATION); 
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
        
        profileCache!.set(userId, fetchedUser, PROFILE_CACHE_DURATION);
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

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      const freshProfile = await fetchUserProfile(session.user, 'manual_refresh', true);
      if (mountedRef.current && freshProfile) {
        setUser(freshProfile);
      }
    }
  }, [session?.user, fetchUserProfile]);

  const clearAuthState = useCallback(() => {
    console.log('🧹 Limpando estado de autenticação');
    if (mountedRef.current) {
      setUser(null);
      setSession(null);
      setAuthEvent(null);
      setIsLoading(false);
      setInitializationComplete(true);
    }
    
    // Limpar caches
    if (profileCache) profileCache.clear();
    if (sessionCache) sessionCache.clear();
    activeProfileFetches.clear();
    retryCount.clear();
  }, []);

  const processSessionAndUser = useCallback(async (currentSession: Session | null, source: string) => {
    console.log(`🔄 processSessionAndUser(${source})`, { 
      hasSession: !!currentSession, 
      userId: currentSession?.user?.id,
      mounted: mountedRef.current,
      logoutSignal: logoutSignalRef.current
    });

    if (logoutSignalRef.current && source.includes('SIGNED_IN')) { 
      console.log('🚫 Ignorando SIGNED_IN durante logout');
      return; 
    }
    
    if (!mountedRef.current) {
      console.log('🚫 Componente desmontado, ignorando processamento');
      return;
    }

    // Verificar se a sessão é válida
    if (currentSession && !currentSession.user) {
      console.log('⚠️ Sessão inválida detectada (sem user), limpando estado');
      clearAuthState();
      return;
    }

    if (!sessionCache) {
      console.log('⚠️ sessionCache não disponível');
      return;
    }

    const sessionCacheKey = `${currentSession?.user?.id || 'null'}_${source}`;
    const cachedSessionEntry = sessionCache.get(sessionCacheKey);
    
    if (cachedSessionEntry === currentSession && !source.includes('manual_refresh') && !source.includes('login_direct')) { 
      console.log('💾 Usando sessão do cache');
      if (!initializationComplete) {
        setInitializationComplete(true);
        setIsLoading(false);
      }
      return; 
    }
    
    setIsLoading(true);
    
    try {
      let newAppProfile: AppUser | null = null;
      
      if (currentSession?.user) {
        console.log('👤 Buscando perfil do usuário');
        newAppProfile = await fetchUserProfile(currentSession.user, source);
      }

      if (mountedRef.current) {
        console.log('✅ Atualizando estado do auth', { 
          hasProfile: !!newAppProfile, 
          hasSession: !!currentSession 
        });
        
        setSession(currentSession);
        setUser(newAppProfile); 
        sessionCache.set(sessionCacheKey, currentSession, SESSION_CACHE_DURATION);
        
        // Gerenciar eventos de auth
        if (source.includes('PASSWORD_RECOVERY')) {
          setAuthEvent('PASSWORD_RECOVERY');
        } else if (source.includes('USER_UPDATED') && currentSession?.user?.id === userRef.current?.id) { 
          setAuthEvent('USER_PASSWORD_UPDATED');
        } else {
          setAuthEvent(null); 
        }
        
        setInitializationComplete(true);
      }
    } catch (error: any) {
      console.error(`❌ Erro em processSessionAndUser(${source}):`, error);
      if (mountedRef.current) { 
        clearAuthState();
      }
    } finally {
      if (mountedRef.current) { 
        setIsLoading(false); 
      }
    }
  }, [fetchUserProfile, clearAuthState, initializationComplete]); 

  const debouncedProcessSession = useMemo(
    () => debounce(processSessionAndUser, DEBOUNCE_DELAY), 
    [processSessionAndUser]
  );

  useEffect(() => { 
    if (isInitialized.current) return;
    
    console.log('🚀 Inicializando AuthProvider');
    isInitialized.current = true;
    mountedRef.current = true;
    
    let authListenerCleanup: (() => void) | undefined;

    // Timeout de segurança para evitar loading infinito
    initTimeoutRef.current = window.setTimeout(() => {
      console.log('⏰ Timeout de inicialização atingido, forçando conclusão');
      if (mountedRef.current && !initializationComplete) {
        setInitializationComplete(true);
        setIsLoading(false);
      }
    }, INITIALIZATION_TIMEOUT);

    const initializeAuth = async () => {
      try {
        console.log('🔍 Verificando sessão inicial');
        
        // Primeiro, tentar obter a sessão atual
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) { 
          console.error("❌ Erro ao obter sessão inicial:", error.message);
          
          // Tratar erros específicos de token inválido
          if (error.message.includes('Invalid Refresh Token') || 
              error.message.includes('Token Not Found') ||
              error.message.includes('refresh_token_not_found')) {
            console.log('🔄 Token inválido detectado, limpando estado');
            clearAuthState();
            return;
          }
          
          // Para outros erros, ainda tentar limpar o estado
          if (mountedRef.current) {
            setInitializationComplete(true);
            setIsLoading(false);
          }
          return; 
        }
        
        console.log('📋 Sessão inicial obtida:', { 
          hasSession: !!initialSession, 
          userId: initialSession?.user?.id 
        });
        
        // Processar a sessão inicial
        if (mountedRef.current) { 
          await processSessionAndUser(initialSession, "initial_session"); 
        }
        
        // Configurar listener de mudanças de estado
        console.log('👂 Configurando listener de auth state');
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          console.log(`🔔 Auth state change: ${event}`, { 
            hasSession: !!newSession, 
            userId: newSession?.user?.id 
          });
          
          try {
            if (!mountedRef.current) {
              console.log('🚫 Componente desmontado, ignorando evento');
              return;
            }
            
            // Limpar timeout se ainda estiver ativo
            if (initTimeoutRef.current) {
              window.clearTimeout(initTimeoutRef.current);
              initTimeoutRef.current = undefined;
            }
            
            setAuthEvent(event); 
            
            if (event === 'TOKEN_REFRESHED') { 
              debouncedProcessSession(newSession, `onAuthStateChange:${event}`); 
            } else { 
              await processSessionAndUser(newSession, `onAuthStateChange:${event}`); 
            }
          } catch (e: any) {
            console.error(`❌ Erro no callback onAuthStateChange (evento: ${event}):`, e.message);
            
            // Recuperação graciosa: limpar estado de autenticação
            if (mountedRef.current) {
              clearAuthState();
              setAuthEvent('AUTH_ERROR');
            }
          }
        });
        
        authListenerCleanup = () => {
          console.log('🔇 Limpando listener de auth');
          authListener?.subscription?.unsubscribe();
        };
        
      } catch (error: any) { 
        console.error("❌ Erro na inicialização do AuthProvider:", error); 
        if (mountedRef.current) { 
          clearAuthState();
        } 
      }
    };

    initializeAuth();

    return () => { 
      console.log('🧹 Cleanup do AuthProvider');
      
      isInitialized.current = false; 
      mountedRef.current = false; 
      
      if (initTimeoutRef.current) {
        window.clearTimeout(initTimeoutRef.current);
      }
      
      authListenerCleanup?.(); 
      activeProfileFetches.clear(); 
      retryCount.clear(); 
      
      if (profileCache) {
        profileCache.destroy(); 
        // profileCache = null; // MANTEMOS A INSTÂNCIA, APENAS LIMPAMOS
      }
      if (sessionCache) {
        sessionCache.destroy(); 
        // sessionCache = null; // MANTEMOS A INSTÂNCIA, APENAS LIMPAMOS
      }
      
      setAuthEvent(null); 
    };
  }, [debouncedProcessSession, processSessionAndUser, clearAuthState, initializationComplete]);

  const login = useCallback(async (email: string, password: string) => {
    console.log('🔐 Tentativa de login');
    logoutSignalRef.current = false;
    if (!mountedRef.current) return;
    
    setIsLoading(true);
    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      console.log('✅ Login realizado com sucesso (signInWithPassword)');
      // Após o login bem-sucedido, processar a sessão imediatamente.
      // Se signInData.session for null, o getSession() abaixo deve obter a sessão correta.
      const currentSession = signInData.session || (await supabase.auth.getSession()).data.session;
      
      if (currentSession) {
        console.log('🔄 Processando sessão diretamente após login');
        await processSessionAndUser(currentSession, 'login_direct');
      } else {
        console.warn('⚠️ Sessão não disponível imediatamente após login, aguardando onAuthStateChange.');
        // Se a sessão não estiver disponível, o onAuthStateChange deverá tratar.
        // No entanto, isso é menos ideal. A sessão deveria estar disponível.
        // Se o problema persistir, pode ser necessário forçar um refresh ou investigar o fluxo do Supabase.
      }

    } catch (error: any) {
      console.error('❌ Erro no login:', error.message);
      if (mountedRef.current) setIsLoading(false); // Garante que o loading é desativado em caso de erro
      
      const errorMessages: Record<string, string> = { 
        'Invalid login credentials': 'Credenciais inválidas. Verifique seu e-mail e senha.', 
        'Email not confirmed': 'E-mail não confirmado. Verifique sua caixa de entrada.', 
        'Too many requests': 'Muitas tentativas. Tente novamente em alguns minutos.', 
      };
      
      const displayMessage = errorMessages[error.message] || error.message || 'Falha no login.';
      throw new Error(displayMessage);
    } finally {
      // setIsLoading(false) é geralmente tratado pelo processSessionAndUser,
      // mas se o login falhar antes de chamar processSessionAndUser, precisamos garantir que ele seja resetado.
      // O bloco catch já faz isso para erros. Se não houver erro, processSessionAndUser deve lidar.
      if (mountedRef.current && !session) { // Se a sessão não foi obtida, pode ser que o loading não foi resetado.
          setIsLoading(false);
      }
    }
  }, [processSessionAndUser, session]); // Adicionado processSessionAndUser e session

  const register = useCallback(async (data: RegisterData): Promise<{ success: boolean; needsEmailConfirmation?: boolean }> => {
    console.log('📝 Tentativa de registro');
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
        console.error('❌ Erro no registro:', signUpError.message);
        const errorMessages: Record<string, string> = { 
          'user already registered': 'Este e-mail já está cadastrado.', 
          'Password should be at least 6 characters': 'A senha deve ter no mínimo 6 caracteres.', 
          'Unable to validate email address': 'E-mail inválido.', 
          'Database error saving new user': 'Erro ao finalizar cadastro. Tente novamente.', 
        };
        
        let displayMessage = signUpError.message; 
        Object.keys(errorMessages).forEach(key => { 
          if (signUpError.message.toLowerCase().includes(key.toLowerCase())) { 
            displayMessage = errorMessages[key]; 
          } 
        });
        
        throw new Error(displayMessage);
      }
      
      if (signUpData.user && signUpData.session) { 
        console.log('✅ Registro com auto-login realizado');
        await processSessionAndUser(signUpData.session, 'register_autologin'); 
        return { success: true, needsEmailConfirmation: false }; 
      }
      
      console.log('✅ Registro realizado, confirmação de email necessária');
      return { success: true, needsEmailConfirmation: true };
    } catch (error: any) { 
      throw new Error(error.message || 'Falha no registro.'); 
    }
  }, [processSessionAndUser]);

  const logout = useCallback(async () => {
    console.log('🚪 Realizando logout');
    if (!mountedRef.current) return;
    
    logoutSignalRef.current = true;
    setIsLoading(true);
    
    try {
      // Limpar caches específicos do usuário
      if (session?.user?.id) { 
        const userId = session.user.id; 
        activeProfileFetches.delete(userId); 
        if (profileCache) profileCache.delete(userId); 
        retryCount.delete(userId); 
      }
      
      // Limpar cache de sessão
      if (sessionCache) {
        sessionCache.clear(); 
        sessionCache.delete('initial_session');
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn("⚠️ Aviso no signOut:", error.message);
      }
      
      console.log('✅ Logout realizado com sucesso');
    } catch (error: any) { 
      console.error("❌ Erro inesperado no logout:", error);
    } finally {
      if (mountedRef.current) { 
        setUser(null); 
        setSession(null); 
        setIsLoading(false); 
        setAuthEvent(null);
      }
      
      // Reset do sinal de logout após um delay
      window.setTimeout(() => { 
        logoutSignalRef.current = false; 
      }, 1000);
    }
  }, [session?.user?.id]);

  const requestPasswordReset = useCallback(async (email: string) => {
    console.log('🔄 Solicitando reset de senha');
    logoutSignalRef.current = false;
    
    try {
      const redirectTo = `${window.location.origin}/auth#type=update_password`;
      console.log('Requesting password reset, redirectTo:', redirectTo);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      
      console.log('✅ Reset de senha solicitado com sucesso');
    } catch (error: any) {
      console.error('❌ Erro ao solicitar reset de senha:', error.message);
      throw new Error(error.message || 'Falha ao solicitar redefinição de senha.');
    }
  }, []);

  const updatePasswordFromRecovery = useCallback(async (password: string) => {
    console.log('🔐 Atualizando senha via recuperação');
    
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      console.log('✅ Senha atualizada, fazendo logout');
      await logout(); 
    } catch (error: any) {
      console.error("❌ Erro ao atualizar senha via recuperação:", error.message);
      throw new Error(error.message || 'Falha ao atualizar senha.');
    }
  }, [logout]);

  const updateUserPassword = useCallback(async (newPassword: string) => {
    console.log('🔐 Atualizando senha do usuário logado');
    
    if (!session) {
      throw new Error("Usuário não autenticado.");
    }
    
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        console.error("❌ Erro ao atualizar senha do usuário logado:", error.message);
        throw error;
      }
      
      console.log('✅ Senha do usuário atualizada com sucesso');
    } catch (error: any) {
      console.error("❌ Exceção ao atualizar senha do usuário logado:", error.message);
      throw new Error(error.message || 'Falha ao atualizar sua senha.');
    }
  }, [session]);

  // Valores memoizados para performance
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
    updatePasswordFromRecovery, 
    updateUserPassword, 
    refreshProfile, 
    isLoading: isLoading && !initializationComplete, // Só mostra loading se não inicializou
    authEvent, 
    setAuthEvent, 
  }), [
    user, session, accessTokenValue, isAuthenticatedValue, isSuperAdminValue,
    login, register, logout, requestPasswordReset,
    updatePasswordFromRecovery, updateUserPassword, refreshProfile, 
    isLoading, initializationComplete, authEvent, 
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