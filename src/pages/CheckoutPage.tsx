
import React, { useEffect, useState, useCallback, useRef, useMemo, startTransition } from 'react';
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Product, PaymentStatus, Coupon, PushInPayPixResponseData, AppSettings, PushInPayPixRequest, PaymentMethod } from '@/types'; // Removed SaleProductItem, AbandonedCartStatus, PlatformSettings
import { productService } from '@/services/productService';
import { salesService, CreateSaleRecordPayload } from '@/services/salesService'; 
import { abandonedCartService, CreateAbandonedCartPayload } from '@/services/abandonedCartService';
import { Button } from '@/components/ui/Button';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { CheckIcon, PHONE_COUNTRY_CODES, DocumentDuplicateIcon, MOCK_WEBHOOK_URL, AppLogoIcon, cn } from '../constants.tsx'; // Removed TagIcon, PLATFORM_NAME
// import { LIVE_VIEW_CHANNEL_NAME, LiveViewEvent } from '../constants.tsx'; // TEMPORARILY HIDDEN
import { settingsService } from '@/services/settingsService';
import { supabase } from '@/supabaseClient';
// import { Database } from '@/types/supabase'; // Removed Database import
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Select } from '@/components/ui/Select';
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import { default as debounce } from 'https://esm.sh/lodash@4.17.21/debounce';


const LockClosedIconSolid: React.FC<React.SVGProps<SVGSVGElement>> = React.memo((props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002 2v-7a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
  </svg>
));
LockClosedIconSolid.displayName = 'LockClosedIconSolid';


const formatCurrency = (valueInCents: number): string => {
    return `R$ ${(valueInCents / 100).toFixed(2).replace('.', ',')}`;
};

const getContrastingTextColorForCta = (hexColor?: string, theme?: 'light' | 'dark'): string => {
    const defaultDarkThemeCtaText = 'var(--reimagined-cta-text)';
    const defaultLightThemeCtaText = 'var(--checkout-color-primary-cta-text)';
    if (!hexColor) return theme === 'dark' ? defaultDarkThemeCtaText : defaultLightThemeCtaText;
    try {
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5 ? (theme === 'dark' ? defaultDarkThemeCtaText : '#1F2937') : (theme === 'dark' ? defaultDarkThemeCtaText : '#FFFFFF');
    } catch (e) { return theme === 'dark' ? defaultDarkThemeCtaText : defaultLightThemeCtaText; }
};

const LOCALSTORAGE_CHECKOUT_FORM_KEY = 'checkoutFormData_v3';
const LOCALSTORAGE_CHECKOUT_SESSION_KEY = 'checkout_session_id_v2';
const POLLING_INITIAL_INTERVAL = 3000;
const POLLING_MAX_INTERVAL = 15000;
const POLLING_TIMEOUT_DURATION = 5 * 60 * 1000;
const ABANDONED_CART_DEBOUNCE_MS = 5000;
const BUYER_DETAILS_DEBOUNCE_MS = 1500;
const MANUAL_CHECK_COOLDOWN_MS = 10000; 

const productDataCache = new Map<string, { data: Product; timestamp: number }>();
const PRODUCT_CACHE_TTL = 2 * 60 * 1000;

interface CheckoutFormState {
  customerName: string;
  customerEmail: string;
  rawWhatsappNumber: string;
  customerWhatsappCountryCode: string;
  couponCodeInput: string;
}

interface CheckoutPrices {
  finalPrice: number;
  originalPriceBeforeDiscount: number;
  discountApplied: number;
}

interface CheckoutPageUIProps {
  product: Product | null;
  formState: CheckoutFormState;
  prices: CheckoutPrices;
  handleFormChange: <K extends keyof CheckoutFormState>(field: K, value: CheckoutFormState[K]) => void;
  handleApplyCoupon: () => void;
  couponError: string | null;
  appliedCoupon: Coupon | null;
  includeOrderBump: boolean;
  handleToggleOrderBump: (enabled: boolean) => void;
  isSubmitting: boolean;
  handlePayWithPix: () => Promise<void>;
  pixData: PushInPayPixResponseData | null;
  copyPixCode: () => void;
  copySuccess: boolean;
  paymentStatus: PaymentStatus | null;
  error: string | null;
  primaryColorStyle: string;
  ctaTextColorStyle: string;
  isPollingPayment: boolean;
  clearAppliedCoupon: () => void;
  removeOrderBump: () => void;
  currentTheme: 'light' | 'dark';
  isPageLoading: boolean; 
  countdownTimerText: string | null;
  hasLeftContent: boolean;
  handleManualCheck: () => void; 
  isManualChecking: boolean;    
  canManuallyCheck: boolean;  
  isReadyToRedirect: boolean; 
  handleProceedToThankYou: () => void; 
}

// Interface for the response from the 'gerar-pix' Edge Function
interface GerarPixEdgeFunctionResponse {
  success: boolean;
  data?: PushInPayPixResponseData; // This is the PIX data from PushInPay
  saleId?: string; // This should be the same saleId passed to the EF
  message?: string;
}

// Removed unused VerifyStatusFunctionResponse interface


const SkeletonCard: React.FC<{ className?: string }> = React.memo(({ className }) => (
  <div className={cn("p-6 md:p-8 shadow-2xl rounded-3xl bg-[var(--reimagined-card-bg)] animate-pulse", className)}>
    <div className="h-8 bg-neutral-700 rounded w-3/4 mb-6 mx-auto"></div>
    <div className="space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-6 bg-neutral-700 rounded w-full"></div>)}
    </div>
    <div className="h-12 bg-neutral-600 rounded-xl w-full mt-8"></div>
  </div>
));
SkeletonCard.displayName = "SkeletonCard";

const CheckoutPageUI: React.FC<CheckoutPageUIProps> = React.memo(({
  product, formState, prices, handleFormChange,
  handleApplyCoupon, couponError, appliedCoupon,
  includeOrderBump, handleToggleOrderBump, isSubmitting, handlePayWithPix,
  pixData, copyPixCode, copySuccess, paymentStatus, error, primaryColorStyle, ctaTextColorStyle,
  isPollingPayment, clearAppliedCoupon, removeOrderBump, currentTheme, isPageLoading,
  countdownTimerText, hasLeftContent,
  handleManualCheck, isManualChecking, canManuallyCheck,
  isReadyToRedirect, handleProceedToThankYou
}) => {

  const themeContainerClass = `checkout-page-theme ${currentTheme === 'dark' ? 'checkout-reimagined-theme' : 'checkout-light-theme'}`;
  const cardThemeClass = currentTheme === 'dark' ? 'card-checkout-reimagined' : 'card-checkout-specific';
  const inputThemeClass = currentTheme === 'dark' ? 'input-checkout-reimagined' : 'input-checkout-specific';
  const buttonThemeClass = currentTheme === 'dark' ? 'button-checkout-reimagined' : 'button-checkout-specific';
  const selectTriggerThemeClass = currentTheme === 'dark' ? 'bg-[var(--reimagined-input-bg)] border-[var(--reimagined-input-border)] text-[var(--reimagined-text-strong)] rounded-r-none border-r-0 h-11' : 'select-trigger-checkout-light rounded-r-none border-r-0 h-11';
  const selectContentThemeClass = currentTheme === 'dark' ? 'bg-[var(--reimagined-card-bg)] border-[var(--reimagined-card-border)] text-[var(--reimagined-text-default)]' : 'bg-[var(--checkout-color-bg-surface)] border-[var(--checkout-color-border-subtle)] text-[var(--checkout-color-text-default)]';
  const headerProductNameClass = currentTheme === 'dark' ? 'text-[var(--reimagined-accent-gold)]' : 'text-[var(--checkout-color-text-strong)]';
  const defaultTextColorClass = currentTheme === 'dark' ? 'text-[var(--reimagined-text-default)]' : 'text-[var(--checkout-color-text-default)]';
  const mutedTextColorClass = currentTheme === 'dark' ? 'text-[var(--reimagined-text-muted)]' : 'text-[var(--checkout-color-text-muted)]';
  const strongTextColorClass = currentTheme === 'dark' ? 'text-[var(--reimagined-text-strong)]' : 'text-[var(--checkout-color-text-strong)]';
  const labelTextColorClass = currentTheme === 'dark' ? 'text-[var(--reimagined-text-muted)]' : 'text-[var(--checkout-color-text-muted)]';

  const phoneCountryOptions = useMemo(() => PHONE_COUNTRY_CODES.map(cc => ({ value: cc.value, label: `${cc.emoji} ${cc.value}` })), []);
  
  if (isPageLoading || !product) {
    return (
      <div className={cn(themeContainerClass, "min-h-screen py-10 md:py-16 lg:py-20")}>
         <header className="mb-10 md:mb-12 text-center">
            <div className="h-16 md:h-20 w-32 md:w-40 bg-neutral-700 rounded-lg mx-auto mb-4 animate-pulse"></div>
            <div className="h-10 w-3/4 md:w-1/2 bg-neutral-700 rounded mx-auto animate-pulse"></div>
          </header>
        <div className="container mx-auto px-4 max-w-6xl">
          <div className={`grid grid-cols-1 ${hasLeftContent ? 'lg:grid-cols-2' : 'lg:grid-cols-1 justify-items-center'} gap-x-10 md:gap-x-12 gap-y-8 items-start`}>
            {hasLeftContent && (
              <div className="lg:col-span-1 space-y-8 lg:sticky lg:top-16">
                <div className="aspect-video bg-neutral-700 rounded-3xl shadow-2xl animate-pulse"></div>
                <div className="h-40 bg-neutral-700 rounded-3xl animate-pulse"></div>
              </div>
            )}
            <div className={`space-y-8 w-full ${hasLeftContent ? 'lg:col-span-1' : 'lg:max-w-lg mx-auto'}`}>
                <SkeletonCard className={cardThemeClass} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(themeContainerClass, "min-h-screen py-10 md:py-16 lg:py-20")}>
      <header className="mb-10 md:mb-12 text-center">
        {product.checkoutCustomization?.logoUrl ? (
          <img src={product.checkoutCustomization.logoUrl} alt={`${product.name} Logo`} className="h-16 md:h-20 mx-auto mb-4 object-contain" />
        ) : (
          <AppLogoIcon className="h-16 md:h-20 mx-auto mb-4" style={{ color: primaryColorStyle }} />
        )}
         {(product.checkoutCustomization?.showProductName !== false) && (
             <h1 className={`text-3xl md:text-4xl font-bold ${headerProductNameClass} font-display`}>{product.name}</h1>
         )}
      </header>

      <div className="container mx-auto px-4 max-w-6xl">
        <div className={`grid grid-cols-1 ${hasLeftContent ? 'lg:grid-cols-2' : 'lg:grid-cols-1 justify-items-center'} gap-x-10 md:gap-x-12 gap-y-8 items-start`}>

          {hasLeftContent && (
            <div className="lg:col-span-1 space-y-8 lg:sticky lg:top-16">
              {product.checkoutCustomization?.videoUrl ? (
                <div className={`aspect-video bg-black rounded-3xl shadow-2xl overflow-hidden border ${currentTheme === 'dark' ? 'border-[var(--reimagined-card-border)]' : 'border-[var(--checkout-color-border-subtle)]' }`}>
                  <iframe width="100%" height="100%" src={product.checkoutCustomization.videoUrl.replace("watch?v=", "embed/")} title="Vídeo do Produto" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                </div>
              ) : product.imageUrl && (
                <img src={product.imageUrl} alt={product.name} className={`w-full rounded-3xl shadow-2xl object-cover max-h-[500px] border ${currentTheme === 'dark' ? 'border-[var(--reimagined-card-border)]' : 'border-[var(--checkout-color-border-subtle)]' }`} />
              )}
              {product.checkoutCustomization?.salesCopy && product.checkoutCustomization.salesCopy.replace(/<[^>]*>?/gm, '').trim() !== '' && (
                <Card className={`${cardThemeClass} p-6 md:p-8`} disableHoverEffect={true}>
                  <div className={`prose prose-sm sm:prose-base max-w-none ${currentTheme === 'dark' ? 'prose-invert' : ''} prose-headings:${strongTextColorClass} prose-p:${defaultTextColorClass} prose-strong:${strongTextColorClass}`} dangerouslySetInnerHTML={{ __html: product.checkoutCustomization.salesCopy }} />
                </Card>
              )}
              {product.checkoutCustomization?.testimonials && product.checkoutCustomization.testimonials.length > 0 && (
                <Card className={`${cardThemeClass} p-6 md:p-8`} disableHoverEffect={true}>
                    <h3 className={`text-xl font-semibold mb-6 font-display ${strongTextColorClass}`}>O que nossos clientes dizem</h3>
                    <div className="space-y-5">
                    {product.checkoutCustomization.testimonials.map((testimonial, index) => (
                        <blockquote key={index} className={`p-4 rounded-2xl border ${currentTheme === 'dark' ? 'bg-[var(--reimagined-input-bg)] border-[var(--reimagined-input-border)]' : 'bg-slate-50 border-[var(--checkout-color-border-subtle)]'}`}>
                          <p className={`italic text-base ${defaultTextColorClass}`}>"{testimonial.text}"</p>
                          <footer className={`mt-3 text-sm font-medium`} style={{color: primaryColorStyle}}>- {testimonial.author}</footer>
                        </blockquote>
                    ))}
                    </div>
                </Card>
              )}
            </div>
          )}

          <div className={`space-y-8 w-full ${hasLeftContent ? 'lg:col-span-1' : 'lg:max-w-lg mx-auto'}`}>
            {countdownTimerText && (
                <div
                    className="text-center p-3.5 rounded-2xl font-semibold text-lg shadow-md"
                    style={{
                        backgroundColor: product.checkoutCustomization?.countdownTimer?.backgroundColor || (currentTheme === 'dark' ? 'var(--reimagined-accent-cta)' : 'var(--checkout-color-primary-DEFAULT)'),
                        color: product.checkoutCustomization?.countdownTimer?.textColor || (currentTheme === 'dark' ? 'var(--reimagined-cta-text)' : 'var(--checkout-color-primary-cta-text)')
                    }}
                >
                  {countdownTimerText}
                </div>
            )}

            <Card className={`${cardThemeClass} p-6 md:p-8 shadow-2xl`} disableHoverEffect={true}>
              <h2 className={`text-2xl md:text-3xl font-bold mb-8 font-display text-center ${strongTextColorClass}`}>Resumo do Pedido</h2>
              <div className={`border-b ${currentTheme === 'dark' ? 'border-[var(--reimagined-input-border)]' : 'border-[var(--checkout-color-border-subtle)]'} pb-6 mb-6 space-y-4`}>
                <div className="flex justify-between items-center">
                  <span className={defaultTextColorClass}>{product.name}</span>
                  <span className={`font-semibold ${defaultTextColorClass}`}>{formatCurrency(product.priceInCents)}</span>
                </div>
                {product.orderBump && includeOrderBump && product.orderBump.customPriceInCents !== undefined && (
                  <div className={`flex justify-between items-center text-sm py-2.5 border-t border-dashed ${currentTheme === 'dark' ? 'border-[var(--reimagined-input-border)]' : 'border-slate-200'}`}>
                    <span className={`${defaultTextColorClass}`}>{product.orderBump.name} <span className={`text-xs font-medium`} style={{color: primaryColorStyle}}>(+ Adicional)</span></span>
                    <span className={`font-medium ${defaultTextColorClass}`}>{formatCurrency(product.orderBump.customPriceInCents)}</span>
                  </div>
                )}
                {prices.discountApplied > 0 && appliedCoupon && (
                  <div className={`flex justify-between items-center text-sm text-status-success py-2.5 border-t border-dashed border-status-success/30`}>
                    <span>Desconto ({appliedCoupon.code})</span>
                    <span>-{formatCurrency(prices.discountApplied)}</span>
                  </div>
                )}
                <div className={`flex justify-between items-center mt-4 pt-5 border-t ${currentTheme === 'dark' ? 'border-[var(--reimagined-input-border)]' : 'border-[var(--checkout-color-border-subtle)]'}`}>
                  <span className={`text-xl font-bold font-display ${strongTextColorClass}`} >Total:</span>
                  <div className="text-right">
                    {prices.originalPriceBeforeDiscount !== prices.finalPrice && (
                         <span className={`block text-sm line-through ${mutedTextColorClass}`}>{formatCurrency(prices.originalPriceBeforeDiscount)}</span>
                    )}
                    <span className="text-3xl font-bold font-display" style={{color: primaryColorStyle}}>{formatCurrency(prices.finalPrice)}</span>
                  </div>
                </div>
              </div>

              {product.orderBump && product.orderBump.customPriceInCents !== undefined && !pixData && (
                <div className="my-8 p-5 rounded-3xl border-2 animate-pulse-subtle" style={{borderColor: `${primaryColorStyle}60`, backgroundColor: `${primaryColorStyle}1A`}}>
                    <h3 className="text-xl font-semibold mb-2 font-display" style={{color: primaryColorStyle}}>OFERTA EXCLUSIVA!</h3>
                    <p className={`text-base mb-1.5 ${defaultTextColorClass}`}>{product.orderBump.name}</p>
                    <p className={`text-sm ${mutedTextColorClass} mb-4`}>{product.orderBump.description}</p>
                    <div className="flex items-center justify-between">
                        <p className="text-2xl font-bold" style={{color: primaryColorStyle}}>
                            + {formatCurrency(product.orderBump.customPriceInCents)}
                        </p>
                        <ToggleSwitch
                            label={includeOrderBump ? 'Adicionado!' : 'Adicionar'}
                            enabled={includeOrderBump}
                            onEnabledChange={handleToggleOrderBump}
                            disabled={isSubmitting || !!pixData}
                            name="orderBumpToggle"
                            size="md"
                         />
                    </div>
                    {includeOrderBump && <button onClick={removeOrderBump} className="text-xs text-status-error hover:underline mt-2" disabled={isSubmitting || !!pixData}>Remover oferta</button>}
                </div>
              )}

              {pixData ? (
                <div className="space-y-5 text-center pt-4">
                  <h3 className="text-2xl font-semibold font-display" style={{color: primaryColorStyle}}>Pague com PIX para finalizar!</h3>
                  {paymentStatus === PaymentStatus.WAITING_PAYMENT && (
                    <>
                      <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="PIX QR Code" className="mx-auto w-60 h-60 md:w-64 md:h-64 rounded-3xl border-4 p-1.5 bg-white shadow-xl" style={{borderColor: primaryColorStyle}} />
                      <p className={`text-sm ${mutedTextColorClass} mt-3`}>Escaneie o QR Code acima ou copie o código.</p>
                      <div role="button" tabIndex={0} aria-label="Copiar código PIX" onClick={copyPixCode} onKeyDown={(e) => e.key === 'Enter' && copyPixCode()}
                           className={cn("relative rounded-xl overflow-hidden cursor-pointer group", inputThemeClass)}>
                        <div className={cn("h-20 p-4 text-xs whitespace-pre-wrap break-all overflow-hidden select-all", defaultTextColorClass)}>{pixData.qr_code}</div>
                        <div className={cn("absolute inset-0 flex flex-col items-center justify-center p-2 transition-all duration-300 ease-in-out", copySuccess ? "bg-status-success/90 text-white backdrop-blur-sm" : "bg-black/50 group-hover:bg-black/60 text-white backdrop-blur-xs")}>
                          {copySuccess ? (<><CheckIcon className="h-6 w-6 mb-1" /><span className="text-sm font-medium">Copiado!</span></>) : (<><DocumentDuplicateIcon className="h-6 w-6 mb-1" /><span className="text-sm font-medium">Copiar Código</span></>)}
                        </div>
                      </div>
                      {isPollingPayment && ( <div className="mt-4 flex items-center justify-center text-base" style={{color: mutedTextColorClass}}><LoadingSpinner size="sm" className="mr-2"/>Aguardando confirmação do pagamento...</div> )}
                      <Button onClick={handleManualCheck} isLoading={isManualChecking} disabled={!canManuallyCheck || isManualChecking || isPollingPayment} variant="outline" size="sm" className={cn(buttonThemeClass, "outline w-full mt-3")}> {isManualChecking ? 'Verificando...' : (canManuallyCheck ? 'Já paguei, verificar status' : 'Aguarde para verificar novamente')} </Button>
                    </>
                  )}
                  {paymentStatus === PaymentStatus.PAID && (
                    <div className="p-6 bg-status-success/10 text-status-success rounded-2xl border border-status-success/30 text-center">
                      <CheckIcon className="h-12 w-12 mx-auto mb-3"/>
                      <h3 className="text-xl font-semibold mb-1">Pagamento Confirmado!</h3>
                      <p className="text-sm mb-4">Seu pedido foi processado. Você será redirecionado em breve.</p>
                      <Button onClick={handleProceedToThankYou} className={cn(buttonThemeClass, "primary w-full")} style={{backgroundColor: primaryColorStyle, color: ctaTextColorStyle }} isLoading={isReadyToRedirect}>
                         {isReadyToRedirect ? 'Redirecionando...' : 'Ir para Obrigado'}
                      </Button>
                    </div>
                  )}
                  {(paymentStatus && [PaymentStatus.CANCELLED, PaymentStatus.EXPIRED, PaymentStatus.FAILED].includes(paymentStatus)) && (
                    <div className="p-5 bg-status-error/10 text-status-error rounded-2xl border border-status-error/30 text-center">
                      <h3 className="text-lg font-semibold mb-2">Pagamento Falhou</h3>
                      <p className="text-sm mb-3">Ocorreu um problema com seu pagamento (status: {paymentStatus}). Por favor, tente novamente.</p>
                      <Button onClick={handlePayWithPix} isLoading={isSubmitting} className={cn(buttonThemeClass, "primary w-full")} style={{backgroundColor: primaryColorStyle, color: ctaTextColorStyle }}>
                        Tentar Novamente com PIX
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); handlePayWithPix(); }} className="space-y-6">
                  <div>
                    <label htmlFor="customerName" className={labelTextColorClass}>Nome Completo</label>
                    <Input id="customerName" type="text" value={formState.customerName} onChange={e => handleFormChange('customerName', e.target.value)} required className={inputThemeClass} placeholder="Seu nome completo" />
                  </div>
                  <div>
                    <label htmlFor="customerEmail" className={labelTextColorClass}>Email</label>
                    <Input id="customerEmail" type="email" value={formState.customerEmail} onChange={e => handleFormChange('customerEmail', e.target.value)} required className={inputThemeClass} placeholder="seu.email@dominio.com" />
                  </div>
                  <div>
                    <label htmlFor="rawWhatsappNumber" className={labelTextColorClass}>WhatsApp</label>
                    <div className="flex">
                        <Select
                            name="customerWhatsappCountryCode"
                            value={formState.customerWhatsappCountryCode}
                            onValueChange={(value) => handleFormChange('customerWhatsappCountryCode', value)}
                            options={phoneCountryOptions}
                            className="w-28" // Ajuste a largura conforme necessário
                            triggerClassName={selectTriggerThemeClass}
                            contentClassName={selectContentThemeClass}
                            aria-label="Código do país do WhatsApp"
                        />
                        <Input id="rawWhatsappNumber" type="tel" value={formState.rawWhatsappNumber} onChange={e => handleFormChange('rawWhatsappNumber', e.target.value)} required className={`${inputThemeClass} rounded-l-none flex-1`} placeholder="Seu número com DDD" />
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-3">
                      <label htmlFor="couponCodeInput" className={labelTextColorClass}>Cupom de Desconto (Opcional)</label>
                      <div className="flex items-stretch gap-2">
                          <Input id="couponCodeInput" type="text" value={formState.couponCodeInput} onChange={e => handleFormChange('couponCodeInput', e.target.value.toUpperCase())} className={`${inputThemeClass} flex-grow`} placeholder="Seu cupom aqui" disabled={!!appliedCoupon} />
                          {appliedCoupon ? (
                              <Button type="button" onClick={clearAppliedCoupon} variant="ghost" className={cn("border border-status-error/50 text-status-error hover:bg-status-error/10", buttonThemeClass, "outline")} >Remover</Button>
                          ) : (
                              <Button type="button" onClick={handleApplyCoupon} variant="outline" className={cn(buttonThemeClass, "outline")} style={{borderColor: primaryColorStyle, color: primaryColorStyle}}>Aplicar</Button>
                          )}
                      </div>
                      {couponError && <p className="text-xs text-status-error mt-1">{couponError}</p>}
                      {appliedCoupon && <p className="text-xs text-status-success mt-1">Cupom "{appliedCoupon.code}" aplicado!</p>}
                  </div>

                  {error && <p className="text-sm text-status-error p-3 bg-status-error/10 rounded-xl border border-status-error/30">{error}</p>}
                  
                  <Button type="submit" isLoading={isSubmitting} className={cn("w-full py-4 text-lg font-semibold shadow-xl", buttonThemeClass, "primary")} style={{backgroundColor: primaryColorStyle, color: ctaTextColorStyle }}>
                    <LockClosedIconSolid className="h-5 w-5 mr-2"/> {isSubmitting ? "Processando..." : "Pagar com PIX"}
                  </Button>
                </form>
              )}
               <p className={`text-xs mt-8 text-center ${mutedTextColorClass}`}>
                Ambiente seguro. Seus dados estão protegidos.
              </p>
            </Card>
            
            {product.checkoutCustomization?.guaranteeBadges && product.checkoutCustomization.guaranteeBadges.length > 0 && (
              <div className="mt-8">
                <div className="flex flex-wrap justify-center items-center gap-4">
                  {product.checkoutCustomization.guaranteeBadges.map((badge) => (
                    <img key={badge.id} src={badge.imageUrl} alt={badge.altText} className="h-12 md:h-14 object-contain" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
CheckoutPageUI.displayName = 'CheckoutPageUI';

const CheckoutPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [product, setProduct] = useState<Product | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [formState, setFormState] = useState<CheckoutFormState>({ customerName: '', customerEmail: '', rawWhatsappNumber: '', customerWhatsappCountryCode: PHONE_COUNTRY_CODES[0].value, couponCodeInput: '' });
  const [prices, setPrices] = useState<CheckoutPrices>({ finalPrice: 0, originalPriceBeforeDiscount: 0, discountApplied: 0 });
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [includeOrderBump, setIncludeOrderBump] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pixData, setPixData] = useState<PushInPayPixResponseData | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const paymentStatusRef = useRef<PaymentStatus | null>(null); 
  
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const pollingIntervalTimerIdRef = useRef<number | null>(null);
  const pollingAttemptRef = useRef<number>(0);
  const pollingStartTimeRef = useRef<number>(0);
  const [canManuallyCheck, setCanManuallyCheck] = useState(true);
  const [isManualChecking, setIsManualChecking] = useState(false);
  const manualCheckTimeoutRef = useRef<number | null>(null);
  const [isReadyToRedirect, setIsReadyToRedirect] = useState(false);

  const [checkoutSessionId, setCheckoutSessionId] = useState<string>('');
  const hasSentEnterEventRef = useRef(false);
  
  const [countdownTimerText, setCountdownTimerText] = useState<string | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  const { user } = useAuth(); // Get current authenticated user, if any

  const debouncedSaveAbandonedCart = useRef(
    debounce(async (currentFormState: CheckoutFormState, currentProduct: Product | null) => {
      if (!currentProduct || !currentFormState.customerEmail.trim()) return;
      
      const payload: CreateAbandonedCartPayload = {
        platformUserId: currentProduct.platformUserId,
        productId: currentProduct.id,
        productName: currentProduct.name,
        potentialValueInCents: prices.finalPrice,
        customerName: currentFormState.customerName.trim(),
        customerEmail: currentFormState.customerEmail.trim(),
        customerWhatsapp: `${currentFormState.customerWhatsappCountryCode}${currentFormState.rawWhatsappNumber.replace(/\D/g, '')}`,
        trackingParameters: extractUtmParamsFromUrl(),
      };

      try {
        // Check if abandoned cart exists for this session/email
        const existingCartId = localStorage.getItem(`abandonedCartId_${currentProduct.id}_${currentFormState.customerEmail}`);
        if (existingCartId) {
            await abandonedCartService.updateAbandonedCartAttempt(existingCartId, payload);
            console.log("[CheckoutPage] Abandoned cart attempt updated:", existingCartId);
        } else {
            const newCart = await abandonedCartService.createAbandonedCartAttempt(payload);
            localStorage.setItem(`abandonedCartId_${currentProduct.id}_${currentFormState.customerEmail}`, newCart.id);
            console.log("[CheckoutPage] Abandoned cart attempt created:", newCart.id);
        }
      } catch (err) {
        console.warn("[CheckoutPage] Failed to save/update abandoned cart:", err);
      }
    }, ABANDONED_CART_DEBOUNCE_MS)
  ).current;
  
  const debouncedSaveBuyerDetails = useRef(
    debounce(async (currentFormState: CheckoutFormState) => {
      localStorage.setItem(LOCALSTORAGE_CHECKOUT_FORM_KEY, JSON.stringify(currentFormState));
    }, BUYER_DETAILS_DEBOUNCE_MS)
  ).current;
  
  // const sendLiveViewEvent = useCallback((event: LiveViewEvent) => { // TEMPORARILY HIDDEN
  //   const channel = supabase.channel(LIVE_VIEW_CHANNEL_NAME); // TEMPORARILY HIDDEN
  //   channel.send({ type: 'broadcast', event: 'live_view_event', payload: event }).catch(err => console.error("[CheckoutPage] Error sending broadcast message:", err)); // TEMPORARILY HIDDEN
  // }, []); // TEMPORARILY HIDDEN

  useEffect(() => {
    paymentStatusRef.current = paymentStatus;
  }, [paymentStatus]);

  useEffect(() => {
    const storedSessionId = localStorage.getItem(LOCALSTORAGE_CHECKOUT_SESSION_KEY) || uuidv4();
    localStorage.setItem(LOCALSTORAGE_CHECKOUT_SESSION_KEY, storedSessionId);
    setCheckoutSessionId(storedSessionId);

    const storedFormData = localStorage.getItem(LOCALSTORAGE_CHECKOUT_FORM_KEY);
    if (storedFormData) {
      try {
        const parsedData = JSON.parse(storedFormData);
        setFormState(prev => ({ ...prev, ...parsedData }));
      } catch (e) { console.warn("Failed to parse stored form data"); }
    }
    
    if (!hasSentEnterEventRef.current && storedSessionId) {
      // sendLiveViewEvent({ type: 'checkout_enter', payload: { userId: user?.id, checkoutSessionId: storedSessionId, timestamp: Date.now() } }); // TEMPORARILY HIDDEN
      hasSentEnterEventRef.current = true;
    }
    
    const handleBeforeUnload = () => {
      // sendLiveViewEvent({ type: 'checkout_leave', payload: { userId: user?.id, checkoutSessionId: storedSessionId, timestamp: Date.now() } }); // TEMPORARILY HIDDEN
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      debouncedSaveAbandonedCart.cancel();
      debouncedSaveBuyerDetails.cancel();
      if (pollingIntervalTimerIdRef.current) clearTimeout(pollingIntervalTimerIdRef.current);
      if (manualCheckTimeoutRef.current) clearTimeout(manualCheckTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      document.body.className = ''; // Reset body classes
    };
  // }, [sendLiveViewEvent, user?.id, debouncedSaveAbandonedCart, debouncedSaveBuyerDetails]); // TEMPORARILY HIDDEN (removed sendLiveViewEvent)
  }, [user?.id, debouncedSaveAbandonedCart, debouncedSaveBuyerDetails]);


  const extractUtmParamsFromUrl = (): Record<string, string> => {
    const params = new URLSearchParams(location.search);
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'src', 'sck', 'ref', 'gclid'];
    const utms: Record<string, string> = {};
    utmKeys.forEach(key => { if (params.has(key)) utms[key] = params.get(key)!; });
    return utms;
  };

  const calculatePrices = useCallback(() => {
    if (!product) return;
    let currentPrice = product.priceInCents;
    let discount = 0;

    if (appliedCoupon) {
      if (appliedCoupon.discountType === 'percentage') {
        discount = Math.round(currentPrice * (appliedCoupon.discountValue / 100));
      } else { // fixed
        discount = Math.min(currentPrice, appliedCoupon.discountValue); // Ensure discount isn't more than price
      }
    }
    const priceAfterCoupon = currentPrice - discount;
    let finalPrice = priceAfterCoupon;
    let originalPriceBeforeAnyDiscount = product.priceInCents; 
    
    if (includeOrderBump && product.orderBump?.customPriceInCents !== undefined) {
      finalPrice += product.orderBump.customPriceInCents;
      originalPriceBeforeAnyDiscount += product.orderBump.customPriceInCents; // Also add bump to original if coupon applies to total
    }

    setPrices({
      finalPrice: Math.max(0, finalPrice), // Ensure price isn't negative
      originalPriceBeforeDiscount: originalPriceBeforeAnyDiscount,
      discountApplied: discount,
    });
  }, [product, appliedCoupon, includeOrderBump]);

  const checkPaymentStatus = useCallback(async (txId: string) => {
    if (!product?.platformUserId || !pixData?.id) return;
    let mappedStatus: PaymentStatus | null = null;
    try {
      const { data: statusRes, error: funcErr } = await supabase.functions.invoke('verificar-status-pix', { 
        body: { transactionId: txId, productOwnerUserId: product.platformUserId, saleId: pixData.id } // Use pixData.id as saleId for now until proper sale record creation
      });
      if (funcErr || !statusRes || !statusRes.success || !statusRes.data) throw new Error(statusRes?.message || funcErr?.message || "Falha ao verificar status do PIX.");
      
      const rawStatus = statusRes.data.status.toLowerCase();
      switch (rawStatus) {
        case 'paid': case 'approved': mappedStatus = PaymentStatus.PAID; break;
        case 'created': case 'waiting_payment': case 'pending': case 'processing': mappedStatus = PaymentStatus.WAITING_PAYMENT; break;
        case 'expired': mappedStatus = PaymentStatus.EXPIRED; break;
        case 'cancelled': mappedStatus = PaymentStatus.CANCELLED; break;
        default: mappedStatus = PaymentStatus.FAILED; 
      }
      setPaymentStatus(mappedStatus);
      if (mappedStatus === PaymentStatus.PAID) {
        if (pollingIntervalTimerIdRef.current) clearTimeout(pollingIntervalTimerIdRef.current);
        setIsPollingPayment(false);
        setIsReadyToRedirect(true);
        setTimeout(() => navigate(`/thank-you/${pixData.id}?origProdId=${product.id}&csid=${checkoutSessionId}`), 2000);
        // sendLiveViewEvent({ type: 'pix_pending_leave', payload: { userId: user?.id, checkoutSessionId: checkoutSessionId, timestamp: Date.now() }}); // TEMPORARILY HIDDEN
      } else if (mappedStatus !== PaymentStatus.WAITING_PAYMENT) {
        if (pollingIntervalTimerIdRef.current) clearTimeout(pollingIntervalTimerIdRef.current);
        setIsPollingPayment(false);
        setError(`Pagamento ${mappedStatus === PaymentStatus.EXPIRED ? 'expirou' : 'falhou/foi cancelado'}.`);
        // sendLiveViewEvent({ type: 'pix_pending_leave', payload: { userId: user?.id, checkoutSessionId: checkoutSessionId, timestamp: Date.now() }}); // TEMPORARILY HIDDEN
      }
    } catch (statusErr: any) { console.error("[CheckoutPage.checkPaymentStatus] Erro:", statusErr.message); if (paymentStatusRef.current !== PaymentStatus.PAID) setError("Erro ao verificar status do pagamento."); }
  // }, [product, pixData?.id, navigate, checkoutSessionId, user?.id, sendLiveViewEvent]); // TEMPORARILY HIDDEN (removed sendLiveViewEvent)
  }, [product, pixData?.id, navigate, checkoutSessionId, user?.id ]);


  const startPaymentPolling = useCallback((txId: string) => {
    setIsPollingPayment(true); pollingAttemptRef.current = 0; pollingStartTimeRef.current = Date.now();
    const poll = async () => {
      if (Date.now() - pollingStartTimeRef.current > POLLING_TIMEOUT_DURATION) {
        setIsPollingPayment(false);
        if (paymentStatusRef.current !== PaymentStatus.PAID) {
          setError("Tempo para verificar PIX excedido.");
          // sendLiveViewEvent({ type: 'pix_pending_leave', payload: { userId: user?.id, checkoutSessionId: checkoutSessionId, timestamp: Date.now() }}); // TEMPORARILY HIDDEN
        }
        return;
      }
      await checkPaymentStatus(txId);
      if (paymentStatusRef.current === PaymentStatus.WAITING_PAYMENT || paymentStatusRef.current === null) {
        pollingAttemptRef.current++;
        const nextInterval = Math.min(POLLING_INITIAL_INTERVAL * Math.pow(1.5, pollingAttemptRef.current), POLLING_MAX_INTERVAL);
        pollingIntervalTimerIdRef.current = window.setTimeout(poll, nextInterval);
      } else { setIsPollingPayment(false); }
    };
    poll();
  // }, [checkPaymentStatus, user?.id, checkoutSessionId, sendLiveViewEvent]); // TEMPORARILY HIDDEN (removed sendLiveViewEvent)
  }, [checkPaymentStatus, user?.id, checkoutSessionId ]);


  const handleManualCheck = useCallback(async () => {
    if (!pixData?.id || !canManuallyCheck || isManualChecking) return;
    setIsManualChecking(true); setCanManuallyCheck(false);
    await checkPaymentStatus(pixData.id);
    setIsManualChecking(false);
    if (manualCheckTimeoutRef.current) clearTimeout(manualCheckTimeoutRef.current);
    manualCheckTimeoutRef.current = window.setTimeout(() => setCanManuallyCheck(true), MANUAL_CHECK_COOLDOWN_MS);
  }, [pixData, canManuallyCheck, isManualChecking, checkPaymentStatus]);

  const handleProceedToThankYou = useCallback(() => {
    if (pixData?.id && product?.id) {
      navigate(`/thank-you/${pixData.id}?origProdId=${product.id}&csid=${checkoutSessionId}`);
    }
  }, [pixData, product, navigate, checkoutSessionId]);

  useEffect(() => {
    if (!slug) { setError("Produto não especificado."); setIsPageLoading(false); return; }
    
    const fetchProductData = async () => {
      setIsPageLoading(true); setError(null);
      const cacheKey = `product_${slug}`;
      const cached = productDataCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PRODUCT_CACHE_TTL) {
        setProduct(cached.data);
        if (cached.data.platformUserId) setAppSettings(await settingsService.getAppSettingsByUserId(cached.data.platformUserId, null));
        setCurrentTheme(cached.data.checkoutCustomization?.theme || 'light');
        setIsPageLoading(false);
        return;
      }
      try {
        const fetchedProductData = await productService.getProductBySlug(slug, null);
        setProduct(fetchedProductData || null); // Handle undefined case
        if (!fetchedProductData) { setError("Produto não encontrado ou indisponível."); setIsPageLoading(false); return; }
        productDataCache.set(cacheKey, { data: fetchedProductData, timestamp: Date.now() });
        if (fetchedProductData.platformUserId) setAppSettings(await settingsService.getAppSettingsByUserId(fetchedProductData.platformUserId, null));
        setCurrentTheme(fetchedProductData.checkoutCustomization?.theme || 'light');
      } catch (err: any) { setError(err.message || "Erro ao carregar dados do produto."); } 
      finally { setIsPageLoading(false); }
    };
    fetchProductData();
  }, [slug]);

  useEffect(() => { calculatePrices(); }, [product, appliedCoupon, includeOrderBump, calculatePrices]);
  useEffect(() => { document.title = product ? `Checkout - ${product.name}` : "Checkout"; }, [product]);
  useEffect(() => { debouncedSaveAbandonedCart(formState, product); debouncedSaveBuyerDetails(formState); }, [formState, product, debouncedSaveAbandonedCart, debouncedSaveBuyerDetails]);

  useEffect(() => {
    if (!product?.checkoutCustomization?.countdownTimer?.enabled || !product.checkoutCustomization.countdownTimer.durationMinutes) {
      setCountdownTimerText(null);
      return;
    }
    const { durationMinutes, messageBefore = "Oferta expira em:", messageAfter = "Oferta expirada!" } = product.checkoutCustomization.countdownTimer;
    const endTime = new Date(Date.now() + durationMinutes * 60000).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const timeLeft = endTime - now;
      if (timeLeft <= 0) {
        setCountdownTimerText(messageAfter);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        return;
      }
      const minutes = Math.floor((timeLeft / (1000 * 60)) % 60);
      const seconds = Math.floor((timeLeft / 1000) % 60);
      setCountdownTimerText(`${messageBefore} ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };
    updateTimer();
    countdownIntervalRef.current = window.setInterval(updateTimer, 1000);
    return () => { if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current); };
  }, [product?.checkoutCustomization?.countdownTimer]);

  const handleFormChange = <K extends keyof CheckoutFormState>(field: K, value: CheckoutFormState[K]) => {
    startTransition(() => { setFormState(prev => ({ ...prev, [field]: value })); });
  };

  const handleApplyCoupon = useCallback(async () => {
    if (!product || !formState.couponCodeInput.trim()) { setCouponError("Digite um código de cupom."); return; }
    setCouponError(null);
    const couponToTry = product.coupons?.find(c => c.code.toUpperCase() === formState.couponCodeInput.trim().toUpperCase());
    if (!couponToTry || !couponToTry.isActive) { setCouponError("Cupom inválido ou inativo."); return; }
    if (couponToTry.expiresAt && new Date(couponToTry.expiresAt) < new Date()) { setCouponError("Cupom expirado."); return; }
    if (couponToTry.minPurchaseValueInCents && product.priceInCents < couponToTry.minPurchaseValueInCents) { setCouponError(`Valor mínimo de R$${(couponToTry.minPurchaseValueInCents / 100).toFixed(2)} para este cupom.`); return; }
    
    const { data: existingSaleWithCoupon, error: fetchError } = await supabase
      .from('sales')
      .select('id')
      .eq('platform_user_id', product.platformUserId)
      .eq('customer_email', formState.customerEmail)
      .eq('coupon_code_used', couponToTry.code.toUpperCase())
      .limit(1);

    if (fetchError) console.warn("Error checking coupon usage:", fetchError);
    if (existingSaleWithCoupon && existingSaleWithCoupon.length > 0) {
      setCouponError(`Cupom "${couponToTry.code}" já utilizado por este e-mail.`);
      return;
    }
    
    setAppliedCoupon(couponToTry);
    setFormState(prev => ({...prev, couponCodeInput: ''}));
  }, [product, formState.couponCodeInput, formState.customerEmail]);

  const clearAppliedCoupon = () => { setAppliedCoupon(null); setCouponError(null); };
  const handleToggleOrderBump = (enabled: boolean) => { setIncludeOrderBump(enabled); };
  const removeOrderBump = () => { setIncludeOrderBump(false); };
  const copyPixCode = () => { if (pixData?.qr_code) { navigator.clipboard.writeText(pixData.qr_code).then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }); } };

  const handlePayWithPix = async () => {
    if (!product) { setError("Produto não carregado."); return; }
    setError(null); setIsSubmitting(true);
    const utms = extractUtmParamsFromUrl();
    try {
      const buyerId = uuidv4(); 
      const saleRecordPayload: CreateSaleRecordPayload = {
        buyerId: buyerId, platformUserId: product.platformUserId,
        products: [{ productId: product.id, name: product.name, quantity: 1, priceInCents: product.priceInCents, originalPriceInCents: product.priceInCents, slug: product.slug, deliveryUrl: product.deliveryUrl }],
        customer: { name: formState.customerName.trim(), email: formState.customerEmail.trim(), whatsapp: `${formState.customerWhatsappCountryCode}${formState.rawWhatsappNumber.replace(/\D/g, '')}`, ip: 'CAPTURA_PENDENTE' },
        paymentMethod: PaymentMethod.PIX, status: PaymentStatus.WAITING_PAYMENT,
        totalAmountInCents: prices.finalPrice, originalAmountBeforeDiscountInCents: prices.originalPriceBeforeDiscount,
        discountAppliedInCents: prices.discountApplied || undefined, couponCodeUsed: appliedCoupon?.code || undefined,
        trackingParameters: utms,
      };
      if (includeOrderBump && product.orderBump && product.orderBump.customPriceInCents !== undefined) {
        saleRecordPayload.products.push({ productId: product.orderBump.productId, name: product.orderBump.name, quantity: 1, priceInCents: product.orderBump.customPriceInCents, originalPriceInCents: product.orderBump.customPriceInCents, isOrderBump: true });
      }
      
      const createdSale = await salesService.createSaleRecord(saleRecordPayload, null);
      console.log("[CheckoutPage] Sale record created:", createdSale);

      const pixRequestPayload: PushInPayPixRequest = {
        value: prices.finalPrice, originalValueBeforeDiscount: prices.originalPriceBeforeDiscount, webhook_url: MOCK_WEBHOOK_URL, //TODO: Update webhook URL
        customerName: formState.customerName.trim(), customerEmail: formState.customerEmail.trim(), customerWhatsapp: `${formState.customerWhatsappCountryCode}${formState.rawWhatsappNumber.replace(/\D/g, '')}`,
        products: saleRecordPayload.products, trackingParameters: utms,
        couponCodeUsed: appliedCoupon?.code, discountAppliedInCents: prices.discountApplied, buyerId: buyerId,
      };

      const { data: pixFuncRes, error: funcErr } = await supabase.functions.invoke<GerarPixEdgeFunctionResponse>('gerar-pix', { 
        body: { payload: pixRequestPayload, productOwnerUserId: product.platformUserId, saleId: createdSale.id } 
      });
      
      if (funcErr) { let msg = "Falha ao gerar PIX."; if (typeof funcErr.message === 'string') { try { const parsed = JSON.parse(funcErr.message); msg = parsed?.error || parsed?.message || funcErr.message; } catch (e) { msg = funcErr.message; } } throw new Error(msg); }
      if (!pixFuncRes || !pixFuncRes.success || !pixFuncRes.data) { throw new Error(pixFuncRes?.message || "Resposta inválida do servidor PIX."); }
      
      startTransition(() => {
        setPixData(pixFuncRes.data || null); // Ensure null if data is undefined
        setPaymentStatus(PaymentStatus.WAITING_PAYMENT);
      });
      startPaymentPolling(pixFuncRes.data.id); // Safe due to check above
      // sendLiveViewEvent({ type: 'pix_pending_enter', payload: { userId: user?.id, checkoutSessionId: checkoutSessionId, timestamp: Date.now() }}); // TEMPORARILY HIDDEN
    } catch (paymentError: any) { setError(paymentError.message || "Erro desconhecido ao processar PIX."); console.error("[handlePayWithPix] Error:", paymentError);
    } finally { setIsSubmitting(false); }
  };
  
  const primaryColorStyle = product?.checkoutCustomization?.primaryColor || appSettings?.checkoutIdentity?.brandColor || (currentTheme === 'dark' ? 'var(--reimagined-accent-cta)' : 'var(--checkout-color-primary-DEFAULT)');
  const ctaTextColorStyle = getContrastingTextColorForCta(primaryColorStyle, currentTheme);
  const hasLeftContent = !!(product?.checkoutCustomization?.videoUrl || product?.imageUrl || (product?.checkoutCustomization?.salesCopy && product.checkoutCustomization.salesCopy.replace(/<[^>]*>?/gm, '').trim() !== '') || (product?.checkoutCustomization?.testimonials && product.checkoutCustomization.testimonials.length > 0));

  return (
    <CheckoutPageUI
      product={product} formState={formState} prices={prices} handleFormChange={handleFormChange}
      handleApplyCoupon={handleApplyCoupon} couponError={couponError} appliedCoupon={appliedCoupon}
      includeOrderBump={includeOrderBump} handleToggleOrderBump={handleToggleOrderBump}
      isSubmitting={isSubmitting} handlePayWithPix={handlePayWithPix} pixData={pixData}
      copyPixCode={copyPixCode} copySuccess={copySuccess} paymentStatus={paymentStatus}
      error={error} primaryColorStyle={primaryColorStyle} ctaTextColorStyle={ctaTextColorStyle}
      isPollingPayment={isPollingPayment} clearAppliedCoupon={clearAppliedCoupon} removeOrderBump={removeOrderBump}
      currentTheme={currentTheme} isPageLoading={isPageLoading} countdownTimerText={countdownTimerText}
      hasLeftContent={hasLeftContent}
      handleManualCheck={handleManualCheck} isManualChecking={isManualChecking} canManuallyCheck={canManuallyCheck}
      isReadyToRedirect={isReadyToRedirect} handleProceedToThankYou={handleProceedToThankYou}
    />
  );
};
export default CheckoutPage;
