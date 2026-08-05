-- MIGRAÇÃO: APARÊNCIA AVANÇADA DA LOJA
-- Pode ser executada com segurança em um projeto que já possui a tabela public.stores.

alter table public.stores
  add column if not exists cover_type text not null default 'image',
  add column if not exists cover_video_url text,
  add column if not exists appearance_settings jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.stores
    add constraint stores_cover_type_check
    check (cover_type in ('image','video','gradient'));
exception when duplicate_object then null;
end $$;

-- Validação básica: appearance_settings deve ser um objeto JSON.
do $$ begin
  alter table public.stores
    add constraint stores_appearance_settings_object_check
    check (jsonb_typeof(appearance_settings) = 'object');
exception when duplicate_object then null;
end $$;

-- O mesmo bucket passa a aceitar imagens e vídeos de capa de até 50 MB.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'store-media',
  'store-media',
  true,
  52428800,
  array['image/png','image/jpeg','image/webp','video/mp4','video/webm']
)
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- Mantém as políticas existentes. Recria apenas se não existirem.
drop policy if exists store_media_public_read on storage.objects;
create policy store_media_public_read on storage.objects
for select to public using(bucket_id='store-media');

drop policy if exists store_media_insert_own on storage.objects;
create policy store_media_insert_own on storage.objects
for insert to authenticated
with check(bucket_id='store-media' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists store_media_update_own on storage.objects;
create policy store_media_update_own on storage.objects
for update to authenticated
using(bucket_id='store-media' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='store-media' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists store_media_delete_own on storage.objects;
create policy store_media_delete_own on storage.objects
for delete to authenticated
using(bucket_id='store-media' and (storage.foldername(name))[1]=auth.uid()::text);
