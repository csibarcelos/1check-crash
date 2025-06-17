
import { UtmifyOrderPayload, UtmifyResponse } from '@/types'; 
// Removed: import { UTMIFY_API_BASE } from '../constants.tsx'; 

export const utmifyService = {
  sendOrderData: async (payload: UtmifyOrderPayload, utmifyToken?: string): Promise<UtmifyResponse> => {
    console.log("UTMifyService: sendOrderData called with payload:", payload, "token:", utmifyToken ? "******" : "NO TOKEN");

    if (!utmifyToken || utmifyToken.trim() === '') {
      const errorMessage = 'Token da API UTMify não fornecido ou inválido.';
      console.warn("UTMifyService Info:", errorMessage);
      return { success: false, message: errorMessage };
    }
    
    // const utmifyEndpoint = `${UTMIFY_API_BASE}/orders`; // This variable was unused

    await new Promise(resolve => setTimeout(resolve, 500)); 
    
    console.log('UTMifyService: Simulated sending data to UTMify.');
    return {
      success: true,
      message: 'Dados enviados para UTMify (simulação).',
      data: { utmifyTrackingId: `sim_utm_${Date.now()}` },
    };
  },
};
