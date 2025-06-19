import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from "react-router-dom"; 
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { salesService } from '@/services/salesService'; 
import { productService } from '@/services/productService';
import { Sale, SaleProductItem, Product, UpsellOffer, PushInPayPixRequest, PushInPayPixResponseData, PushInPayPixResponse, AppSettings, UtmifyOrderPayload, PaymentStatus as AppPaymentStatus, UtmifyCustomer, UtmifyProduct, UtmifyTrackingParameters } from '@/types'; 
import { CheckCircleIcon, DocumentDuplicateIcon, MOCK_WEBHOOK_URL, PLATFORM_NAME } from '../constants.tsx'; 
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

export const ThankYouPage: React.FC = () => {
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

  useEffect(() => {
    document.title = "Obrigado!";
  }, []);


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
      phone: saleDetails.customer.whatsapp || null, // Use WhatsApp as phone
      document: null, // Not collected
      ip: saleDetails.customer.ip,
    };

    const utmifyProducts: UtmifyProduct[] = saleDetails.products.map(item => ({
      id: item.productId,
      name: item.name,
      quantity: item.quantity,
      priceInCents: item.priceInCents,
      planId: item.productId, // Use product ID as planId
      planName: item.name, // Use product name as planName
    }));
    
    const utmifyTrackingParams: UtmifyTrackingParameters = {
        utm_source: saleDetails.trackingParameters?.utm_source || null,
        utm_medium: saleDetails.trackingParameters?.utm_medium || null,
        utm_campaign: saleDetails.trackingParameters?.utm_campaign || null,
        utm_term: saleDetails.trackingParameters?.utm_term || null,
        utm_content: saleDetails.trackingParameters?.utm_content || null,
    };

    const payload: UtmifyOrderPayload = {
      orderId: saleDetails.pushInPayTransactionId, // Use pushInPayTransactionId as orderId for consistency with 'awaiting_payment'
      platform: PLATFORM_NAME,
      paymentMethod: saleDetails.paymentMethod as "pix" | "credit_card" | "boleto",
      status: saleDetails.status, // Should be 'paid'
      createdAt: saleDetails.createdAt,
      approvedDate: saleDetails.paidAt || new Date().toISOString(), // Ensure approvedDate is set
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
      // 1. Fetch da venda principal
      const fetchedSale = await salesService.getSaleById(mainSaleTransactionId, null);
      if (!fetchedSale) {
        setError("Detalhes do pedido principal não encontrados.");
        setIsLoading(false);
        return;
      }
      setMainSaleDetails(fetchedSale);

      // 2. Disparar evento de conversão
      const saleProducts = Array.isArray(fetchedSale.products) ? fetchedSale.products : [];
      const saleCurrency = fetchedSale.commission?.currency || 'BRL';
      triggerConversionEvent(fetchedSale.id, fetchedSale.totalAmountInCents, saleCurrency, saleProducts);

      // 3. Fetch das configurações do usuário (dono do produto)
      if (fetchedSale.platformUserId) {
        const settings = await settingsService.getAppSettingsByUserId(fetchedSale.platformUserId, null);
        setAppSettings(settings); 
      }
      
      // 4. Buscar detalhes de TODOS os produtos comprados para obter as URLs de entrega
      if (saleProducts.length > 0) {
        const productDetailsPromises = saleProducts.map(item => 
          productService.getProductById(item.productId, null)
        );
        const productsResults = await Promise.all(productDetailsPromises);
        const validProducts = productsResults.filter((p): p is Product => p !== undefined);
        setPurchasedProducts(validProducts);
      }
      
      // Send 'approved' to UTMify if sale is paid
      if (fetchedSale.status === AppPaymentStatus.PAID && fetchedSale.platformUserId) {
        await sendApprovedPaymentToUtmify(fetchedSale, fetchedSale.platformUserId);
      }

      // 5. Lógica de Upsell (continua a mesma)
      if (originalProductIdFromUrl) {
        const fetchedOrigProduct = await productService.getProductById(originalProductIdFromUrl, null);
        setOriginalProductDetails(fetchedOrigProduct || null);
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
      }
    } catch (err) {
      setError("Falha ao buscar detalhes do pedido ou produto original.");
      console.error(err);
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

      console.log("ThankYouPage: Invocando 'gerar-pix' para upsell com payload:", upsellPixPayload, "para productOwnerUserId:", mainSaleDetails.platformUserId);
      const { data: pixFunctionResponse, error: functionError } = await supabase.functions.invoke<PushInPayPixResponse>('gerar-pix', {
          body: {
              payload: upsellPixPayload,
              productOwnerUserId: mainSaleDetails.platformUserId
          }
      });
      console.log("ThankYouPage: Response from 'gerar-pix' for upsell:", pixFunctionResponse);
      console.error("ThankYouPage: Error from 'gerar-pix' for upsell (if any):", functionError);

      if (functionError) {
        let errorMessage = "Falha ao gerar PIX para oferta adicional.";
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
        setUpsellPixData(pixFunctionResponse.data);
        // TODO: Consider sending an 'awaiting_payment' event for this upsell to UTMify if needed.
        // This would involve creating a new UtmifyOrderPayload specifically for the upsell transaction.
      } else {
        throw new Error(pixFunctionResponse?.message || "A resposta da função não continha os dados do PIX para o upsell.");
      }

    } catch (paymentError: any) {
        console.error("Upsell PIX Payment Error:", paymentError);
        setUpsellErrorMessage(paymentError.message || "Erro desconhecido ao processar oferta adicional.");
    } finally {
        setIsProcessingUpsell(false);
    }
  };
  
  const handleDeclineUpsell = () => {
    setShowUpsellModal(false);
    setUpsellPixData(null);
  };

  const copyUpsellPixCode = () => {
    if (upsellPixData?.qr_code) {
        navigator.clipboard.writeText(upsellPixData.qr_code).then(() => {
            setCopySuccessUpsell(true);
            setTimeout(() => setCopySuccessUpsell(false), 2000);
        });
    }
  };

  const primaryColorForPage = originalProductDetails?.checkoutCustomization?.primaryColor || appSettings?.checkoutIdentity?.brandColor || '#0D9488';
  const ctaTextColorForPage = getContrastingTextColor(primaryColorForPage);


  if (isLoading) {
    return <div className="flex justify-center items-center h-screen text-[var(--checkout-color-text-muted)]"><p>Carregando...</p></div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--checkout-color-bg-main)] p-6 text-center checkout-light-theme" style={{ '--checkout-color-primary-DEFAULT': primaryColorForPage, '--checkout-color-primary-cta-text': ctaTextColorForPage } as React.CSSProperties}>
        <Card className="max-w-md w-full shadow-xl card-checkout-specific">
          <h1 className="text-2xl font-bold text-red-600 mb-3">Erro no Pedido</h1>
          <p className="text-[var(--checkout-color-text-default)] mb-6">{error}</p>
          <Button onClick={() => navigate('/')} className="button-checkout-specific primary">Voltar para Home</Button>
        </Card>
      </div>
    );
  }

  if (!mainSaleDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--checkout-color-bg-main)] p-6 text-center checkout-light-theme" style={{ '--checkout-color-primary-DEFAULT': primaryColorForPage, '--checkout-color-primary-cta-text': ctaTextColorForPage } as React.CSSProperties}>
        <Card className="max-w-md w-full shadow-xl card-checkout-specific">
          <h1 className="text-2xl font-bold text-[var(--checkout-color-text-strong)] mb-3">Pedido Não Encontrado</h1>
          <p className="text-[var(--checkout-color-text-default)] mb-6">Não conseguimos encontrar os detalhes do seu pedido. Verifique o link ou tente novamente.</p>
          <Button onClick={() => navigate('/')} className="button-checkout-specific primary">Voltar para Home</Button>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[var(--checkout-color-bg-main)] flex flex-col items-center justify-center p-4 md:p-6 checkout-light-theme" style={{ '--checkout-color-primary-DEFAULT': primaryColorForPage, '--checkout-color-primary-cta-text': ctaTextColorForPage } as React.CSSProperties}>
      <Card className="max-w-lg w-full shadow-2xl border border-green-300 card-checkout-specific">
        <div className="text-center">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-[var(--checkout-color-text-strong)] mb-3">Obrigado pela sua compra!</h1>
          <p className="text-[var(--checkout-color-text-default)] mb-2">
            Seu pedido <span className="font-semibold text-[var(--checkout-color-primary-DEFAULT)]">#{(mainSaleDetails.pushInPayTransactionId || 'INVÁLIDO').substring(0, 12)}...</span> foi confirmado.
          </p>
          <p className="text-[var(--checkout-color-text-muted)] mb-6">
            Enviamos um e-mail para <span className="font-semibold text-[var(--checkout-color-text-default)]">{mainSaleDetails.customer.email}</span> com os detalhes do seu pedido e instruções de acesso.
          </p>

          {/* Resumo da Compra */}
          <div className="bg-[var(--checkout-color-bg-main)] p-4 rounded-md border border-[var(--checkout-color-border-subtle)] mb-6">
            <h3 className="font-semibold text-[var(--checkout-color-text-strong)] mb-2">Resumo da Compra:</h3>
            <ul className="text-sm text-[var(--checkout-color-text-muted)] space-y-1">
              {mainSaleDetails.products.map((item, index) => (
                <li key={index} className="flex justify-between">
                  <span className="text-[var(--checkout-color-text-default)]">{item.name} (x{item.quantity}) {item.isOrderBump ? <span className="text-xs text-green-600">(Oferta Adicional)</span> : item.isUpsell ? <span className="text-xs text-green-600">(Oferta Pós-Compra)</span>: ""}</span>
                  <span className="text-[var(--checkout-color-text-default)]">{formatCurrency(item.priceInCents)}</span>
                </li>
              ))}
               {mainSaleDetails.discountAppliedInCents && mainSaleDetails.discountAppliedInCents > 0 && (
                <li className="flex justify-between text-red-600 border-t border-dashed border-red-200 pt-1 mt-1">
                  <span>Desconto ({mainSaleDetails.couponCodeUsed})</span>
                  <span>-{formatCurrency(mainSaleDetails.discountAppliedInCents)}</span>
                </li>
              )}
              <li className="flex justify-between font-bold text-[var(--checkout-color-text-strong)] border-t border-[var(--checkout-color-border-subtle)] pt-1 mt-1">
                <span>Total:</span>
                <span>{formatCurrency(mainSaleDetails.totalAmountInCents)}</span>
              </li>
            </ul>
          </div>

          {/* Acesso aos Produtos */}
          <div className="space-y-3">
            <h3 className="font-semibold text-[var(--checkout-color-text-strong)] text-center">Acesse seus produtos:</h3>
            {purchasedProducts.length > 0 ? (
              purchasedProducts.map(product => {
                // Find the corresponding item in saleDetails.products to check if it's an upsell/orderbump for naming
                const saleItem = mainSaleDetails.products.find(p => p.productId === product.id);
                let productNameDisplay = product.name;
                if (saleItem?.isOrderBump) productNameDisplay += " (Oferta Adicional)";
                if (saleItem?.isUpsell) productNameDisplay += " (Oferta Pós-Compra)";

                return product.deliveryUrl ? (
                  <a key={product.id} href={product.deliveryUrl} target="_blank" rel="noopener noreferrer">
                    <Button 
                      style={{ backgroundColor: primaryColorForPage, color: ctaTextColorForPage }}
                      className="button-checkout-specific primary w-full text-lg py-3">
                        Acessar: {productNameDisplay}
                    </Button>
                  </a>
                ) : (
                  <div key={product.id} className="text-center p-3 bg-[var(--checkout-color-bg-main)] border border-[var(--checkout-color-border-subtle)] rounded-md">
                    <p className="font-semibold text-[var(--checkout-color-text-strong)]">{productNameDisplay}</p>
                    <p className="text-xs text-[var(--checkout-color-text-muted)]">O acesso a este produto será enviado por e-mail.</p>
                  </div>
                )
              })
            ) : (
               <p className="text-sm text-center text-[var(--checkout-color-text-muted)]">Processando links de acesso...</p>
            )}
          </div>
        </div>
      </Card>
      
      {upsellOffer && upsellProductPrice !== null && (
        <Modal isOpen={showUpsellModal} onClose={handleDeclineUpsell} title="Uma Oferta Especial Para Você!" size="lg" theme="light">
            {upsellPixData ? (
                <div className="space-y-3 text-center">
                     <h3 className="text-xl font-semibold" style={{color: 'var(--checkout-color-primary-DEFAULT)'}}>Pague com PIX para adicionar!</h3>
                     <img src={`data:image/png;base64,${upsellPixData.qr_code_base64}`} alt="PIX QR Code para Upsell" className="mx-auto w-48 h-48 rounded-md border-2 p-1 bg-white" style={{borderColor: 'var(--checkout-color-primary-DEFAULT)'}}/>
                      <p className="text-sm text-[var(--checkout-color-text-muted)] mb-1 text-center">
                        Escaneie o QR Code ou clique no botão abaixo para copiar o código.
                      </p>
                       <Input 
                          name="upsellPixCode" 
                          readOnly 
                          value={upsellPixData.qr_code} 
                          className="input-checkout-specific text-xs text-center text-[var(--checkout-color-text-strong)] mb-3"
                       />
                      <Button 
                          type="button" 
                          onClick={copyUpsellPixCode} 
                          className={`w-full mb-2 ${copySuccessUpsell ? 'bg-status-success text-white' : 'button-checkout-specific primary'}`}
                          style={!copySuccessUpsell ? { backgroundColor: primaryColorForPage, color: ctaTextColorForPage } : {}}
                          disabled={isProcessingUpsell}
                      >
                          {copySuccessUpsell ? (
                              <>
                                  <CheckCircleIcon className="h-5 w-5 mr-2"/> Copiado!
                              </>
                          ) : (
                              <>
                                  <DocumentDuplicateIcon className="h-5 w-5 mr-2"/> Copiar Código PIX
                              </>
                          )}
                      </Button>
                     <p className="text-sm text-[var(--checkout-color-text-muted)]">Após o pagamento, você receberá acesso à esta oferta adicional.</p>
                     <Button 
                        variant="ghost"
                        onClick={handleDeclineUpsell} 
                        className="w-full mt-2 py-3 text-md bg-[var(--checkout-color-bg-main)] text-[var(--checkout-color-text-default)] border border-[var(--checkout-color-border-subtle)] hover:bg-[var(--checkout-color-border-subtle)] focus:ring-2 focus:ring-offset-2 focus:ring-[var(--checkout-color-primary-DEFAULT)]"
                        disabled={isProcessingUpsell}
                      >
                        Não, obrigado (Fechar)
                      </Button>
                </div>
            ) : (
                <>
                    <div className="text-center">
                        {upsellOffer.imageUrl && <img src={upsellOffer.imageUrl} alt={upsellOffer.name} className="max-h-48 mx-auto mb-3 rounded-md shadow-md" />}
                        <h3 className="text-xl font-semibold text-[var(--checkout-color-text-strong)] mb-1">{upsellOffer.name}</h3>
                        <p className="text-[var(--checkout-color-text-default)] mb-3">{upsellOffer.description}</p>
                        <p className="text-2xl font-bold text-[var(--checkout-color-primary-DEFAULT)] mb-4">Por apenas: {formatCurrency(upsellProductPrice)}</p>
                    </div>
                    {upsellErrorMessage && <p className="text-sm text-red-500 p-2 bg-red-100 border border-red-200 rounded-md my-2">{upsellErrorMessage}</p>}
                    <div className="flex flex-col sm:flex-row justify-center gap-3 mt-4">
                        <Button 
                            onClick={handleAcceptUpsell} 
                            disabled={isProcessingUpsell}
                            style={{ backgroundColor: primaryColorForPage, color: ctaTextColorForPage }}
                            className="button-checkout-specific primary flex-1 py-3 text-md animate-pulse-subtle"
                        >
                            {isProcessingUpsell ? "Processando..." : "Sim, quero esta oferta!"}
                        </Button>
                        <Button 
                            variant="ghost"
                            onClick={handleDeclineUpsell} 
                            disabled={isProcessingUpsell} 
                            className="flex-1 py-3 text-md bg-[var(--checkout-color-bg-main)] text-[var(--checkout-color-text-default)] border border-[var(--checkout-color-border-subtle)] hover:bg-[var(--checkout-color-border-subtle)] focus:ring-2 focus:ring-offset-2 focus:ring-[var(--checkout-color-primary-DEFAULT)]"
                        >
                            Não, obrigado
                        </Button>
                    </div>
                </>
            )}
        </Modal>
      )}
    </div>
  );
};