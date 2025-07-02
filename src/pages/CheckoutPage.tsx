import React, { useEffect, useState, useCallback, useRef, useMemo, startTransition } from 'react';
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Product, PaymentStatus, Coupon, PushInPayPixResponseData, AppSettings, SaleProductItem } from '@/types';
import { productService } from '@/services/productService';
import { buyerService } from '@/services/buyerService';
import { abandonedCartService, CreateAbandonedCartPayload } from '@/services/abandonedCartService';
import { Button } from '@/components/ui/Button';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { CheckIcon, PHONE_COUNTRY_CODES, DocumentDuplicateIcon, LockClosedIcon } from '../constants.tsx'; 
import { settingsService } from '@/services/settingsService';
import { supabase } from '@/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Select } from '@/components/ui/Select';
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import { default as debounce } from 'https://esm.sh/lodash@4.17.21/debounce';
import { Modal } from '@/components/ui/Modal';
import { getOptimalTextColor, calculateEffectiveBg } from '@/utils/colorUtils.ts';

// Local cn utility
const cn = (...classes: (string | undefined | null | false)[]): string => classes.filter(Boolean).join(' ');

const formatCurrency = (valueInCents: number): string => {
    return `R$ ${(valueInCents / 100).toFixed(2).replace('.', ',')}`;
};

const LOCALSTORAGE_CHECKOUT_FORM_KEY = 'checkoutFormData_v3';
const LOCALSTORAGE_CHECKOUT_SESSION_KEY = 'checkout_session_id_v2';
const POLLING_INITIAL_INTERVAL = 3000;
const POLLING_MAX_INTERVAL = 15000;
const POLLING_TIMEOUT_DURATION = 5 * 60 * 1000;
const ABANDONED_CART_DEBOUNCE_MS = 5000;
const BUYER_DETAILS_DEBOUNCE_MS = 1500;
const MANUAL_CHECK_COOLDOWN_MS = 10000; 

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
  
  selectedTraditionalOrderBumps: string[]; 
  handleToggleTraditionalOrderBump: (offerId: string) => void;

  postClickOfferDecision: 'accepted' | 'rejected' | null; 

  isSubmitting: boolean;
  handleInitiatePayment: () => Promise<void>;
  pixData: PushInPayPixResponseData | null;
  copyPixCode: () => void;
  copySuccess: boolean;
  paymentStatus: PaymentStatus | null;
  error: string | null;
  
  // Dynamic styling props
  resolvedPrimaryHex: string;
  ctaButtonTextColor: string;
  orderBumpContentTextColor: string;
  upsellModalTitleColor: string;
  upsellModalDescColor: string;

  isPollingPayment: boolean;
  clearAppliedCoupon: () => void;
  currentTheme: 'light' | 'dark';
  isPageLoading: boolean; 
  countdownTimerText: string | null;
  hasLeftContent: boolean;
  handleManualCheck: () => void; 
  isManualChecking: boolean;    
  canManuallyCheck: boolean;  
  isReadyToRedirect: boolean; 
  handleProceedToThankYou: () => void; 

  showPostClickOfferModal: boolean;
  handleAcceptPostClickOffer: () => void;
  handleDeclinePostClickOffer: () => void;
  isProcessingPostClickOffer: boolean;
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

const CheckoutFooter: React.FC<{ productName?: string; className?: string; primaryColor?: string }> = ({ productName, className, primaryColor }) => {
    const currentYear = new Date().getFullYear();
    return (
        <footer className={cn("mt-12 pt-8 border-t text-center text-xs", className)}>
            <div className="space-y-2">
                {productName && <p>{productName} - {currentYear} © Todos os direitos reservados.</p>}
                <p>
                    Processado por <a href="https://1checkout.com.br/?src=check" target="_blank" rel="noopener noreferrer" className="font-medium hover:underline" style={{color: primaryColor || 'var(--checkout-color-primary-DEFAULT, var(--reimagined-accent-cta))'}}>1Checkout</a>
                </p>
            </div>
        </footer>
    );
};


const CheckoutPageUI: React.FC<CheckoutPageUIProps> = React.memo(({
  product, formState, prices, handleFormChange,
  handleApplyCoupon, couponError, appliedCoupon,
  selectedTraditionalOrderBumps, handleToggleTraditionalOrderBump,
  postClickOfferDecision,
  isSubmitting, handleInitiatePayment, pixData,
  copyPixCode, copySuccess, paymentStatus, error, 
  resolvedPrimaryHex, ctaButtonTextColor, orderBumpContentTextColor,
  upsellModalTitleColor, upsellModalDescColor,
  isPollingPayment, clearAppliedCoupon, currentTheme, isPageLoading,
  countdownTimerText, hasLeftContent,
  handleManualCheck, isManualChecking, canManuallyCheck,
  isReadyToRedirect, handleProceedToThankYou,
  showPostClickOfferModal, handleAcceptPostClickOffer, handleDeclinePostClickOffer, isProcessingPostClickOffer,
}) => {

  const themeContainerClass = cn('checkout-page-theme', currentTheme === 'dark' ? 'checkout-reimagined-theme' : 'checkout-light-theme');
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
         <CheckoutFooter productName={product?.name} className={cn(mutedTextColorClass, currentTheme === 'dark' ? 'border-[var(--reimagined-card-border)]' : 'border-[var(--checkout-color-border-subtle)]')} primaryColor={resolvedPrimaryHex} />
      </div>
    );
  }

  const renderHeaderLogo = () => {
    if (!product.checkoutCustomization?.logoUrl) {
      return null;
    }
    return <img src={product.checkoutCustomization.logoUrl} alt={`${product.name} Logo`} className="h-16 md:h-20 mx-auto mb-4 object-contain" />;
  };

  return (
    <div className={cn(themeContainerClass, "min-h-screen py-10 md:py-16 lg:py-20")}>
      <header className="mb-10 md:mb-12 text-center">
        {renderHeaderLogo()}
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
                          <footer className={`mt-3 text-sm font-medium`} style={{color: resolvedPrimaryHex}}>- {testimonial.author}</footer>
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
                        backgroundColor: product.checkoutCustomization?.countdownTimer?.backgroundColor || resolvedPrimaryHex,
                        color: product.checkoutCustomization?.countdownTimer?.textColor || getOptimalTextColor(product.checkoutCustomization?.countdownTimer?.backgroundColor || resolvedPrimaryHex, {lightColor: '#FFFFFF', darkColor: '#1F2937'})
                    }}
                >
                  {countdownTimerText}
                </div>
            )}

            <Card className={`${cardThemeClass} p-6 md:p-8 shadow-2xl`} disableHoverEffect={true}>
              <h2 className={`text-2xl md:text-3xl font-bold mb-6 font-display text-center ${strongTextColorClass}`}>Resumo do Pedido</h2>
              <div className={`border-b ${currentTheme === 'dark' ? 'border-[var(--reimagined-input-border)]' : 'border-[var(--checkout-color-border-subtle)]'} pb-4 mb-4 space-y-4`}>
                <div className="flex justify-between items-end">
                  <div className="flex items-end gap-4">
                    {(product.productImageUrl || product.imageUrl) && (
                      <img src={product.productImageUrl || product.imageUrl} alt={product.name} className="w-24 h-24 object-cover rounded-lg border border-neutral-700/50 shadow-sm"/>
                    )}
                    <span className="pb-1" style={{color: orderBumpContentTextColor}}>{product.name}</span>
                  </div>
                  <span className={`font-semibold pb-1`} style={{color: orderBumpContentTextColor}}>{formatCurrency(product.priceInCents)}</span>
                </div>
                
                {(Array.isArray(product.orderBumps) ? product.orderBumps : []).filter(ob => selectedTraditionalOrderBumps.includes(ob.id)).map(ob => (
                  <div key={`summary-ob-${ob.id}`} className={`flex justify-between items-center text-sm py-2.5 border-t border-dashed ${currentTheme === 'dark' ? 'border-[var(--reimagined-input-border)]' : 'border-slate-200'}`}>
                    <span style={{color: orderBumpContentTextColor}}>{ob.name} <span className={`text-xs font-medium`} style={{color: resolvedPrimaryHex}}>(+ Adicional)</span></span>
                    <span className={`font-medium`} style={{color: orderBumpContentTextColor}}>{formatCurrency(ob.customPriceInCents || 0)}</span>
                  </div>
                ))}

                {postClickOfferDecision === 'accepted' && product.postClickOffer && (
                  <div key="summary-pco" className={`flex justify-between items-center text-sm py-2.5 border-t border-dashed ${currentTheme === 'dark' ? 'border-[var(--reimagined-input-border)]' : 'border-slate-200'}`}>
                    <span style={{color: orderBumpContentTextColor}}>{product.postClickOffer.name} <span className={`text-xs font-medium`} style={{color: resolvedPrimaryHex}}>(+ Oferta Extra!)</span></span>
                    <span className={`font-medium`} style={{color: orderBumpContentTextColor}}>{formatCurrency(product.postClickOffer.customPriceInCents || 0)}</span>
                  </div>
                )}

                {prices.discountApplied > 0 && appliedCoupon && (
                  <div className={`flex justify-between items-center text-sm text-green-500 py-2.5 border-t border-dashed border-green-500/30`}>
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
                    <span className="text-3xl font-bold font-display" style={{color: resolvedPrimaryHex}}>{formatCurrency(prices.finalPrice)}</span>
                  </div>
                </div>
              </div>
             
              {(Array.isArray(product.orderBumps) ? product.orderBumps : []).length > 0 && !pixData && (
                <div className="my-6 space-y-4">
                  <h3 className={`text-lg font-semibold ${strongTextColorClass}`}>Ofertas Especiais para Você:</h3>
                  {(Array.isArray(product.orderBumps) ? product.orderBumps : []).map((ob) => (
                     <div key={`select-ob-${ob.id}`} 
                         className={cn(
                            `mt-6 p-4 border-2 rounded-lg transition-all duration-200 ease-in-out`,
                             product.checkoutCustomization?.animateTraditionalOrderBumps !== false ? 'animate-pulse-subtle' : '',
                             selectedTraditionalOrderBumps.includes(ob.id) 
                                ? 'ring-2 shadow-lg' 
                                : 'opacity-80 hover:opacity-100'
                             )}
                         style={{
                           borderColor: selectedTraditionalOrderBumps.includes(ob.id) ? resolvedPrimaryHex : `${resolvedPrimaryHex}4D`, 
                           backgroundColor: selectedTraditionalOrderBumps.includes(ob.id) ? `${resolvedPrimaryHex}2A` : `${resolvedPrimaryHex}1A`,
                           '--tw-ring-color': resolvedPrimaryHex,
                         } as React.CSSProperties}
                    >
                       {ob.imageUrl && <img src={ob.imageUrl} alt={ob.name} className="w-20 h-20 object-cover rounded-md float-right ml-3 mb-2 border border-neutral-600/50"/>}
                       <h4 className={`font-semibold`} style={{color: orderBumpContentTextColor}}>{ob.name}</h4>
                       {ob.description && <p className={`text-xs mb-2 whitespace-pre-line leading-relaxed`} style={{color: orderBumpContentTextColor}}>{ob.description}</p>}
                       <div className="flex items-center justify-between mt-2">
                          <p className="text-xl font-bold" style={{color: orderBumpContentTextColor}}>
                              + {formatCurrency(ob.customPriceInCents || 0)}
                          </p>
                          <ToggleSwitch
                              labelStyle={{ color: orderBumpContentTextColor }} 
                              label={selectedTraditionalOrderBumps.includes(ob.id) ? 'Adicionado!' : 'Adicionar'}
                              enabled={selectedTraditionalOrderBumps.includes(ob.id)}
                              onEnabledChange={() => handleToggleTraditionalOrderBump(ob.id)}
                              disabled={isSubmitting || !!pixData}
                              name={`traditionalOrderBumpToggle-${ob.id}`}
                              size="md"
                          />
                       </div>
                    </div>
                  ))}
                </div>
              )}


              {pixData ? (
                <div className="space-y-5 text-center pt-4">
                  <h3 className="text-2xl font-semibold font-display" style={{color: resolvedPrimaryHex}}>Pague com PIX para finalizar!</h3>
                  {paymentStatus === PaymentStatus.WAITING_PAYMENT && (
                    <>
                      <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="PIX QR Code" className="mx-auto w-60 h-60 md:w-64 md:h-64 rounded-3xl border-4 p-1.5 bg-white shadow-xl" style={{borderColor: resolvedPrimaryHex}} />
                      <p className={`text-sm ${mutedTextColorClass} mt-3`}>Escaneie o QR Code acima ou copie o código.</p>
                      <div role="button" tabIndex={0} aria-label="Copiar código PIX" onClick={copyPixCode} onKeyDown={(e) => e.key === 'Enter' && copyPixCode()}
                           className={cn("relative rounded-xl overflow-hidden cursor-pointer group", inputThemeClass)}>
                        <div className={cn("h-20 p-4 text-xs whitespace-pre-wrap break-all overflow-hidden select-all", defaultTextColorClass)}>{pixData.qr_code}</div>
                        <div className={cn("absolute inset-0 flex flex-col items-center justify-center p-2 transition-all duration-300 ease-in-out", copySuccess ? "bg-status-success/90 text-white backdrop-blur-sm" : "bg-black/50 group-hover:bg-black/60 text-white backdrop-blur-xs")}>
                          {copySuccess ? (<><CheckIcon className="h-6 w-6 mb-1" /><span className="text-sm font-medium">Copiado!</span></>) : (<><DocumentDuplicateIcon className="h-6 w-6 mb-1" /><span className="text-sm font-medium">Copiar Código</span></>)}
                        </div>
                      </div>
                      {isPollingPayment && ( <div className={cn("mt-4 flex items-center justify-center text-base", mutedTextColorClass)}><LoadingSpinner size="sm" className="mr-2"/>Aguardando confirmação do pagamento...</div> )}
                      <Button onClick={handleManualCheck} isLoading={isManualChecking} disabled={!canManuallyCheck || isManualChecking || isPollingPayment} variant="outline" size="sm" className={cn(buttonThemeClass, "outline w-full mt-3")}> {isManualChecking ? 'Verificando...' : (canManuallyCheck ? 'Já paguei, verificar status' : 'Aguarde para verificar novamente')} </Button>
                    </>
                  )}
                  {paymentStatus === PaymentStatus.PAID && (
                    <div className="p-6 bg-status-success/10 text-status-success rounded-2xl border border-status-success/30 text-center">
                      <CheckIcon className="h-12 w-12 mx-auto mb-3"/>
                      <h3 className="text-xl font-semibold mb-1">Pagamento Confirmado!</h3>
                      <p className="text-sm mb-4">Seu pedido foi processado. Você será redirecionado em breve.</p>
                      <Button onClick={handleProceedToThankYou} className={cn(buttonThemeClass, "primary w-full")} style={{backgroundColor: resolvedPrimaryHex, color: ctaButtonTextColor }} isLoading={isReadyToRedirect}>
                         {isReadyToRedirect ? 'Redirecionando...' : 'Ir para Obrigado'}
                      </Button>
                    </div>
                  )}
                  {(paymentStatus && [PaymentStatus.CANCELLED, PaymentStatus.EXPIRED, PaymentStatus.FAILED].includes(paymentStatus)) && (
                    <div className="p-5 bg-status-error/10 text-status-error rounded-2xl border border-status-error/30 text-center">
                      <h3 className="text-lg font-semibold mb-2">Pagamento Falhou</h3>
                      <p className="text-sm mb-3">Ocorreu um problema com seu pagamento (status: {paymentStatus}). Por favor, tente novamente.</p>
                      <Button onClick={() => handleInitiatePayment()} isLoading={isSubmitting} className={cn(buttonThemeClass, "primary w-full")} style={{backgroundColor: resolvedPrimaryHex, color: ctaButtonTextColor }}>
                        Tentar Novamente com PIX
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); handleInitiatePayment(); }} className="space-y-6">
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
                            className="w-28" 
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
                              <Button type="button" onClick={handleApplyCoupon} variant="outline" className={cn(buttonThemeClass, "outline")} style={{borderColor: resolvedPrimaryHex, color: resolvedPrimaryHex}}>Aplicar</Button>
                          )}
                      </div>
                      {couponError && <p className="text-xs text-status-error mt-1">{couponError}</p>}
                      {appliedCoupon && <p className="text-xs text-status-success mt-1">Cupom "{appliedCoupon.code}" aplicado!</p>}
                  </div>

                  {error && <p className="text-sm text-status-error p-3 bg-status-error/10 rounded-xl border border-status-error/30">{error}</p>}
                  
                  <Button type="submit" isLoading={isSubmitting || isProcessingPostClickOffer} className={cn("w-full py-4 text-lg font-semibold shadow-xl", buttonThemeClass, "primary")} style={{backgroundColor: resolvedPrimaryHex, color: ctaButtonTextColor }} iconSpacing="normal" leftIcon={<LockClosedIcon className="h-5 w-5"/>}>
                    {isSubmitting || isProcessingPostClickOffer ? "Processando..." : "Pagar com PIX"}
                  </Button>
                </form>
              )}
               <p className={`text-xs mt-8 text-center ${mutedTextColorClass}`}>
                <LockClosedIcon className="inline h-3 w-3 mr-1 align-baseline" /> Ambiente seguro. Seus dados estão protegidos.
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
      {product.postClickOffer && (
        <Modal
            isOpen={showPostClickOfferModal}
            onClose={handleDeclinePostClickOffer}
            title={product.postClickOffer.modalTitle || "✨ Oferta Especial! ✨"}
            size="lg"
            theme={currentTheme === 'dark' ? 'dark-app' : 'light'}
        >
            <div className="text-center">
                {product.postClickOffer.imageUrl && (
                    <img src={product.postClickOffer.imageUrl} alt={product.postClickOffer.name} className="max-h-48 mx-auto mb-4 rounded-lg shadow-md"/>
                )}
                <h2 className={`text-2xl font-bold mb-2`} style={{color: upsellModalTitleColor}}>{product.postClickOffer.name}</h2>
                
                <div 
                    className={cn(
                        `text-base mb-4 prose prose-sm sm:prose-base max-w-none whitespace-pre-line leading-relaxed`,
                         currentTheme === 'dark' ? 'prose-invert' : '' // prose-invert para tema escuro
                    )}
                    style={{color: upsellModalDescColor}}
                    dangerouslySetInnerHTML={{ __html: product.postClickOffer.description }} 
                />

                <p className="text-3xl font-bold mb-6" style={{color: resolvedPrimaryHex}}>
                    + {formatCurrency(product.postClickOffer.customPriceInCents || 0)}
                </p>
                {error && <p className="text-sm text-status-error p-2 bg-status-error/10 border border-status-error/30 rounded-md my-3">{error}</p>}
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                    <Button
                        onClick={handleAcceptPostClickOffer}
                        isLoading={isProcessingPostClickOffer || isSubmitting} 
                        disabled={isProcessingPostClickOffer || isSubmitting}
                        className={cn(buttonThemeClass, "primary flex-1 py-3 text-md")}
                        style={{backgroundColor: resolvedPrimaryHex, color: ctaButtonTextColor}}
                    >
                        {product.postClickOffer.modalAcceptButtonText || 'Sim, Adicionar!'}
                    </Button>
                    <Button
                        onClick={handleDeclinePostClickOffer}
                        disabled={isProcessingPostClickOffer || isSubmitting} 
                        variant="outline"
                        className={cn(buttonThemeClass, "outline flex-1 py-3 text-md")}
                    >
                         {product.postClickOffer.modalDeclineButtonText || 'Não, Obrigado'}
                    </Button>
                </div>
            </div>
        </Modal>
      )}
      <CheckoutFooter 
        productName={product?.name} 
        className={cn(mutedTextColorClass, currentTheme === 'dark' ? 'border-[var(--reimagined-card-border)]' : 'border-[var(--checkout-color-border-subtle)]')} 
        primaryColor={resolvedPrimaryHex}
      />
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
  
  const [selectedTraditionalOrderBumps, setSelectedTraditionalOrderBumps] = useState<string[]>([]);
  const [showPostClickOfferModal, setShowPostClickOfferModal] = useState(false);
  const [postClickOfferDecision, setPostClickOfferDecision] = useState<'accepted' | 'rejected' | null>(null);
  const [isProcessingPostClickOffer, setIsProcessingPostClickOffer] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pixData, setPixData] = useState<PushInPayPixResponseData | null>(null);
  const [currentSaleId, setCurrentSaleId] = useState<string | null>(null); // State to hold the sale ID
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

  const { user } = useAuth();

  const [resolvedPrimaryHex, setResolvedPrimaryHex] = useState<string>('');
  const [ctaButtonTextColor, setCtaButtonTextColor] = useState<string>('');
  const [orderBumpContentTextColor, setOrderBumpContentTextColor] = useState<string>('');
  const [upsellModalTitleColor, setUpsellModalTitleColor] = useState<string>('');
  const [upsellModalDescColor, setUpsellModalDescColor] = useState<string>('');


  const primaryColorStyle = useMemo(() => product?.checkoutCustomization?.primaryColor || 
                                      appSettings?.checkoutIdentity?.brandColor || 
                                      (currentTheme === 'dark' ? 'var(--reimagined-accent-cta)' : 'var(--checkout-color-primary-DEFAULT)'),
                                      [product, appSettings, currentTheme]);
  
useEffect(() => {
    let actualHex = primaryColorStyle;
    const colorVarMap: Record<string, string> = {
      'var(--reimagined-accent-cta)': '#FDE047', // Amarelo
      'var(--checkout-color-primary-DEFAULT)': '#0D9488', // Teal
    };

    if (colorVarMap[actualHex]) {
      actualHex = colorVarMap[actualHex];
    }
    
    const defaultHexForTheme = currentTheme === 'dark' ? '#FDE047' : '#0D9488';
    let finalResolvedHex = defaultHexForTheme;

    if (/^#([0-9A-F]{3,4}|[0-9A-F]{6}|[0-9A-F]{8})$/i.test(actualHex.trim())) {
      finalResolvedHex = actualHex.trim();
    }
    setResolvedPrimaryHex(finalResolvedHex);
    setCtaButtonTextColor(getOptimalTextColor(finalResolvedHex, { lightColor: '#FFFFFF', darkColor: '#1F2937' }));

    if (currentTheme === 'light') {
      const pageBgHex = '#F9FAFB'; 
      const orderBumpTransparentBg = `${finalResolvedHex}1A`; 
      const effectiveBg = calculateEffectiveBg(orderBumpTransparentBg, pageBgHex);
      setOrderBumpContentTextColor(getOptimalTextColor(effectiveBg, { lightColor: '#FFFFFF', darkColor: '#1F2937' }));
      setUpsellModalTitleColor('#000000'); 
      setUpsellModalDescColor(getOptimalTextColor('#FFFFFF', { lightColor: '#FFFFFF', darkColor: '#374151' }));
    } else { 
      setOrderBumpContentTextColor(getOptimalTextColor(finalResolvedHex, { lightColor: '#FFFFFF', darkColor: '#E0E0E0' }));
      const darkModalBg = '#1A1A1E'; 
      setUpsellModalTitleColor(getOptimalTextColor(darkModalBg, { lightColor: '#FFFFFF', darkColor: '#E0E0E0' }));
      setUpsellModalDescColor(getOptimalTextColor(darkModalBg, { lightColor: '#E0E0E0', darkColor: '#A0A0A0' }));
    }
  }, [primaryColorStyle, currentTheme]);


  const debouncedSaveAbandonedCart = useRef(
    debounce(async (currentFormState: CheckoutFormState, currentProduct: Product | null, currentPrices: CheckoutPrices) => {
      if (!currentProduct || !currentFormState.customerEmail.trim()) return;
      
      const payload: CreateAbandonedCartPayload = {
        platformUserId: currentProduct.platformUserId, productId: currentProduct.id,
        productName: currentProduct.name, potentialValueInCents: currentPrices.finalPrice,
        customerName: currentFormState.customerName.trim(), customerEmail: currentFormState.customerEmail.trim(),
        customerWhatsapp: `${currentFormState.customerWhatsappCountryCode}${currentFormState.rawWhatsappNumber.replace(/\D/g, '')}`,
        trackingParameters: extractUtmParamsFromUrl(),
      };
      try {
        const existingCartId = localStorage.getItem(`abandonedCartId_${currentProduct.id}_${currentFormState.customerEmail}`);
        if (existingCartId) { await abandonedCartService.updateAbandonedCartAttempt(existingCartId, payload); } 
        else { const newCart = await abandonedCartService.createAbandonedCartAttempt(payload); localStorage.setItem(`abandonedCartId_${currentProduct.id}_${currentFormState.customerEmail}`, newCart.id); }
      } catch (err) { console.warn("[CheckoutPage] Failed to save/update abandoned cart:", err); }
    }, ABANDONED_CART_DEBOUNCE_MS)
  ).current;
  
  const debouncedSaveBuyerDetails = useRef( debounce(async (currentFormState: CheckoutFormState) => { localStorage.setItem(LOCALSTORAGE_CHECKOUT_FORM_KEY, JSON.stringify(currentFormState)); }, BUYER_DETAILS_DEBOUNCE_MS) ).current;
  
  useEffect(() => { paymentStatusRef.current = paymentStatus; }, [paymentStatus]);

  useEffect(() => {
    const storedSessionId = localStorage.getItem(LOCALSTORAGE_CHECKOUT_SESSION_KEY) || uuidv4();
    localStorage.setItem(LOCALSTORAGE_CHECKOUT_SESSION_KEY, storedSessionId);
    setCheckoutSessionId(storedSessionId);
    const storedFormData = localStorage.getItem(LOCALSTORAGE_CHECKOUT_FORM_KEY);
    if (storedFormData) { try { const parsedData = JSON.parse(storedFormData); setFormState(prev => ({ ...prev, ...parsedData })); } catch (e) { console.warn("Failed to parse stored form data"); } }
    if (!hasSentEnterEventRef.current && storedSessionId) { hasSentEnterEventRef.current = true; }
    const handleBeforeUnload = () => {}; window.addEventListener('beforeunload', handleBeforeUnload);
    return () => { window.removeEventListener('beforeunload', handleBeforeUnload); debouncedSaveAbandonedCart.cancel(); debouncedSaveBuyerDetails.cancel(); if (pollingIntervalTimerIdRef.current) clearTimeout(pollingIntervalTimerIdRef.current); if (manualCheckTimeoutRef.current) clearTimeout(manualCheckTimeoutRef.current); if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current); document.body.className = ''; };
  }, [user?.id, debouncedSaveAbandonedCart, debouncedSaveBuyerDetails]);

  const extractUtmParamsFromUrl = (): Record<string, string> => { const params = new URLSearchParams(location.search); const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'src', 'sck', 'ref', 'gclid']; const utms: Record<string, string> = {}; utmKeys.forEach(key => { if (params.has(key)) utms[key] = params.get(key)!; }); return utms; };

  const calculatePrices = useCallback(() => {
    if (!product) return;
    let currentPrice = product.priceInCents;
    let originalPrice = product.priceInCents; 
    let discount = 0;

    (Array.isArray(product.orderBumps) ? product.orderBumps : []).forEach(ob => {
        if (selectedTraditionalOrderBumps.includes(ob.id)) {
            const obPrice = ob.customPriceInCents ?? 0; 
            currentPrice += obPrice;
            originalPrice += obPrice;
        }
    });
    
    if (postClickOfferDecision === 'accepted' && product.postClickOffer?.customPriceInCents !== undefined) {
        currentPrice += product.postClickOffer.customPriceInCents;
        originalPrice += product.postClickOffer.customPriceInCents;
    }

    if (appliedCoupon) {
      if (appliedCoupon.discountType === 'percentage') { discount = Math.round(currentPrice * (appliedCoupon.discountValue / 100)); } 
      else { discount = Math.min(currentPrice, appliedCoupon.discountValue); }
    }
    
    const finalPrice = currentPrice - discount;
    
    setPrices({ finalPrice: Math.max(0, finalPrice), originalPriceBeforeDiscount: originalPrice, discountApplied: discount, });
  }, [product, appliedCoupon, selectedTraditionalOrderBumps, postClickOfferDecision]);

  const checkPaymentStatus = useCallback(async (txId: string, saleIdToCheck: string) => {
    if (!product?.platformUserId || !saleIdToCheck) return;
    let mappedStatus: PaymentStatus | null = null;
    try {
      const { data: pixFuncRes, error: funcErr } = await supabase.functions.invoke('verificar-status-pix', { body: { transactionId: txId, productOwnerUserId: product.platformUserId, saleId: saleIdToCheck } });
      if (funcErr || !pixFuncRes || !pixFuncRes.success || !pixFuncRes.data) throw new Error(pixFuncRes?.message || funcErr?.message || "Falha ao verificar status do PIX.");
      const rawStatus = pixFuncRes.data.status.toLowerCase();
      switch (rawStatus) { case 'paid': case 'approved': mappedStatus = PaymentStatus.PAID; break; case 'created': case 'waiting_payment': case 'pending': case 'processing': mappedStatus = PaymentStatus.WAITING_PAYMENT; break; case 'expired': mappedStatus = PaymentStatus.EXPIRED; break; case 'cancelled': mappedStatus = PaymentStatus.CANCELLED; break; default: mappedStatus = PaymentStatus.FAILED; }
      setPaymentStatus(mappedStatus);
      if (mappedStatus === PaymentStatus.PAID) { if (pollingIntervalTimerIdRef.current) clearTimeout(pollingIntervalTimerIdRef.current); setIsPollingPayment(false); setIsReadyToRedirect(true); setTimeout(() => navigate(`/thank-you/${saleIdToCheck}?origProdId=${product.id}&csid=${checkoutSessionId}`), 2000); } 
            else if (mappedStatus !== PaymentStatus.WAITING_PAYMENT) { if (pollingIntervalTimerIdRef.current) clearTimeout(pollingIntervalTimerIdRef.current); setIsPollingPayment(false); setError("Payment failed."); }
    } catch (statusErr: any) { console.error("[CheckoutPage.checkPaymentStatus] Erro:", statusErr.message); if (paymentStatusRef.current !== PaymentStatus.PAID) setError("Erro ao verificar status do pagamento."); }
  }, [product, navigate, checkoutSessionId ]);

  const startPaymentPolling = useCallback((txId: string, saleIdToPoll: string) => { 
    setIsPollingPayment(true); pollingAttemptRef.current = 0; pollingStartTimeRef.current = Date.now(); 
    const poll = async () => { 
      if (Date.now() - pollingStartTimeRef.current > POLLING_TIMEOUT_DURATION) { 
        setIsPollingPayment(false); 
        if (paymentStatusRef.current !== PaymentStatus.PAID) { setError("Tempo para verificar PIX excedido."); } return; 
      } 
      await checkPaymentStatus(txId, saleIdToPoll); 
      if (paymentStatusRef.current === PaymentStatus.WAITING_PAYMENT || paymentStatusRef.current === null) { 
        pollingAttemptRef.current++; 
        const nextInterval = Math.min(POLLING_INITIAL_INTERVAL * Math.pow(1.5, pollingAttemptRef.current), POLLING_MAX_INTERVAL); 
        pollingIntervalTimerIdRef.current = window.setTimeout(poll, nextInterval); 
      } else { 
        setIsPollingPayment(false); 
      } 
    }; 
    poll(); 
  }, [checkPaymentStatus]);
  
  const handleManualCheck = useCallback(async () => { 
    if (!pixData?.id || !currentSaleId || !canManuallyCheck || isManualChecking) return; 
    setIsManualChecking(true); 
    setCanManuallyCheck(false); 
    await checkPaymentStatus(pixData.id, currentSaleId); 
    setIsManualChecking(false); 
    if (manualCheckTimeoutRef.current) clearTimeout(manualCheckTimeoutRef.current); 
    manualCheckTimeoutRef.current = window.setTimeout(() => setCanManuallyCheck(true), MANUAL_CHECK_COOLDOWN_MS); 
  }, [pixData, canManuallyCheck, isManualChecking, checkPaymentStatus, currentSaleId]);
  
  const handleProceedToThankYou = useCallback(() => { if (currentSaleId && product?.id) { navigate(`/thank-you/${currentSaleId}?origProdId=${product.id}&csid=${checkoutSessionId}`); } }, [currentSaleId, product, navigate, checkoutSessionId]);

  useEffect(() => { 
    if (!slug) { 
      setError("Produto não especificado."); 
      setIsPageLoading(false); 
      return; 
    } 
    const fetchProductData = async () => { 
      setIsPageLoading(true); 
      setError(null); 
      try { 
        // Always fetch from service, which now handles caching internally
        const fetchedProductData = await productService.getProductBySlug(slug); 
        setProduct(fetchedProductData || null); 
        
        if (!fetchedProductData) { 
          setError("Produto não encontrado ou indisponível."); 
        } else {
          if (fetchedProductData.platformUserId) {
            setAppSettings(await settingsService.getAppSettingsByUserId(fetchedProductData.platformUserId));
          }
          setCurrentTheme(fetchedProductData.checkoutCustomization?.theme || 'light');
        }
      } catch (err: any) { 
        setError(err.message || "Erro ao carregar dados do produto."); 
      } finally { 
        setIsPageLoading(false); 
      } 
    }; 
    fetchProductData(); 
  }, [slug]);
  
  useEffect(() => {
    if (product && !appliedCoupon) {
      const automaticCoupons = product.coupons?.filter(c => c.isAutomatic && c.isActive && (!c.expiresAt || new Date(c.expiresAt) >= new Date()) && (c.maxUses === undefined || (c.uses || 0) < c.maxUses) && (c.minPurchaseValueInCents === undefined || product.priceInCents >= c.minPurchaseValueInCents));
      if (automaticCoupons && automaticCoupons.length > 0) { setAppliedCoupon(automaticCoupons[0]); setFormState(prev => ({...prev, couponCodeInput: ''})); setCouponError(null); }
    }
  }, [product, appliedCoupon]);

  useEffect(() => { calculatePrices(); }, [product, appliedCoupon, selectedTraditionalOrderBumps, postClickOfferDecision, calculatePrices]);
  useEffect(() => { document.title = product ? `Checkout - ${product.name}` : "Checkout"; }, [product]);
  
  useEffect(() => {
      debouncedSaveAbandonedCart(formState, product, prices);
      debouncedSaveBuyerDetails(formState);
  }, [formState, product, prices, debouncedSaveAbandonedCart, debouncedSaveBuyerDetails]);

  useEffect(() => { if (!product?.checkoutCustomization?.countdownTimer?.enabled || !product.checkoutCustomization.countdownTimer.durationMinutes) { setCountdownTimerText(null); return; } const { durationMinutes, messageBefore = "Oferta expira em:", messageAfter = "Oferta expirada!" } = product.checkoutCustomization.countdownTimer; const endTime = new Date(Date.now() + durationMinutes * 60000).getTime(); const updateTimer = () => { const now = Date.now(); const timeLeft = endTime - now; if (timeLeft <= 0) { setCountdownTimerText(messageAfter); if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current); return; } const minutes = Math.floor((timeLeft / (1000 * 60)) % 60); const seconds = Math.floor((timeLeft / 1000) % 60); setCountdownTimerText(`${messageBefore} ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`); }; updateTimer(); countdownIntervalRef.current = window.setInterval(updateTimer, 1000); return () => { if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current); }; }, [product?.checkoutCustomization?.countdownTimer]);

  const handleFormChange = <K extends keyof CheckoutFormState>(field: K, value: CheckoutFormState[K]) => { 
    startTransition(() => { 
      setFormState(prev => ({ ...prev, [field]: value })); 
    }); 
  };
  const handleApplyCoupon = useCallback(async () => { if (!product || !formState.couponCodeInput.trim()) { setCouponError("Digite um código de cupom."); return; } setCouponError(null); const couponToTry = product.coupons?.find(c => c.code.toUpperCase() === formState.couponCodeInput.trim().toUpperCase()); if (!couponToTry || !couponToTry.isActive) { setCouponError("Cupom inválido ou inativo."); return; } if (couponToTry.expiresAt && new Date(couponToTry.expiresAt) < new Date()) { setCouponError("Cupom expirado."); return; } if (couponToTry.minPurchaseValueInCents && product.priceInCents < couponToTry.minPurchaseValueInCents) { setCouponError(`Valor mínimo de R\$${(couponToTry.minPurchaseValueInCents / 100).toFixed(2)} para este cupom.`); return; } const { data: existingSaleWithCoupon, error: fetchError } = await supabase.from('sales').select('id').eq('platform_user_id', product.platformUserId).eq('customer_email', formState.customerEmail).eq('coupon_code_used', couponToTry.code.toUpperCase()).limit(1); if (fetchError) console.warn("Error checking coupon usage:", fetchError); if (existingSaleWithCoupon && existingSaleWithCoupon.length > 0) { setCouponError(`Cupom "${couponToTry.code}" já utilizado por este e-mail.`); return; } setAppliedCoupon(couponToTry); setFormState(prev => ({...prev, couponCodeInput: ''})); }, [product, formState.couponCodeInput, formState.customerEmail]);
  const clearAppliedCoupon = () => { setAppliedCoupon(null); setCouponError(null); };
  const handleToggleTraditionalOrderBump = (offerId: string) => { setSelectedTraditionalOrderBumps(prev => prev.includes(offerId) ? prev.filter(id => id !== offerId) : [...prev, offerId]); };
  const copyPixCode = () => { if (pixData?.qr_code) { navigator.clipboard.writeText(pixData.qr_code).then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }); } };

  const proceedToPixGeneration = async (currentDecisionForPostClickOffer: 'accepted' | 'rejected' | null) => {
    if (!product) { setError("Produto não carregado."); setIsSubmitting(false); setIsProcessingPostClickOffer(false); return; }
    setError(null); 
    
    const utms = extractUtmParamsFromUrl();
    const buyerId = uuidv4();

    const saleProducts: SaleProductItem[] = [{ productId: product.id, name: product.name, quantity: 1, priceInCents: product.priceInCents, originalPriceInCents: product.priceInCents, slug: product.slug, deliveryUrl: product.deliveryUrl }];
    
    if (Array.isArray(product.orderBumps) && product.orderBumps.length > 0) {
      for (const ob of product.orderBumps) {
        if (selectedTraditionalOrderBumps.includes(ob.id)) {
          const orderBumpFullProduct = await productService.getProductById(ob.productId); 
          saleProducts.push({ productId: ob.productId, name: ob.name, quantity: 1, priceInCents: ob.customPriceInCents || 0, originalPriceInCents: ob.customPriceInCents || 0, isTraditionalOrderBump: true, deliveryUrl: orderBumpFullProduct?.deliveryUrl, slug: orderBumpFullProduct?.slug });
        }
      }
    }

    if (currentDecisionForPostClickOffer === 'accepted' && product.postClickOffer) {
        const pcoProduct = product.postClickOffer;
        saleProducts.push({ productId: product.postClickOffer.productId, name: product.postClickOffer.name, quantity: 1, priceInCents: product.postClickOffer.customPriceInCents || 0, originalPriceInCents: product.postClickOffer.customPriceInCents || 0, isPostClickOffer: true, deliveryUrl: pcoProduct?.imageUrl, slug: pcoProduct?.name.toLowerCase().replace(/\s+/g, '-') });
    }

    let priceForPixCalculation = product.priceInCents;
    let originalPriceForPixCalculation = product.priceInCents;

    (Array.isArray(product.orderBumps) ? product.orderBumps : []).forEach(ob => {
      if (selectedTraditionalOrderBumps.includes(ob.id)) {
        const obPrice = ob.customPriceInCents ?? 0;
        priceForPixCalculation += obPrice;
        originalPriceForPixCalculation += obPrice;
      }
    });

    if (currentDecisionForPostClickOffer === 'accepted' && product.postClickOffer?.customPriceInCents !== undefined) {
      priceForPixCalculation += product.postClickOffer.customPriceInCents;
      originalPriceForPixCalculation += product.postClickOffer.customPriceInCents;
    }

    let discountForPixCalculation = 0;
    if (appliedCoupon) {
      if (appliedCoupon.discountType === 'percentage') {
        discountForPixCalculation = Math.round(priceForPixCalculation * (appliedCoupon.discountValue / 100));
      } else {
        discountForPixCalculation = Math.min(priceForPixCalculation, appliedCoupon.discountValue);
      }
    }
    const finalPriceForPix = Math.max(0, priceForPixCalculation - discountForPixCalculation);

    try {
      await buyerService.createBuyer({ id: buyerId, sessionId: checkoutSessionId, authUserId: user?.id, email: formState.customerEmail.trim(), name: formState.customerName.trim(), whatsapp: `${formState.customerWhatsappCountryCode}${formState.rawWhatsappNumber.replace(/\D/g, '')}`, });

      const { data: pixFuncRes, error: funcErr } = await supabase.functions.invoke('gerar-pix', { body: { payload: { value: finalPriceForPix, originalValueBeforeDiscount: originalPriceForPixCalculation, customerName: formState.customerName.trim(), customerEmail: formState.customerEmail.trim(), customerWhatsapp: `${formState.customerWhatsappCountryCode}${formState.rawWhatsappNumber.replace(/\D/g, '')}`, products: saleProducts, trackingParameters: utms, couponCodeUsed: appliedCoupon?.code, discountAppliedInCents: discountForPixCalculation, buyerId, }, productOwnerUserId: product.platformUserId } });

      if (funcErr) { let msg = "Falha ao gerar PIX."; if (typeof funcErr.message === 'string') { try { const parsed = JSON.parse(funcErr.message); msg = parsed?.error || parsed?.message || funcErr.message; } catch (e) { msg = funcErr.message; } } throw new Error(msg); }
      if (!pixFuncRes || !pixFuncRes.success || !pixFuncRes.data || !pixFuncRes.saleId) { throw new Error(pixFuncRes?.message || "Resposta inválida do servidor PIX (dados ou saleId ausentes)."); }
      
      const saleId = pixFuncRes.saleId;

      startTransition(() => { 
        setPixData(pixFuncRes.data || null); 
        setCurrentSaleId(saleId);
        setPaymentStatus(PaymentStatus.WAITING_PAYMENT); 
      });
      startPaymentPolling(pixFuncRes.data.id, saleId);
    } catch (paymentError: any) { setError(paymentError.message || "Erro desconhecido ao processar PIX."); console.error("[proceedToPixGeneration] Error:", paymentError);
    } finally { 
      if (!product.postClickOffer || currentDecisionForPostClickOffer !== null) {
        setIsSubmitting(false);
      }
    }
  };
  
  const handleInitiatePayment = async () => {
    if (!product) return;
    setError(null);
    if (product.postClickOffer && product.postClickOffer.productId && postClickOfferDecision === null) {
        setShowPostClickOfferModal(true);
        return; 
    }
    setIsSubmitting(true); 
    await proceedToPixGeneration(postClickOfferDecision);
  };

  const handleAcceptPostClickOffer = async () => {
    setPostClickOfferDecision('accepted');
    setShowPostClickOfferModal(false);
    setIsProcessingPostClickOffer(true); 
    try {
      await proceedToPixGeneration('accepted');
    } finally {
      setIsProcessingPostClickOffer(false);
    }
  };
  
  const handleDeclinePostClickOffer = async () => {
    setPostClickOfferDecision('rejected');
    setShowPostClickOfferModal(false);
    setIsProcessingPostClickOffer(true);
    try {
      await proceedToPixGeneration('rejected');
    } finally {
      setIsProcessingPostClickOffer(false);
    }
  };
  
  const hasLeftContent = !!(product?.checkoutCustomization?.videoUrl || product?.imageUrl || (product?.checkoutCustomization?.salesCopy && product.checkoutCustomization.salesCopy.replace(/<[^>]*>?/gm, '').trim() !== '') || (product?.checkoutCustomization?.testimonials && product.checkoutCustomization.testimonials.length > 0));

  return (
    <CheckoutPageUI
      product={product} formState={formState} prices={prices} handleFormChange={handleFormChange}
      handleApplyCoupon={handleApplyCoupon} couponError={couponError} appliedCoupon={appliedCoupon}
      selectedTraditionalOrderBumps={selectedTraditionalOrderBumps} handleToggleTraditionalOrderBump={handleToggleTraditionalOrderBump}
      postClickOfferDecision={postClickOfferDecision}
      isSubmitting={isSubmitting} handleInitiatePayment={handleInitiatePayment} pixData={pixData}
      copyPixCode={copyPixCode} copySuccess={copySuccess} paymentStatus={paymentStatus}
      error={error} 
      resolvedPrimaryHex={resolvedPrimaryHex} 
      ctaButtonTextColor={ctaButtonTextColor}
      orderBumpContentTextColor={orderBumpContentTextColor}
      upsellModalTitleColor={upsellModalTitleColor}
      upsellModalDescColor={upsellModalDescColor}
      isPollingPayment={isPollingPayment} clearAppliedCoupon={clearAppliedCoupon}
      currentTheme={currentTheme} isPageLoading={isPageLoading} countdownTimerText={countdownTimerText}
      hasLeftContent={hasLeftContent}
      handleManualCheck={handleManualCheck} isManualChecking={isManualChecking} canManuallyCheck={canManuallyCheck}
      isReadyToRedirect={isReadyToRedirect} handleProceedToThankYou={handleProceedToThankYou}
      showPostClickOfferModal={showPostClickOfferModal}
      handleAcceptPostClickOffer={handleAcceptPostClickOffer}
      handleDeclinePostClickOffer={handleDeclinePostClickOffer}
      isProcessingPostClickOffer={isProcessingPostClickOffer}
    />
  );
};
export default CheckoutPage;