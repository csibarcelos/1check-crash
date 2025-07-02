import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from '../contexts/AuthContext';
import { AppLogoIcon } from '../components/AppLogoIcon'; 
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div as any;

const EmailIcon = React.memo((props: React.SVGProps<SVGSVGElement>) => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}> <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /> </svg> ));
EmailIcon.displayName = 'EmailIcon';
const LockClosedIcon = React.memo((props: React.SVGProps<SVGSVGElement>) => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}> <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /> </svg> ));
LockClosedIcon.displayName = 'LockClosedIcon';
const UserIcon = React.memo((props: React.SVGProps<SVGSVGElement>) => ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}> <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /> </svg> ));
UserIcon.displayName = 'UserIcon';

const pageVariants = { initial: { opacity: 0, y: 20 }, in: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "circOut" as const } }, out: { opacity: 0, y: -20, transition: { duration: 0.3, ease: "circIn" as const } } };
const cardVariants = { initial: { opacity: 0, scale: 0.95 }, in: { opacity: 1, scale: 1, transition: { duration: 0.4, delay: 0.2, ease: "circOut" as const } }, out: { opacity: 0, scale: 0.95, transition: { duration: 0.2, ease: "circIn" as const } } };
const COMMON_INPUT_CLASSES = "block w-full px-4 py-3.5 rounded-xl shadow-sm focus:outline-none sm:text-sm transition-all duration-300 ease-in-out bg-auth-input-bg border border-auth-input-border focus:border-auth-input-focus-border focus:ring-1 focus:ring-auth-input-focus-border text-auth-text-primary placeholder-auth-text-secondary caret-auth-accent-gold";
const ICON_WRAPPER_CLASSES = "absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-auth-text-secondary";

type ViewType = 'login' | 'register' | 'forgotPassword' | 'emailVerification' | 'updatePassword';

interface FormState { email: string; password: string; confirmPassword: string; fullName: string; }
interface FormErrors { email?: string; password?: string; confirmPassword?: string; fullName?: string; general?: string; }

const validateEmail = (email: string): string | undefined => { if (!email) return 'E-mail é obrigatório'; if (!/\S+@\S+\.\S+/.test(email)) return 'E-mail inválido'; return undefined; };
const validatePassword = (password: string): string | undefined => { if (!password) return 'Senha é obrigatória'; if (password.length < 6) return 'A senha deve ter no mínimo 6 caracteres'; return undefined; };
const validateFullName = (fullName: string): string | undefined => { if (!fullName.trim()) return 'O nome completo é obrigatório'; if (fullName.trim().length < 2) return 'Nome deve ter pelo menos 2 caracteres'; return undefined; };

interface AuthButtonProps { type?: "button" | "submit" | "reset"; onClick?: () => void; isLoading?: boolean; children: React.ReactNode; className?: string; variant?: 'primary' | 'link'; disabled?: boolean; }
const AuthButtonComponent: React.FC<AuthButtonProps> = ({ type = "button", onClick, isLoading, children, className = '', variant = 'primary', disabled }) => {
  if (variant === 'link') return ( <button type={type} onClick={onClick} disabled={disabled} className={`font-semibold text-auth-accent-gold hover:text-auth-accent-gold-darker transition-colors duration-200 ${className}`} > {children} </button> );
  return ( <button type={type} onClick={onClick} disabled={isLoading || disabled} className={`w-full flex justify-center items-center px-6 py-3.5 border border-transparent text-base font-semibold rounded-xl shadow-lg text-auth-cta-text-dark bg-gradient-to-br from-auth-accent-gold to-auth-accent-gold-darker hover:from-auth-accent-gold-darker hover:to-auth-accent-gold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-auth-accent-gold focus:ring-offset-auth-card-bg transition-all duration-300 ease-in-out transform hover:scale-105 ${isLoading || disabled ? 'opacity-70 cursor-not-allowed' : ''} ${className}`} > {isLoading ? <LoadingSpinner size="sm" color="text-auth-cta-text-dark" /> : children} </button> );
};
const AuthButton = React.memo(AuthButtonComponent);
AuthButton.displayName = 'AuthButton';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, isAuthenticated, isLoading: authContextLoading, requestPasswordReset, updatePasswordFromRecovery, authEvent, setAuthEvent } = useAuth();

  const [currentView, setCurrentView] = useState<ViewType>('login');
  const [formState, setFormState] = useState<FormState>({ email: '', password: '', confirmPassword: '', fullName: '' });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const hasNavigatedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { setHasMounted(true); document.body.classList.add('auth-page-reimagined-theme'); return () => { document.body.classList.remove('auth-page-reimagined-theme'); }; }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hash = location.hash;
    if (params.get('register') === 'true') setCurrentView('register');
    if (hash.includes('#type=update_password')) {
      setCurrentView('updatePassword');
    }
  }, [location.search, location.hash]);
  
  useEffect(() => {
    if (authEvent === 'PASSWORD_RECOVERY' && location.hash.includes('type=update_password')) {
      setCurrentView('updatePassword');
      setAuthEvent(null);
    }
  }, [authEvent, setAuthEvent, location.hash]);


  useEffect(() => { if (hasMounted && !authContextLoading && isAuthenticated && !hasNavigatedRef.current && currentView !== 'updatePassword') { hasNavigatedRef.current = true; navigate('/dashboard'); } }, [isAuthenticated, navigate, authContextLoading, hasMounted, currentView]);

  const updateFormField = useCallback((field: keyof FormState, value: string) => { setFormState(prev => ({ ...prev, [field]: value })); if (formErrors[field]) { setFormErrors(prev => ({ ...prev, [field]: undefined })); } }, [formErrors]);
  const clearForm = useCallback(() => { setFormState({ email: '', password: '', confirmPassword: '', fullName: '' }); setFormErrors({}); setSuccessMessage(null); }, []);
  const handleViewChange = useCallback((view: ViewType) => { setCurrentView(view); clearForm(); if(view !== 'updatePassword') navigate('/auth' + (view === 'register' ? '?register=true' : '')); else navigate('/auth#type=update_password'); }, [clearForm, navigate]);

  const validateForm = useCallback((): boolean => {
    const errors: FormErrors = {};
    if (currentView !== 'emailVerification' && currentView !== 'updatePassword') { const emailError = validateEmail(formState.email); if (emailError) errors.email = emailError; }
    if (currentView === 'register') { const fullNameError = validateFullName(formState.fullName); if (fullNameError) errors.fullName = fullNameError; const passwordError = validatePassword(formState.password); if (passwordError) errors.password = passwordError; if (formState.password !== formState.confirmPassword) errors.confirmPassword = 'As senhas não coincidem'; } 
    else if (currentView === 'login') { const passwordError = validatePassword(formState.password); if (passwordError) errors.password = passwordError; }
    else if (currentView === 'updatePassword') { const passwordError = validatePassword(formState.password); if (passwordError) errors.password = passwordError; if (formState.password !== formState.confirmPassword) errors.confirmPassword = 'As senhas não coincidem'; }
    setFormErrors(errors); return Object.keys(errors).length === 0;
  }, [currentView, formState]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setFormLoading(true); setFormErrors(prev => ({ ...prev, general: undefined })); setSuccessMessage(null);
    try {
      if (currentView === 'register') { const result = await register({ email: formState.email, password: formState.password, full_name: formState.fullName }); if (result?.success && result.needsEmailConfirmation) { setCurrentView('emailVerification'); setSuccessMessage(`Cadastro realizado! Enviamos um e-mail de confirmação para ${formState.email}. Verifique sua caixa de entrada (e spam) para ativar sua conta.`); } } 
      else if (currentView === 'login') { await login(formState.email, formState.password); } 
      else if (currentView === 'forgotPassword') { await requestPasswordReset(formState.email); setSuccessMessage(`Se uma conta com o e-mail ${formState.email} existir, um link para redefinição de senha foi enviado.`); }
      else if (currentView === 'updatePassword') { await updatePasswordFromRecovery(formState.password); setSuccessMessage('Senha alterada com sucesso! Você já pode fazer login.'); handleViewChange('login'); }
    } catch (err: any) { setFormErrors(prev => ({ ...prev, general: err.message || 'Ocorreu um erro. Tente novamente.' }));
    } finally { setFormLoading(false); }
  }, [currentView, formState, validateForm, login, register, requestPasswordReset, updatePasswordFromRecovery, handleViewChange]);

  const title = useMemo(() => {
    switch (currentView) {
      case 'register': return 'Crie sua Conta Exclusiva';
      case 'forgotPassword': return 'Redefinir Senha';
      case 'emailVerification': return 'Verifique seu E-mail';
      case 'updatePassword': return 'Defina sua Nova Senha';
      default: return 'Acesse a Plataforma';
    }
  }, [currentView]);

  const isFormSubmittable = useMemo(() => {
    if (currentView === 'emailVerification') return true;
    if (currentView === 'forgotPassword') return !!formState.email && !validateEmail(formState.email);
    if (currentView === 'login') return !!formState.email && !validateEmail(formState.email) && !!formState.password && !validatePassword(formState.password);
    if (currentView === 'register') return !!formState.email && !validateEmail(formState.email) && !!formState.fullName && !validateFullName(formState.fullName) && !!formState.password && !validatePassword(formState.password) && !!formState.confirmPassword && formState.password === formState.confirmPassword;
    if (currentView === 'updatePassword') return !!formState.password && !validatePassword(formState.password) && !!formState.confirmPassword && formState.password === formState.confirmPassword;
    return false;
  }, [currentView, formState]);

  if (!hasMounted) return null;
  if (authContextLoading && !isAuthenticated) return ( <div className="min-h-screen flex items-center justify-center auth-page-reimagined-theme"> <LoadingSpinner size="lg" /> </div> );

  return (
    <MotionDiv key="authPageContainer" className="min-h-screen auth-page-reimagined-theme flex flex-col justify-center py-12 sm:px-6 lg:px-8 overflow-hidden relative" variants={pageVariants} initial="initial" animate="in" exit="out" >
      <div className="aurora-effect gold-aurora"></div> <div className="aurora-effect green-aurora"></div>
      <MotionDiv className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.1, ease: "circOut" as const } }} >
        <Link to="/"> <AppLogoIcon className="mx-auto h-24 w-auto mb-6 text-auth-accent-gold filter drop-shadow-[0_2px_3px_rgba(255,193,7,0.5)]" /> </Link>
        <h2 className="text-3xl font-bold font-display text-auth-text-primary tracking-tight"> {title} </h2>
        {currentView !== 'emailVerification' && currentView !== 'updatePassword' && (
          <p className="mt-3 text-sm text-auth-text-secondary">
            {currentView === 'login' && (<>Não tem conta? <AuthButton variant="link" onClick={() => handleViewChange('register')}>Crie uma agora</AuthButton></>)}
            {currentView === 'register' && (<>Já possui uma conta? <AuthButton variant="link" onClick={() => handleViewChange('login')}>Faça login</AuthButton></>)}
            {currentView === 'forgotPassword' && (<>Lembrou a senha? <AuthButton variant="link" onClick={() => handleViewChange('login')}>Faça login</AuthButton></>)}
          </p>
        )}
      </MotionDiv>
      <MotionDiv className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10" variants={cardVariants} initial="initial" animate="in" exit="out" >
        <div className="bg-auth-card-bg border border-auth-card-border shadow-2xl rounded-2xl py-10 px-6 sm:px-10 backdrop-filter backdrop-blur-xl">
          <AnimatePresence mode="wait">
            <MotionDiv key={currentView} initial={{ opacity: 0, x: currentView === 'login' ? -30 : 30 }} animate={{ opacity: 1, x: 0, transition: { duration: 0.4, ease: "circOut" as const } }} exit={{ opacity: 0, x: currentView === 'login' ? 30 : -30, transition: { duration: 0.2, ease: "circIn" as const } }} >
              {currentView === 'emailVerification' ? (
                <div className="text-center space-y-5"> <EmailIcon className="h-16 w-16 text-auth-accent-gold mx-auto"/> <p className="text-auth-text-secondary text-base">{successMessage}</p> <AuthButton onClick={() => handleViewChange('login')}> Ir para Login </AuthButton> </div>
              ) : (
                <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
                  {currentView === 'register' && (
                    <>
                      <div>
                        <label htmlFor="fullName" className="block text-sm font-medium text-auth-text-secondary sr-only">Nome Completo</label>
                        <div className="relative">
                          <div className={ICON_WRAPPER_CLASSES}><UserIcon className="h-5 w-5"/></div>
                          <input id="fullName" name="fullName" type="text" autoComplete="name" required value={formState.fullName} onChange={e => updateFormField('fullName', e.target.value)} className={`${COMMON_INPUT_CLASSES} pl-12`} placeholder="Nome Completo" />
                        </div>
                        {formErrors.fullName && <p className="mt-2 text-sm text-red-400">{formErrors.fullName}</p>}
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-auth-text-secondary sr-only">E-mail</label>
                        <div className="relative">
                          <div className={ICON_WRAPPER_CLASSES}><EmailIcon className="h-5 w-5"/></div>
                          <input id="email" name="email" type="email" autoComplete="email" required value={formState.email} onChange={e => updateFormField('email', e.target.value)} className={`${COMMON_INPUT_CLASSES} pl-12`} placeholder="E-mail" />
                        </div>
                        {formErrors.email && <p className="mt-2 text-sm text-red-400">{formErrors.email}</p>}
                      </div>
                      <div>
                        <label htmlFor="password" className="block text-sm font-medium text-auth-text-secondary sr-only">Senha</label>
                        <div className="relative">
                          <div className={ICON_WRAPPER_CLASSES}><LockClosedIcon className="h-5 w-5"/></div>
                          <input id="password" name="password" type="password" autoComplete="new-password" required value={formState.password} onChange={e => updateFormField('password', e.target.value)} className={`${COMMON_INPUT_CLASSES} pl-12`} placeholder="Senha (mín. 6 caracteres)" />
                        </div>
                        {formErrors.password && <p className="mt-2 text-sm text-red-400">{formErrors.password}</p>}
                      </div>
                      <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-auth-text-secondary sr-only">Confirmar Senha</label>
                        <div className="relative">
                          <div className={ICON_WRAPPER_CLASSES}><LockClosedIcon className="h-5 w-5"/></div>
                          <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required value={formState.confirmPassword} onChange={e => updateFormField('confirmPassword', e.target.value)} className={`${COMMON_INPUT_CLASSES} pl-12`} placeholder="Confirmar Senha" />
                        </div>
                        {formErrors.confirmPassword && <p className="mt-2 text-sm text-red-400">{formErrors.confirmPassword}</p>}
                      </div>
                    </>
                  )}

                  {currentView === 'login' && (
                    <>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-auth-text-secondary sr-only">E-mail</label>
                        <div className="relative">
                          <div className={ICON_WRAPPER_CLASSES}><EmailIcon className="h-5 w-5"/></div>
                          <input id="email" name="email" type="email" autoComplete="email" required value={formState.email} onChange={e => updateFormField('email', e.target.value)} className={`${COMMON_INPUT_CLASSES} pl-12`} placeholder="E-mail" />
                        </div>
                        {formErrors.email && <p className="mt-2 text-sm text-red-400">{formErrors.email}</p>}
                      </div>
                      <div>
                        <label htmlFor="password" className="block text-sm font-medium text-auth-text-secondary sr-only">Senha</label>
                        <div className="relative">
                          <div className={ICON_WRAPPER_CLASSES}><LockClosedIcon className="h-5 w-5"/></div>
                          <input id="password" name="password" type="password" autoComplete="current-password" required value={formState.password} onChange={e => updateFormField('password', e.target.value)} className={`${COMMON_INPUT_CLASSES} pl-12`} placeholder="Senha" />
                        </div>
                        {formErrors.password && <p className="mt-2 text-sm text-red-400">{formErrors.password}</p>}
                      </div>
                      <div className="text-right text-sm">
                        <AuthButton variant="link" onClick={() => handleViewChange('forgotPassword')}>Esqueceu sua senha?</AuthButton>
                      </div>
                    </>
                  )}

                  {currentView === 'forgotPassword' && (
                    <>
                      <p className="text-center text-sm text-auth-text-secondary">Digite seu e-mail para receber o link de redefinição.</p>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-auth-text-secondary sr-only">E-mail</label>
                        <div className="relative">
                          <div className={ICON_WRAPPER_CLASSES}><EmailIcon className="h-5 w-5"/></div>
                          <input id="email" name="email" type="email" autoComplete="email" required value={formState.email} onChange={e => updateFormField('email', e.target.value)} className={`${COMMON_INPUT_CLASSES} pl-12`} placeholder="Seu e-mail cadastrado" />
                        </div>
                        {formErrors.email && <p className="mt-2 text-sm text-red-400">{formErrors.email}</p>}
                      </div>
                    </>
                  )}

                  {currentView === 'updatePassword' && (
                    <>
                      <p className="text-center text-sm text-auth-text-secondary">Digite sua nova senha. Ela deve ter no mínimo 6 caracteres.</p>
                      <div>
                        <label htmlFor="password" className="block text-sm font-medium text-auth-text-secondary sr-only">Nova Senha</label>
                        <div className="relative">
                          <div className={ICON_WRAPPER_CLASSES}><LockClosedIcon className="h-5 w-5"/></div>
                          <input id="password" name="password" type="password" autoComplete="new-password" required value={formState.password} onChange={e => updateFormField('password', e.target.value)} className={`${COMMON_INPUT_CLASSES} pl-12`} placeholder="Nova Senha" />
                        </div>
                        {formErrors.password && <p className="mt-2 text-sm text-red-400">{formErrors.password}</p>}
                      </div>
                      <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-auth-text-secondary sr-only">Confirmar Nova Senha</label>
                        <div className="relative">
                          <div className={ICON_WRAPPER_CLASSES}><LockClosedIcon className="h-5 w-5"/></div>
                          <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required value={formState.confirmPassword} onChange={e => updateFormField('confirmPassword', e.target.value)} className={`${COMMON_INPUT_CLASSES} pl-12`} placeholder="Confirmar Nova Senha" />
                        </div>
                        {formErrors.confirmPassword && <p className="mt-2 text-sm text-red-400">{formErrors.confirmPassword}</p>}
                      </div>
                    </>
                  )}

                  <div>
                    <AuthButton type="submit" isLoading={formLoading} disabled={!isFormSubmittable}>
                      {currentView === 'register' ? 'Criar minha conta' :
                      currentView === 'login' ? 'Entrar' :
                      currentView === 'forgotPassword' ? 'Enviar link de redefinição' :
                      'Confirmar Nova Senha'}
                    </AuthButton>
                  </div>
                  {formErrors.general && <p className="mt-2 text-center text-sm text-red-400">{formErrors.general}</p>}
                  {successMessage && <p className="mt-2 text-center text-sm text-green-400">{successMessage}</p>}
                </form>
              )}
            </MotionDiv>
          </AnimatePresence>
        </div>
      </MotionDiv>
    </MotionDiv>
  );
};

export default AuthPage;