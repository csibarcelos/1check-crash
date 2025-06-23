
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from "react-router-dom"; 
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { salesService } from '@/services/salesService'; 
import { productService } from '@/services/productService';
import { Sale, SaleProductItem, Product, UpsellOffer, PushInPayPixRequest, PushInPayPixResponseData, PushInPayPixResponse, AppSettings, UtmifyOrderPayload, PaymentStatus as AppPaymentStatus, UtmifyCustomer, UtmifyProduct, UtmifyTrackingParameters } from '@/types'; 
import { CheckIcon, DocumentDuplicateIcon, MOCK_WEBHOOK_URL, PLATFORM_NAME } from '../constants.tsx'; 
import { supabase } from '@/supabaseClient'; 
import { Input } from '@/components/ui/Input'; 
import { settingsService } from '@/services/settingsService';
import { utmifyService } from '@/services/utmifyService';


const formatCurrency = (valueInCents: number): string => {
    return `R$ ${(valueInCents / 100).toFixed(2).replace('.', ',')}`;
};

const triggerConversionEvent = (orderId: string, orderValue: number, currency: string, products: SaleProductItem[]) => {
  console.log(`CONVERSION EVENT: Order ${orderId}, Value ${orderValue} ${currency}, Products:`, products.map(p => p.name));
};

const getContrastingTextColorForDynamicTheme = (hexColor?: string, theme?: 'light' | 'dark'): string => {
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

const ThankYouPage: React.FC = () => {
  const { orderId: mainSaleTransactionId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const originalProductIdFromUrl = queryParams.get('origProdId');

  const [mainSaleDetails, setMainSaleDetails] = useState<Sale | null>(null);
  const [originalProductDetails, setOriginalProductDetails] = useState<Product | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null); 
  const [upsellOffer, setUpsellOffer] = useState<UpsellOffer | null>(null);
  const [upsellProductPrice, setUpsellProductPrice] = useState<number | null>(null);
  const [purchasedProducts, setPurchasedProducts] = useState<Product[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [isProcessingUpsell, setIsProcessingUpsell] = useState(false);
  const [upsellPixData, setUpsellPixData] = useState<PushInPayPixResponseData | null>(null); 
  const [upsellErrorMessage, setUpsellErrorMessage] = useState<string | null>(null);
  const [copySuccessUpsell, setCopySuccessUpsell] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    document.title = "Obrigado pela sua Compra!";
    const themeToApply = currentTheme === 'dark' ? 'checkout-reimagined-theme' : 'checkout-light-theme';
    document.body.classList.add(themeToApply);
    return () => { document.body.classList.remove(themeToApply); };
  }, [currentTheme]);


  const sendApprovedPaymentToUtmify = async (saleDetails: Sale, productOwnerUserId: string) => {
    const logPrefix = `[ThankYouPage.sendApprovedPaymentToUtmify for prodOwner: ${productOwnerUserId || 'N/A'}]`;

    if (!productOwnerUserId) {
        console.log(`${logPrefix} Evento 'approved' não enviado. Motivo: ID do dono do produto ausente.`);
        return;
    }
    console.log(`${logPrefix} Preparando para chamar Edge Function para enviar evento 'approved'.`);

    const utmifyCustomer: UtmifyCustomer = {
      name: saleDetails.customer.name,
      email: saleDetails.customer.email,
      whatsapp: saleDetails.customer.whatsapp,
      phone: saleDetails.customer.whatsapp || null, 
      document: null, 
      ip: saleDetails.customer.ip,
    };

    const utmifyProducts: UtmifyProduct[] = saleDetails.products.map(item => ({
      id: item.productId,
      name: item.name,
      quantity: item.quantity,
      priceInCents: item.priceInCents,
      planId: item.productId, 
      planName: item.name, 
    }));
    
    const utmifyTrackingParams: UtmifyTrackingParameters = {
        utm_source: saleDetails.trackingParameters?.utm_source || null,
        utm_medium: saleDetails.trackingParameters?.utm_medium || null,
        utm_campaign: saleDetails.trackingParameters?.utm_campaign || null,
        utm_term: saleDetails.trackingParameters?.utm_term || null,
        utm_content: saleDetails.trackingParameters?.utm_content || null,
    };

    const payload: UtmifyOrderPayload = {
      orderId: saleDetails.pushInPayTransactionId, 
      platform: PLATFORM_NAME,
      paymentMethod: saleDetails.paymentMethod as "pix" | "credit_card" | "boleto",
      status: saleDetails.status, 
      createdAt: saleDetails.createdAt,
      approvedDate: saleDetails.paidAt || new Date().toISOString(), 
      customer: utmifyCustomer,
      products: utmifyProducts,
      trackingParameters: utmifyTrackingParams,
      commission: saleDetails.commission,
      couponCodeUsed: saleDetails.couponCodeUsed,
      discountAppliedInCents: saleDetails.discountAppliedInCents,
      originalAmountBeforeDiscountInCents: saleDetails.originalAmountBeforeDiscountInCents,
      isUpsellTransaction: !!saleDetails.upsellPushInPayTransactionId && saleDetails.pushInPayTransactionId === saleDetails.upsellPushInPayTransactionId, 
      originalSaleId: undefined, 
    };

    try {
      await utmifyService.sendOrderDataToUtmify(payload, productOwnerUserId);
      console.log(`${logPrefix} Chamada para Edge Function 'send-utmify-event' (approved) enviada.`);
    } catch (utmifyError) {
      console.error(`${logPrefix} Falha ao chamar Edge Function 'send-utmify-event' (approved).`, utmifyError);
    }
  };


  const fetchInitialData = useCallback(async () => {
    if (!mainSaleTransactionId) {
      setError("ID do pedido principal não encontrado.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fetchedSale = await salesService.getSaleById(mainSaleTransactionId, null);
      if (!fetchedSale) {
        setError("Detalhes do pedido principal não encontrados.");
        setIsLoading(false);
        return;
      }
      setMainSaleDetails(fetchedSale);

      const saleProducts = Array.isArray(fetchedSale.products) ? fetchedSale.products : [];
      const saleCurrency = fetchedSale.commission?.currency || 'BRL';
      triggerConversionEvent(fetchedSale.id, fetchedSale.totalAmountInCents, saleCurrency, saleProducts);

      if (fetchedSale.platformUserId) {
        const settings = await settingsService.getAppSettingsByUserId(fetchedSale.platformUserId, null);
        setAppSettings(settings); 
      }
      
      if (saleProducts.length > 0) {
        const productDetailsPromises = saleProducts.map(item => 
          productService.getProductById(item.productId, null)
        );
        const productsResults = await Promise.all(productDetailsPromises);
        const validProducts = productsResults.filter((p): p is Product => p !== undefined);
        setPurchasedProducts(validProducts);
      }
      
      if (fetchedSale.status === AppPaymentStatus.PAID && fetchedSale.platformUserId) {
        await sendApprovedPaymentToUtmify(fetchedSale, fetchedSale.platformUserId);
      }

      if (originalProductIdFromUrl) {
        const fetchedOrigProduct = await productService.getProductById(originalProductIdFromUrl, null);
        setOriginalProductDetails(fetchedOrigProduct || null);
        setCurrentTheme(fetchedOrigProduct?.checkoutCustomization?.theme || 'light');
        if (fetchedOrigProduct?.upsell && !fetchedSale.upsellPushInPayTransactionId) {
          setUpsellOffer(fetchedOrigProduct.upsell);
          if (fetchedOrigProduct.upsell.customPriceInCents !== undefined) {
            setUpsellProductPrice(fetchedOrigProduct.upsell.customPriceInCents);
          } else {
            const fullUpsellProduct = await productService.getProductById(fetchedOrigProduct.upsell.productId, null);
            setUpsellProductPrice(fullUpsellProduct?.priceInCents || 0);
          }
          setShowUpsellModal(true);
        }
      } else {
        setCurrentTheme('light'); // Default if no original product
      }
    } catch (err) {
      setError("Falha ao buscar detalhes do pedido ou produto original.");
      console.error(err);
      setCurrentTheme('light');
    } finally {
      setIsLoading(false);
    }
  }, [mainSaleTransactionId, originalProductIdFromUrl]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);


  const handleAcceptUpsell = async () => {
    if (!mainSaleDetails || !upsellOffer || upsellProductPrice === null || upsellProductPrice <= 0) {
      setUpsellErrorMessage("Não foi possível processar a oferta adicional. Detalhes ausentes.");
      return;
    }
    setIsProcessingUpsell(true);
    setUpsellErrorMessage(null);
    setUpsellPixData(null);

    try {
      const upsellPixPayload: PushInPayPixRequest = {
        value: upsellProductPrice,
        originalValueBeforeDiscount: upsellProductPrice, 
        webhook_url: MOCK_WEBHOOK_URL, 
        customerName: mainSaleDetails.customer.name,
        customerEmail: mainSaleDetails.customer.email,
        customerWhatsapp: mainSaleDetails.customer.whatsapp,
        products: [{
          productId: upsellOffer.productId,
          name: upsellOffer.name,
          quantity: 1,
          priceInCents: upsellProductPrice,
          originalPriceInCents: upsellProductPrice, 
          isUpsell: true,
        }],
        isUpsellTransaction: true,
        originalSaleId: mainSaleDetails.id,
      };

      const { data: pixFunctionResponse, error: functionError } = await supabase.functions.invoke<PushInPayPixResponse>('gerar-pix', {
          body: {
              payload: upsellPixPayload,
              productOwnerUserId: mainSaleDetails.platformUserId
          }
      });

      if (functionError) {
        let errorMessage = "Falha ao gerar PIX para oferta adicional.";
         if (typeof functionError.message === 'string') {
             try { const parsedMessage = JSON.parse(functionError.message); errorMessage = parsedMessage?.error || parsedMessage?.message || functionError.message; } 
             catch (e) { errorMessage = functionError.message; }
        } throw new Error(errorMessage);
      }

      if (pixFunctionResponse && pixFunctionResponse.success && pixFunctionResponse.data) {
        setUpsellPixData(pixFunctionResponse.data);
      } else {
        throw new Error(pixFunctionResponse?.message || "A resposta da função não continha os dados do PIX para o upsell.");
      }

    } catch (paymentError: any) {
        setUpsellErrorMessage(paymentError.message || "Erro desconhecido ao processar oferta adicional.");
    } finally {
        setIsProcessingUpsell(false);
    }
  };
  
  const handleDeclineUpsell = () => { setShowUpsellModal(false); setUpsellPixData(null); };
  const copyUpsellPixCode = () => { if (upsellPixData?.qr_code) { navigator.clipboard.writeText(upsellPixData.qr_code).then(() => { setCopySuccessUpsell(true); setTimeout(() => setCopySuccessUpsell(false), 2000); }); } };

  const primaryColorForPage = originalProductDetails?.checkoutCustomization?.primaryColor || appSettings?.checkoutIdentity?.brandColor || (currentTheme === 'dark' ? 'var(--reimagined-accent-cta)' : 'var(--checkout-color-primary-DEFAULT)');
  const ctaTextColorForPage = getContrastingTextColorForDynamicTheme(primaryColorForPage, currentTheme);
  const themeContainerClass = currentTheme === 'dark' ? 'checkout-reimagined-theme' : 'checkout-light-theme';
  const cardThemeClass = currentTheme === 'dark' ? 'card-checkout-reimagined' : 'card-checkout-specific';
  const buttonThemeClass = currentTheme === 'dark' ? 'button-checkout-reimagined' : 'button-checkout-specific';
  const inputThemeClass = currentTheme === 'dark' ? 'input-checkout-reimagined' : 'input-checkout-specific';

  // const cardBgColor = currentTheme === 'dark' ? 'var(--reimagined-card-bg)' : 'var(--checkout-color-bg-surface)'; // Removido pois não é usado
  const cardBorderColor = currentTheme === 'dark' ? 'var(--reimagined-card-border)' : 'var(--checkout-color-border-subtle)';
  const strongTextColor = currentTheme === 'dark' ? 'var(--reimagined-text-strong)' : 'var(--checkout-color-text-strong)';
  const defaultTextColor = currentTheme === 'dark' ? 'text-[var(--reimagined-text-default)]' : 'text-[var(--checkout-color-text-default)]';
  const mutedTextColor = currentTheme === 'dark' ? 'text-[var(--reimagined-text-muted)]' : 'text-[var(--checkout-color-text-muted)]';
  const mainBgColor = currentTheme === 'dark' ? 'var(--reimagined-bg-main)' : 'var(--checkout-color-bg-main)';


  if (isLoading) { return <div className={`${themeContainerClass} flex justify-center items-center h-screen`} style={{color: defaultTextColor, backgroundColor: mainBgColor}}><p>Carregando...</p></div>; }
  if (error || !mainSaleDetails) {
    return (
      <div className={`${themeContainerClass} flex flex-col items-center justify-center min-h-screen p-6 text-center`} style={{color: defaultTextColor, backgroundColor: mainBgColor}}>
        <Card className={`${cardThemeClass} max-w-md w-full shadow-xl`}>
          <h1 className="text-2xl font-bold text-red-500 mb-3">Erro no Pedido</h1>
          <p className="mb-6">{error || "Pedido não encontrado."}</p>
          <Button onClick={() => navigate('/')} className={`${buttonThemeClass} primary`}>Voltar para Home</Button>
        </Card>
      </div>
    );
  }
  
  return (
    <div className={`${themeContainerClass} min-h-screen flex flex-col items-center justify-center p-4 md:p-6`} style={{color: defaultTextColor, backgroundColor: mainBgColor}}>
      <Card className={`${cardThemeClass} max-w-lg w-full shadow-2xl border border-green-300/50`}>
        <div className="text-center">
          <CheckIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-3" style={{color: strongTextColor}}>Obrigado pela sua compra!</h1>
          <p className="mb-2" style={{color: defaultTextColor}}>Seu pedido <span className="font-semibold" style={{color: primaryColorForPage}}>#{(mainSaleDetails.pushInPayTransactionId || 'INVÁLIDO').substring(0, 12)}...</span> foi confirmado.</p>
          <p className="mb-6" style={{color: mutedTextColor}}>Enviamos um e-mail para <span className="font-semibold" style={{color: defaultTextColor}}>{mainSaleDetails.customer.email}</span> com os detalhes do seu pedido e instruções de acesso.</p>
          <div className="p-4 rounded-md border mb-6" style={{backgroundColor: mainBgColor, borderColor: cardBorderColor}}>
            <h3 className="font-semibold mb-2" style={{color: strongTextColor}}>Resumo da Compra:</h3>
            <ul className="text-sm space-y-1" style={{color: mutedTextColor}}>
              {mainSaleDetails.products.map((item, index) => ( <li key={index} className="flex justify-between"><span style={{color: defaultTextColor}}>{item.name} (x{item.quantity}) {item.isOrderBump ? <span className="text-xs text-green-600">(Oferta Adicional)</span> : item.isUpsell ? <span className="text-xs text-green-600">(Oferta Pós-Compra)</span>: ""}</span><span style={{color: defaultTextColor}}>{formatCurrency(item.priceInCents)}</span></li> ))}
               {mainSaleDetails.discountAppliedInCents && mainSaleDetails.discountAppliedInCents > 0 && ( <li className="flex justify-between text-red-600 border-t border-dashed border-red-200/50 pt-1 mt-1"><span>Desconto ({mainSaleDetails.couponCodeUsed})</span><span>-{formatCurrency(mainSaleDetails.discountAppliedInCents)}</span></li> )}
              <li className="flex justify-between font-bold border-t pt-1 mt-1" style={{borderColor: cardBorderColor, color: strongTextColor}}><span>Total:</span><span>{formatCurrency(mainSaleDetails.totalAmountInCents)}</span></li>
            </ul>
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold text-center" style={{color: strongTextColor}}>Acesse seus produtos:</h3>
            {purchasedProducts.length > 0 ? ( purchasedProducts.map(product => { const saleItem = mainSaleDetails.products.find(p => p.productId === product.id); let productNameDisplay = product.name; if (saleItem?.isOrderBump) productNameDisplay += " (Oferta Adicional)"; if (saleItem?.isUpsell) productNameDisplay += " (Oferta Pós-Compra)"; return product.deliveryUrl ? ( <a key={product.id} href={product.deliveryUrl} target="_blank" rel="noopener noreferrer"><Button style={{ backgroundColor: primaryColorForPage, color: ctaTextColorForPage }} className={`${buttonThemeClass} primary w-full text-lg py-3`}>Acessar: {productNameDisplay}</Button></a> ) : ( <div key={product.id} className="text-center p-3 rounded-md border" style={{backgroundColor: mainBgColor, borderColor: cardBorderColor}}><p className="font-semibold" style={{color: strongTextColor}}>{productNameDisplay}</p><p className="text-xs" style={{color: mutedTextColor}}>O acesso a este produto será enviado por e-mail.</p></div> ) }) ) : ( <p className="text-sm text-center" style={{color: mutedTextColor}}>Processando links de acesso...</p> )}
          </div>
        </div>
      </Card>
      
      {upsellOffer && upsellProductPrice !== null && (
        <Modal isOpen={showUpsellModal} onClose={handleDeclineUpsell} title="Uma Oferta Especial Para Você!" size="lg" theme={currentTheme === 'dark' ? 'dark-app' : 'light'}>
            {upsellPixData ? (
                <div className="space-y-3 text-center">
                     <h3 className="text-xl font-semibold" style={{color: primaryColorForPage}}>Pague com PIX para adicionar!</h3>
                     <img src={`data:image/png;base64,${upsellPixData.qr_code_base64}`} alt="PIX QR Code para Upsell" className="mx-auto w-48 h-48 rounded-md border-2 p-1 bg-white" style={{borderColor: primaryColorForPage}}/>
                      <p className="text-sm mb-1 text-center" style={{color: mutedTextColor}}>Escaneie o QR Code ou clique no botão abaixo para copiar o código.</p>
                       <Input name="upsellPixCode" readOnly value={upsellPixData.qr_code} className={`${inputThemeClass} text-xs text-center mb-3`} style={{color: strongTextColor}}/>
                      <Button type="button" onClick={copyUpsellPixCode} className={`w-full mb-2 ${copySuccessUpsell ? 'bg-status-success text-white' : `${buttonThemeClass} primary`}`} style={!copySuccessUpsell ? { backgroundColor: primaryColorForPage, color: ctaTextColorForPage } : {}} disabled={isProcessingUpsell}>
                          {copySuccessUpsell ? ( <><CheckIcon className="h-5 w-5 mr-2"/> Copiado!</> ) : ( <><DocumentDuplicateIcon className="h-5 w-5 mr-2"/> Copiar Código PIX</> )}
                      </Button>
                     <p className="text-sm" style={{color: mutedTextColor}}>Após o pagamento, você receberá acesso à esta oferta adicional.</p>
                     <Button variant="ghost" onClick={handleDeclineUpsell} className={`${buttonThemeClass} outline w-full mt-2 py-3 text-md`} disabled={isProcessingUpsell}>Não, obrigado (Fechar)</Button>
                </div>
            ) : (
                <>
                    <div className="text-center">
                        {upsellOffer.imageUrl && <img src={upsellOffer.imageUrl} alt={upsellOffer.name} className="max-h-48 mx-auto mb-3 rounded-md shadow-md" />}
                        <h3 className="text-xl font-semibold mb-1" style={{color: strongTextColor}}>{upsellOffer.name}</h3>
                        <p className="mb-3" style={{color: defaultTextColor}}>{upsellOffer.description}</p>
                        <p className="text-2xl font-bold mb-4" style={{color: primaryColorForPage}}>Por apenas: {formatCurrency(upsellProductPrice)}</p>
                    </div>
                    {upsellErrorMessage && <p className="text-sm text-status-error p-2 bg-status-error/10 border border-status-error/30 rounded-md my-2">{upsellErrorMessage}</p>}
                    <div className="flex flex-col sm:flex-row justify-center gap-3 mt-4">
                        <Button onClick={handleAcceptUpsell} disabled={isProcessingUpsell} style={{ backgroundColor: primaryColorForPage, color: ctaTextColorForPage }} className={`${buttonThemeClass} primary flex-1 py-3 text-md animate-pulse-subtle`}>
                            {isProcessingUpsell ? "Processando..." : "Sim, quero esta oferta!"}
                        </Button>
                        <Button variant="ghost" onClick={handleDeclineUpsell} disabled={isProcessingUpsell} className={`${buttonThemeClass} outline flex-1 py-3 text-md`}>Não, obrigado</Button>
                    </div>
                </>
            )}
        </Modal>
      )}
    </div>
  );
};

export default ThankYouPage;