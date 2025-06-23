
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from "react-router-dom";
// import { v4 as uuidv4 } from 'uuid'; // Removed: unused
import { Product, PaymentStatus, Coupon, PushInPayPixResponseData, PushInPayPixResponse, AppSettings, /* PlatformSettings, */ SaleProductItem, /* PaymentMethod, Sale, UtmifyOrderPayload, */ AbandonedCartStatus, PushInPayPixRequest, PushInPayTransactionStatusResponse /*, UtmifyCustomer, UtmifyProduct, UtmifyTrackingParameters */ } from '@/types';
import { productService } from '@/services/productService';
import { abandonedCartService, CreateAbandonedCartPayload } from '@/services/abandonedCartService';
// import { customerService } from '@/services/customerService'; // Removed: unused
import { Button } from '@/components/ui/Button';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { CheckIcon, PHONE_COUNTRY_CODES, DocumentDuplicateIcon, TagIcon, MOCK_WEBHOOK_URL, PLATFORM_NAME, /* DEFAULT_CURRENCY, */ AppLogoIcon, cn } from '../constants.tsx';
import { settingsService } from '@/services/settingsService';
// import { salesService } from '@/services/salesService'; // Removed: unused
// import { utmifyService } from '@/services/utmifyService'; // Removed: unused
import { supabase } from '@/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Select } from '@/components/ui/Select';

const LockClosedIconSolid: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002 2v-7a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
  </svg>
);

const formatCurrency = (valueInCents: number): string => {
    return `R$ ${(valueInCents / 100).toFixed(2).replace('.', ',')}`;
};

// Removed unused function: formatPhoneNumberVisual
// const formatPhoneNumberVisual = (digits: string): string => {
//   if (!digits) return '';
//   if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
//   if (digits.length >= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6,10)}`;
//   if (digits.length > 6) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
//   if (digits.length > 2) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
//   return `(${digits}`;
// };


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
    } catch (e) {
      return theme === 'dark' ? defaultDarkThemeCtaText : defaultLightThemeCtaText;
    }
};

const LOCALSTORAGE_CHECKOUT_KEY = 'checkoutFormData_v2';
const POLLING_INTERVAL = 5000;
const POLLING_TIMEOUT_DURATION = 5 * 60 * 1000;

interface CheckoutPageUIProps {
  product: Product | null;
  customerName: string;
  handleCustomerNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  customerEmail: string;
  handleCustomerEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  rawWhatsappNumber: string;
  handleWhatsappInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  customerWhatsappCountryCode: string;
  handleCountryCodeChange: (value: string) => void;
  couponCodeInput: string;
  handleCouponCodeInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleApplyCoupon: () => void;
  couponError: string | null;
  appliedCoupon: Coupon | null;
  finalPrice: number | null;
  originalPriceBeforeDiscount: number | null;
  discountApplied: number;
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
  setPixData: React.Dispatch<React.SetStateAction<PushInPayPixResponseData | null>>;
  setPaymentStatus: React.Dispatch<React.SetStateAction<PaymentStatus | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  hasLeftContent: boolean;
  currentTheme: 'light' | 'dark';
}


const CheckoutPageUI: React.FC<CheckoutPageUIProps> = ({
  product, customerName, handleCustomerNameChange, customerEmail, handleCustomerEmailChange,
  rawWhatsappNumber, handleWhatsappInputChange, customerWhatsappCountryCode, handleCountryCodeChange,
  couponCodeInput, handleCouponCodeInputChange, handleApplyCoupon, couponError, appliedCoupon,
  finalPrice, originalPriceBeforeDiscount, discountApplied,
  includeOrderBump, handleToggleOrderBump, isSubmitting, handlePayWithPix,
  pixData, copyPixCode, copySuccess, paymentStatus, error, primaryColorStyle, ctaTextColorStyle,
  isPollingPayment, clearAppliedCoupon, removeOrderBump,
  setPixData, setPaymentStatus, setError: setGeneralError, hasLeftContent, currentTheme
}) => {
  if (!product || finalPrice === null || originalPriceBeforeDiscount === null) {
    return <div className={`flex justify-center items-center min-h-screen ${currentTheme === 'dark' ? 'text-[var(--reimagined-text-muted)]' : 'text-[var(--checkout-color-text-muted)]' }`}><LoadingSpinner size="lg" /><p className="ml-3">Carregando...</p></div>;
  }

  const themeContainerClass = `checkout-page-theme ${currentTheme === 'dark' ? 'checkout-reimagined-theme' : 'checkout-light-theme'}`;
  const cardThemeClass = currentTheme === 'dark' ? 'card-checkout-reimagined' : 'card-checkout-specific';
  const inputThemeClass = currentTheme === 'dark' ? 'input-checkout-reimagined' : 'input-checkout-specific';
  const buttonThemeClass = currentTheme === 'dark' ? 'button-checkout-reimagined' : 'button-checkout-specific';

  const selectTriggerThemeClass = currentTheme === 'dark'
    ? 'bg-[var(--reimagined-input-bg)] border-[var(--reimagined-input-border)] text-[var(--reimagined-text-strong)] rounded-r-none border-r-0 h-11'
    : 'select-trigger-checkout-light rounded-r-none border-r-0 h-11'; 

  const selectContentThemeClass = currentTheme === 'dark'
    ? 'bg-[var(--reimagined-card-bg)] border-[var(--reimagined-card-border)] text-[var(--reimagined-text-default)]'
    : 'bg-[var(--checkout-color-bg-surface)] border-[var(--checkout-color-border-subtle)] text-[var(--checkout-color-text-default)]';

  const headerProductNameClass = currentTheme === 'dark' ? 'text-[var(--reimagined-accent-gold)]' : 'text-[var(--checkout-color-text-strong)]';
  const defaultTextColorClass = currentTheme === 'dark' ? 'text-[var(--reimagined-text-default)]' : 'text-[var(--checkout-color-text-default)]';
  const mutedTextColorClass = currentTheme === 'dark' ? 'text-[var(--reimagined-text-muted)]' : 'text-[var(--checkout-color-text-muted)]';
  const strongTextColorClass = currentTheme === 'dark' ? 'text-[var(--reimagined-text-strong)]' : 'text-[var(--checkout-color-text-strong)]';
  const labelTextColorClass = currentTheme === 'dark' ? 'text-[var(--reimagined-text-muted)]' : 'text-[var(--checkout-color-text-muted)]';


  const phoneCountryOptions = PHONE_COUNTRY_CODES.map(cc => ({ value: cc.value, label: `${cc.emoji} ${cc.value}` }));

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
            {product.checkoutCustomization?.countdownTimer?.enabled && (
                <div
                    id="checkout-countdown-timer"
                    className="text-center p-3.5 rounded-2xl font-semibold text-lg shadow-md"
                    style={{
                        backgroundColor: product.checkoutCustomization.countdownTimer.backgroundColor || (currentTheme === 'dark' ? 'var(--reimagined-accent-cta)' : 'var(--checkout-color-primary-DEFAULT)'),
                        color: product.checkoutCustomization.countdownTimer.textColor || (currentTheme === 'dark' ? 'var(--reimagined-cta-text)' : 'var(--checkout-color-primary-cta-text)')
                    }}
                >
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
                {discountApplied > 0 && appliedCoupon && (
                  <div className={`flex justify-between items-center text-sm text-status-success py-2.5 border-t border-dashed border-status-success/30`}>
                    <span>Desconto ({appliedCoupon.code})</span>
                    <span>-{formatCurrency(discountApplied)}</span>
                  </div>
                )}
                <div className={`flex justify-between items-center mt-4 pt-5 border-t ${currentTheme === 'dark' ? 'border-[var(--reimagined-input-border)]' : 'border-[var(--checkout-color-border-subtle)]'}`}>
                  <span className={`text-xl font-bold font-display ${strongTextColorClass}`} >Total:</span>
                  <div className="text-right">
                    {originalPriceBeforeDiscount !== finalPrice && (
                         <span className={`block text-sm line-through ${mutedTextColorClass}`}>{formatCurrency(originalPriceBeforeDiscount)}</span>
                    )}
                    <span className="text-3xl font-bold font-display" style={{color: primaryColorStyle}}>{formatCurrency(finalPrice)}</span>
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
                      
                      <div 
                        className={cn("relative rounded-xl overflow-hidden cursor-pointer group", inputThemeClass)}
                        onClick={copyPixCode}
                        role="button"
                        tabIndex={0}
                        aria-label="Copiar código PIX"
                        aria-live="polite"
                      >
                        <div className={cn("h-20 p-4 text-xs whitespace-pre-wrap break-all overflow-hidden select-all", defaultTextColorClass)}>
                          {pixData.qr_code}
                        </div>
                        <div 
                          className={cn(
                            "absolute inset-0 flex flex-col items-center justify-center p-2 transition-all duration-300 ease-in-out",
                            copySuccess 
                              ? "bg-status-success/90 text-white backdrop-blur-sm" 
                              : "bg-black/50 group-hover:bg-black/60 text-white backdrop-blur-xs"
                          )}
                        >
                          {copySuccess ? (
                            <>
                              <CheckIcon className="h-6 w-6 mb-1" />
                              <span className="text-sm font-medium">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <DocumentDuplicateIcon className="h-5 w-5 mb-1 opacity-80" />
                              <span className="text-xs">Clique para copiar</span>
                            </>
                          )}
                        </div>
                      </div>

                      {isPollingPayment && <div className={`flex items-center justify-center text-base ${mutedTextColorClass} mt-4`}><LoadingSpinner size="sm" className="mr-2.5"/>Verificando pagamento...</div>}
                    </>
                  )}
                  {paymentStatus === PaymentStatus.PAID && (
                    <div className="p-5 bg-status-success/10 rounded-2xl border border-status-success/30">
                      <CheckIcon className="h-16 w-16 text-status-success mx-auto mb-3" />
                      <p className="text-xl font-semibold text-status-success font-display">Pagamento Confirmado!</p>
                      <p className={`text-base ${defaultTextColorClass}`}>Você será redirecionado em instantes...</p>
                    </div>
                  )}
                   {(paymentStatus === PaymentStatus.FAILED || paymentStatus === PaymentStatus.EXPIRED || paymentStatus === PaymentStatus.CANCELLED) && !isPollingPayment && (
                     <div className="mt-5 text-center">
                       <p className="text-status-error mb-4 text-base">{error || `O pagamento PIX ${paymentStatus === PaymentStatus.EXPIRED ? 'expirou' : 'falhou/foi cancelado'}.`}</p>
                       <Button onClick={() => { setPixData(null); setPaymentStatus(null); setGeneralError(null); handlePayWithPix(); }} isLoading={isSubmitting} disabled={isSubmitting} style={{ backgroundColor: primaryColorStyle, color: ctaTextColorStyle }} className={`${buttonThemeClass} primary w-full py-3.5 text-lg`}>
                         Tentar Novamente com PIX
                       </Button>
                     </div>
                   )}
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); handlePayWithPix(); }} className="space-y-6 pt-4">
                  <div><Input label="Nome Completo" name="customerName" type="text" value={customerName} onChange={handleCustomerNameChange} required disabled={isSubmitting} className={inputThemeClass} labelClassName={labelTextColorClass} autoComplete="name" /></div>
                  <div><Input label="E-mail Principal" name="customerEmail" type="email" value={customerEmail} onChange={handleCustomerEmailChange} required disabled={isSubmitting} className={inputThemeClass} labelClassName={labelTextColorClass} autoComplete="email" /></div>

                  <div>
                    <label htmlFor="customerWhatsapp" className={`block text-sm font-medium ${labelTextColorClass} mb-1.5`}>WhatsApp</label>
                    <div className="flex items-center">
                      <Select
                        name="customerWhatsappCountryCode"
                        value={customerWhatsappCountryCode}
                        onValueChange={handleCountryCodeChange}
                        options={phoneCountryOptions}
                        disabled={isSubmitting}
                        triggerClassName={cn(selectTriggerThemeClass, "w-20 flex-[0_0_auto] rounded-r-none border-r-0")}
                        contentClassName={selectContentThemeClass}
                      />
                      <Input
                        name="customerWhatsapp"
                        type="tel"
                        value={rawWhatsappNumber}
                        onChange={handleWhatsappInputChange}
                        placeholder="(XX) XXXXX-XXXX"
                        required
                        autoComplete="tel"
                        disabled={isSubmitting}
                        className={cn(inputThemeClass, "rounded-l-none h-11")}
                        wrapperClassName="flex-1 min-w-0"
                      />
                    </div>
                  </div>

                  {!appliedCoupon && product.coupons && product.coupons.length > 0 && (
                    <div className="pt-3">
                        <label htmlFor="couponCode" className={`block text-sm font-medium ${labelTextColorClass} mb-1.5`}>Cupom de Desconto</label>
                        <div className="flex items-center gap-3">
                            <Input name="couponCode" type="text" value={couponCodeInput} onChange={handleCouponCodeInputChange} placeholder="Seu cupom aqui" disabled={isSubmitting} icon={<TagIcon className={`h-5 w-5 ${mutedTextColorClass}`}/>} className={cn(inputThemeClass, "flex-grow h-11")} wrapperClassName="flex-grow" labelClassName={labelTextColorClass} />
                            <Button type="button" onClick={handleApplyCoupon} variant="outline" size="md" disabled={isSubmitting || !couponCodeInput.trim()} className={cn(buttonThemeClass, "outline flex-shrink-0 py-3 h-11")}>Aplicar</Button>
                        </div>
                        {couponError && <p className="text-xs text-status-error mt-2">{couponError}</p>}
                    </div>
                  )}
                   {appliedCoupon && (
                    <div className="p-3.5 bg-status-success/10 border border-status-success/30 rounded-2xl text-base">
                        <p className="text-status-success font-medium">Cupom "{appliedCoupon.code}" aplicado! <button type="button" onClick={clearAppliedCoupon} className="ml-1.5 text-status-error text-xs hover:underline">(Remover)</button></p>
                    </div>
                  )}

                  {error && <p className="text-sm text-status-error p-3.5 bg-status-error/10 rounded-2xl border border-status-error/30">{error}</p>}

                  <Button
                    type="submit"
                    size="lg"
                    isLoading={isSubmitting}
                    disabled={isSubmitting}
                    style={{ backgroundColor: primaryColorStyle, color: ctaTextColorStyle }}
                    className={cn(buttonThemeClass, "primary w-full text-lg py-4 mt-5 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]")}
                    leftIcon={<LockClosedIconSolid className="h-6 w-6" />}
                  >
                    {`Pagar com PIX ${formatCurrency(finalPrice)}`}
                  </Button>
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
};

const calculatePriceWithCoupon = (basePrice: number, coupon: Coupon | null): { price: number; discount: number } => {
    if (!coupon || !coupon.isActive) {
        return { price: basePrice, discount: 0 };
    }
    if (coupon.minPurchaseValueInCents && basePrice < coupon.minPurchaseValueInCents) {
        return { price: basePrice, discount: 0 }; // Does not apply
    }
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
        discountAmount = Math.round(basePrice * (coupon.discountValue / 100));
    } else { // fixed
        discountAmount = coupon.discountValue;
    }
    discountAmount = Math.min(discountAmount, basePrice); // Discount cannot exceed price
    return { price: basePrice - discountAmount, discount: discountAmount };
};


const CheckoutPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [product, setProduct] = useState<Product | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  // const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null); // Removed: unused

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerWhatsappCountryCode, setCustomerWhatsappCountryCode] = useState('+55');
  const [rawWhatsappNumber, setRawWhatsappNumber] = useState('');
  
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  
  const [includeOrderBump, setIncludeOrderBump] = useState(false);
  const [finalPrice, setFinalPrice] = useState<number | null>(null);
  const [originalPriceBeforeDiscount, setOriginalPriceBeforeDiscount] = useState<number | null>(null);
  const [discountApplied, setDiscountApplied] = useState(0);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pixData, setPixData] = useState<PushInPayPixResponseData | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light'); 
  
  const pollingTimeoutRef = useRef<number | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);

  const initialLoadRef = useRef(true);
  const { accessToken } = useAuth();
  
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const trackingParamsFromUrl = useMemo(() => {
    const params: Record<string, string> = {};
    queryParams.forEach((value, key) => {
      if (key.toLowerCase().startsWith('utm_') || ['src', 'ref', 'gclid', 'fbclid'].includes(key.toLowerCase())) {
        params[key.toLowerCase()] = value;
      }
    });
    return params;
  }, [queryParams]);

  const [abandonedCartRecord, setAbandonedCartRecord] = useState<string | null>(null);
  const cartUpdateTimeoutRef = useRef<number | null>(null);

  const saveOrUpdateAbandonedCart = useCallback(async () => {
    if (!product || !customerEmail.trim() || !product.platformUserId || pixData) return;

    let potentialValue = product.priceInCents;
    if (includeOrderBump && product.orderBump?.customPriceInCents !== undefined) {
        potentialValue += product.orderBump.customPriceInCents;
    }
    const priceAfterCoupon = calculatePriceWithCoupon(potentialValue, appliedCoupon);
    potentialValue = priceAfterCoupon.price;

    const cartPayload: CreateAbandonedCartPayload = {
        productId: product.id,
        productName: product.name,
        potentialValueInCents: potentialValue,
        customerName: customerName.trim() || customerEmail.split('@')[0],
        customerEmail: customerEmail.trim(),
        customerWhatsapp: `${customerWhatsappCountryCode}${rawWhatsappNumber.replace(/\D/g, '')}`,
        platformUserId: product.platformUserId,
        trackingParameters: trackingParamsFromUrl,
        status: AbandonedCartStatus.NOT_CONTACTED,
    };
    
    try {
        if (!abandonedCartRecord) {
            const newCart = await abandonedCartService.createAbandonedCartAttempt(cartPayload);
            if(newCart && newCart.id) setAbandonedCartRecord(newCart.id);
        } else {
            await abandonedCartService.updateAbandonedCartAttempt(abandonedCartRecord, cartPayload);
        }
    } catch (cartError) {
        console.warn("Falha ao salvar/atualizar carrinho abandonado:", cartError);
    }
  }, [
    product, customerEmail, customerName, customerWhatsappCountryCode, rawWhatsappNumber, 
    includeOrderBump, appliedCoupon, trackingParamsFromUrl, abandonedCartRecord, pixData
  ]);

  useEffect(() => {
    if (initialLoadRef.current || !product || pixData) return; 

    if (cartUpdateTimeoutRef.current) {
        clearTimeout(cartUpdateTimeoutRef.current);
    }
    cartUpdateTimeoutRef.current = window.setTimeout(() => {
        saveOrUpdateAbandonedCart(); 
    }, 2000);

    return () => {
        if (cartUpdateTimeoutRef.current) {
            clearTimeout(cartUpdateTimeoutRef.current);
        }
    };
  }, [customerName, customerEmail, rawWhatsappNumber, product, pixData, includeOrderBump, appliedCoupon, saveOrUpdateAbandonedCart]);
  
  const loadInitialData = useCallback(async () => {
    if (!slug) { setError("Slug do produto não encontrado na URL."); return; }
    setIsSubmitting(true); 
    try {
      const fetchedProduct = await productService.getProductBySlug(slug, accessToken);
      if (!fetchedProduct) { setError("Produto não encontrado."); setIsSubmitting(false); return; }
      setProduct(fetchedProduct);
      setCurrentTheme(fetchedProduct.checkoutCustomization?.theme || 'light');
      document.title = `Checkout - ${fetchedProduct.name}`;

      if (fetchedProduct.platformUserId) {
        const ownerSettings = await settingsService.getAppSettingsByUserId(fetchedProduct.platformUserId, accessToken);
        setAppSettings(ownerSettings);

        // Removed: setPlatformSettings as it's unused
        // const platSettings = await settingsService.getPlatformSettings(accessToken);
        // setPlatformSettings(platSettings);

        const storedData = localStorage.getItem(LOCALSTORAGE_CHECKOUT_KEY);
        let initialEmail = '';
        if (storedData) {
          try {
            const parsedData = JSON.parse(storedData);
            setCustomerName(parsedData.customerName || '');
            initialEmail = parsedData.customerEmail || '';
            setCustomerEmail(initialEmail);
            setCustomerWhatsappCountryCode(parsedData.customerWhatsappCountryCode || '+55');
            setRawWhatsappNumber(parsedData.rawWhatsappNumber || '');
          } catch (e) { console.error("Error parsing checkout form data from localStorage", e); }
        }
        
        // Initial cart creation if email is present and product loaded
        if (initialEmail.trim() && fetchedProduct.id && fetchedProduct.platformUserId && !abandonedCartRecord && !pixData) {
            let potentialValue = fetchedProduct.priceInCents;
            const autoCouponForInitial = fetchedProduct.coupons?.find(c => c.isAutomatic && c.isActive);
            if (autoCouponForInitial) {
                 const priceWithAutoCoupon = calculatePriceWithCoupon(potentialValue, autoCouponForInitial);
                 potentialValue = priceWithAutoCoupon.price;
            }
           
            const initialCartPayload: CreateAbandonedCartPayload = {
                productId: fetchedProduct.id,
                productName: fetchedProduct.name,
                potentialValueInCents: potentialValue,
                customerName: (JSON.parse(storedData || '{}').customerName || '').trim() || initialEmail.split('@')[0],
                customerEmail: initialEmail.trim(),
                customerWhatsapp: `${JSON.parse(storedData || '{}').customerWhatsappCountryCode || '+55'}${ (JSON.parse(storedData || '{}').rawWhatsappNumber || '').replace(/\D/g, '')}`,
                platformUserId: fetchedProduct.platformUserId,
                trackingParameters: trackingParamsFromUrl,
                status: AbandonedCartStatus.NOT_CONTACTED,
            };
            try {
                const newCart = await abandonedCartService.createAbandonedCartAttempt(initialCartPayload);
                if(newCart && newCart.id) setAbandonedCartRecord(newCart.id);
            } catch (cartError) {
                console.warn("Falha ao criar carrinho abandonado inicial:", cartError);
            }
        }
      } else {
        console.warn("Product owner ID (platformUserId) is missing. Cannot fetch settings or save abandoned cart.");
      }

      const autoCoupon = fetchedProduct.coupons?.find(c => c.isAutomatic && c.isActive);
      if (autoCoupon) {
        setAppliedCoupon(autoCoupon);
        setCouponCodeInput(autoCoupon.code);
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar informações do produto.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
      initialLoadRef.current = false;
    }
  }, [slug, accessToken, trackingParamsFromUrl, abandonedCartRecord, pixData]); 

  useEffect(() => { loadInitialData(); }, [loadInitialData]);


  useEffect(() => {
    if (initialLoadRef.current) return;
    const dataToStore = { customerName, customerEmail, customerWhatsappCountryCode, rawWhatsappNumber };
    localStorage.setItem(LOCALSTORAGE_CHECKOUT_KEY, JSON.stringify(dataToStore));
  }, [customerName, customerEmail, customerWhatsappCountryCode, rawWhatsappNumber]);

  const calculateFinalPrice = useCallback(() => {
    if (!product) return;
    let currentPrice = product.priceInCents;
    let currentOriginalPrice = product.priceInCents;
    let currentDiscount = 0;

    if (includeOrderBump && product.orderBump?.customPriceInCents !== undefined) {
      currentPrice += product.orderBump.customPriceInCents;
      currentOriginalPrice += product.orderBump.customPriceInCents;
    }

    if (appliedCoupon && appliedCoupon.isActive) {
      const basePriceForCoupon = currentPrice; 
      if (appliedCoupon.minPurchaseValueInCents && basePriceForCoupon < appliedCoupon.minPurchaseValueInCents) {
        setCouponError(`Valor mínimo de compra de ${formatCurrency(appliedCoupon.minPurchaseValueInCents)} não atingido para este cupom.`);
      } else {
        let discountAmount = 0;
        if (appliedCoupon.discountType === 'percentage') {
          discountAmount = Math.round(basePriceForCoupon * (appliedCoupon.discountValue / 100));
        } else {
          discountAmount = appliedCoupon.discountValue;
        }
        currentDiscount = Math.min(discountAmount, basePriceForCoupon); 
        currentPrice -= currentDiscount;
        setCouponError(null);
      }
    }
    setFinalPrice(currentPrice);
    setOriginalPriceBeforeDiscount(currentOriginalPrice);
    setDiscountApplied(currentDiscount);
  }, [product, appliedCoupon, includeOrderBump]);

  useEffect(() => { calculateFinalPrice(); }, [calculateFinalPrice]);
  
  const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => setCustomerName(e.target.value);
  const handleCustomerEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => setCustomerEmail(e.target.value);
  const handleWhatsappInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    setRawWhatsappNumber(digits.slice(0,11)); 
  };
  const handleCountryCodeChange = (value: string) => setCustomerWhatsappCountryCode(value);

  const handleCouponCodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCouponCodeInput(e.target.value.toUpperCase());
    setCouponError(null); 
    if (appliedCoupon && e.target.value.toUpperCase() !== appliedCoupon.code) {
        setAppliedCoupon(null); 
    }
  };

  const handleApplyCoupon = () => {
    if (!product || !couponCodeInput) return;
    const coupon = product.coupons?.find(c => c.code === couponCodeInput && c.isActive);
    if (coupon) {
      if (coupon.minPurchaseValueInCents && (product.priceInCents + (includeOrderBump && product.orderBump?.customPriceInCents ? product.orderBump.customPriceInCents : 0)) < coupon.minPurchaseValueInCents) {
        setCouponError(`Valor mínimo de R$${(coupon.minPurchaseValueInCents/100).toFixed(2)} não atingido.`);
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon(coupon);
        setCouponError(null);
      }
    } else {
      setCouponError('Cupom inválido ou expirado.');
      setAppliedCoupon(null);
    }
  };
  const clearAppliedCoupon = () => { setAppliedCoupon(null); setCouponCodeInput(''); setCouponError(null); };
  const removeOrderBump = () => { setIncludeOrderBump(false); };
  const handleToggleOrderBump = (enabled: boolean) => { setIncludeOrderBump(enabled); };

  const handlePayWithPix = async () => {
    if (!product || finalPrice === null || !customerName.trim() || !customerEmail.trim() || !rawWhatsappNumber.trim() || !product.platformUserId) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    setIsSubmitting(true); setError(null); setPixData(null);

    const productsForSale: SaleProductItem[] = [{
        productId: product.id, name: product.name, quantity: 1,
        priceInCents: product.priceInCents - (appliedCoupon && !includeOrderBump ? discountApplied : 0), 
        originalPriceInCents: product.priceInCents,
        deliveryUrl: product.deliveryUrl, slug: product.slug,
    }];
    if (includeOrderBump && product.orderBump && product.orderBump.customPriceInCents !== undefined) {
      productsForSale.push({
        productId: product.orderBump.productId, name: product.orderBump.name, quantity: 1,
        priceInCents: product.orderBump.customPriceInCents - (appliedCoupon && includeOrderBump ? discountApplied : 0),
        originalPriceInCents: product.orderBump.customPriceInCents, isOrderBump: true,
        deliveryUrl: (await productService.getProductById(product.orderBump.productId, accessToken))?.deliveryUrl,
        slug: (await productService.getProductById(product.orderBump.productId, accessToken))?.slug,
      });
    }
    
    const completeWhatsapp = `${customerWhatsappCountryCode}${rawWhatsappNumber.replace(/\D/g, '')}`;

    const pixPayload: PushInPayPixRequest = {
        value: finalPrice,
        originalValueBeforeDiscount: originalPriceBeforeDiscount || 0,
        webhook_url: MOCK_WEBHOOK_URL, 
        customerName, customerEmail, customerWhatsapp: completeWhatsapp,
        products: productsForSale,
        trackingParameters: trackingParamsFromUrl,
        couponCodeUsed: appliedCoupon?.code,
        discountAppliedInCents: discountApplied,
    };

    try {
        const { data: pixFunctionResponse, error: functionError } = await supabase.functions.invoke<PushInPayPixResponse>('gerar-pix', {
            body: {
                payload: pixPayload,
                productOwnerUserId: product.platformUserId
            }
        });
        if (functionError) {
            let errorMessage = "Falha ao gerar PIX.";
            if (typeof functionError.message === 'string') {
                try { const parsedMessage = JSON.parse(functionError.message); errorMessage = parsedMessage?.error || parsedMessage?.message || functionError.message; } 
                catch (e) { errorMessage = functionError.message; }
            }
            throw new Error(errorMessage);
        }
        if (pixFunctionResponse && pixFunctionResponse.success && pixFunctionResponse.data) {
            setPixData(pixFunctionResponse.data);
            setPaymentStatus(PaymentStatus.WAITING_PAYMENT);
            startPaymentPolling(pixFunctionResponse.data.id);

            if (abandonedCartRecord) {
                await abandonedCartService.deleteAbandonedCart(abandonedCartRecord, accessToken);
                setAbandonedCartRecord(null);
            }

        } else {
            throw new Error(pixFunctionResponse?.message || "A resposta da função não continha os dados do PIX.");
        }
    } catch (paymentError: any) {
      setError(paymentError.message || "Erro desconhecido ao processar pagamento.");
      console.error("PIX Payment Error:", paymentError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPixCode = () => { if (pixData?.qr_code) { navigator.clipboard.writeText(pixData.qr_code).then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }); } };

  const checkPaymentStatus = useCallback(async (transactionId: string) => {
    if (!product || !product.platformUserId) { console.error("Product or platformUserId missing for payment status check."); return; }
    try {
      const { data: statusResponse, error: functionError } = await supabase.functions.invoke<PushInPayTransactionStatusResponse>('verificar-status-pix', {
        body: { transactionId, productOwnerUserId: product.platformUserId }
      });

      if (functionError) throw new Error(functionError.message);
      if (!statusResponse || !statusResponse.success || !statusResponse.data) throw new Error(statusResponse?.message || "Resposta inválida ao verificar status do PIX.");
      
      const rawStatus = statusResponse.data.status.toLowerCase();
      let mappedStatus: PaymentStatus;

      switch (rawStatus) {
          case 'paid':
          case 'approved':
              mappedStatus = PaymentStatus.PAID;
              break;
          case 'waiting_payment':
          case 'pending':
          case 'processing':
              mappedStatus = PaymentStatus.WAITING_PAYMENT;
              break;
          case 'cancelled':
          case 'canceled': // Common alternative spelling
              mappedStatus = PaymentStatus.CANCELLED;
              break;
          case 'expired':
              mappedStatus = PaymentStatus.EXPIRED;
              break;
          case 'failed':
          case 'error':
          case 'rejected':
              mappedStatus = PaymentStatus.FAILED;
              break;
          default:
              console.warn(`[checkPaymentStatus] Unknown status from PushInPay: '${rawStatus}'. Defaulting to WAITING_PAYMENT for UI continuity.`);
              mappedStatus = PaymentStatus.WAITING_PAYMENT;
      }
      
      setPaymentStatus(mappedStatus);

      if (mappedStatus === PaymentStatus.PAID) {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
        setIsPollingPayment(false);
        navigate(`/thank-you/${transactionId}?origProdId=${product.id}`);
      }
    } catch (statusError: any) {
      console.error("Erro ao verificar status do pagamento:", statusError.message);
      // Do not change paymentStatus here, let polling continue or timeout
    }
  }, [product, navigate]);

  const startPaymentPolling = useCallback((transactionId: string) => {
    setIsPollingPayment(true);
    checkPaymentStatus(transactionId); 

    pollingIntervalRef.current = window.setInterval(() => {
      checkPaymentStatus(transactionId);
    }, POLLING_INTERVAL);

    pollingTimeoutRef.current = window.setTimeout(() => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      setIsPollingPayment(false);
      if (paymentStatus !== PaymentStatus.PAID) {
        setError("Tempo limite para verificação do pagamento PIX excedido. Se você pagou, entre em contato.");
      }
    }, POLLING_TIMEOUT_DURATION);
  }, [checkPaymentStatus, paymentStatus]); // paymentStatus added as dependency as it's read in timeout

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
    };
  }, []);

  const primaryColorStyle = product?.checkoutCustomization?.primaryColor || appSettings?.checkoutIdentity?.brandColor || (currentTheme === 'dark' ? 'var(--reimagined-accent-cta)' : 'var(--checkout-color-primary-DEFAULT)');
  const ctaTextColorStyle = getContrastingTextColorForCta(primaryColorStyle, currentTheme);
  const hasLeftContent = product?.checkoutCustomization?.videoUrl || product?.imageUrl || (product?.checkoutCustomization?.salesCopy && product.checkoutCustomization.salesCopy.replace(/<[^>]*>?/gm, '').trim() !== '') || (product?.checkoutCustomization?.testimonials && product.checkoutCustomization.testimonials.length > 0);

  useEffect(() => {
    const timerElement = document.getElementById('checkout-countdown-timer');
    if (timerElement && product?.checkoutCustomization?.countdownTimer?.enabled && product.checkoutCustomization.countdownTimer.durationMinutes) {
      const durationMillis = product.checkoutCustomization.countdownTimer.durationMinutes * 60 * 1000;
      let endTime = localStorage.getItem(`countdownEndTime_${product.id}`);
      if (!endTime || parseInt(endTime) < Date.now()) {
        endTime = String(Date.now() + durationMillis);
        localStorage.setItem(`countdownEndTime_${product.id}`, endTime);
      }
      
      const intervalId = setInterval(() => {
        const remaining = parseInt(endTime!) - Date.now();
        if (remaining <= 0) {
          clearInterval(intervalId);
          timerElement.textContent = product.checkoutCustomization?.countdownTimer?.messageAfter || 'Oferta Expirada!';
          return;
        }
        const minutes = Math.floor((remaining / (1000 * 60)) % 60);
        const seconds = Math.floor((remaining / 1000) % 60);
        const messageBefore = product.checkoutCustomization?.countdownTimer?.messageBefore || 'Oferta expira em:';
        timerElement.textContent = `${messageBefore} ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }, 1000);
      return () => clearInterval(intervalId);
    }
  }, [product, currentTheme]);

  return (
    <CheckoutPageUI
      product={product}
      customerName={customerName}
      handleCustomerNameChange={handleCustomerNameChange}
      customerEmail={customerEmail}
      handleCustomerEmailChange={handleCustomerEmailChange}
      rawWhatsappNumber={rawWhatsappNumber}
      handleWhatsappInputChange={handleWhatsappInputChange}
      customerWhatsappCountryCode={customerWhatsappCountryCode}
      handleCountryCodeChange={handleCountryCodeChange}
      couponCodeInput={couponCodeInput}
      handleCouponCodeInputChange={handleCouponCodeInputChange}
      handleApplyCoupon={handleApplyCoupon}
      couponError={couponError}
      appliedCoupon={appliedCoupon}
      finalPrice={finalPrice}
      originalPriceBeforeDiscount={originalPriceBeforeDiscount}
      discountApplied={discountApplied}
      includeOrderBump={includeOrderBump}
      handleToggleOrderBump={handleToggleOrderBump}
      isSubmitting={isSubmitting}
      handlePayWithPix={handlePayWithPix}
      pixData={pixData}
      copyPixCode={copyPixCode}
      copySuccess={copySuccess}
      paymentStatus={paymentStatus}
      error={error}
      primaryColorStyle={primaryColorStyle}
      ctaTextColorStyle={ctaTextColorStyle}
      isPollingPayment={isPollingPayment}
      clearAppliedCoupon={clearAppliedCoupon}
      removeOrderBump={removeOrderBump}
      setPixData={setPixData}
      setPaymentStatus={setPaymentStatus}
      setError={setError}
      hasLeftContent={!!hasLeftContent}
      currentTheme={currentTheme}
    />
  );
};

export default CheckoutPage;
