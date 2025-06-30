
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { salesService } from '@/services/salesService';
import { productService } from '@/services/productService';
import { Sale, SaleProductItem, Product, UpsellOffer, PushInPayPixResponseData, AppSettings, PaymentStatus as AppPaymentStatus } from '@/types'; 
import { CheckIcon, DocumentDuplicateIcon, MOCK_WEBHOOK_URL, cn, ExternalLinkIconHero } from '../constants.tsx'; 
import { supabase } from '@/supabaseClient';
import { Input } from '@/components/ui/Input';
import { settingsService } from '@/services/settingsService';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getOptimalTextColor } from '@/utils/colorUtils.ts'; // IMPORT THE NEW UTILITY

const POLLING_INITIAL_INTERVAL = 3000;
const POLLING_MAX_INTERVAL = 15000;
const UPSELL_POLLING_TIMEOUT_DURATION = 10 * 60 * 1000;
const MANUAL_CHECK_COOLDOWN_MS = 10000;
const UPSELL_MODAL_DELAY_MS = 3000;


const formatCurrency = (valueInCents: number): string => {
    return `R\$ ${(valueInCents / 100).toFixed(2).replace('.', ',')}`;
};

const ThankYouPage: React.FC = () => {
  const { orderId: mainSaleTransactionId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const originalProductIdFromUrl = queryParams.get('origProdId');
  const checkoutSessionIdFromUrl = queryParams.get('csid');

  const { user } = useAuth(); 

  const [mainSaleDetails, setMainSaleDetails] = useState<Sale | null>(null);
  const [originalProductDetails, setOriginalProductDetails] = useState<Product | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [upsellOffer, setUpsellOffer] = useState<UpsellOffer | null>(null);
  const [upsellProductDetails, setUpsellProductDetails] = useState<Product | null>(null);
  const [upsellProductPrice, setUpsellProductPrice] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [isUpsellModalReadyToShow, setIsUpsellModalReadyToShow] = useState(false);
  const [isProcessingUpsell, setIsProcessingUpsell] = useState(false);
  const [upsellPixData, setUpsellPixData] = useState<PushInPayPixResponseData | null>(null);
  const [upsellErrorMessage, setUpsellErrorMessage] = useState<string | null>(null);
  const [copySuccessUpsell, setCopySuccessUpsell] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');

  const [upsellPaymentStatus, setUpsellPaymentStatus] = useState<AppPaymentStatus | null>(null);
  const upsellPaymentStatusRef = useRef<AppPaymentStatus | null>(null);
  const [isPollingUpsellPayment, setIsPollingUpsellPayment] = useState(false);
  const [canManuallyCheckUpsell, setCanManuallyCheckUpsell] = useState(true);
  const [isManualCheckingUpsell, setIsManualCheckingUpsell] = useState(false);
  const upsellPollingIntervalTimerIdRef = useRef<number | null>(null);
  const upsellPollingAttemptRef = useRef<number>(0);
  const upsellPollingStartTimeRef = useRef<number>(0);
  const upsellManualCheckTimeoutRef = useRef<number | null>(null);
  const upsellModalDelayTimerRef = useRef<number | null>(null);

  // Dynamic styling state
  const [resolvedPrimaryHex, setResolvedPrimaryHex] = useState<string>(
    currentTheme === 'dark' ? '#FDE047' : '#0D9488'
  );
  const [ctaButtonTextColor, setCtaButtonTextColor] = useState<string>(
    currentTheme === 'dark' ? '#1F2937' : '#FFFFFF'
  );

  useEffect(() => {
    upsellPaymentStatusRef.current = upsellPaymentStatus;
  }, [upsellPaymentStatus]);

  useEffect(() => {
    document.title = "Obrigado pela sua Compra!";
    const themeToApply = currentTheme === 'dark' ? 'checkout-reimagined-theme' : 'checkout-light-theme';
    document.body.classList.add(themeToApply);
    return () => {
        document.body.classList.remove(themeToApply);
        if (upsellModalDelayTimerRef.current) clearTimeout(upsellModalDelayTimerRef.current);
    };
  }, [currentTheme, user?.id, checkoutSessionIdFromUrl]);


  const fetchInitialData = useCallback(async () => {
    if (!mainSaleTransactionId) { setError("ID do pedido principal não encontrado."); setIsLoading(false); return; }
    setIsLoading(true); setError(null);
    try {
      const fetchedSale = await salesService.getSaleById(mainSaleTransactionId);
      if (!fetchedSale) { setError("Detalhes do pedido principal não encontrados."); setIsLoading(false); return; }
      setMainSaleDetails(fetchedSale);
      if (fetchedSale.platformUserId) {
        setAppSettings(await settingsService.getAppSettingsByUserId(fetchedSale.platformUserId));
      }
      
      if (originalProductIdFromUrl) {
        const origProduct = await productService.getProductById(originalProductIdFromUrl);
        setOriginalProductDetails(origProduct || null);
        const newTheme = origProduct?.checkoutCustomization?.theme || 'light';
        setCurrentTheme(newTheme);

        if (origProduct?.upsell?.redirectUrl) {
            window.location.href = origProduct.upsell.redirectUrl;
            return; // Stop further execution
        }

        if (origProduct?.upsell && !fetchedSale.upsellPushInPayTransactionId && fetchedSale.status === AppPaymentStatus.PAID) {
          setUpsellOffer(origProduct.upsell);
          const fullUpsellProd = await productService.getProductById(origProduct.upsell.productId);
          setUpsellProductDetails(fullUpsellProd || null); 
          setUpsellProductPrice(origProduct.upsell.customPriceInCents ?? fullUpsellProd?.priceInCents ?? 0);

          if (upsellModalDelayTimerRef.current) clearTimeout(upsellModalDelayTimerRef.current);
          upsellModalDelayTimerRef.current = window.setTimeout(() => {
            setIsUpsellModalReadyToShow(true);
            setShowUpsellModal(true);
          }, UPSELL_MODAL_DELAY_MS);
        }
      } else { setCurrentTheme('light'); }
    } catch (err) { setError("Falha ao buscar detalhes do pedido ou produto original."); console.error(err); setCurrentTheme('light');
    } finally { setIsLoading(false); }
  }, [mainSaleTransactionId, originalProductIdFromUrl]);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

  // Effect to calculate resolvedPrimaryHex and ctaButtonTextColor
  useEffect(() => {
    const determinedPrimaryColor = originalProductDetails?.checkoutCustomization?.primaryColor || 
                                   appSettings?.checkoutIdentity?.brandColor || 
                                   (currentTheme === 'dark' ? 'var(--reimagined-accent-cta)' : 'var(--checkout-color-primary-DEFAULT)');
    
    let actualHex = determinedPrimaryColor;
    const colorVarMap: Record<string, string> = {
      'var(--reimagined-accent-cta)': '#FDE047',
      'var(--checkout-color-primary-DEFAULT)': '#0D9488',
    };

    if (colorVarMap[actualHex]) {
      actualHex = colorVarMap[actualHex];
    }

    if (/^#([0-9A-F]{3,4}|[0-9A-F]{6}|[0-9A-F]{8})$/i.test(actualHex.trim())) {
      setResolvedPrimaryHex(actualHex.trim());
      setCtaButtonTextColor(getOptimalTextColor(actualHex.trim(), { lightColor: '#FFFFFF', darkColor: '#1F2937' }));
    } else {
      const fallbackHex = currentTheme === 'dark' ? '#FDE047' : '#0D9488';
      setResolvedPrimaryHex(fallbackHex);
      setCtaButtonTextColor(getOptimalTextColor(fallbackHex, { lightColor: '#FFFFFF', darkColor: '#1F2937' }));
    }
  }, [originalProductDetails, appSettings, currentTheme]);


  const checkUpsellPaymentStatus = useCallback(async (upsellTxId: string) => {
    if (!mainSaleDetails?.platformUserId || !upsellOffer || upsellProductPrice === null || !upsellProductDetails) {
      console.warn("[ThankYouPage.checkUpsellPaymentStatus] Dados insuficientes para verificar pagamento do upsell.");
      return;
    }
    let mappedStatus: AppPaymentStatus | null = null;
    try {
      const { data: pixFuncRes, error: funcErr } = await supabase.functions.invoke('verificar-status-pix', { body: { transactionId: upsellTxId, productOwnerUserId: mainSaleDetails.platformUserId, saleId: mainSaleDetails.id, isUpsellTransaction: true } });
      if (funcErr || !pixFuncRes || !pixFuncRes.success || !pixFuncRes.data) throw new Error(pixFuncRes?.message || funcErr?.message || "Falha ao verificar status do PIX do upsell.");

      const rawStatus = pixFuncRes.data.status.toLowerCase();
      switch (rawStatus) {
        case 'paid': case 'approved': mappedStatus = AppPaymentStatus.PAID; break;
        case 'created': case 'waiting_payment': case 'pending': case 'processing': mappedStatus = AppPaymentStatus.WAITING_PAYMENT; break;
        case 'expired': mappedStatus = AppPaymentStatus.EXPIRED; break; 
        case 'cancelled': mappedStatus = AppPaymentStatus.CANCELLED; break; 
        default: mappedStatus = AppPaymentStatus.FAILED;
      }
      setUpsellPaymentStatus(mappedStatus);

      if (mappedStatus === AppPaymentStatus.PAID) {
        if (upsellPollingIntervalTimerIdRef.current) clearTimeout(upsellPollingIntervalTimerIdRef.current);
        setIsPollingUpsellPayment(false);
        
        const newUpsellProductItem: SaleProductItem = { 
            productId: upsellOffer.productId, 
            name: upsellProductDetails.name, 
            quantity: 1, 
            priceInCents: upsellProductPrice, 
            originalPriceInCents: upsellProductPrice, 
            isUpsell: true, 
            deliveryUrl: upsellProductDetails.deliveryUrl, 
            slug: upsellProductDetails.slug 
        };

        setMainSaleDetails(prev => {
            if (!prev) return null;
            const updatedSaleProducts = [...prev.products, newUpsellProductItem];
            const updatedTotalAmount = prev.totalAmountInCents + upsellProductPrice;
            return { 
                ...prev, 
                upsellPushInPayTransactionId: upsellTxId, 
                upsellStatus: AppPaymentStatus.PAID, 
                upsellAmountInCents: upsellProductPrice, 
                totalAmountInCents: updatedTotalAmount, 
                products: updatedSaleProducts 
            };
        });

        console.log('[ThankYouPage] Pagamento do upsell confirmado. Enviando evento de tracking...');
        const { error: trackError } = await supabase.functions.invoke(
          'send-upsell-utmify-event',
          {
            body: {
              originalSaleId: mainSaleDetails.id,
              upsellProductId: upsellOffer.productId,
              upsellPriceInCents: upsellProductPrice
            }
          }
        );
        if (trackError) console.warn('[ThankYouPage] AVISO: Falha ao registrar o evento de tracking do upsell.', trackError);
        else console.log('[ThankYouPage] Evento de tracking do upsell enviado com sucesso!');
        
      } else if (mappedStatus !== AppPaymentStatus.WAITING_PAYMENT) {
        if (upsellPollingIntervalTimerIdRef.current) clearTimeout(upsellPollingIntervalTimerIdRef.current);
        setIsPollingUpsellPayment(false);
        setUpsellErrorMessage(`Pagamento da oferta adicional ${mappedStatus === AppPaymentStatus.EXPIRED ? 'expirou' : 'falhou/foi cancelado'}.`);
      }
    } catch (statusErr: any) {
      console.error("[ThankYouPage.checkUpsellPaymentStatus] Erro:", statusErr.message);
      if (upsellPaymentStatusRef.current !== AppPaymentStatus.PAID) setUpsellErrorMessage("Erro ao verificar status do pagamento do upsell.");
    }
  }, [mainSaleDetails, upsellOffer, upsellProductDetails, upsellProductPrice, user?.id, checkoutSessionIdFromUrl]);


  const startUpsellPaymentPolling = useCallback((upsellTxId: string) => {
    setIsPollingUpsellPayment(true); upsellPollingAttemptRef.current = 0; upsellPollingStartTimeRef.current = Date.now();
    const poll = async () => {
      if (Date.now() - upsellPollingStartTimeRef.current > UPSELL_POLLING_TIMEOUT_DURATION) {
        setIsPollingUpsellPayment(false);
        if (upsellPaymentStatusRef.current !== AppPaymentStatus.PAID) setUpsellErrorMessage("Tempo para verificar PIX do upsell excedido.");
        return;
      }
      await checkUpsellPaymentStatus(upsellTxId);
      if (upsellPaymentStatusRef.current === AppPaymentStatus.WAITING_PAYMENT || upsellPaymentStatusRef.current === null) {
        upsellPollingAttemptRef.current++;
        const nextInterval = Math.min(POLLING_INITIAL_INTERVAL * Math.pow(1.5, upsellPollingAttemptRef.current), POLLING_MAX_INTERVAL);
        upsellPollingIntervalTimerIdRef.current = window.setTimeout(poll, nextInterval);
      } else { setIsPollingUpsellPayment(false); }
    };
    poll();
  }, [checkUpsellPaymentStatus]);

  const handleManualCheckUpsell = useCallback(async () => {
    if (!upsellPixData?.id || !canManuallyCheckUpsell || isManualCheckingUpsell) return;
    setIsManualCheckingUpsell(true); setCanManuallyCheckUpsell(false);
    await checkUpsellPaymentStatus(upsellPixData.id);
    setIsManualCheckingUpsell(false);
    if (upsellManualCheckTimeoutRef.current) clearTimeout(upsellManualCheckTimeoutRef.current);
    upsellManualCheckTimeoutRef.current = window.setTimeout(() => setCanManuallyCheckUpsell(true), MANUAL_CHECK_COOLDOWN_MS);
  }, [upsellPixData, canManuallyCheckUpsell, isManualCheckingUpsell, checkUpsellPaymentStatus]);

  useEffect(() => {
    return () => {
      if (upsellPollingIntervalTimerIdRef.current) clearTimeout(upsellPollingIntervalTimerIdRef.current);
      if (upsellManualCheckTimeoutRef.current) clearTimeout(upsellManualCheckTimeoutRef.current);
    };
  }, []);

  const handleAcceptUpsell = async () => {
    if (!mainSaleDetails || !upsellOffer || upsellProductPrice === null || upsellProductPrice <= 0 || !upsellProductDetails) {
      setUpsellErrorMessage("Não foi possível processar a oferta adicional. Detalhes ausentes ou inválidos."); return;
    }
    setIsProcessingUpsell(true); setUpsellErrorMessage(null); setUpsellPixData(null);
    try {
      const upsellPixPayload = {
        value: upsellProductPrice, originalValueBeforeDiscount: upsellProductPrice, webhook_url: MOCK_WEBHOOK_URL,
        customerName: mainSaleDetails.customer.name, customerEmail: mainSaleDetails.customer.email, customerWhatsapp: mainSaleDetails.customer.whatsapp,
        products: [{ productId: upsellOffer.productId, name: upsellProductDetails.name, quantity: 1, priceInCents: upsellProductPrice, originalPriceInCents: upsellProductPrice, isUpsell: true, deliveryUrl: upsellProductDetails.deliveryUrl, slug: upsellProductDetails.slug }],
        isUpsellTransaction: true, originalSaleId: mainSaleDetails.id,
      };
      const { data: pixFuncRes, error: funcErr } = await supabase.functions.invoke('gerar-pix', { 
        body: { 
            payload: upsellPixPayload,
            productOwnerUserId: mainSaleDetails.platformUserId, 
            saleId: mainSaleDetails.id 
        } 
      });

      if (funcErr) { let msg = "Falha ao gerar PIX para oferta adicional."; if (typeof funcErr.message === 'string') { try { const parsed = JSON.parse(funcErr.message); msg = parsed?.error || parsed?.message || funcErr.message; } catch (e) { msg = funcErr.message; } } throw new Error(msg); }
      if (pixFuncRes && (pixFuncRes as any).success && (pixFuncRes as any).data) { setUpsellPixData((pixFuncRes as any).data); startUpsellPaymentPolling((pixFuncRes as any).data.id); setUpsellPaymentStatus(AppPaymentStatus.WAITING_PAYMENT); }
      else { throw new Error((pixFuncRes as any)?.message || "Resposta inválida do PIX para upsell."); }
    } catch (paymentError: any) { setUpsellErrorMessage(paymentError.message || "Erro ao processar oferta adicional.");
    } finally { setIsProcessingUpsell(false); }
  };

  const handleDeclineUpsell = () => { setShowUpsellModal(false); setUpsellPixData(null); if (upsellPollingIntervalTimerIdRef.current) clearTimeout(upsellPollingIntervalTimerIdRef.current); setIsPollingUpsellPayment(false); };
  const copyUpsellPixCode = () => { if (upsellPixData?.qr_code) { navigator.clipboard.writeText(upsellPixData.qr_code).then(() => { setCopySuccessUpsell(true); setTimeout(() => setCopySuccessUpsell(false), 2000); }); } };

  const themeContainerClass = currentTheme === 'dark' ? 'checkout-reimagined-theme' : 'checkout-light-theme';
  const cardThemeClass = currentTheme === 'dark' ? 'card-checkout-reimagined' : 'card-checkout-specific';
  const buttonThemeClass = currentTheme === 'dark' ? 'button-checkout-reimagined' : 'button-checkout-specific';
  const inputThemeClass = currentTheme === 'dark' ? 'input-checkout-reimagined' : 'input-checkout-specific';
  const cardBorderColor = currentTheme === 'dark' ? 'var(--reimagined-card-border)' : 'var(--checkout-color-border-subtle)';
  const strongTextColor = currentTheme === 'dark' ? 'var(--reimagined-text-strong)' : 'var(--checkout-color-text-strong)';
  const defaultTextColor = currentTheme === 'dark' ? 'text-[var(--reimagined-text-default)]' : 'text-[var(--checkout-color-text-default)]';
  const mutedTextColor = currentTheme === 'dark' ? 'text-[var(--reimagined-text-muted)]' : 'text-[var(--checkout-color-text-muted)]';
  const mainBgColor = currentTheme === 'dark' ? 'var(--reimagined-bg-main)' : 'var(--checkout-color-bg-main)';

  if (isLoading) { return <div className={cn(themeContainerClass, "flex justify-center items-center h-screen")} style={{color: defaultTextColor, backgroundColor: mainBgColor}}><LoadingSpinner size="lg" /><p className="ml-3">Carregando...</p></div>; }
  if (error || !mainSaleDetails) { return ( <div className={cn(themeContainerClass, "flex flex-col items-center justify-center min-h-screen p-6 text-center")} style={{color: defaultTextColor, backgroundColor: mainBgColor}}> <Card className={cn(cardThemeClass, "max-w-md w-full shadow-xl")}> <h1 className="text-2xl font-bold text-red-500 mb-3">Erro no Pedido</h1> <p className="mb-6">{error || "Pedido não encontrado."}</p> <Button onClick={() => navigate('/')} className={cn(buttonThemeClass, "primary")} style={{backgroundColor: resolvedPrimaryHex, color: ctaButtonTextColor}}>Voltar para Home</Button> </Card> </div> ); }

  return (
    <div className={cn(themeContainerClass, "min-h-screen flex flex-col items-center justify-center p-4 md:p-6")} style={{color: defaultTextColor, backgroundColor: mainBgColor}}>
      <Card className={cn(cardThemeClass, "max-w-lg w-full shadow-2xl border border-green-300/50")}>
        <div className="text-center">
          <CheckIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-3" style={{color: strongTextColor}}>Obrigado pela sua compra!</h1>
          <p className="mb-2" style={{color: defaultTextColor}}>Seu pedido <span className="font-semibold" style={{color: resolvedPrimaryHex}}>#{(mainSaleDetails.id || 'INVÁLIDO').substring(0, 12)}...</span> foi confirmado.</p>
          <p className="mb-6" style={{color: mutedTextColor}}>Enviamos um e-mail para <span className="font-semibold" style={{color: defaultTextColor}}>{mainSaleDetails.customer.email}</span> com os detalhes do seu pedido e instruções de acesso.</p>
          <div className="p-4 rounded-md border mb-6" style={{backgroundColor: mainBgColor, borderColor: cardBorderColor}}>
            <h3 className="font-semibold mb-2" style={{color: strongTextColor}}>Resumo da Compra:</h3>
            <ul className="text-sm space-y-1" style={{color: mutedTextColor}}> {mainSaleDetails.products.map((item, index) => ( <li key={`${item.productId}-${index}`} className="flex justify-between"><span style={{color: defaultTextColor}}>{item.name} (x{item.quantity}) {item.isTraditionalOrderBump ? <span className="text-xs text-green-600">(Oferta Adicional)</span> : item.isUpsell ? <span className="text-xs text-green-600">(Oferta Pós-Compra)</span>: ""}</span><span style={{color: defaultTextColor}}>{formatCurrency(item.priceInCents)}</span></li> ))} {mainSaleDetails.discountAppliedInCents && mainSaleDetails.discountAppliedInCents > 0 && ( <li className="flex justify-between text-red-600 border-t border-dashed border-red-200/50 pt-1 mt-1"><span>Desconto ({mainSaleDetails.couponCodeUsed})</span><span>-{formatCurrency(mainSaleDetails.discountAppliedInCents)}</span></li> )} <li className="flex justify-between font-bold border-t pt-1 mt-1" style={{borderColor: cardBorderColor, color: strongTextColor}}><span>Total:</span><span>{formatCurrency(mainSaleDetails.totalAmountInCents)}</span></li> </ul>
          </div>
          <div className="space-y-3 mt-6">
            <h3 className="font-semibold text-center mb-3" style={{color: strongTextColor}}>Acesse seus produtos:</h3>
            <div className="flex flex-col space-y-3">
              {mainSaleDetails.products.map((item, index) => {
                const productNameDisplay = item.isTraditionalOrderBump ? `${item.name} (Oferta Adicional)` : item.isUpsell ? `${item.name} (Oferta Pós-Compra)` : item.name;
                if (item.deliveryUrl) {
                  return (
                    <a key={`${item.productId}-${index}-link`} href={item.deliveryUrl} target="_blank" rel="noopener noreferrer"
                      className={cn(
                        "block w-full text-center px-4 py-2.5 rounded-lg transition-colors duration-200 ease-in-out font-medium group",
                        "border hover:shadow-md",
                        currentTheme === 'dark'
                          ? 'border-[var(--reimagined-input-border)] text-[var(--reimagined-text-default)] hover:border-[var(--reimagined-accent-cta)] hover:text-[var(--reimagined-accent-cta)] hover:bg-[rgba(253,224,71,0.05)]'
                          : 'border-[var(--checkout-color-border-subtle)] text-[var(--checkout-color-text-default)] hover:border-[var(--checkout-color-primary-DEFAULT)] hover:text-[var(--checkout-color-primary-DEFAULT)] hover:bg-[rgba(13,148,136,0.03)]'
                      )}
                      style={currentTheme === 'light' ? { borderColor: resolvedPrimaryHex, color: resolvedPrimaryHex } : {}}
                    >
                      Acessar: {productNameDisplay}
                      <ExternalLinkIconHero className="inline-block h-4 w-4 ml-1.5 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </a>
                  );
                }
                return (
                  <div key={`${item.productId}-${index}-no-link`} className="text-center p-3 rounded-md border" style={{backgroundColor: mainBgColor, borderColor: cardBorderColor}}>
                    <p className="font-medium" style={{color: defaultTextColor}}>{productNameDisplay}</p>
                    <p className="text-xs" style={{color: mutedTextColor}}>O acesso será enviado por e-mail.</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {upsellOffer && upsellProductPrice !== null && upsellProductDetails && (
        <Modal isOpen={showUpsellModal && isUpsellModalReadyToShow} onClose={handleDeclineUpsell} title="Uma Oferta Especial Para Você!" size="lg" theme={currentTheme === 'dark' ? 'dark-app' : 'light'}>
            {upsellPixData && upsellPaymentStatus === AppPaymentStatus.WAITING_PAYMENT ? (
                <div className="space-y-3 text-center">
                     <h3 className="text-xl font-semibold" style={{color: resolvedPrimaryHex}}>Pague com PIX para adicionar!</h3>
                     <img src={`data:image/png;base64,${upsellPixData.qr_code_base64}`} alt="PIX QR Code para Upsell" className="mx-auto w-48 h-48 rounded-md border-2 p-1 bg-white" style={{borderColor: resolvedPrimaryHex}}/>
                      <p className="text-sm mb-1 text-center" style={{color: mutedTextColor}}>Escaneie o QR Code ou clique no botão abaixo para copiar o código.</p>
                       <Input name="upsellPixCode" readOnly value={upsellPixData.qr_code} className={cn(inputThemeClass, "text-xs text-center mb-3")} style={{color: strongTextColor}}/>
                      <Button type="button" onClick={copyUpsellPixCode} className={cn("w-full mb-2", copySuccessUpsell ? 'bg-status-success text-white' : cn(buttonThemeClass, "primary"))} style={!copySuccessUpsell ? { backgroundColor: resolvedPrimaryHex, color: ctaButtonTextColor } : {}} disabled={isProcessingUpsell || isPollingUpsellPayment}> {copySuccessUpsell ? ( <><CheckIcon className="h-5 w-5 mr-2"/> Copiado!</> ) : ( <><DocumentDuplicateIcon className="h-5 w-5 mr-2"/> Copiar Código PIX</> )} </Button>
                      {isPollingUpsellPayment && ( <div className="mt-3 flex items-center justify-center text-base" style={{color: mutedTextColor}}><LoadingSpinner size="sm" className="mr-2"/>Verificando pagamento...</div> )}
                      <Button onClick={handleManualCheckUpsell} isLoading={isManualCheckingUpsell} disabled={!canManuallyCheckUpsell || isManualCheckingUpsell || isPollingUpsellPayment} variant="outline" size="sm" className={cn(buttonThemeClass, "outline w-full mt-2")}> {isManualCheckingUpsell ? 'Verificando...' : (canManuallyCheckUpsell ? 'Verificar Manualmente' : 'Aguarde para verificar')} </Button>
                      {upsellErrorMessage && <p className="text-sm text-status-error p-2 bg-status-error/10 border border-status-error/30 rounded-md mt-2">{upsellErrorMessage}</p>}
                      <Button variant="ghost" onClick={handleDeclineUpsell} className={cn(buttonThemeClass, "outline w-full mt-3 py-3 text-md")} disabled={isProcessingUpsell || isPollingUpsellPayment}>Não, obrigado (Fechar)</Button>
                </div>
            ) : upsellPaymentStatus === AppPaymentStatus.PAID ? (
                <div className="text-center space-y-4 py-5"> <CheckIcon className="h-12 w-12 text-status-success mx-auto mb-2"/> <h3 className="text-xl font-semibold text-status-success">Oferta Adicionada!</h3> <p style={{color: defaultTextColor}}>Sua oferta adicional foi confirmada. O acesso será enviado junto com os demais produtos.</p> 
                <Button onClick={handleDeclineUpsell} variant="outline" className={cn(buttonThemeClass, "outline w-full mt-3 py-3")}>Fechar</Button> 
                </div>
            ) : (
                <>
                    <div className="text-center"> {upsellOffer.imageUrl && <img src={upsellOffer.imageUrl} alt={upsellOffer.name} className="max-h-48 mx-auto mb-3 rounded-md shadow-md" />} <h3 className="text-xl font-semibold mb-1" style={{color: strongTextColor}}>{upsellProductDetails.name}</h3> <p className="mb-3" style={{color: defaultTextColor}}>{upsellProductDetails.description}</p> <p className="text-2xl font-bold mb-4" style={{color: resolvedPrimaryHex}}>Por apenas: {formatCurrency(upsellProductPrice)}</p> </div>
                    {upsellErrorMessage && <p className="text-sm text-status-error p-2 bg-status-error/10 border border-status-error/30 rounded-md my-2">{upsellErrorMessage}</p>}
                    <div className="flex flex-col sm:flex-row justify-center gap-3 mt-4"> <Button onClick={handleAcceptUpsell} disabled={isProcessingUpsell} style={{ backgroundColor: resolvedPrimaryHex, color: ctaButtonTextColor }} className={cn(buttonThemeClass, "primary flex-1 py-3 text-md animate-pulse-subtle")}> {isProcessingUpsell ? "Processando..." : "Sim, quero esta oferta!"} </Button> <Button variant="ghost" onClick={handleDeclineUpsell} disabled={isProcessingUpsell} className={cn(buttonThemeClass, "outline flex-1 py-3 text-md")}>Não, obrigado</Button> </div>
                </>
            )}
        </Modal>
      )}
    </div>
  );
};

export default ThankYouPage;