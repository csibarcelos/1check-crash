

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_public_app_settings"("user_id_param" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Esta função busca as configurações de um usuário específico.
  -- A correção principal está aqui: usamos 'platform_user_id' em vez de 'user_id'.
  RETURN (
    SELECT json_build_object(
      'pushinPayEnabled', (api_tokens->>'pushinPayEnabled')::boolean
      -- Nunca exponha os tokens aqui.
    )
    FROM public.app_settings
    WHERE platform_user_id = user_id_param -- <-- CORREÇÃO APLICADA AQUI
  );
END;
$$;


ALTER FUNCTION "public"."get_public_app_settings"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
    -- Function logic here
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_app_settings"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.app_settings (platform_user_id, api_tokens, checkout_identity_brand_color, updated_at, created_at)
  values (
    new.id,
    '{"pushinPay": "", "utmify": "", "pushinPayEnabled": false, "utmifyEnabled": false}',
    '#FDE047', -- Cor padrão (amarelo)
    now(),
    now()
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user_app_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = TRUE
  );
$$;


ALTER FUNCTION "public"."is_current_user_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_the_super_admin"() RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    SET search_path = ''; -- Isso é bom para evitar ambiguidades
    RETURN EXISTS (
        SELECT 1
        FROM auth.users -- Consulta auth.users, o que é bom
        WHERE id = auth.uid() AND email = 'usedonjuan@gmail.com'
    );
END;
$$;


ALTER FUNCTION "public"."is_current_user_the_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"("user_id_to_check" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_email_from_auth text;
BEGIN
  -- Busca o email do usuário diretamente da tabela auth.users
  SELECT au.email INTO user_email_from_auth
  FROM auth.users au
  WHERE au.id = user_id_to_check;

  -- Compara com o email do super admin definido
  -- Certifique-se de que 'usedonjuan@gmail.com' é o email correto do seu super admin.
  RETURN user_email_from_auth = 'usedonjuan@gmail.com';
END;
$$;


ALTER FUNCTION "public"."is_super_admin"("user_id_to_check" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."abandoned_carts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "platform_user_id" "uuid" NOT NULL,
    "customer_name" "text",
    "customer_email" "text" NOT NULL,
    "customer_whatsapp" "text" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "product_name" "text" NOT NULL,
    "potential_value_in_cents" integer NOT NULL,
    "date" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "last_interaction_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tracking_parameters" "jsonb"
);


ALTER TABLE "public"."abandoned_carts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "platform_user_id" "uuid" NOT NULL,
    "custom_domain" "text",
    "checkout_identity" "jsonb",
    "smtp_settings" "jsonb",
    "api_tokens" "jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "pixel_integrations" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."app_settings"."pixel_integrations" IS 'Stores an array of pixel integration configurations';



CREATE TABLE IF NOT EXISTS "public"."audit_log_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "actor_email" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "target_entity_type" "text",
    "target_entity_id" "text",
    "description" "text" NOT NULL,
    "details" "jsonb"
);


ALTER TABLE "public"."audit_log_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_log_entries" IS 'Registros de auditoria para ações importantes na plataforma.';



COMMENT ON COLUMN "public"."audit_log_entries"."actor_user_id" IS 'ID do usuário que realizou a ação.';



COMMENT ON COLUMN "public"."audit_log_entries"."actor_email" IS 'Email do usuário no momento da ação (para referência rápida).';



COMMENT ON COLUMN "public"."audit_log_entries"."action_type" IS 'Tipo de ação realizada (ex: PLATFORM_SETTINGS_UPDATE, USER_STATUS_CHANGE).';



COMMENT ON COLUMN "public"."audit_log_entries"."target_entity_type" IS 'Tipo da entidade afetada (ex: user, product, platform_settings).';



COMMENT ON COLUMN "public"."audit_log_entries"."target_entity_id" IS 'ID da entidade afetada.';



COMMENT ON COLUMN "public"."audit_log_entries"."description" IS 'Descrição legível da ação.';



COMMENT ON COLUMN "public"."audit_log_entries"."details" IS 'Dados JSON adicionais sobre a ação (ex: valores antigos e novos).';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "actor_email" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "target_entity_type" "text",
    "target_entity_id" "text",
    "description" "text" NOT NULL,
    "details" "jsonb"
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "text" NOT NULL,
    "platform_user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "whatsapp" "text" NOT NULL,
    "products_purchased" "text"[],
    "funnel_stage" "text" NOT NULL,
    "first_purchase_date" timestamp with time zone,
    "last_purchase_date" timestamp with time zone,
    "total_orders" integer DEFAULT 0 NOT NULL,
    "total_spent_in_cents" integer DEFAULT 0 NOT NULL,
    "sale_ids" "text"[],
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "id" "text" DEFAULT 'global'::"text" NOT NULL,
    "platform_commission_percentage" double precision NOT NULL,
    "platform_fixed_fee_in_cents" integer NOT NULL,
    "platform_account_id_push_in_pay" "text" DEFAULT '9E4E58C6-88EF-47F4-BEEC-4C1BE3C502B9'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "platform_account_id_pushinpay" "text" DEFAULT ''::"text"
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."platform_settings"."platform_account_id_pushinpay" IS 'Armazena o ID da Conta PushInPay para recebimentos da plataforma';



CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "platform_user_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "price_in_cents" integer NOT NULL,
    "image_url" "text",
    "checkout_customization" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "delivery_url" "text",
    "total_sales" integer DEFAULT 0,
    "clicks" integer DEFAULT 0,
    "checkout_views" integer DEFAULT 0,
    "conversion_rate" double precision DEFAULT 0,
    "abandonment_rate" double precision DEFAULT 0,
    "order_bump" "jsonb",
    "upsell" "jsonb",
    "coupons" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."products"."platform_user_id" IS 'ID do usuário da plataforma (proprietário do produto)';



COMMENT ON COLUMN "public"."products"."slug" IS 'Identificador único para URL amigável';



COMMENT ON COLUMN "public"."products"."checkout_customization" IS 'Configurações de personalização do checkout';



COMMENT ON COLUMN "public"."products"."order_bump" IS 'Configuração da oferta de Order Bump';



COMMENT ON COLUMN "public"."products"."upsell" IS 'Configuração da oferta de Upsell';



COMMENT ON COLUMN "public"."products"."coupons" IS 'Lista de cupons associados ao produto';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "is_super_admin" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Perfis de usuários, complementando auth.users.';



COMMENT ON COLUMN "public"."profiles"."id" IS 'Referencia auth.users.id.';



CREATE TABLE IF NOT EXISTS "public"."sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "platform_user_id" "uuid" NOT NULL,
    "push_in_pay_transaction_id" "text" NOT NULL,
    "upsell_push_in_pay_transaction_id" "text",
    "order_id_urmify" "text",
    "products" "jsonb" NOT NULL,
    "customer_name" "text" NOT NULL,
    "customer_email" "text" NOT NULL,
    "customer_ip" "text",
    "customer_whatsapp" "text" NOT NULL,
    "payment_method" "text" NOT NULL,
    "status" "text" NOT NULL,
    "upsell_status" "text",
    "total_amount_in_cents" integer NOT NULL,
    "upsell_amount_in_cents" integer,
    "original_amount_before_discount_in_cents" integer NOT NULL,
    "discount_applied_in_cents" integer,
    "coupon_code_used" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "paid_at" timestamp with time zone,
    "tracking_parameters" "jsonb",
    "commission_total_price_in_cents" integer,
    "commission_gateway_fee_in_cents" integer,
    "commission_user_commission_in_cents" integer,
    "commission_currency" "text",
    "platform_commission_in_cents" integer,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."sales" OWNER TO "postgres";


ALTER TABLE ONLY "public"."abandoned_carts"
    ADD CONSTRAINT "abandoned_carts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("platform_user_id");



ALTER TABLE ONLY "public"."audit_log_entries"
    ADD CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "customers_email_platform_user_id_idx" ON "public"."customers" USING "btree" ("email", "platform_user_id");



CREATE INDEX "idx_abandoned_carts_platform_user_id" ON "public"."abandoned_carts" USING "btree" ("platform_user_id");



CREATE INDEX "idx_abandoned_carts_product_id" ON "public"."abandoned_carts" USING "btree" ("product_id");



CREATE INDEX "idx_audit_logs_actor_user_id" ON "public"."audit_logs" USING "btree" ("actor_user_id");



CREATE INDEX "idx_audit_logs_timestamp" ON "public"."audit_logs" USING "btree" ("timestamp");



CREATE INDEX "idx_customers_platform_user_id" ON "public"."customers" USING "btree" ("platform_user_id");



CREATE INDEX "idx_profiles_on_id" ON "public"."profiles" USING "btree" ("id");



CREATE INDEX "idx_sales_created_at" ON "public"."sales" USING "btree" ("created_at");



CREATE INDEX "idx_sales_platform_user_id" ON "public"."sales" USING "btree" ("platform_user_id");



CREATE OR REPLACE TRIGGER "handle_product_update" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "on_abandoned_carts_updated" BEFORE UPDATE ON "public"."abandoned_carts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_app_settings_updated" BEFORE UPDATE ON "public"."app_settings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_customers_updated" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_platform_settings_updated" BEFORE UPDATE ON "public"."platform_settings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_sales_updated" BEFORE UPDATE ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



ALTER TABLE ONLY "public"."abandoned_carts"
    ADD CONSTRAINT "abandoned_carts_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."abandoned_carts"
    ADD CONSTRAINT "abandoned_carts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_log_entries"
    ADD CONSTRAINT "audit_log_entries_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Allow Super Admins FULL ACCESS to all profiles" ON "public"."profiles" TO "authenticated" USING ("public"."is_current_user_super_admin"()) WITH CHECK ("public"."is_current_user_super_admin"());



CREATE POLICY "Allow anonymous read access to products" ON "public"."products" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous users to record abandoned carts" ON "public"."abandoned_carts" FOR INSERT TO "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "authenticator", "pgbouncer", "supabase_auth_admin", "supabase_storage_admin", "supabase_replication_admin", "supabase_read_only_user", "supabase_realtime_admin", "postgres" WITH CHECK (true);



CREATE POLICY "Allow authenticated read access to platform settings" ON "public"."platform_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to DELETE their own profile" ON "public"."profiles" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Allow authenticated users to INSERT their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Allow authenticated users to SELECT their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Allow authenticated users to UPDATE their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Allow public read access to platform settings" ON "public"."platform_settings" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can delete their own products" ON "public"."products" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "platform_user_id"));



CREATE POLICY "Authenticated users can insert their own products" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "platform_user_id"));



CREATE POLICY "Authenticated users can read their own products" ON "public"."products" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "platform_user_id"));



CREATE POLICY "Authenticated users can update their own products" ON "public"."products" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "platform_user_id")) WITH CHECK (("auth"."uid"() = "platform_user_id"));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."platform_settings" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Permitir Super Admin atualizar config da plataforma" ON "public"."platform_settings" FOR UPDATE TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) AND ("id" = 'global'::"text"))) WITH CHECK (("public"."is_super_admin"("auth"."uid"()) AND ("id" = 'global'::"text")));



CREATE POLICY "Permitir Super Admin ler config da plataforma" ON "public"."platform_settings" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"("auth"."uid"()) AND ("id" = 'global'::"text")));



CREATE POLICY "Permitir Super Admin ler logs de auditoria" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ("public"."is_super_admin"("auth"."uid"()));



CREATE POLICY "Permitir atualização dos próprios carrinhos abandonados" ON "public"."abandoned_carts" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "platform_user_id")) WITH CHECK (("auth"."uid"() = "platform_user_id"));



CREATE POLICY "Permitir inserção das configurações da plataforma por super" ON "public"."platform_settings" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_current_user_the_super_admin"() AND ("id" = 'global'::"text")));



CREATE POLICY "Permitir inserção de carrinhos abandonados via checkout" ON "public"."abandoned_carts" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Permitir inserção de clientes para o usuário logado" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "platform_user_id"));



CREATE POLICY "Permitir leitura das próprias vendas" ON "public"."sales" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "platform_user_id"));



CREATE POLICY "Permitir leitura dos próprios carrinhos abandonados" ON "public"."abandoned_carts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "platform_user_id"));



CREATE POLICY "Permitir leitura dos próprios clientes" ON "public"."customers" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "platform_user_id"));



CREATE POLICY "Proibir exclusão das configurações da plataforma" ON "public"."platform_settings" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "Public read access" ON "public"."platform_settings" FOR SELECT USING (true);



CREATE POLICY "Super Admins can delete all products" ON "public"."products" FOR DELETE TO "authenticated" USING ((( SELECT "profiles"."is_super_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = true));



CREATE POLICY "Super Admins can insert any product" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "profiles"."is_super_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = true));



CREATE POLICY "Super Admins can read all audit logs" ON "public"."audit_log_entries" FOR SELECT TO "authenticated" USING ((( SELECT "profiles"."is_super_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = true));



CREATE POLICY "Super Admins can read all products" ON "public"."products" FOR SELECT TO "authenticated" USING ((( SELECT "profiles"."is_super_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = true));



CREATE POLICY "Super Admins can update all products" ON "public"."products" FOR UPDATE TO "authenticated" USING ((( SELECT "profiles"."is_super_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = true)) WITH CHECK ((( SELECT "profiles"."is_super_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = true));



CREATE POLICY "Users can create their own app settings" ON "public"."app_settings" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "platform_user_id"));



CREATE POLICY "Users can delete their own app settings" ON "public"."app_settings" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "platform_user_id"));



CREATE POLICY "Users can read their own app settings" ON "public"."app_settings" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "platform_user_id"));



CREATE POLICY "Users can update their own app settings" ON "public"."app_settings" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "platform_user_id")) WITH CHECK (("auth"."uid"() = "platform_user_id"));



CREATE POLICY "Users can view their own abandoned carts" ON "public"."abandoned_carts" FOR SELECT USING (("auth"."uid"() = "platform_user_id"));



CREATE POLICY "Users can view their own sales" ON "public"."sales" FOR SELECT USING (("auth"."uid"() = "platform_user_id"));



ALTER TABLE "public"."abandoned_carts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "allow_insert_sales" ON "public"."sales" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("products" IS NOT NULL) AND ("customer_email" IS NOT NULL) AND ("total_amount_in_cents" > 0) AND ("platform_user_id" IS NOT NULL)));



CREATE POLICY "allow_select_sales" ON "public"."sales" FOR SELECT TO "authenticated", "anon" USING ((("platform_user_id" = "auth"."uid"()) OR (("auth"."uid"() IS NOT NULL) AND ("customer_email" = "auth"."email"())) OR ("auth"."uid"() IS NULL)));



ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "permitir delete carrinho abandonado" ON "public"."abandoned_carts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "platform_user_id"));



CREATE POLICY "permitir escrita configs app" ON "public"."app_settings" TO "authenticated" USING (("auth"."uid"() = "platform_user_id")) WITH CHECK (("auth"."uid"() = "platform_user_id"));



CREATE POLICY "permitir leitura configurações app" ON "public"."app_settings" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "platform_user_id"));



CREATE POLICY "permitir tudo de todos" ON "public"."abandoned_carts" USING (true) WITH CHECK (true);



ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."get_public_app_settings"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_app_settings"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_app_settings"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_app_settings"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_app_settings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_app_settings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_the_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_the_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_the_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"("user_id_to_check" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"("user_id_to_check" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"("user_id_to_check" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."abandoned_carts" TO "anon";
GRANT ALL ON TABLE "public"."abandoned_carts" TO "authenticated";
GRANT ALL ON TABLE "public"."abandoned_carts" TO "service_role";



GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log_entries" TO "anon";
GRANT ALL ON TABLE "public"."audit_log_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log_entries" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."sales" TO "anon";
GRANT ALL ON TABLE "public"."sales" TO "authenticated";
GRANT ALL ON TABLE "public"."sales" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
