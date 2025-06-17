
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from "react-router-dom"; 
import { v4 as uuidv4 } from 'uuid'; 
import { Product, PaymentStatus, Coupon, PushInPayPixResponseData, PushInPayPixResponse, AppSettings, PlatformSettings, SaleProductItem, PaymentMethod, Sale, UtmifyOrderPayload, AbandonedCartStatus, PushInPayPixRequest, PushInPayTransactionStatusResponse } from '@/types'; 
import { productService } from '@/services/productService';
import { abandonedCartService, CreateAbandonedCartPayload } from '@/services/abandonedCartService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { CheckCircleIcon, PHONE_COUNTRY_CODES, DocumentDuplicateIcon, TagIcon, MOCK_WEBHOOK_URL, PLATFORM_NAME } from '../constants.tsx'; 
import { settingsService } from '@/services/settingsService';
import { salesService } from '@/services/salesService';
import { utmifyService } from '@/services/utmifyService';
import { supabase } from '@/supabaseClient'; 


const LockClosedIconSolid: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002 2v-7a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
  </svg>
);

const formatCurrency = (valueInCents: number): string => {
    return `R$ ${(valueInCents / 100).toFixed(2).replace('.', ',')}`;
};

const formatPhoneNumberVisual = (digits: string): string => {
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

const getContrastingTextColor = (hexColor?: string): string => {
    if (!hexColor) return '#111827'; 
    try {
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5 ? '#111827' : '#FFFFFF'; 
    } catch (e) {
      return '#111827'; 
    }
};

const LOCALSTORAGE_CHECKOUT_KEY = 'checkoutFormData';
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
  handleCountryCodeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  couponCodeInput: string;
  handleCouponCodeInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleApplyCoupon: () => void;
  couponError: string | null;
  appliedCoupon: Coupon | null;
  finalPrice: number | null;
  originalPriceBeforeDiscount: number | null;
  discountApplied: number;
  includeOrderBump: boolean;
  handleToggleOrderBump: () => void;
  isSubmitting: boolean;
  handlePayWithPix: () => Promise<void>;
  pixData: PushInPayPixResponseData | null;
  copyPixCode: () => void;
  copySuccess: boolean;
  paymentStatus: PaymentStatus | null;
  error: string | null;
  getPrimaryColor: () => string;
  getCtaTextColor: () => string;
  isPollingPayment: boolean;
  clearAppliedCoupon: () => void;
  removeOrderBump: () => void;
  setPixData: React.Dispatch<React.SetStateAction<PushInPayPixResponseData | null>>;
  setPaymentStatus: React.Dispatch<React.SetStateAction<PaymentStatus | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  hasLeftContent: boolean;
}

const CheckoutPageUI: React.FC<CheckoutPageUIProps> = ({
  product, customerName, handleCustomerNameChange, customerEmail, handleCustomerEmailChange,
  rawWhatsappNumber, handleWhatsappInputChange, customerWhatsappCountryCode, handleCountryCodeChange,
  couponCodeInput, handleCouponCodeInputChange, handleApplyCoupon, couponError, appliedCoupon,
  finalPrice, originalPriceBeforeDiscount, discountApplied,
  includeOrderBump, handleToggleOrderBump, isSubmitting, handlePayWithPix,
  pixData, copyPixCode, copySuccess, paymentStatus, error, getPrimaryColor, getCtaTextColor,
  isPollingPayment, clearAppliedCoupon, removeOrderBump,
  setPixData, setPaymentStatus, setError: setGeneralError, hasLeftContent
}) => {
  if (!product || finalPrice === null || originalPriceBeforeDiscount === null) {
    return <div className="text-center p-8 text-neutral-600">Carregando informações do produto...</div>;
  }
  const primaryColor = getPrimaryColor();
  const ctaTextColor = getCtaTextColor();

  return (
    <div className="checkout-light-theme min-h-screen">
      <style>{`:root { --checkout-color-primary-DEFAULT: ${primaryColor}; --checkout-color-primary-cta-text: ${ctaTextColor}; }`}</style>
      <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
        <header className="mb-8 text-center">
          {product.checkoutCustomization?.logoUrl ? (
            <img src={product.checkoutCustomization.logoUrl} alt={`${product.name} Logo`} className="h-16 md:h-20 mx-auto mb-4 object-contain" />
          ) : (
            <h1 className="text-3xl md:text-4xl font-extrabold" style={{ color: primaryColor }}>{product.name}</h1>
          )}
        </header>

        <div className={`grid ${hasLeftContent ? 'grid-cols-1 lg:grid-cols-2' : 'lg:grid-cols-1 justify-items-center'} gap-8 items-start`}>
          <div className={`space-y-6 w-full ${!hasLeftContent ? 'lg:hidden' : ''}`}>
            {product.checkoutCustomization?.videoUrl && (
              <div className="aspect-video bg-neutral-800 rounded-lg shadow-lg overflow-hidden border border-neutral-300">
                <iframe
                  width="100%" height="100%" src={product.checkoutCustomization.videoUrl.replace("watch?v=", "embed/")}
                  title="Vídeo do Produto" frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            )}
            {!product.checkoutCustomization?.videoUrl && product.imageUrl && (
              <img src={product.imageUrl} alt={product.name} className="w-full rounded-lg shadow-lg object-cover max-h-80 border border-neutral-300" />
            )}

            {product.checkoutCustomization?.salesCopy && product.checkoutCustomization.salesCopy.replace(/<[^>]*>?/gm, '').trim() !== '' && (
              <Card className="card-checkout-specific">
                <div 
                    className="prose prose-sm sm:prose-base max-w-none" 
                    dangerouslySetInnerHTML={{ __html: product.checkoutCustomization.salesCopy }} 
                />
              </Card>
            )}

            {product.checkoutCustomization?.testimonials && product.checkoutCustomization.testimonials.length > 0 && (
              <Card title="O que nossos clientes dizem" className="card-checkout-specific">
                <div className="space-y-4">
                  {product.checkoutCustomization.testimonials.map((testimonial, index) => (
                    <blockquote key={index} className="p-3 bg-neutral-50 rounded-md border border-neutral-200">
                      <p className="italic">"{testimonial.text}"</p>
                      <footer className="mt-2 text-sm font-medium">- {testimonial.author}</footer>
                    </blockquote>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <div className={`space-y-6 w-full ${hasLeftContent ? 'lg:sticky lg:top-8' : 'lg:max-w-xl'}`}>
            <Card className="card-checkout-specific">
                <div className="flex justify-between items-baseline mb-2">
                    <h2 className="text-xl font-semibold">Resumo do Pedido</h2>
                    {product.checkoutCustomization?.countdownTimer?.enabled && (
                         <div id="checkout-countdown-timer" className="text-sm font-medium px-2 py-1 rounded">
                         </div>
                    )}
                </div>
              <div className="border-b border-neutral-200 pb-3 mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span>{product.name}</span>
                  <span className="font-semibold">{formatCurrency(product.priceInCents)}</span>
                </div>
                {product.orderBump && includeOrderBump && (
                  <div className="flex justify-between items-center text-sm my-1.5 py-1.5 border-t border-neutral-200">
                    <div className="flex items-center">
                        <span>{product.orderBump.name} <span className="text-xs" style={{color: primaryColor}}>(Oferta Adicional!)</span></span>
                    </div>
                    <span className="font-medium">
                        {product.orderBump.customPriceInCents !== undefined ? formatCurrency(product.orderBump.customPriceInCents) : "Preço Ind."}
                    </span>
                  </div>
                )}
                {discountApplied > 0 && appliedCoupon && (
                  <div className="flex justify-between items-center text-sm text-red-600 my-1.5 py-1.5 border-t border-dashed border-red-300">
                    <span>Desconto ({appliedCoupon.code})</span>
                    <span>-{formatCurrency(discountApplied)}</span>
                  </div>
                )}
                 <div className="flex justify-between items-center mt-2 pt-2 border-t border-neutral-300">
                    <span className="text-lg font-bold">Total:</span>
                    <div className="text-right">
                        {originalPriceBeforeDiscount !== finalPrice && (
                             <span className="block text-xs line-through">{formatCurrency(originalPriceBeforeDiscount)}</span>
                        )}
                        <span className="text-xl font-bold" style={{color: primaryColor}}>{formatCurrency(finalPrice)}</span>
                    </div>
                </div>
              </div>

                {product.orderBump && !pixData && (
                    <div className="my-5 p-4 rounded-lg border-2" style={{borderColor: primaryColor, backgroundColor: `${primaryColor}1A`}}>
                        <h3 className="text-lg font-semibold mb-2" style={{color: primaryColor}}>OFERTA ESPECIAL! <span className="text-neutral-800">Adicionar "{product.orderBump.name}"?</span></h3>
                        <p className="text-sm mb-2">{product.orderBump.description}</p>
                        <div className="flex items-center justify-between">
                            <p className="text-lg font-bold" style={{color: primaryColor}}>
                                + {formatCurrency(product.orderBump.customPriceInCents !== undefined ? product.orderBump.customPriceInCents : 0)}
                            </p>
                            <label htmlFor="orderBumpToggle" className="flex items-center cursor-pointer">
                                <div className="relative">
                                    <input type="checkbox" id="orderBumpToggle" className="sr-only" checked={includeOrderBump} onChange={handleToggleOrderBump} disabled={isSubmitting || !!pixData} />
                                    <div className={`block w-12 h-7 rounded-full transition-colors ${includeOrderBump ? 'bg-opacity-100' : 'bg-neutral-300'}`} style={{backgroundColor: includeOrderBump ? primaryColor : undefined}}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${includeOrderBump ? 'translate-x-full' : ''}`}></div>
                                </div>
                                <div className="ml-3 text-sm font-medium">{includeOrderBump ? 'Sim!' : 'Não'}</div>
                            </label>
                        </div>
                         {includeOrderBump && <button onClick={removeOrderBump} className="text-xs text-red-500 hover:underline mt-1" disabled={isSubmitting || !!pixData}>Remover oferta</button>}
                    </div>
                )}

              {pixData ? (
                <div className="space-y-4 text-center">
                  <h3 className="text-xl font-semibold" style={{color: primaryColor}}>Pague com PIX para finalizar!</h3>
                  {paymentStatus === PaymentStatus.WAITING_PAYMENT && (
                    <>
                      <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="PIX QR Code" className="mx-auto w-56 h-56 rounded-md border-2 p-1 bg-white" style={{borderColor: primaryColor}} />
                      <div className="relative">
                        <Input name="pixCode" readOnly value={pixData.qr_code} className="input-checkout-specific pr-10 text-xs text-center"/>
                        <Button type="button" onClick={copyPixCode} variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-neutral-500 hover:text-[var(--checkout-color-primary-DEFAULT)]">
                          {copySuccess ? <CheckCircleIcon className="h-5 w-5 text-green-500"/> : <DocumentDuplicateIcon className="h-5 w-5"/>}
                        </Button>
                      </div>
                      {copySuccess && <p className="text-xs text-green-600">Código PIX copiado!</p>}
                      <p className="text-sm">Escaneie o QR Code ou copie o código acima.</p>
                      {isPollingPayment && <div className="flex items-center justify-center text-sm">Verificando pagamento...</div>}
                    </>
                  )}
                  {paymentStatus === PaymentStatus.PAID && (
                    <div className="p-4 bg-green-50 rounded-md border border-green-200">
                      <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-2" />
                      <p className="text-lg font-semibold text-green-700">Pagamento Confirmado!</p>
                      <p className="text-sm">Você será redirecionado em instantes...</p>
                    </div>
                  )}
                   {(paymentStatus === PaymentStatus.FAILED || paymentStatus === PaymentStatus.EXPIRED || paymentStatus === PaymentStatus.CANCELLED) && !isPollingPayment && (
                     <div className="mt-6 text-center">
                       <p className="text-red-500 mb-2">{error || `O pagamento PIX ${paymentStatus === PaymentStatus.EXPIRED ? 'expirou' : 'falhou/foi cancelado'}.`}</p>
                       <Button
                         onClick={() => { setPixData(null); setPaymentStatus(null); setGeneralError(null); handlePayWithPix(); }}
                         disabled={isSubmitting}
                         className="button-checkout-specific primary w-full"
                       >
                         {isSubmitting ? "Processando..." : "Tentar Novamente com PIX"}
                       </Button>
                     </div>
                   )}
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); handlePayWithPix(); }} className="space-y-4">
                  <div>
                    <Input label="Nome Completo" name="customerName" type="text" value={customerName} onChange={handleCustomerNameChange} required disabled={isSubmitting} className="input-checkout-specific" />
                  </div>
                  <div>
                    <Input label="E-mail Principal" name="customerEmail" type="email" value={customerEmail} onChange={handleCustomerEmailChange} required disabled={isSubmitting} className="input-checkout-specific" />
                  </div>
                  <div>
                     <label htmlFor="customerWhatsapp" className="block text-sm font-medium mb-1">WhatsApp</label>
                    <div className="flex">
                        <select 
                            name="customerWhatsappCountryCode" 
                            value={customerWhatsappCountryCode} 
                            onChange={handleCountryCodeChange}
                            className="select-checkout-specific rounded-l-md border border-r-0 border-neutral-300 bg-neutral-50 p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--checkout-color-primary-DEFAULT)] focus:border-[var(--checkout-color-primary-DEFAULT)] w-32"
                            disabled={isSubmitting}
                        >
                            {PHONE_COUNTRY_CODES.map(cc => <option key={cc.value} value={cc.value}>{cc.emoji} {cc.value}</option>)}
                        </select>
                        <Input name="customerWhatsapp" type="tel" value={rawWhatsappNumber} onChange={handleWhatsappInputChange} placeholder="(XX) XXXXX-XXXX" required disabled={isSubmitting} className="input-checkout-specific rounded-l-none flex-1" />
                    </div>
                  </div>
                  
                  {!appliedCoupon && product.coupons && product.coupons.length > 0 && (
                    <div className="pt-3">
                        <label htmlFor="couponCode" className="block text-sm font-medium mb-1">Cupom de Desconto</label>
                        <div className="flex items-center gap-2">
                            <Input name="couponCode" type="text" value={couponCodeInput} onChange={handleCouponCodeInputChange} placeholder="Seu cupom aqui" disabled={isSubmitting} icon={<TagIcon className="h-5 w-5 text-neutral-400"/>} className="input-checkout-specific flex-grow"/>
                            <Button type="button" onClick={handleApplyCoupon} variant="outline" size="md" disabled={isSubmitting || !couponCodeInput.trim()} className="button-checkout-specific outline flex-shrink-0">Aplicar</Button>
                        </div>
                        {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
                    </div>
                  )}
                   {appliedCoupon && (
                    <div className="p-2 bg-green-50 border border-green-200 rounded-md text-sm">
                        <p className="text-green-700 font-medium">Cupom "{appliedCoupon.code}" aplicado! <button type="button" onClick={clearAppliedCoupon} className="ml-1 text-red-500 text-xs hover:underline">(Remover)</button></p>
                    </div>
                  )}

                  {error && <p className="text-sm text-red-500 p-2 bg-red-50 rounded-md border border-red-300">{error}</p>}
                  
                  <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: primaryColor, color: ctaTextColor }} className="button-checkout-specific primary w-full text-lg py-3 mt-2">
                    {isSubmitting ? (
                        "Processando Pagamento..."
                    ) : (
                        <>
                            <LockClosedIconSolid className="h-5 w-5 mr-2" />
                            Pagar com PIX {formatCurrency(finalPrice)}
                        </>
                    )}
                  </Button>
                </form>
              )}
               <p className="text-xs mt-4 text-center flex items-center justify-center">
                <LockClosedIconSolid className="h-4 w-4 mr-1"/> Ambiente 100% seguro. Seus dados estão protegidos.
              </p>
            </Card>
            
            {product.checkoutCustomization?.guaranteeBadges && product.checkoutCustomization.guaranteeBadges.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                {product.checkoutCustomization.guaranteeBadges.map((badge: { id: string; imageUrl: string; altText: string; }) => (
                  <div key={badge.id} className="bg-white p-2 rounded-md shadow-sm border border-neutral-200 flex items-center justify-center">
                    <img src={badge.imageUrl} alt={badge.altText} className="max-h-16 object-contain" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <footer className="mt-12 pt-6 border-t border-neutral-300 text-center">
            <p className="text-xs">&copy; {new Date().getFullYear()} {product.name}. Todos os direitos reservados.</p>
            <p className="text-xs mt-1">Processado por {PLATFORM_NAME}.</p>
        </footer>
      </div>
    </div>
  );
};


export const CheckoutPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [product, setProduct] = useState<Product | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);

  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerWhatsappCountryCode, setCustomerWhatsappCountryCode] = useState(PHONE_COUNTRY_CODES[0].value);
  const [rawWhatsappNumber, setRawWhatsappNumber] = useState('');
  
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [includeOrderBump, setIncludeOrderBump] = useState(false);
  
  const [finalPrice, setFinalPrice] = useState<number | null>(null); 
  const [originalPriceBeforeDiscount, setOriginalPriceBeforeDiscount] = useState<number | null>(null);
  const [discountApplied, setDiscountApplied] = useState(0);

  const [pixData, setPixData] = useState<PushInPayPixResponseData | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const pollingTimeoutRef = useRef<number | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  
  const [abandonedCartId, setAbandonedCartId] = useState<string | null>(null);
  const abandonedCartTimeoutRef = useRef<number | null>(null);

  const [currentProductsForSale, setCurrentProductsForSale] = useState<SaleProductItem[]>([]);

  useEffect(() => {
    if (product && product.name) {
      if (pixData && paymentStatus === PaymentStatus.WAITING_PAYMENT) {
        document.title = `Aguardando Pagamento - ${product.name}`;
      } else if (!pixData) {
        document.title = `Finalizar Compra - ${product.name}`;
      } else if (paymentStatus === PaymentStatus.EXPIRED || paymentStatus === PaymentStatus.FAILED || paymentStatus === PaymentStatus.CANCELLED) {
         document.title = `Pagamento Falhou - ${product.name}`;
      }
    } else if (!product && !isLoadingProduct) {
      document.title = "Checkout";
    }
    return () => {
    };
  }, [product, pixData, paymentStatus, isLoadingProduct]);


  useEffect(() => {
    const savedData = localStorage.getItem(LOCALSTORAGE_CHECKOUT_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.slug === slug) { 
          setCustomerName(parsed.customerName || '');
          setCustomerEmail(parsed.customerEmail || '');
          setRawWhatsappNumber(parsed.rawWhatsappNumber || '');
          setCustomerWhatsappCountryCode(parsed.customerWhatsappCountryCode || PHONE_COUNTRY_CODES[0].value);
        } else {
          localStorage.removeItem(LOCALSTORAGE_CHECKOUT_KEY); 
        }
      } catch (e) {
        console.warn("Failed to parse checkout form data from localStorage", e);
        localStorage.removeItem(LOCALSTORAGE_CHECKOUT_KEY);
      }
    }
  }, [slug]);

  useEffect(() => {
    const dataToSave = { slug, customerName, customerEmail, rawWhatsappNumber, customerWhatsappCountryCode };
    localStorage.setItem(LOCALSTORAGE_CHECKOUT_KEY, JSON.stringify(dataToSave));
  }, [slug, customerName, customerEmail, rawWhatsappNumber, customerWhatsappCountryCode]);

  useEffect(() => {
    const fetchAllData = async () => {
      if (!slug) {
        setError("Produto não especificado.");
        setIsLoadingProduct(false);
        return;
      }
      setIsLoadingProduct(true);
      setError(null);
      try {
        const fetchedProduct = await productService.getProductBySlug(slug, null); 
        if (!fetchedProduct) {
          setError("Produto não encontrado.");
          setIsLoadingProduct(false);
          return;
        }
        setProduct(fetchedProduct);

        if (fetchedProduct.platformUserId) {
            const fetchedAppSettings = await settingsService.getAppSettingsByUserId(fetchedProduct.platformUserId, null); 
            setAppSettings(fetchedAppSettings);
        }
        
        const fetchedPlatformSettings = await settingsService.getPlatformSettings(null); 
        setPlatformSettings(fetchedPlatformSettings);
        
        if (fetchedProduct.coupons) {
            const autoApplyCoupon = fetchedProduct.coupons.find(c => c.isAutomatic && c.isActive);
            if (autoApplyCoupon) {
                setAppliedCoupon(autoApplyCoupon);
            }
        }
        
      } catch (err: any) {
        setError(err.message || "Falha ao carregar informações do produto ou configurações.");
        console.error(err);
      } finally {
        setIsLoadingProduct(false);
      }
    };
    fetchAllData();
  }, [slug]);


  const getPrimaryColor = useCallback(() => {
    return product?.checkoutCustomization?.primaryColor || appSettings?.checkoutIdentity?.brandColor || '#0D9488';
  }, [product, appSettings]);
  
  const getCtaTextColor = useCallback(() => {
    return getContrastingTextColor(getPrimaryColor());
  }, [getPrimaryColor]);

  useEffect(() => {
    const timerConfig = product?.checkoutCustomization?.countdownTimer;
    if (!timerConfig || !timerConfig.enabled || typeof timerConfig.durationMinutes !== 'number' || timerConfig.durationMinutes <= 0) {
        const timerEl = document.getElementById('checkout-countdown-timer');
        if (timerEl) timerEl.innerHTML = '';
        return;
    }
    
    const timerElement = document.getElementById('checkout-countdown-timer');
    if (!timerElement) return;

    timerElement.style.backgroundColor = timerConfig.backgroundColor || '#EF4444';
    timerElement.style.color = timerConfig.textColor || '#FFFFFF';
    
    const storageKey = `countdownEndTime_${slug}`;
    let endTime = localStorage.getItem(storageKey) ? parseInt(localStorage.getItem(storageKey)!) : null;

    if (!endTime || endTime < Date.now()) { 
      endTime = Date.now() + (timerConfig.durationMinutes * 60 * 1000);
      localStorage.setItem(storageKey, endTime.toString());
    }

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const distance = endTime! - now;

      if (distance < 0) {
        clearInterval(intervalId);
        timerElement.innerHTML = timerConfig.messageAfter || "Oferta Expirada!";
        localStorage.removeItem(storageKey); 
        return;
      }
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      timerElement.innerHTML = `${timerConfig.messageBefore || 'Oferta expira em:'} ${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    }, 1000);

    return () => clearInterval(intervalId);
  }, [product, slug]);


  useEffect(() => {
    if (product) {
      let currentTotal = product.priceInCents;
      let calculatedDiscount = 0;
      let tempProductsForSale: SaleProductItem[] = [];

      tempProductsForSale.push({
          productId: product.id, name: product.name, quantity: 1, 
          priceInCents: product.priceInCents,
          originalPriceInCents: product.priceInCents,
          slug: product.slug,
          deliveryUrl: product.deliveryUrl,
      });

      if (appliedCoupon && appliedCoupon.isActive) {
        if (appliedCoupon.discountType === 'percentage') {
          calculatedDiscount = Math.round(product.priceInCents * (appliedCoupon.discountValue / 100));
        } else if (appliedCoupon.discountType === 'fixed') {
          calculatedDiscount = appliedCoupon.discountValue;
        }
        tempProductsForSale[0].priceInCents = Math.max(0, product.priceInCents - calculatedDiscount);
        currentTotal -= calculatedDiscount;
        if (currentTotal < 0) currentTotal = 0;
      }
      
      let initialTotalForOriginalPrice = product.priceInCents;
      
      if (includeOrderBump && product.orderBump?.customPriceInCents !== undefined) {
        initialTotalForOriginalPrice += product.orderBump.customPriceInCents;
        currentTotal += product.orderBump.customPriceInCents;
        tempProductsForSale.push({
            productId: product.orderBump.productId, name: product.orderBump.name, quantity: 1,
            priceInCents: product.orderBump.customPriceInCents, 
            originalPriceInCents: product.orderBump.customPriceInCents, 
            isOrderBump: true,
            slug: undefined,
            deliveryUrl: undefined
        });
      }
      setOriginalPriceBeforeDiscount(initialTotalForOriginalPrice);
      
      setDiscountApplied(calculatedDiscount);
      setFinalPrice(currentTotal);
      setCurrentProductsForSale(tempProductsForSale); 
    }
  }, [product, appliedCoupon, includeOrderBump]);

  const handleApplyCoupon = () => {
    setCouponError(null);
    if (!product || !product.coupons || product.coupons.length === 0) {
      setCouponError("Nenhum cupom disponível para este produto.");
      return;
    }
    const foundCoupon = product.coupons.find(c => c.code.toUpperCase() === couponCodeInput.trim().toUpperCase());
    if (foundCoupon) {
      if (foundCoupon.isActive) {
        setAppliedCoupon(foundCoupon);
        setCouponCodeInput(''); 
      } else {
        setCouponError("Este cupom não está mais ativo.");
      }
    } else {
      setCouponError("Cupom inválido.");
    }
  };
  const clearAppliedCoupon = () => setAppliedCoupon(null);
  
  const handleToggleOrderBump = () => {
    if (pixData) return; 
    setIncludeOrderBump(prev => !prev);
  };
  const removeOrderBump = () => {
      if (pixData) return;
      setIncludeOrderBump(false);
  };

  const scheduleAbandonedCart = useCallback(() => {
    if (abandonedCartTimeoutRef.current) window.clearTimeout(abandonedCartTimeoutRef.current);
    abandonedCartTimeoutRef.current = window.setTimeout(async () => {
      if (!product || !product.id || !customerEmail || paymentStatus === PaymentStatus.PAID || !finalPrice) return;
      
      const payload: CreateAbandonedCartPayload = {
        platformUserId: product.platformUserId,
        productId: product.id,
        productName: product.name,
        potentialValueInCents: finalPrice,
        customerName: customerName || customerEmail.split('@')[0],
        customerEmail: customerEmail,
        customerWhatsapp: customerWhatsappCountryCode + rawWhatsappNumber.replace(/\D/g, ''),
        trackingParameters: Object.fromEntries(new URLSearchParams(location.search).entries()),
      };
      
      try {
        if (!abandonedCartId) { 
            const newCart = await abandonedCartService.createAbandonedCartAttempt(payload);
            setAbandonedCartId(newCart.id);
            console.log("Abandoned cart created:", newCart.id);
        } else { 
            console.log("Abandoned cart already has ID, not re-creating:", abandonedCartId);
        }
      } catch (abandonedError) {
        console.error("Failed to log abandoned cart:", abandonedError);
      }
    }, 15000);
  }, [product, customerEmail, customerName, customerWhatsappCountryCode, rawWhatsappNumber, paymentStatus, finalPrice, abandonedCartId, location.search]);

  useEffect(() => {
    if (customerEmail && product && !pixData && paymentStatus !== PaymentStatus.PAID) {
      scheduleAbandonedCart();
    }
    return () => {
      if (abandonedCartTimeoutRef.current) window.clearTimeout(abandonedCartTimeoutRef.current);
    };
  }, [customerName, customerEmail, rawWhatsappNumber, product, pixData, paymentStatus, scheduleAbandonedCart]);

  const mapApiStatusToUiStatus = useCallback((apiStatus?: string): PaymentStatus => {
    if (!apiStatus) {
        console.warn(`API status is undefined. Defaulting to FAILED.`);
        return PaymentStatus.FAILED;
    }
    const lowerStatus = apiStatus.toLowerCase();
    switch (lowerStatus) {
        case "created":
        case "waiting_payment":
        case "pending":
            return PaymentStatus.WAITING_PAYMENT;
        case "paid":
        case "approved":
        case "confirmed":
            return PaymentStatus.PAID;
        case "cancelled":
        case "refused":
            return PaymentStatus.CANCELLED;
        case "expired":
            return PaymentStatus.EXPIRED;
        case "failed":
        case "error":
            return PaymentStatus.FAILED;
        default:
            console.warn(`Unknown API status from PushInPay: '${apiStatus}'. Defaulting to FAILED.`);
            return PaymentStatus.FAILED;
    }
  }, []);


  const handlePayWithPix = async () => {
    setError(null);
    if (!product || finalPrice === null || !platformSettings || !appSettings || currentProductsForSale.length === 0) {
      setError("Informações do produto, configurações ou itens de venda ausentes.");
      return;
    }
    if (!customerName.trim() || !customerEmail.trim() || !rawWhatsappNumber.trim()) {
      setError("Por favor, preencha todos os campos obrigatórios: Nome, Email e WhatsApp.");
      return;
    }

    setIsSubmitting(true);
    setPaymentStatus(null);
    setPixData(null);
    const clientTraceId = uuidv4();
    
    try {
        const pixPayload: PushInPayPixRequest = {
            value: finalPrice,
            originalValueBeforeDiscount: originalPriceBeforeDiscount ?? finalPrice, 
            webhook_url: MOCK_WEBHOOK_URL,
            customerName: customerName,
            customerEmail: customerEmail,
            customerWhatsapp: `${customerWhatsappCountryCode}${rawWhatsappNumber.replace(/\D/g, '')}`,
            products: currentProductsForSale,
            trackingParameters: Object.fromEntries(new URLSearchParams(location.search).entries()),
            couponCodeUsed: appliedCoupon?.code,
            discountAppliedInCents: discountApplied
        };
        
        console.log(`[CheckoutPage][${clientTraceId}] Invocando 'gerar-pix' com payload:`, pixPayload, "para productOwnerUserId:", product.platformUserId);
        const { data: pixFunctionResponse, error: functionError } = await supabase.functions.invoke<PushInPayPixResponse>('gerar-pix', {
            headers: { 'X-Client-Trace-Id': clientTraceId },
            body: {
                payload: pixPayload,
                productOwnerUserId: product.platformUserId
            }
        });
        console.log(`[CheckoutPage][${clientTraceId}] Resposta da Edge Function 'gerar-pix':`, pixFunctionResponse);
        if (functionError) console.error(`[CheckoutPage][${clientTraceId}] Erro da Edge Function 'gerar-pix':`, functionError);


        if (functionError) {
            let errorMessage = "Falha ao gerar PIX junto ao provedor.";
            if (typeof functionError.message === 'string') {
              try {
                  const parsedMessage = JSON.parse(functionError.message);
                  if (parsedMessage && parsedMessage.error && typeof parsedMessage.error === 'string') {
                      errorMessage = parsedMessage.error;
                  } else if (parsedMessage && parsedMessage.message && typeof parsedMessage.message === 'string') {
                      errorMessage = parsedMessage.message;
                  } else {
                      errorMessage = functionError.message;
                  }
              } catch (e) {
                  errorMessage = functionError.message;
              }
            }
            throw new Error(errorMessage);
        }

        if (pixFunctionResponse && pixFunctionResponse.success && pixFunctionResponse.data) {
            setPixData(pixFunctionResponse.data);
            const initialApiStatus = pixFunctionResponse.data.status;
            const initialUiStatus = mapApiStatusToUiStatus(initialApiStatus); 
            setPaymentStatus(initialUiStatus);
            startPollingPaymentStatus(pixFunctionResponse.data.id, product.platformUserId);
        } else {
            throw new Error(pixFunctionResponse?.message || "A resposta da função não continha os dados do PIX esperados.");
        }

    } catch (paymentError: any) {
        console.error(`[CheckoutPage][${clientTraceId}] Erro no bloco catch de handlePayWithPix:`, paymentError);
        setError(paymentError.message || "Ocorreu um erro desconhecido ao gerar o PIX. Tente novamente.");
    } finally {
      setIsSubmitting(false); 
    }
  };


  const startPollingPaymentStatus = (transactionId: string, productOwnerId: string) => {
    if (pollingIntervalRef.current) window.clearInterval(pollingIntervalRef.current);
    if (pollingTimeoutRef.current) window.clearTimeout(pollingTimeoutRef.current);
    setIsPollingPayment(true);

    pollingTimeoutRef.current = window.setTimeout(() => {
      if (pollingIntervalRef.current) window.clearInterval(pollingIntervalRef.current);
      setIsPollingPayment(false);
      if (paymentStatus !== PaymentStatus.PAID) { 
        setError("Tempo limite para verificação de pagamento esgotado. Se você pagou, contate o suporte.");
        setPaymentStatus(PaymentStatus.EXPIRED); 
      }
    }, POLLING_TIMEOUT_DURATION);

    pollingIntervalRef.current = window.setInterval(async () => {
      const clientTraceId = uuidv4();
      try {
        console.log(`[CheckoutPage][${clientTraceId}] Polling status for transactionId: ${transactionId}`);
        const { data: statusFunctionResponse, error: functionError } = await supabase.functions.invoke<PushInPayTransactionStatusResponse>('verificar-status-pix', {
            headers: { 'X-Client-Trace-Id': clientTraceId },
            body: { transactionId, productOwnerUserId: productOwnerId }
        });

        console.log(`[CheckoutPage][${clientTraceId}] Resposta do polling da Edge Function 'verificar-status-pix':`, statusFunctionResponse);
        if(functionError) console.error(`[CheckoutPage][${clientTraceId}] Erro do polling da Edge Function 'verificar-status-pix':`, functionError);

        if (functionError) {
            console.error(`[CheckoutPage][${clientTraceId}] Erro ao verificar status do PIX (polling):`, functionError.message);
            setError(functionError.message || "Falha ao verificar status do PIX.");
            if (pollingIntervalRef.current) window.clearInterval(pollingIntervalRef.current);
            if (pollingTimeoutRef.current) window.clearTimeout(pollingTimeoutRef.current);
            setIsPollingPayment(false);
            setPaymentStatus(PaymentStatus.FAILED);
            return;
        }

        if (statusFunctionResponse && statusFunctionResponse.success && statusFunctionResponse.data) {
            const currentApiStatus = statusFunctionResponse.data.status; 
            const statusForUi = mapApiStatusToUiStatus(currentApiStatus); 
            setPaymentStatus(statusForUi);

            if (statusForUi === PaymentStatus.PAID) {
                if (pollingIntervalRef.current) window.clearInterval(pollingIntervalRef.current);
                if (pollingTimeoutRef.current) window.clearTimeout(pollingTimeoutRef.current);
                setIsPollingPayment(false);

                if (!product || !platformSettings || currentProductsForSale.length === 0 || finalPrice === null || originalPriceBeforeDiscount === null) {
                    console.error(`[CheckoutPage][${clientTraceId}] Dados ausentes para finalizar venda: product, platformSettings, finalPrice, originalPriceBeforeDiscount ou currentProductsForSale.`);
                    setError("Erro ao finalizar a venda: dados do produto, configurações da plataforma, preços ou itens da venda ausentes.");
                    return;
                }

                const saleRecordForCreation: Omit<Sale, 'id' | 'createdAt' | 'platformCommissionInCents' | 'commission'> = {
                    platformUserId: product.platformUserId,
                    pushInPayTransactionId: transactionId,
                    products: currentProductsForSale,
                    customer: { name: customerName, email: customerEmail, whatsapp: customerWhatsappCountryCode + rawWhatsappNumber.replace(/\D/g, '') },
                    paymentMethod: PaymentMethod.PIX,
                    status: PaymentStatus.PAID,
                    totalAmountInCents: finalPrice,
                    originalAmountBeforeDiscountInCents: originalPriceBeforeDiscount,
                    discountAppliedInCents: discountApplied,
                    couponCodeUsed: appliedCoupon?.code,
                    trackingParameters: Object.fromEntries(new URLSearchParams(location.search).entries()),
                    paidAt: statusFunctionResponse.data.paid_at || new Date().toISOString(),
                };
                
                const createdSale = await salesService.createSale(saleRecordForCreation, platformSettings, null); 
                console.log(`[CheckoutPage][${clientTraceId}] Venda criada no banco de dados:`, createdSale.id);
                
                if(appSettings?.apiTokens?.utmifyEnabled && appSettings.apiTokens.utmify){
                    const utmifyProducts = createdSale.products.map(p => ({
                        id: p.productId, name: p.name, quantity: p.quantity, priceInCents: p.priceInCents,
                        planId: null, planName: null, isUpsell: p.isOrderBump || p.isUpsell, slug: p.slug
                    }));
                    const utmifyPayload: UtmifyOrderPayload = {
                        orderId: createdSale.id, platform: PLATFORM_NAME,
                        paymentMethod: "pix", status: PaymentStatus.PAID, createdAt: createdSale.createdAt,
                        customer: { name: createdSale.customer.name, email: createdSale.customer.email, whatsapp: createdSale.customer.whatsapp, ip: createdSale.customer.ip },
                        products: utmifyProducts, trackingParameters: createdSale.trackingParameters,
                        commission: createdSale.commission, approvedDate: createdSale.paidAt,
                        couponCodeUsed: createdSale.couponCodeUsed, discountAppliedInCents: createdSale.discountAppliedInCents,
                        originalAmountBeforeDiscountInCents: createdSale.originalAmountBeforeDiscountInCents,
                    };
                    await utmifyService.sendOrderData(utmifyPayload, appSettings.apiTokens.utmify);
                    console.log(`[CheckoutPage][${clientTraceId}] Dados da venda enviados para UTMify.`);
                }
                
                if (abandonedCartId) {
                    await abandonedCartService.updateAbandonedCartStatus(abandonedCartId, AbandonedCartStatus.RECOVERED, null);
                    console.log(`[CheckoutPage][${clientTraceId}] Carrinho abandonado ${abandonedCartId} atualizado para RECOVERED.`);
                }
                localStorage.removeItem(LOCALSTORAGE_CHECKOUT_KEY);
                navigate(`/thank-you/${transactionId}?origProdId=${product.id}`);

            } else if (
                statusForUi === PaymentStatus.EXPIRED ||
                statusForUi === PaymentStatus.CANCELLED ||
                statusForUi === PaymentStatus.FAILED
            ) {
                if (pollingIntervalRef.current) window.clearInterval(pollingIntervalRef.current);
                if (pollingTimeoutRef.current) window.clearTimeout(pollingTimeoutRef.current);
                setIsPollingPayment(false);
                setError(`O pagamento PIX ${statusForUi === PaymentStatus.EXPIRED ? 'expirou' : 'falhou/foi cancelado'}. Por favor, tente novamente.`);
                console.warn(`[CheckoutPage][${clientTraceId}] Pagamento PIX ${statusForUi}. Polling interrompido.`);
            }
        } else {
             console.warn(`[CheckoutPage][${clientTraceId}] Polling: Resposta da função 'verificar-status-pix' não foi bem-sucedida ou não continha dados.`);
             setError(statusFunctionResponse?.message || "Resposta inválida ao verificar status do PIX.");
             if (pollingIntervalRef.current) window.clearInterval(pollingIntervalRef.current);
             if (pollingTimeoutRef.current) window.clearTimeout(pollingTimeoutRef.current);
             setIsPollingPayment(false);
             setPaymentStatus(PaymentStatus.FAILED);
        }
      } catch (pollError: any) {
        console.error(`[CheckoutPage][${clientTraceId}] Erro durante o polling do status do PIX:`, pollError);
        setError(pollError.message || "Erro ao verificar status do pagamento. Tente novamente.");
        if (pollingIntervalRef.current) window.clearInterval(pollingIntervalRef.current);
        if (pollingTimeoutRef.current) window.clearTimeout(pollingTimeoutRef.current);
        setIsPollingPayment(false);
        setPaymentStatus(PaymentStatus.FAILED);
      }
    }, POLLING_INTERVAL);

    return () => {
      if (pollingIntervalRef.current) window.clearInterval(pollingIntervalRef.current);
      if (pollingTimeoutRef.current) window.clearTimeout(pollingTimeoutRef.current);
    };
  };


  const copyPixCode = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }).catch(err => {
        console.error('Falha ao copiar código PIX:', err);
        alert('Não foi possível copiar o código PIX. Por favor, copie manualmente.');
      });
    }
  };

  const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => setCustomerName(e.target.value);
  const handleCustomerEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => setCustomerEmail(e.target.value.trim());
  const handleCountryCodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => setCustomerWhatsappCountryCode(e.target.value);
  const handleWhatsappInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value.replace(/\D/g, '');
      setRawWhatsappNumber(formatPhoneNumberVisual(input));
  };
  const handleCouponCodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setCouponCodeInput(e.target.value);

  const hasLeftContent = product ?
    !!(
      product.checkoutCustomization?.videoUrl ||
      product.imageUrl ||
      (product.checkoutCustomization?.salesCopy && product.checkoutCustomization.salesCopy.replace(/<[^>]*>?/gm, '').trim() !== '')
    )
    : false;


  if (isLoadingProduct) {
    return <div className="flex justify-center items-center min-h-screen text-neutral-500"><p className="ml-3">Carregando produto...</p></div>;
  }
  if (error && !product) { 
    return <div className="text-center p-8 text-red-500 bg-red-50 rounded-md min-h-screen flex flex-col items-center justify-center">
        <p className="text-xl mb-4">Oops! Algo deu errado.</p>
        <p className="mb-6">{error}</p>
        <Button onClick={() => window.location.reload()} className="button-checkout-specific primary">Tentar Novamente</Button>
    </div>;
  }
  if (!product) { 
    return <div className="text-center p-8 text-neutral-500 min-h-screen flex flex-col items-center justify-center">Produto não disponível.</div>;
  }

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
        getPrimaryColor={getPrimaryColor}
        getCtaTextColor={getCtaTextColor}
        isPollingPayment={isPollingPayment}
        clearAppliedCoupon={clearAppliedCoupon}
        removeOrderBump={removeOrderBump}
        setPixData={setPixData}
        setPaymentStatus={setPaymentStatus}
        setError={setError}
        hasLeftContent={hasLeftContent}
    />
  );
};