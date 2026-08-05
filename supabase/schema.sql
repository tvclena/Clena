-- =========================================================
-- BASE DA DASHBOARD OTTO
-- Execute no SQL Editor do Supabase uma única vez.
-- =========================================================

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  store_name text not null default 'Minha loja',
  responsible_name text,
  whatsapp text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada usuário só pode visualizar o próprio perfil.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

-- Cada usuário só pode inserir o próprio perfil.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

-- Cada usuário só pode atualizar o próprio perfil.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Cada usuário só pode excluir o próprio perfil.
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
on public.profiles
for delete
to authenticated
using (auth.uid() = id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Cria automaticamente o perfil após o cadastro no Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    store_name,
    responsible_name
  )
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'store_name'), ''), 'Minha loja'),
    nullif(trim(new.raw_user_meta_data ->> 'responsible_name'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Bucket público apenas para exibição dos avatares.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-avatars',
  'store-avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública das imagens do bucket.
drop policy if exists "store_avatars_public_read" on storage.objects;
create policy "store_avatars_public_read"
on storage.objects
for select
to public
using (bucket_id = 'store-avatars');

-- Usuário autenticado envia somente para a própria pasta: UID/arquivo.ext
drop policy if exists "store_avatars_insert_own" on storage.objects;
create policy "store_avatars_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'store-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Usuário atualiza somente arquivos da própria pasta.
drop policy if exists "store_avatars_update_own" on storage.objects;
create policy "store_avatars_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'store-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'store-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Usuário exclui somente arquivos da própria pasta.
drop policy if exists "store_avatars_delete_own" on storage.objects;
create policy "store_avatars_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'store-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
