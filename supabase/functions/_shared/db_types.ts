
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          variables?: Json
          operationName?: string
          query?: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      abandoned_carts: {
        Row: {
          created_at: string
          customer_email: string
          customer_name: string | null
          customer_whatsapp: string
          date: string
          id: string
          last_interaction_at: string
          platform_user_id: string
          potential_value_in_cents: number
          product_id: string
          product_name: string
          recovery_email_sent_at: string | null
          session_id: string | null
          status: string
          tracking_parameters: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_name?: string | null
          customer_whatsapp: string
          date?: string
          id?: string
          last_interaction_at?: string
          platform_user_id: string
          potential_value_in_cents: number
          product_id: string
          product_name: string
          recovery_email_sent_at?: string | null
          session_id?: string | null
          status: string
          tracking_parameters?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_name?: string | null
          customer_whatsapp?: string
          date?: string
          id?: string
          last_interaction_at?: string
          platform_user_id?: string
          potential_value_in_cents?: number
          product_id?: string
          product_name?: string
          recovery_email_sent_at?: string | null
          session_id?: string | null
          status?: string
          tracking_parameters?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_carts_platform_user_id_fkey"
            columns: ["platform_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abandoned_carts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          abandoned_cart_recovery_config: Json | null
          api_tokens: Json | null
          checkout_identity: Json | null
          checkout_identity_brand_color: string | null
          created_at: string
          custom_domain: string | null
          notification_settings: Json | null
          pix_generated_email_config: Json | null
          pix_recovery_config: Json | null
          pixel_integrations: Json | null
          platform_user_id: string
          smtp_settings: Json | null
          updated_at: string
          whatsapp_templates: Json | null
        }
        Insert: {
          abandoned_cart_recovery_config?: Json | null
          api_tokens?: Json | null
          checkout_identity?: Json | null
          checkout_identity_brand_color?: string | null
          created_at?: string
          custom_domain?: string | null
          notification_settings?: Json | null
          pix_generated_email_config?: Json | null
          pix_recovery_config?: Json | null
          pixel_integrations?: Json | null
          platform_user_id: string
          smtp_settings?: Json | null
          updated_at?: string
          whatsapp_templates?: Json | null
        }
        Update: {
          abandoned_cart_recovery_config?: Json | null
          api_tokens?: Json | null
          checkout_identity?: Json | null
          checkout_identity_brand_color?: string | null
          created_at?: string
          custom_domain?: string | null
          notification_settings?: Json | null
          pix_generated_email_config?: Json | null
          pix_recovery_config?: Json | null
          pixel_integrations?: Json | null
          platform_user_id?: string
          smtp_settings?: Json | null
          updated_at?: string
          whatsapp_templates?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_platform_user_id_fkey"
            columns: ["platform_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log_entries: {
        Row: {
          action_type: string
          actor_email: string
          actor_user_id: string
          description: string
          details: Json | null
          id: string
          target_entity_id: string | null
          target_entity_type: string | null
          timestamp: string
        }
        Insert: {
          action_type: string
          actor_email: string
          actor_user_id: string
          description: string
          details?: Json | null
          id?: string
          target_entity_id?: string | null
          target_entity_type?: string | null
          timestamp?: string
        }
        Update: {
          action_type?: string
          actor_email?: string
          actor_user_id?: string
          description?: string
          details?: Json | null
          id?: string
          target_entity_id?: string | null
          target_entity_type?: string | null
          timestamp?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          actor_email: string
          actor_user_id: string
          description: string
          details: Json | null
          id: string
          target_entity_id: string | null
          target_entity_type: string | null
          timestamp: string
        }
        Insert: {
          action_type: string
          actor_email: string
          actor_user_id: string
          description: string
          details?: Json | null
          id?: string
          target_entity_id?: string | null
          target_entity_type?: string | null
          timestamp?: string
        }
        Update: {
          action_type?: string
          actor_email?: string
          actor_user_id?: string
          description?: string
          details?: Json | null
          id?: string
          target_entity_id?: string | null
          target_entity_type?: string | null
          timestamp?: string
        }
        Relationships: []
      }
      buyers: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          session_id: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          session_id?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          session_id?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          email: string
          first_purchase_date: string | null
          funnel_stage: string
          id: string
          last_purchase_date: string | null
          name: string
          platform_user_id: string
          products_purchased: string[] | null
          sale_ids: string[] | null
          total_orders: number
          total_spent_in_cents: number
          updated_at: string
          whatsapp: string
        }
        Insert: {
          created_at?: string
          email: string
          first_purchase_date?: string | null
          funnel_stage: string
          id: string
          last_purchase_date?: string | null
          name: string
          platform_user_id: string
          products_purchased?: string[] | null
          sale_ids?: string[] | null
          total_orders?: number
          total_spent_in_cents?: number
          updated_at?: string
          whatsapp: string
        }
        Update: {
          created_at?: string
          email?: string
          first_purchase_date?: string | null
          funnel_stage?: string
          id?: string
          last_purchase_date?: string | null
          name?: string
          platform_user_id?: string
          products_purchased?: string[] | null
          sale_ids?: string[] | null
          total_orders?: number
          total_spent_in_cents?: number
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_platform_user_id_fkey"
            columns: ["platform_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string
          id: string
          platform_account_id_push_in_pay: string
          platform_account_id_pushinpay: string | null
          platform_commission_percentage: number
          platform_fixed_fee_in_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform_account_id_push_in_pay?: string
          platform_account_id_pushinpay?: string | null
          platform_commission_percentage: number
          platform_fixed_fee_in_cents: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          platform_account_id_push_in_pay?: string
          platform_account_id_pushinpay?: string | null
          platform_commission_percentage?: number
          platform_fixed_fee_in_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          abandonment_rate: number | null
          checkout_customization: Json
          checkout_views: number | null
          clicks: number | null
          conversion_rate: number | null
          coupons: Json | null
          created_at: string
          delivery_url: string | null
          description: string
          id: string
          image_url: string | null
          name: string
          order_bump: Json | null
          order_bumps: Json | null
          platform_user_id: string
          post_purchase_email_config: Json | null
          price_in_cents: number
          product_image_url: string | null
          slug: string
          total_sales: number | null
          updated_at: string
          upsell: Json | null
          utm_params: Json | null
          whatsapp_templates: Json | null
        }
        Insert: {
          abandonment_rate?: number | null
          checkout_customization?: Json
          checkout_views?: number | null
          clicks?: number | null
          conversion_rate?: number | null
          coupons?: Json | null
          created_at?: string
          delivery_url?: string | null
          description: string
          id?: string
          image_url?: string | null
          name: string
          order_bump?: Json | null
          order_bumps?: Json | null
          platform_user_id: string
          post_purchase_email_config?: Json | null
          price_in_cents: number
          product_image_url?: string | null
          slug: string
          total_sales?: number | null
          updated_at?: string
          upsell?: Json | null
          utm_params?: Json | null
          whatsapp_templates?: Json | null
        }
        Update: {
          abandonment_rate?: number | null
          checkout_customization?: Json
          checkout_views?: number | null
          clicks?: number | null
          conversion_rate?: number | null
          coupons?: Json | null
          created_at?: string
          delivery_url?: string | null
          description?: string
          id?: string
          image_url?: string | null
          name?: string
          order_bump?: Json | null
          order_bumps?: Json | null
          platform_user_id?: string
          post_purchase_email_config?: Json | null
          price_in_cents?: number
          product_image_url?: string | null
          slug?: string
          total_sales?: number | null
          updated_at?: string
          upsell?: Json | null
          utm_params?: Json | null
          whatsapp_templates?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_super_admin: boolean
          name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_super_admin?: boolean
          name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_super_admin?: boolean
          name?: string | null
        }
        Relationships: []
      }
      sales: {
        Row: {
          buyer_id: string | null
          commission_currency: string | null
          commission_gateway_fee_in_cents: number | null
          commission_total_price_in_cents: number | null
          commission_user_commission_in_cents: number | null
          coupon_code_used: string | null
          created_at: string
          customer_email: string
          customer_ip: string | null
          customer_name: string
          customer_whatsapp: string
          discount_applied_in_cents: number | null
          id: string
          order_id_urmify: string | null
          original_amount_before_discount_in_cents: number
          paid_at: string | null
          payment_method: string
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          pix_recovery_emails_sent: Json | null
          platform_commission_in_cents: number | null
          platform_user_id: string
          products: Json
          push_in_pay_transaction_id: string | null
          status: string
          total_amount_in_cents: number
          tracking_parameters: Json | null
          updated_at: string
          upsell_amount_in_cents: number | null
          upsell_push_in_pay_transaction_id: string | null
          upsell_status: string | null
        }
        Insert: {
          buyer_id?: string | null
          commission_currency?: string | null
          commission_gateway_fee_in_cents?: number | null
          commission_total_price_in_cents?: number | null
          commission_user_commission_in_cents?: number | null
          coupon_code_used?: string | null
          created_at?: string
          customer_email: string
          customer_ip?: string | null
          customer_name: string
          customer_whatsapp: string
          discount_applied_in_cents?: number | null
          id?: string
          order_id_urmify?: string | null
          original_amount_before_discount_in_cents: number
          paid_at?: string | null
          payment_method: string
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          pix_recovery_emails_sent?: Json | null
          platform_commission_in_cents?: number | null
          platform_user_id: string
          products: Json
          push_in_pay_transaction_id?: string | null
          status: string
          total_amount_in_cents: number
          tracking_parameters?: Json | null
          updated_at?: string
          upsell_amount_in_cents?: number | null
          upsell_push_in_pay_transaction_id?: string | null
          upsell_status?: string | null
        }
        Update: {
          buyer_id?: string | null
          commission_currency?: string | null
          commission_gateway_fee_in_cents?: number | null
          commission_total_price_in_cents?: number | null
          commission_user_commission_in_cents?: number | null
          coupon_code_used?: string | null
          created_at?: string
          customer_email?: string
          customer_ip?: string | null
          customer_name?: string
          customer_whatsapp?: string
          discount_applied_in_cents?: number | null
          id?: string
          order_id_urmify?: string | null
          original_amount_before_discount_in_cents?: number
          paid_at?: string | null
          payment_method?: string
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          pix_recovery_emails_sent?: Json | null
          platform_commission_in_cents?: number | null
          platform_user_id?: string
          products?: Json
          push_in_pay_transaction_id?: string | null
          status?: string
          total_amount_in_cents?: number
          tracking_parameters?: Json | null
          updated_at?: string
          upsell_amount_in_cents?: number | null
          upsell_push_in_pay_transaction_id?: string | null
          upsell_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_platform_user_id_fkey"
            columns: ["platform_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_or_fetch_buyer: {
        Args: { p_session_id?: string }
        Returns: string
      }
      get_public_app_settings: {
        Args: { user_id_param: string }
        Returns: Json
      }
      is_current_user_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_current_user_the_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_super_admin: {
        Args: { user_id_to_check: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
