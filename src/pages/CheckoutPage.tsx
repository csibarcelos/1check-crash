
import React, { useEffect, useState, useCallback, useRef, useMemo, startTransition } from 'react';
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Product, PaymentStatus, Coupon, PushInPayPixResponseData, AppSettings, SaleProductItem, AbandonedCartStatus, PushInPayPixRequest, LiveViewEvent, PaymentMethod, Sale, PlatformSettings } from '@/types'; // Added PlatformSettings
import { productService } from '@/services/productService';
import { salesService } from '@/services/salesService'; 
import { abandonedCartService, CreateAbandonedCartPayload } from '@/services/abandonedCartService';
import { Button } from '@/components/ui/Button';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { CheckIcon, PHONE_COUNTRY_CODES, DocumentDuplicateIcon, TagIcon, MOCK_WEBHOOK_URL, PLATFORM_NAME, AppLogoIcon, cn, LIVE_VIEW_CHANNEL_NAME } from '../constants.tsx';
import { settingsService } from '@/services/settingsService';
import { supabase } from '@/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Select } from '@/components/ui/Select';
import { v4 as uuidv4 } from 'uuid';

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

const LOCALSTORAGE_CHECKOUT_KEY = 'checkoutFormData_v3';
const POLLING_INITIAL_INTERVAL = 3000;
const POLLING_MAX_INTERVAL = 15000;
const POLLING_TIMEOUT_DURATION = 5 * 60 * 1000;
const ABANDONED_CART_DEBOUNCE_MS = 5000;
const MANUAL_CHECK_COOLDOWN_MS = 10000; // 10 segundos

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

// Interface para a resposta esperada da Edge Function 'gerar-pix'
interface GerarPixFunctionResponse {
  success: boolean;
  data?: PushInPayPixResponseData; // Dados do PIX da PushInPay
  saleId?: string;                 // ID da venda criada pela Edge Function
  message?: string;
}

// Interface para a resposta da Edge Function 'verificar-status-pix'
interface VerifyStatusFunctionResponse {
    success: boolean;
    data?: PushInPayPixResponseData; // PushInPay status data
    saleUpdated?: boolean;           // Indicates if DB sale record was updated
    message?: string;
}


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
                          {copySuccess ? (<><CheckIcon className="h-6 w-6 mb-1" /><span className="text-sm font-medium">Copiado!</span></>) : (<><DocumentDuplicateIcon className="h-5 w-5 mb-1 opacity-80" /><span className="text-xs">Clique para copiar</span></>)}
                        </div>
                      </div>
                      {isPollingPayment && (
                        <div className="mt-4 space-y-2">
                            <div className={`flex items-center justify-center text-base ${mutedTextColorClass}`}>
                                <LoadingSpinner size="sm" className="mr-2.5"/>Verificando pagamento...
                            </div>
                            <Button
                                onClick={handleManualCheck}
                                isLoading={isManualChecking}
                                disabled={!canManuallyCheck || isManualChecking}
                                variant="outline"
                                size="sm"
                                className={`${buttonThemeClass} outline w-full`}
                            >
                                {isManualChecking ? 'Verificando...' : (canManuallyCheck ? 'Verificar Pagamento Manualmente' : 'Aguarde para verificar novamente')}
                            </Button>
                        </div>
                      )}
                       {error && <p className="text-sm text-status-error p-3.5 bg-status-error/10 rounded-2xl border border-status-error/30 mt-4">{error}</p>}
                    </>
                  )}
                  {paymentStatus === PaymentStatus.PAID && (
                    <div className="p-5 bg-status-success/10 rounded-2xl border border-status-success/30">
                      <CheckIcon className="h-16 w-16 text-status-success mx-auto mb-3" />
                      <p className="text-xl font-semibold text-status-success font-display">Pagamento Confirmado!</p>
                      {isReadyToRedirect ? (
                         <Button onClick={handleProceedToThankYou} style={{ backgroundColor: primaryColorStyle, color: ctaTextColorStyle }} className={`${buttonThemeClass} primary w-full py-3 text-lg mt-4`}>
                            Ir para Detalhes do Pedido
                        </Button>
                      ) : (
                        <p className={`text-base ${defaultTextColorClass}`}>Seu pagamento foi confirmado!</p>
                      )}
                      {error && <p className="text-sm text-status-error p-3.5 bg-status-error/10 rounded-2xl border border-status-error/30 mt-4">{error}</p>}
                    </div>
                  )}
                   {(paymentStatus === PaymentStatus.FAILED || paymentStatus === PaymentStatus.EXPIRED || paymentStatus === PaymentStatus.CANCELLED) && !isPollingPayment && (
                     <div className="mt-5 text-center">
                       <p className="text-status-error mb-4 text-base">{error || `O pagamento PIX ${paymentStatus === PaymentStatus.EXPIRED ? 'expirou' : 'falhou/foi cancelado'}.`}</p>
                       <Button onClick={handlePayWithPix} isLoading={isSubmitting} disabled={isSubmitting} style={{ backgroundColor: primaryColorStyle, color: ctaTextColorStyle }} className={`${buttonThemeClass} primary w-full py-3.5 text-lg`}>Tentar Novamente com PIX</Button>
                     </div>
                   )}
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); handlePayWithPix(); }} className="space-y-6 pt-4" aria-labelledby="form-title">
                  <h2 id="form-title" className="sr-only">Informações de Pagamento</h2>
                  <div><Input label="Nome Completo" name="customerName" type="text" value={formState.customerName} onChange={(e) => handleFormChange('customerName', e.target.value)} required disabled={isSubmitting} className={inputThemeClass} labelClassName={labelTextColorClass} autoComplete="name" /></div>
                  <div><Input label="E-mail Principal" name="customerEmail" type="email" value={formState.customerEmail} onChange={(e) => handleFormChange('customerEmail', e.target.value)} required disabled={isSubmitting} className={inputThemeClass} labelClassName={labelTextColorClass} autoComplete="email" /></div>
                  <div>
                    <label htmlFor="customerWhatsapp" className={`block text-sm font-medium ${labelTextColorClass} mb-1.5`}>WhatsApp</label>
                    <div className="flex items-center">
                      <Select name="customerWhatsappCountryCode" value={formState.customerWhatsappCountryCode} onValueChange={(val) => handleFormChange('customerWhatsappCountryCode', val)} options={phoneCountryOptions} disabled={isSubmitting} triggerClassName={cn(selectTriggerThemeClass, "w-20 flex-[0_0_auto] rounded-r-none border-r-0")} contentClassName={selectContentThemeClass}/>
                      <Input name="customerWhatsapp" type="tel" value={formState.rawWhatsappNumber} onChange={(e) => handleFormChange('rawWhatsappNumber', e.target.value.replace(/\D/g, '').slice(0,11))} placeholder="(XX) XXXXX-XXXX" required autoComplete="tel" disabled={isSubmitting} className={cn(inputThemeClass, "rounded-l-none h-11")} wrapperClassName="flex-1 min-w-0"/>
                    </div>
                  </div>
                  {!appliedCoupon && product.coupons && product.coupons.length > 0 && (
                    <div className="pt-3">
                        <label htmlFor="couponCode" className={`block text-sm font-medium ${labelTextColorClass} mb-1.5`}>Cupom de Desconto</label>
                        <div className="flex items-center gap-3">
                            <Input name="couponCode" type="text" value={formState.couponCodeInput} onChange={(e) => handleFormChange('couponCodeInput', e.target.value.toUpperCase())} placeholder="Seu cupom aqui" disabled={isSubmitting} icon={<TagIcon className={`h-5 w-5 ${mutedTextColorClass}`}/>} className={cn(inputThemeClass, "flex-grow h-11")} wrapperClassName="flex-grow" labelClassName={labelTextColorClass} />
                            <Button type="button" onClick={handleApplyCoupon} variant="outline" size="md" disabled={isSubmitting || !formState.couponCodeInput.trim()} className={cn(buttonThemeClass, "outline flex-shrink-0 py-3 h-11")}>Aplicar</Button>
                        </div>
                        {couponError && <p className="text-xs text-status-error mt-2">{couponError}</p>}
                    </div>
                  )}
                   {appliedCoupon && ( <div className="p-3.5 bg-status-success/10 border border-status-success/30 rounded-2xl text-base"> <p className="text-status-success font-medium">Cupom "{appliedCoupon.code}" aplicado! <button type="button" onClick={clearAppliedCoupon} className="ml-1.5 text-status-error text-xs hover:underline">(Remover)</button></p> </div> )}
                  {error && <p className="text-sm text-status-error p-3.5 bg-status-error/10 rounded-2xl border border-status-error/30">{error}</p>}
                  <Button type="submit" size="lg" isLoading={isSubmitting} disabled={isSubmitting} style={{ backgroundColor: primaryColorStyle, color: ctaTextColorStyle }} className={cn(buttonThemeClass, "primary w-full text-lg py-4 mt-5 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]")} leftIcon={<LockClosedIconSolid className="h-6 w-6" />}> {`Pagar com PIX ${formatCurrency(prices.finalPrice)}`} </Button>
                </form>
              )}
               <p className={`text-sm ${mutedTextColorClass} mt-8 text-center flex items-center justify-center`}>
                <LockClosedIconSolid className="h-4 w-4 mr-1.5"/> Ambiente 100% seguro. Seus dados estão protegidos.
               </p>
            </Card>
            {product.checkoutCustomization?.guaranteeBadges && product.checkoutCustomization.guaranteeBadges.length > 0 && (
              <div className={`grid grid-cols-2 sm:grid-cols-3 gap-5 mt-8`}>
                {product.checkoutCustomization.guaranteeBadges.map((badge: { id: string; imageUrl: string; altText: string; }) => (
                  <div key={badge.id} className={`${cardThemeClass} p-4 rounded-2xl shadow-lg flex items-center justify-center h-24 transition-all hover:shadow-xl hover:scale-105`}>
                    <img src={badge.imageUrl} alt={badge.altText} className="max-h-16 object-contain" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <footer className={`mt-16 md:mt-20 pt-10 border-t ${currentTheme === 'dark' ? 'border-[var(--reimagined-card-border)]' : 'border-[var(--checkout-color-border-subtle)]'} text-center`}>
            <p className={`text-sm ${mutedTextColorClass}`}>&copy; ${new Date().getFullYear()} {product.name}. Todos os direitos reservados.</p>
            <p className={`text-sm ${mutedTextColorClass} mt-1.5`}>Processado por ${PLATFORM_NAME} via 1Checkout.</p>
        </footer>
      </div>
    </div>
  );
});
CheckoutPageUI.displayName = "CheckoutPageUI";

const calculatePriceWithCoupon = (basePriceInCents: number, coupon: Coupon | null): { price: number; discount: number } => {
  if (!coupon || !coupon.isActive) {
    return { price: basePriceInCents, discount: 0 };
  }

  let discountAmount = 0;
  if (coupon.discountType === 'percentage') {
    discountAmount = Math.round(basePriceInCents * (coupon.discountValue / 100));
  } else if (coupon.discountType === 'fixed') {
    discountAmount = coupon.discountValue; 
  }

  discountAmount = Math.min(discountAmount, basePriceInCents);
  if (coupon.minPurchaseValueInCents && basePriceInCents < coupon.minPurchaseValueInCents) {
    return { price: basePriceInCents, discount: 0 }; 
  }

  const finalPrice = basePriceInCents - discountAmount;
  return { price: finalPrice, discount: discountAmount };
};


const CheckoutPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [product, setProduct] = useState<Product | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [formState, setFormState] = useState<CheckoutFormState>({ customerName: '', customerEmail: '', rawWhatsappNumber: '', customerWhatsappCountryCode: '+55', couponCodeInput: '' });
  const [prices, setPrices] = useState<CheckoutPrices>({ finalPrice: 0, originalPriceBeforeDiscount: 0, discountApplied: 0 });
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [includeOrderBump, setIncludeOrderBump] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pixData, setPixData] = useState<PushInPayPixResponseData | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const paymentStatusRef = useRef<PaymentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null); 
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light'); 
  const [countdownTimerText, setCountdownTimerText] = useState<string | null>(null);
  const [isReadyToRedirect, setIsReadyToRedirect] = useState(false);
  
  const pollingIntervalTimerIdRef = useRef<number | null>(null);
  const pollingAttemptRef = useRef<number>(0);
  const pollingStartTimeRef = useRef<number>(0);

  const [isManualChecking, setIsManualChecking] = useState(false);
  const [canManuallyCheck, setCanManuallyCheck] = useState(true);
  const manualCheckTimeoutRef = useRef<number | null>(null);
  const createdSaleIdRef = useRef<string | null>(null);


  const { accessToken, user } = useAuth();
  const checkoutSessionIdRef = useRef<string>(uuidv4());
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const trackingParamsFromUrl = useMemo(() => {
    const params: Record<string, string> = {};
    queryParams.forEach((value, key) => { if (key.toLowerCase().startsWith('utm_') || ['src', 'ref', 'gclid', 'fbclid'].includes(key.toLowerCase())) params[key.toLowerCase()] = value; });
    return params;
  }, [queryParams]);

  const abandonedCartIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    paymentStatusRef.current = paymentStatus;
  }, [paymentStatus]);

  const sendLiveViewEvent = useCallback((event: LiveViewEvent) => {
    const channel = supabase.channel(LIVE_VIEW_CHANNEL_NAME);
    channel.send({ type: 'broadcast', event: 'live_view_event', payload: event }).catch(err => console.error("[CheckoutPage] Error sending broadcast for LiveView:", err));
  }, []);

  useEffect(() => { sendLiveViewEvent({ type: 'checkout_enter', payload: { userId: user?.id, checkoutSessionId: checkoutSessionIdRef.current, timestamp: Date.now() } }); }, [sendLiveViewEvent, user?.id]);

  const loadInitialData = useCallback(async () => {
    if (!slug) { setError("Slug do produto não encontrado."); setIsPageLoading(false); return; }
    console.log("[CheckoutPage.loadInitialData] Starting to load data for slug:", slug);
    try {
      const cachedProduct = productDataCache.get(slug);
      let fetchedProductData: Product | null = null;

      if (cachedProduct && (Date.now() - cachedProduct.timestamp < PRODUCT_CACHE_TTL)) {
        fetchedProductData = cachedProduct.data;
        console.log("[CheckoutPage.loadInitialData] Product loaded from cache for slug:", slug);
      } else {
        fetchedProductData = await productService.getProductBySlug(slug, accessToken);
        if (fetchedProductData) {
          productDataCache.set(slug, { data: fetchedProductData, timestamp: Date.now() });
          console.log("[CheckoutPage.loadInitialData] Product fetched and cached for slug:", slug);
        }
      }

      if (!fetchedProductData) { setError("Produto não encontrado ou indisponível."); setIsPageLoading(false); return; }
      
      setProduct(fetchedProductData);
      document.title = `Checkout - ${fetchedProductData.name}`;
      setCurrentTheme(fetchedProductData.checkoutCustomization?.theme || 'light');

      let ownerSettings: AppSettings | null = null;
      if (fetchedProductData.platformUserId) {
        ownerSettings = await settingsService.getAppSettingsByUserId(fetchedProductData.platformUserId, accessToken); //_token aqui não é usado por getAppSettingsByUserId, é apenas para consistência
        setAppSettings(ownerSettings);
        console.log("[CheckoutPage.loadInitialData] Owner settings loaded for user:", fetchedProductData.platformUserId);
      }

      const storedDataRaw = localStorage.getItem(LOCALSTORAGE_CHECKOUT_KEY);
      if (storedDataRaw) {
        try {
          const parsed = JSON.parse(storedDataRaw);
          setFormState(prev => ({ ...prev, ...parsed, couponCodeInput: prev.couponCodeInput }));
          console.log("[CheckoutPage.loadInitialData] Form state loaded from localStorage.");
        } catch (e) { console.error("Error parsing stored checkout form data", e); localStorage.removeItem(LOCALSTORAGE_CHECKOUT_KEY); }
      }
      
      if (fetchedProductData.coupons?.find(c => c.isAutomatic && c.isActive)) {
        setAppliedCoupon(fetchedProductData.coupons.find(c => c.isAutomatic && c.isActive)!);
        console.log("[CheckoutPage.loadInitialData] Automatic coupon applied.");
      }

    } catch (err: any) { setError(err.message || 'Falha ao carregar dados do checkout.'); console.error("[CheckoutPage.loadInitialData] Error:", err);
    } finally { setIsPageLoading(false); console.log("[CheckoutPage.loadInitialData] Finished loading data.");}
  }, [slug, accessToken]);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (!isPageLoading) {
        localStorage.setItem(LOCALSTORAGE_CHECKOUT_KEY, JSON.stringify({
          customerName: formState.customerName, customerEmail: formState.customerEmail,
          rawWhatsappNumber: formState.rawWhatsappNumber, customerWhatsappCountryCode: formState.customerWhatsappCountryCode,
        }));
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [formState.customerName, formState.customerEmail, formState.rawWhatsappNumber, formState.customerWhatsappCountryCode, isPageLoading]);

  const calculateFinalPrice = useCallback(() => {
    if (!product) return;
    let currentBasePrice = product.priceInCents;
    if (includeOrderBump && product.orderBump?.customPriceInCents !== undefined) {
      currentBasePrice += product.orderBump.customPriceInCents;
    }
    const { price: priceAfterCoupon, discount } = calculatePriceWithCoupon(currentBasePrice, appliedCoupon);
    startTransition(() => { setPrices({ finalPrice: priceAfterCoupon, originalPriceBeforeDiscount: currentBasePrice, discountApplied: discount }); });
    if (appliedCoupon && currentBasePrice < (appliedCoupon.minPurchaseValueInCents || 0)) { setCouponError(`Valor mínimo de ${formatCurrency(appliedCoupon.minPurchaseValueInCents || 0)} não atingido.`); } 
    else if (appliedCoupon) { setCouponError(null); }
  }, [product, appliedCoupon, includeOrderBump]);

  useEffect(() => { calculateFinalPrice(); }, [calculateFinalPrice]);

  const saveOrUpdateAbandonedCart = useCallback(async () => {
    if (!product || !formState.customerEmail.trim() || !product.platformUserId || pixData || isPageLoading) return;
    const cartPayload: CreateAbandonedCartPayload = {
      productId: product.id, productName: product.name, potentialValueInCents: prices.finalPrice,
      customerName: formState.customerName.trim() || formState.customerEmail.split('@')[0],
      customerEmail: formState.customerEmail.trim(),
      customerWhatsapp: `${formState.customerWhatsappCountryCode}${formState.rawWhatsappNumber.replace(/\D/g, '')}`,
      platformUserId: product.platformUserId, trackingParameters: trackingParamsFromUrl, status: AbandonedCartStatus.NOT_CONTACTED,
    };
    try {
      if (!abandonedCartIdRef.current) { 
        const newCart = await abandonedCartService.createAbandonedCartAttempt(cartPayload); 
        if (newCart?.id) abandonedCartIdRef.current = newCart.id; 
      } else { 
        await abandonedCartService.updateAbandonedCartAttempt(abandonedCartIdRef.current, cartPayload); 
      }
    } catch (cartError) { console.warn("Falha ao salvar/atualizar carrinho abandonado:", cartError); }
  }, [product, formState, prices.finalPrice, trackingParamsFromUrl, pixData, isPageLoading]);

  useEffect(() => {
    if (isPageLoading || pixData) return;
    if (abandonedCartTimeoutRef.current) clearTimeout(abandonedCartTimeoutRef.current);
    abandonedCartTimeoutRef.current = window.setTimeout(saveOrUpdateAbandonedCart, ABANDONED_CART_DEBOUNCE_MS);
    return () => { if (abandonedCartTimeoutRef.current) clearTimeout(abandonedCartTimeoutRef.current); };
  }, [formState.customerName, formState.customerEmail, formState.rawWhatsappNumber, pixData, saveOrUpdateAbandonedCart, isPageLoading]);

  const handleFormChange = useCallback(<K extends keyof CheckoutFormState>(field: K, value: CheckoutFormState[K]) => {
    startTransition(() => {
      setFormState(prev => ({ ...prev, [field]: value }));
      if (field === 'couponCodeInput' && appliedCoupon && value.toUpperCase() !== appliedCoupon.code) { setAppliedCoupon(null); setCouponError(null); } 
      else if (field === 'couponCodeInput') { setCouponError(null); }
    });
  }, [appliedCoupon]);
  
  const handleApplyCoupon = useCallback(() => {
    if (!product || !formState.couponCodeInput) return;
    const coupon = product.coupons?.find(c => c.code === formState.couponCodeInput.toUpperCase() && c.isActive);
    if (coupon) {
      let basePriceForMinCheck = product.priceInCents;
      if (includeOrderBump && product.orderBump?.customPriceInCents !== undefined) { basePriceForMinCheck += product.orderBump.customPriceInCents; }
      if (coupon.minPurchaseValueInCents && basePriceForMinCheck < coupon.minPurchaseValueInCents) { setCouponError(`Valor mínimo de ${formatCurrency(coupon.minPurchaseValueInCents)} não atingido.`); setAppliedCoupon(null); } 
      else { setAppliedCoupon(coupon); setCouponError(null); }
    } else { setCouponError('Cupom inválido ou expirado.'); setAppliedCoupon(null); }
  }, [product, formState.couponCodeInput, includeOrderBump]);

  const clearAppliedCoupon = useCallback(() => { startTransition(() => { setAppliedCoupon(null); setFormState(prev => ({...prev, couponCodeInput: ''})); setCouponError(null); }); }, []);
  const removeOrderBump = useCallback(() => { startTransition(() => setIncludeOrderBump(false)); }, []);
  const handleToggleOrderBump = useCallback((enabled: boolean) => { startTransition(() => setIncludeOrderBump(enabled)); }, []);

  const handlePayWithPix = useCallback(async () => {
    if (!product || prices.finalPrice === null || !formState.customerName.trim() || !formState.customerEmail.trim() || !formState.rawWhatsappNumber.trim() || !product.platformUserId) { setError("Por favor, preencha todos os campos obrigatórios."); return; }
    setIsSubmitting(true); setError(null); setPixData(null); createdSaleIdRef.current = null;
    setIsReadyToRedirect(false);
    
    const productsForSale: SaleProductItem[] = [{ productId: product.id, name: product.name, quantity: 1, priceInCents: product.priceInCents - (appliedCoupon && !includeOrderBump ? prices.discountApplied : 0), originalPriceInCents: product.priceInCents, deliveryUrl: product.deliveryUrl, slug: product.slug }];
    if (includeOrderBump && product.orderBump?.customPriceInCents !== undefined) {
        let bumpProductDeliveryUrl, bumpProductSlug; try { const bumpProdDetails = await productService.getProductById(product.orderBump.productId, accessToken); bumpProductDeliveryUrl = bumpProdDetails?.deliveryUrl; bumpProductSlug = bumpProdDetails?.slug; } catch { /* ignore */ }
        productsForSale.push({ productId: product.orderBump.productId, name: product.orderBump.name, quantity: 1, priceInCents: product.orderBump.customPriceInCents - (appliedCoupon && includeOrderBump ? prices.discountApplied - (product.priceInCents - (appliedCoupon && !includeOrderBump ? prices.discountApplied : 0)) : 0) , originalPriceInCents: product.orderBump.customPriceInCents, isOrderBump: true, deliveryUrl: bumpProductDeliveryUrl, slug: bumpProductSlug });
    }
    
    const pixPayloadForFunction: PushInPayPixRequest & { platformUserId: string; paymentMethod: PaymentMethod; ip?: string; } = { 
        value: prices.finalPrice, originalValueBeforeDiscount: prices.originalPriceBeforeDiscount, 
        webhook_url: MOCK_WEBHOOK_URL, 
        customerName: formState.customerName, customerEmail: formState.customerEmail, 
        customerWhatsapp: `${formState.customerWhatsappCountryCode}${formState.rawWhatsappNumber.replace(/\D/g, '')}`, 
        products: productsForSale, 
        trackingParameters: trackingParamsFromUrl, 
        couponCodeUsed: appliedCoupon?.code, 
        discountAppliedInCents: prices.discountApplied,
        platformUserId: product.platformUserId, 
        paymentMethod: PaymentMethod.PIX,    
        ip: undefined, 
    };
        
    try {
        const { data: functionResponse, error: funcError } = await supabase.functions.invoke<GerarPixFunctionResponse>('gerar-pix', { 
            body: { 
                payload: pixPayloadForFunction, 
                productOwnerUserId: product.platformUserId 
            } 
        });

        if (funcError || !functionResponse || !functionResponse.success || !functionResponse.data || !functionResponse.saleId) {
            throw new Error(functionResponse?.message || funcError?.message || "Falha ao gerar PIX ou registrar venda.");
        }
        
        createdSaleIdRef.current = functionResponse.saleId;
        console.log(`[CheckoutPage.handlePayWithPix] PIX gerado e Venda criada pela Edge Function com ID: ${createdSaleIdRef.current}`);
        
        startTransition(() => { setPixData(functionResponse.data); setPaymentStatus(PaymentStatus.WAITING_PAYMENT); });
        sendLiveViewEvent({ type: 'pix_pending_enter', payload: { userId: user?.id, checkoutSessionId: checkoutSessionIdRef.current, timestamp: Date.now() } });
        if (pollingIntervalTimerIdRef.current) clearTimeout(pollingIntervalTimerIdRef.current);
        startPaymentPolling(functionResponse.data.id, functionResponse.saleId); // Passa saleId para o polling

    } catch (paymentErr: any) { 
        setError(paymentErr.message || "Erro ao processar PIX."); 
        console.error("PIX Payment Error:", paymentErr);
    } finally { 
        setIsSubmitting(false); 
    }
  }, [product, prices, formState, appliedCoupon, includeOrderBump, trackingParamsFromUrl, accessToken, sendLiveViewEvent, user?.id]);

  const copyPixCode = useCallback(() => { if (pixData?.qr_code) { navigator.clipboard.writeText(pixData.qr_code).then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }); } }, [pixData]);

  const checkPaymentStatus = useCallback(async (pushInPayTxId: string, dbSaleId: string) => {
    if (!product?.platformUserId || !pushInPayTxId || !dbSaleId) {
      console.warn(`[CheckoutPage.checkPaymentStatus] Dados insuficientes. PushInPay TX ID: ${pushInPayTxId}, DB Sale ID: ${dbSaleId}, Product Owner: ${product?.platformUserId}.`);
      return;
    }
    console.log(`[CheckoutPage.checkPaymentStatus] Checking status for PushInPay TX ID: ${pushInPayTxId}, DB Sale ID: ${dbSaleId}`);
    let mappedStatus: PaymentStatus | null = null;

    try {
      const { data: funcResponse, error: funcError } = await supabase.functions.invoke<VerifyStatusFunctionResponse>('verificar-status-pix', { 
          body: { 
              transactionId: pushInPayTxId, 
              productOwnerUserId: product.platformUserId,
              saleId: dbSaleId // << ENVIANDO saleId
          } 
      });
      
      if (funcError || !funcResponse || !funcResponse.success || !funcResponse.data) {
        console.warn(`[CheckoutPage.checkPaymentStatus] Erro ou resposta inválida de 'verificar-status-pix':`, funcError || funcResponse);
        throw new Error(funcResponse?.message || funcError?.message || "Resposta inválida ao verificar status.");
      }

      const rawStatus = funcResponse.data.status.toLowerCase();
      console.log(`[CheckoutPage.checkPaymentStatus] Raw status from backend: '${rawStatus}'`);
      
      switch (rawStatus) {
        case 'paid': case 'approved': mappedStatus = PaymentStatus.PAID; break;
        case 'created': case 'waiting_payment': case 'pending': case 'processing': mappedStatus = PaymentStatus.WAITING_PAYMENT; break;
        case 'cancelled': case 'canceled': mappedStatus = PaymentStatus.CANCELLED; break;
        case 'expired': mappedStatus = PaymentStatus.EXPIRED; break;
        case 'failed': case 'error': case 'rejected': mappedStatus = PaymentStatus.FAILED; break;
        default:
          console.warn(`[CheckoutPage.checkPaymentStatus] Status desconhecido: ${rawStatus}. Tratando como WAITING_PAYMENT.`);
          mappedStatus = PaymentStatus.WAITING_PAYMENT;
      }
      console.log(`[CheckoutPage.checkPaymentStatus] Status mapeado: '${mappedStatus}'. Edge function updated DB: ${funcResponse.saleUpdated}`);
      startTransition(() => setPaymentStatus(mappedStatus)); 

      if (mappedStatus === PaymentStatus.PAID) {
        if (pollingIntervalTimerIdRef.current) clearTimeout(pollingIntervalTimerIdRef.current);
        setIsPollingPayment(false);
        sendLiveViewEvent({ type: 'pix_pending_leave', payload: { userId: user?.id, checkoutSessionId: checkoutSessionIdRef.current } });

        if (!funcResponse.saleUpdated) {
             console.error(`[CheckoutPage.checkPaymentStatus] CRÍTICO: Pagamento PIX ${pushInPayTxId} confirmado, mas Edge Function falhou ao atualizar saleId ${dbSaleId} no banco.`);
             setError("Erro crítico ao finalizar o pedido após pagamento. O PIX foi pago, mas houve um problema ao registrar sua compra. Contate o suporte com o ID da transação PIX: " + pushInPayTxId);
             return; // Não prosseguir se a atualização do DB pela EF falhou
        }
        
        // Se a Edge Function atualizou o DB, podemos prosseguir.
        setIsReadyToRedirect(true); 
        if (abandonedCartIdRef.current && accessToken) {
            console.log(`[CheckoutPage.checkPaymentStatus] PIX pago. Tentando deletar carrinho abandonado ID: ${abandonedCartIdRef.current}`);
            await abandonedCartService.deleteAbandonedCart(abandonedCartIdRef.current, accessToken).catch(delErr => 
            console.warn(`[CheckoutPage.checkPaymentStatus] Falha ao deletar carrinho abandonado (ID: ${abandonedCartIdRef.current}): ${delErr.message}. Prosseguindo...`)
            );
            abandonedCartIdRef.current = null;
        }
          
      } else if (mappedStatus !== PaymentStatus.WAITING_PAYMENT) { 
        if (pollingIntervalTimerIdRef.current) clearTimeout(pollingIntervalTimerIdRef.current);
        setIsPollingPayment(false);
        setError(`Pagamento ${mappedStatus === PaymentStatus.EXPIRED ? 'expirou' : 'falhou/foi cancelado'}.`);
        sendLiveViewEvent({ type: 'pix_pending_leave', payload: { userId: user?.id, checkoutSessionId: checkoutSessionIdRef.current } });
      }
    } catch (statusErr: any) {
      console.error("[CheckoutPage.checkPaymentStatus] Erro ao verificar status:", statusErr.message);
      if (paymentStatusRef.current !== PaymentStatus.PAID) { 
          setError("Erro ao verificar status do pagamento. A verificação continuará em segundo plano.");
      }
    }
  }, [product, sendLiveViewEvent, user?.id, accessToken]); 

  const startPaymentPolling = useCallback((pushInPayTxId: string, dbSaleId: string) => {
    console.log(`[CheckoutPage.startPaymentPolling] Starting polling for PushInPay TX ID: ${pushInPayTxId}, DB Sale ID: ${dbSaleId}`);
    setIsPollingPayment(true);
    pollingAttemptRef.current = 0;
    pollingStartTimeRef.current = Date.now();

    const poll = async () => {
      console.log(`[CheckoutPage.startPaymentPolling] Poll attempt #${pollingAttemptRef.current + 1}`);
      if (Date.now() - pollingStartTimeRef.current > POLLING_TIMEOUT_DURATION) {
        console.warn("[CheckoutPage.startPaymentPolling] Polling timeout reached.");
        setIsPollingPayment(false);
        if (paymentStatusRef.current !== PaymentStatus.PAID) { setError("Tempo para verificar o PIX excedido. Se pagou, contate o suporte ou verifique manualmente."); sendLiveViewEvent({ type: 'pix_pending_leave', payload: { userId: user?.id, checkoutSessionId: checkoutSessionIdRef.current } }); }
        return;
      }
      await checkPaymentStatus(pushInPayTxId, dbSaleId); // Passa os dois IDs
      if (paymentStatusRef.current === PaymentStatus.WAITING_PAYMENT || paymentStatusRef.current === null) {
        pollingAttemptRef.current++;
        const nextInterval = Math.min(POLLING_INITIAL_INTERVAL * Math.pow(1.5, pollingAttemptRef.current), POLLING_MAX_INTERVAL);
        console.log(`[CheckoutPage.startPaymentPolling] Next poll in ${nextInterval}ms. Current status: ${paymentStatusRef.current}`);
        pollingIntervalTimerIdRef.current = window.setTimeout(poll, nextInterval);
      } else {
        console.log(`[CheckoutPage.startPaymentPolling] Polling stopped. Final status: ${paymentStatusRef.current}`);
        setIsPollingPayment(false);
      }
    };
    poll();
  }, [checkPaymentStatus, sendLiveViewEvent, user?.id]);

  const handleManualCheck = useCallback(async () => {
    if (!pixData?.id || !createdSaleIdRef.current || !canManuallyCheck || isManualChecking) return;
    console.log("[CheckoutPage.handleManualCheck] Manual check triggered for TX ID:", pixData.id, "Sale ID:", createdSaleIdRef.current);
    setIsManualChecking(true);
    setCanManuallyCheck(false);
    await checkPaymentStatus(pixData.id, createdSaleIdRef.current); // Passa os dois IDs
    setIsManualChecking(false);
    if (manualCheckTimeoutRef.current) clearTimeout(manualCheckTimeoutRef.current);
    manualCheckTimeoutRef.current = window.setTimeout(() => { setCanManuallyCheck(true); console.log("[CheckoutPage.handleManualCheck] Cooldown finished, manual check re-enabled."); }, MANUAL_CHECK_COOLDOWN_MS);
  }, [pixData, createdSaleIdRef, canManuallyCheck, isManualChecking, checkPaymentStatus]);

  const handleProceedToThankYou = useCallback(() => {
    if (product && createdSaleIdRef.current ) {
      navigate(`/thank-you/${createdSaleIdRef.current}?origProdId=${product.id}&csid=${checkoutSessionIdRef.current}`);
    } else {
      console.error("[CheckoutPage.handleProceedToThankYou] Cannot navigate: product or createdSaleIdRef is missing.");
      setError("Erro ao carregar detalhes do pedido. Tente recarregar a página ou contate o suporte.");
    }
  }, [product, navigate, checkoutSessionIdRef]);


  useEffect(() => {
    if (!product?.checkoutCustomization?.countdownTimer?.enabled || !product.checkoutCustomization.countdownTimer.durationMinutes) { setCountdownTimerText(null); return; }
    const { durationMinutes, messageBefore, messageAfter } = product.checkoutCustomization.countdownTimer;
    const storageKey = `countdownEndTime_${product.id}_${checkoutSessionIdRef.current}`;
    let endTime = localStorage.getItem(storageKey);
    if (!endTime || parseInt(endTime) < Date.now()) { endTime = String(Date.now() + durationMinutes * 60 * 1000); localStorage.setItem(storageKey, endTime); }
    const intervalId = setInterval(() => {
      const remaining = parseInt(endTime!) - Date.now();
      if (remaining <= 0) { clearInterval(intervalId); setCountdownTimerText(messageAfter || 'Oferta Expirada!'); return; }
      const minutes = String(Math.floor((remaining / (1000 * 60)) % 60)).padStart(2, '0');
      const seconds = String(Math.floor((remaining / 1000) % 60)).padStart(2, '0');
      setCountdownTimerText(`${messageBefore || 'Oferta expira em:'} ${minutes}:${seconds}`);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [product]);
  
  const abandonedCartTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      console.log("[CheckoutPage] Unmounting. Clearing polling timers.");
      if (pollingIntervalTimerIdRef.current) clearTimeout(pollingIntervalTimerIdRef.current);
      if (manualCheckTimeoutRef.current) clearTimeout(manualCheckTimeoutRef.current);
      if (abandonedCartTimeoutRef.current) clearTimeout(abandonedCartTimeoutRef.current);
      if (pixData && (paymentStatusRef.current === PaymentStatus.WAITING_PAYMENT || paymentStatusRef.current === null)) { sendLiveViewEvent({ type: 'pix_pending_leave', payload: { userId: user?.id, checkoutSessionId: checkoutSessionIdRef.current } }); }
    };
  }, [pixData, sendLiveViewEvent, user?.id]);

  const primaryColorStyle = useMemo(() => product?.checkoutCustomization?.primaryColor || appSettings?.checkoutIdentity?.brandColor || (currentTheme === 'dark' ? 'var(--reimagined-accent-cta)' : 'var(--checkout-color-primary-DEFAULT)'), [product, appSettings, currentTheme]);
  const ctaTextColorStyle = useMemo(() => getContrastingTextColorForCta(primaryColorStyle, currentTheme), [primaryColorStyle, currentTheme]);
  const hasLeftContent = useMemo(() => product?.checkoutCustomization?.videoUrl || product?.imageUrl || (product?.checkoutCustomization?.salesCopy && product.checkoutCustomization.salesCopy.replace(/<[^>]*>?/gm, '').trim() !== '') || (product?.checkoutCustomization?.testimonials && product.checkoutCustomization.testimonials.length > 0), [product]);

  return (
    <CheckoutPageUI
      product={product} formState={formState} prices={prices}
      handleFormChange={handleFormChange} handleApplyCoupon={handleApplyCoupon}
      couponError={couponError} appliedCoupon={appliedCoupon}
      includeOrderBump={includeOrderBump} handleToggleOrderBump={handleToggleOrderBump}
      isSubmitting={isSubmitting} handlePayWithPix={handlePayWithPix}
      pixData={pixData} copyPixCode={copyPixCode} copySuccess={copySuccess}
      paymentStatus={paymentStatus} error={error} primaryColorStyle={primaryColorStyle}
      ctaTextColorStyle={ctaTextColorStyle} isPollingPayment={isPollingPayment}
      clearAppliedCoupon={clearAppliedCoupon} removeOrderBump={removeOrderBump}
      currentTheme={currentTheme} isPageLoading={isPageLoading}
      countdownTimerText={countdownTimerText} hasLeftContent={hasLeftContent}
      handleManualCheck={handleManualCheck} isManualChecking={isManualChecking} canManuallyCheck={canManuallyCheck}
      isReadyToRedirect={isReadyToRedirect} handleProceedToThankYou={handleProceedToThankYou}
    />
  );
};
export default CheckoutPage;
