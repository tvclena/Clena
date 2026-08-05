create extension if not exists pgcrypto;

create table if not exists public.scheduling_businesses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default '', business_type text not null default 'service', description text default '', whatsapp text default '', instagram text default '', phone text default '', email text default '', address text default '',
  primary_color text not null default '#2563eb', timezone text not null default 'America/Sao_Paulo', logo_url text default '', cover_url text default '',
  slot_interval integer not null default 15 check (slot_interval in (5,10,15,30,60)), min_notice_minutes integer not null default 60, max_advance_days integer not null default 60,
  buffer_minutes integer not null default 0, cancellation_hours integer not null default 24, max_per_customer_day integer not null default 0,
  auto_confirm boolean not null default true, waitlist_enabled boolean not null default false, reschedule_enabled boolean not null default true,
  manual_approval boolean not null default false, require_cpf boolean not null default false, require_terms boolean not null default false,
  cancellation_policy text default '', terms_text text default '', payment_mode text not null default 'none' check (payment_mode in ('none','full','percentage','fixed')),
  deposit_percentage numeric(5,2) not null default 30, deposit_fixed numeric(12,2) not null default 0, payment_deadline_minutes integer not null default 30,
  refund_policy text not null default 'manual', pay_pix boolean not null default true, pix_key text default '', pix_receiver text default '', pay_card_online boolean not null default false,
  pay_on_site boolean not null default true, require_receipt boolean not null default false, notify_confirmation boolean not null default true,
  notify_reminder boolean not null default true, reminder_hours integer not null default 24, notification_channel text not null default 'whatsapp',
  notify_payment boolean not null default true, notify_aftercare boolean not null default false, confirmation_message text default '', reminder_message text default '',
  slug text unique, is_published boolean not null default false, show_prices boolean not null default true, show_resources boolean not null default true,
  allow_any_resource boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.scheduling_services (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, description text default '', image_url text default '', duration_minutes integer not null default 60,
  price numeric(12,2) not null default 0, capacity integer not null default 1, location_type text not null default 'onsite',
  payment_mode text not null default 'inherit', deposit_value numeric(12,2) not null default 0, allow_resource_choice boolean not null default true,
  is_active boolean not null default true, sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.scheduling_resources (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  resource_type text not null default 'professional', name text not null, title text default '', description text default '', image_url text default '',
  capacity integer not null default 1, email text default '', phone text default '', notes text default '', is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.scheduling_service_resources (
  service_id uuid not null references public.scheduling_services(id) on delete cascade,
  resource_id uuid not null references public.scheduling_resources(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(service_id,resource_id)
);

create table if not exists public.scheduling_weekly_hours (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid references public.scheduling_resources(id) on delete cascade, weekday text not null,
  is_open boolean not null default true, start_time time, end_time time, break_start time, break_end time,
  created_at timestamptz not null default now()
);

create table if not exists public.scheduling_blocks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid references public.scheduling_resources(id) on delete cascade, title text default '', starts_at timestamptz not null, ends_at timestamptz not null,
  recurrence_rule text, created_at timestamptz not null default now(), check (ends_at > starts_at)
);

create table if not exists public.scheduling_customers (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, phone text default '', email text default '', cpf text default '', birth_date date, notes text default '', tags text[] not null default '{}',
  is_blocked boolean not null default false, total_appointments integer not null default 0, no_show_count integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.scheduling_appointments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.scheduling_customers(id) on delete set null, customer_name text default '', customer_phone text default '', customer_email text default '',
  service_id uuid not null references public.scheduling_services(id) on delete restrict, resource_id uuid references public.scheduling_resources(id) on delete set null,
  starts_at timestamptz not null, ends_at timestamptz not null, status text not null default 'pending' check(status in ('pending','confirmed','completed','cancelled','no_show')),
  payment_status text not null default 'not_required' check(payment_status in ('not_required','pending','partial','paid','refunded')),
  total_amount numeric(12,2) not null default 0, deposit_amount numeric(12,2) not null default 0, paid_amount numeric(12,2) not null default 0,
  payment_method text, payment_reference text, receipt_url text, notes text default '', cancellation_reason text default '',
  source text not null default 'public', confirmation_token uuid not null default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.scheduling_waitlist (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.scheduling_customers(id) on delete cascade, service_id uuid references public.scheduling_services(id) on delete cascade,
  resource_id uuid references public.scheduling_resources(id) on delete set null, desired_date date, preferred_start time, preferred_end time,
  status text not null default 'waiting', notes text default '', created_at timestamptz not null default now()
);

create table if not exists public.scheduling_notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid references public.scheduling_appointments(id) on delete cascade, channel text not null, notification_type text not null,
  scheduled_for timestamptz not null, sent_at timestamptz, status text not null default 'pending', payload jsonb not null default '{}', error_message text,
  created_at timestamptz not null default now()
);

create index if not exists scheduling_appointments_user_start_idx on public.scheduling_appointments(user_id,starts_at);
create index if not exists scheduling_appointments_resource_start_idx on public.scheduling_appointments(resource_id,starts_at);
create index if not exists scheduling_services_user_idx on public.scheduling_services(user_id,is_active);
create index if not exists scheduling_customers_user_phone_idx on public.scheduling_customers(user_id,phone);
create index if not exists scheduling_blocks_user_start_idx on public.scheduling_blocks(user_id,starts_at);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;

do $$ begin
  create trigger scheduling_businesses_updated before update on public.scheduling_businesses for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger scheduling_services_updated before update on public.scheduling_services for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger scheduling_resources_updated before update on public.scheduling_resources for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger scheduling_customers_updated before update on public.scheduling_customers for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger scheduling_appointments_updated before update on public.scheduling_appointments for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

alter table public.scheduling_businesses enable row level security;
alter table public.scheduling_services enable row level security;
alter table public.scheduling_resources enable row level security;
alter table public.scheduling_service_resources enable row level security;
alter table public.scheduling_weekly_hours enable row level security;
alter table public.scheduling_blocks enable row level security;
alter table public.scheduling_customers enable row level security;
alter table public.scheduling_appointments enable row level security;
alter table public.scheduling_waitlist enable row level security;
alter table public.scheduling_notifications enable row level security;

do $$ declare t text; begin
  foreach t in array array['scheduling_businesses','scheduling_services','scheduling_resources','scheduling_service_resources','scheduling_weekly_hours','scheduling_blocks','scheduling_customers','scheduling_appointments','scheduling_waitlist','scheduling_notifications'] loop
    execute format('drop policy if exists %I_owner_all on public.%I',t,t);
    execute format('create policy %I_owner_all on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',t,t);
  end loop;
end $$;

drop policy if exists scheduling_business_public_read on public.scheduling_businesses;
create policy scheduling_business_public_read on public.scheduling_businesses for select to anon using (is_published = true);
drop policy if exists scheduling_services_public_read on public.scheduling_services;
create policy scheduling_services_public_read on public.scheduling_services for select to anon using (is_active = true and exists(select 1 from public.scheduling_businesses b where b.user_id=scheduling_services.user_id and b.is_published=true));
drop policy if exists scheduling_resources_public_read on public.scheduling_resources;
create policy scheduling_resources_public_read on public.scheduling_resources for select to anon using (is_active = true and exists(select 1 from public.scheduling_businesses b where b.user_id=scheduling_resources.user_id and b.is_published=true));
drop policy if exists scheduling_hours_public_read on public.scheduling_weekly_hours;
create policy scheduling_hours_public_read on public.scheduling_weekly_hours for select to anon using (exists(select 1 from public.scheduling_businesses b where b.user_id=scheduling_weekly_hours.user_id and b.is_published=true));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('scheduling-media','scheduling-media',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880;

drop policy if exists scheduling_media_insert on storage.objects;
create policy scheduling_media_insert on storage.objects for insert to authenticated with check (bucket_id='scheduling-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists scheduling_media_update on storage.objects;
create policy scheduling_media_update on storage.objects for update to authenticated using (bucket_id='scheduling-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists scheduling_media_delete on storage.objects;
create policy scheduling_media_delete on storage.objects for delete to authenticated using (bucket_id='scheduling-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists scheduling_media_public_read on storage.objects;
create policy scheduling_media_public_read on storage.objects for select to public using (bucket_id='scheduling-media');
