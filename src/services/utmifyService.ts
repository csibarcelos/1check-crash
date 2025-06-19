
import { Product, UtmifyOrderPayload, UtmifyResponse } from '@/types';
// import { UTMIFY_API_BASE } from '../constants.tsx'; // No longer used
import { supabase } from '@/supabaseClient'; // Import Supabase client

const buildUtmifiedUrl = (product: Product, checkoutUrl: string): string => {
  console.log("UTMIFY SERVICE (URL Builder): Chamado para o produto:", product.name);
  console.log("UTMIFY SERVICE (URL Builder): URL de Checkout Original:", checkoutUrl);

  if (!product.utmParams) {
    return checkoutUrl;
  }

  try {
    const url = new URL(checkoutUrl);

    if (product.utmParams.source) {
      url.searchParams.set('utm_source', product.utmParams.source);
    }
    if (product.utmParams.medium) {
      url.searchParams.set('utm_medium', product.utmParams.medium);
    }
    if (product.utmParams.campaign) {
      url.searchParams.set('utm_campaign', product.utmParams.campaign);
    }
    if (product.utmParams.term) {
      url.searchParams.set('utm_term', product.utmParams.term);
    }
    if (product.utmParams.content) {
      url.searchParams.set('utm_content', product.utmParams.content);
    }
    
    const utmified = url.toString();
    console.log("UTMIFY SERVICE (URL Builder): URL com UTMs:", utmified);
    return utmified;

  } catch (error) {
    console.error("UTMIFY SERVICE (URL Builder): Erro ao construir URL com UTMs. Retornando original.", error);
    return checkoutUrl; 
  }
};

const sendOrderDataToUtmify = async (
  payload: UtmifyOrderPayload, 
  productOwnerUserId: string,
  _apiTokenFromFrontend?: string // No longer used directly to call UTMify API
): Promise<UtmifyResponse> => {
  console.log("[utmifyService.sendOrderDataToUtmify] Invocando Edge Function 'send-utmify-event' para productOwner:", productOwnerUserId, "Payload:", payload);

  try {
    const { data, error } = await supabase.functions.invoke('send-utmify-event', {
      body: { 
        payload, 
        productOwnerUserId 
      },
    });

    if (error) {
      console.error("[utmifyService.sendOrderDataToUtmify] Erro da Edge Function:", error);
      throw new Error(error.message || "Erro ao invocar a função 'send-utmify-event'.");
    }

    console.log("[utmifyService.sendOrderDataToUtmify] Resposta da Edge Function:", data);
    // Assuming the Edge Function returns a structure compatible with UtmifyResponse
    // or a structure that indicates success/failure of its own operation.
    if (data && typeof data.success === 'boolean') {
        return data as UtmifyResponse; // If Edge Function returns { success: boolean, message?: string, data?: any }
    } else {
        // If Edge Function returns UTMify's direct response, it should already be UtmifyResponse
        // For now, let's assume a simple success/failure from the Edge Function itself
        console.warn("[utmifyService.sendOrderDataToUtmify] Resposta inesperada da Edge Function:", data);
        return { success: false, message: "Resposta inesperada da função de envio para UTMify."};
    }

  } catch (error: any) {
    console.error("[utmifyService.sendOrderDataToUtmify] Exceção ao chamar Edge Function:", error);
    return {
      success: false,
      message: error.message || "Falha ao comunicar com o serviço de envio para UTMify.",
    };
  }
};

export const utmifyService = {
  buildUtmifiedUrl,
  sendOrderDataToUtmify,
};
