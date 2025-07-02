
import { supabase } from '@/supabaseClient';
import { Database } from '@/types/supabase';
import { Buyer } from '@/types';

type BuyerInsert = Database['public']['Tables']['buyers']['Insert'];
type BuyerRow = Database['public']['Tables']['buyers']['Row'];

const fromSupabaseBuyerRow = (row: BuyerRow): Buyer => ({
    id: row.id,
    session_id: row.session_id || undefined,
    auth_user_id: row.auth_user_id || undefined,
    email: row.email || undefined,
    name: row.name || undefined,
    whatsapp: row.whatsapp || undefined,
    created_at: row.created_at || undefined,
    updated_at: row.updated_at || undefined,
});


export const buyerService = {
    createBuyer: async (buyerData: {
        id: string; 
        sessionId?: string;
        authUserId?: string;
        email?: string;
        name?: string;
        whatsapp?: string;
    }): Promise<Buyer> => {
        const logPrefix = `[buyerService.createBuyer(id: ${buyerData.id.substring(0,8)})]`;
        console.log(`${logPrefix} Attempting to create buyer.`);

        const newBuyerRecord: BuyerInsert = {
            id: buyerData.id,
            session_id: buyerData.sessionId,
            auth_user_id: buyerData.authUserId,
            email: buyerData.email,
            name: buyerData.name,
            whatsapp: buyerData.whatsapp,
            // created_at and updated_at will be set by default by Supabase or trigger
        };
        console.log(`${logPrefix} Payload for insert:`, newBuyerRecord);


        const { data, error } = await supabase
            .from('buyers')
            .insert(newBuyerRecord)
            .select()
            .single<BuyerRow>();

        if (error) {
            console.error(`${logPrefix} Supabase createBuyer error:`, error);
            throw new Error(error.message || 'Falha ao criar comprador.');
        }
        if (!data) {
            console.error(`${logPrefix} Falha ao criar comprador, dados não retornados.`);
            throw new Error('Falha ao criar comprador, dados não retornados.');
        }
        console.log(`${logPrefix} Buyer created successfully:`, data);
        return fromSupabaseBuyerRow(data);
    },
};
