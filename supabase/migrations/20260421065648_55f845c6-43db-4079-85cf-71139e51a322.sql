-- Fix function search_path
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tighten avatar listing: replace broad public select with per-user listing
drop policy if exists "Avatar images are publicly accessible" on storage.objects;

create policy "Avatars accessible by owner listing"
  on storage.objects for select
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);