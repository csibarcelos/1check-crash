drop policy "Super Admins can delete all products" on "public"."products";

drop policy "Super Admins can insert any product" on "public"."products";

drop policy "Super Admins can read all products" on "public"."products";

drop policy "Super Admins can update all products" on "public"."products";

drop policy "Allow anonymous users to record abandoned carts" on "public"."abandoned_carts";

drop policy "Permitir inserção de carrinhos abandonados via checkout" on "public"."abandoned_carts";

drop policy "allow_insert_sales" on "public"."sales";

drop policy "allow_select_sales" on "public"."sales";

create table "public"."buyers" (
    "id" uuid not null default uuid_generate_v4(),
    "session_id" text,
    "auth_user_id" uuid,
    "email" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "name" text,
    "whatsapp" text
);


alter table "public"."buyers" enable row level security;

alter table "public"."abandoned_carts" add column "session_id" text;

alter table "public"."app_settings" add column "checkout_identity_brand_color" character varying(7);

alter table "public"."products" add column "utm_params" jsonb;

alter table "public"."sales" add column "buyer_id" uuid;

CREATE INDEX buyers_auth_user_id_idx ON public.buyers USING btree (auth_user_id);

CREATE UNIQUE INDEX buyers_pkey ON public.buyers USING btree (id);

CREATE INDEX buyers_session_id_idx ON public.buyers USING btree (session_id);

CREATE INDEX sales_buyer_id_idx ON public.sales USING btree (buyer_id);

alter table "public"."buyers" add constraint "buyers_pkey" PRIMARY KEY using index "buyers_pkey";

alter table "public"."buyers" add constraint "buyers_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."buyers" validate constraint "buyers_auth_user_id_fkey";

alter table "public"."buyers" add constraint "session_or_auth_check" CHECK ((((session_id IS NOT NULL) AND (auth_user_id IS NULL)) OR (auth_user_id IS NOT NULL))) not valid;

alter table "public"."buyers" validate constraint "session_or_auth_check";

alter table "public"."sales" add constraint "sales_buyer_id_fkey" FOREIGN KEY (buyer_id) REFERENCES buyers(id) not valid;

alter table "public"."sales" validate constraint "sales_buyer_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_or_fetch_buyer(p_session_id text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    buyer_id UUID;
    current_user_id UUID := auth.uid();
BEGIN
    -- Lógica para usuário AUTENTICADO
    IF current_user_id IS NOT NULL THEN
        -- Tenta encontrar o buyer pelo ID do usuário autenticado
        SELECT id INTO buyer_id FROM public.buyers WHERE auth_user_id = current_user_id;

        -- Se não encontrar, cria um novo buyer vinculado ao usuário autenticado
        IF NOT FOUND THEN
            INSERT INTO public.buyers (auth_user_id) VALUES (current_user_id) RETURNING id INTO buyer_id;
        END IF;

    -- Lógica para usuário ANÔNIMO
    ELSE
        -- Tenta encontrar o buyer pelo ID da sessão anônima
        SELECT id INTO buyer_id FROM public.buyers WHERE session_id = p_session_id;

        -- Se não encontrar, cria um novo buyer vinculado à sessão anônima
        IF NOT FOUND THEN
            INSERT INTO public.buyers (session_id) VALUES (p_session_id) RETURNING id INTO buyer_id;
        END IF;
    END IF;

    -- Retorna o ID do buyer (seja ele existente ou recém-criado)
    RETURN buyer_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_super_admin = true
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user_app_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.app_settings (platform_user_id, api_tokens, checkout_identity_brand_color, updated_at, created_at)
  VALUES (
    NEW.id,
    '{"pushinPay": "", "utmify": "", "pushinPayEnabled": false, "utmifyEnabled": false}',
    '#e0d288',
    now(),
    now()
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

grant delete on table "public"."buyers" to "anon";

grant insert on table "public"."buyers" to "anon";

grant references on table "public"."buyers" to "anon";

grant select on table "public"."buyers" to "anon";

grant trigger on table "public"."buyers" to "anon";

grant truncate on table "public"."buyers" to "anon";

grant update on table "public"."buyers" to "anon";

grant delete on table "public"."buyers" to "authenticated";

grant insert on table "public"."buyers" to "authenticated";

grant references on table "public"."buyers" to "authenticated";

grant select on table "public"."buyers" to "authenticated";

grant trigger on table "public"."buyers" to "authenticated";

grant truncate on table "public"."buyers" to "authenticated";

grant update on table "public"."buyers" to "authenticated";

grant delete on table "public"."buyers" to "service_role";

grant insert on table "public"."buyers" to "service_role";

grant references on table "public"."buyers" to "service_role";

grant select on table "public"."buyers" to "service_role";

grant trigger on table "public"."buyers" to "service_role";

grant truncate on table "public"."buyers" to "service_role";

grant update on table "public"."buyers" to "service_role";

create policy "Allow anonymous users to update their own abandoned carts"
on "public"."abandoned_carts"
as permissive
for update
to public
using (true)
with check (true);


create policy "Allow update abandoned carts"
on "public"."abandoned_carts"
as permissive
for update
to public
using (true)
with check (true);


create policy "Allow update by session"
on "public"."abandoned_carts"
as permissive
for update
to public
using ((session_id = ((current_setting('request.headers'::text, true))::json ->> 'x-session-id'::text)));


create policy "Allow users to update carts by session"
on "public"."abandoned_carts"
as permissive
for update
to public
using ((session_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'session_id'::text)));


create policy "Apenas proprietário pode modificar suas configurações"
on "public"."app_settings"
as permissive
for all
to authenticated
using ((auth.uid() = platform_user_id));


create policy "Configurações são públicas para leitura"
on "public"."app_settings"
as permissive
for select
to public
using (true);


create policy "Usuários podem gerenciar seus próprios registros de comprador"
on "public"."buyers"
as permissive
for all
to public
using (((auth_user_id = auth.uid()) OR ((session_id IS NOT NULL) AND (session_id = ((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'session_id'::text)))));


create policy "Super Admins full access"
on "public"."products"
as permissive
for all
to public
using (is_super_admin())
with check (is_super_admin());


create policy "Users can select their own sales"
on "public"."sales"
as permissive
for select
to public
using ((auth.uid() = platform_user_id));


create policy "Users can update status and paid_at for their own sales"
on "public"."sales"
as permissive
for update
to public
using ((auth.uid() = platform_user_id))
with check ((auth.uid() = platform_user_id));


create policy "Usuários podem gerenciar os pedidos vinculados ao seu buyer_id"
on "public"."sales"
as permissive
for all
to public
using ((buyer_id IN ( SELECT buyers.id
   FROM buyers)));


create policy "Allow anonymous users to record abandoned carts"
on "public"."abandoned_carts"
as permissive
for insert
to anon, authenticated, authenticator, dashboard_user, pgbouncer, postgres, service_role, supabase_admin, supabase_auth_admin, supabase_read_only_user, supabase_realtime_admin, supabase_replication_admin, supabase_storage_admin
with check (true);


create policy "Permitir inserção de carrinhos abandonados via checkout"
on "public"."abandoned_carts"
as permissive
for insert
to anon, authenticated
with check (true);


create policy "allow_insert_sales"
on "public"."sales"
as permissive
for insert
to anon, authenticated
with check (((products IS NOT NULL) AND (customer_email IS NOT NULL) AND (total_amount_in_cents > 0) AND (platform_user_id IS NOT NULL)));


create policy "allow_select_sales"
on "public"."sales"
as permissive
for select
to anon, authenticated
using (((platform_user_id = auth.uid()) OR ((auth.uid() IS NOT NULL) AND (customer_email = auth.email())) OR (auth.uid() IS NULL)));


CREATE TRIGGER update_buyers_updated_at BEFORE UPDATE ON public.buyers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


