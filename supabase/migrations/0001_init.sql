-- Bento initial schema
-- Tables, indexes, row level security and the screenshots storage bucket.

create extension if not exists "pgcrypto";
-- Trigram indexes are what make the dashboard's substring search fast.
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- folders
-- ---------------------------------------------------------------------------
create table if not exists public.folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

-- One folder name per user, case insensitive.
create unique index if not exists folders_user_name_key
  on public.folders (user_id, lower(name));

create index if not exists folders_user_id_idx on public.folders (user_id);

-- ---------------------------------------------------------------------------
-- bookmarks
-- ---------------------------------------------------------------------------
create table if not exists public.bookmarks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  url            text not null check (char_length(url) between 1 and 4000),
  title          text not null default '' check (char_length(title) <= 500),
  favicon_url    text,
  screenshot_url text,
  tags           text[] not null default '{}',
  notes          text not null default '' check (char_length(notes) <= 10000),
  folder_id      uuid references public.folders (id) on delete set null,
  starred        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists bookmarks_user_created_idx
  on public.bookmarks (user_id, created_at desc);

create index if not exists bookmarks_folder_idx
  on public.bookmarks (folder_id);

create index if not exists bookmarks_tags_idx
  on public.bookmarks using gin (tags);

-- The dashboard searches with case insensitive substring matches on these three
-- columns, so index them for trigram lookups rather than full text.
create index if not exists bookmarks_title_trgm_idx
  on public.bookmarks using gin (title gin_trgm_ops);

create index if not exists bookmarks_url_trgm_idx
  on public.bookmarks using gin (url gin_trgm_ops);

create index if not exists bookmarks_notes_trgm_idx
  on public.bookmarks using gin (notes gin_trgm_ops);

-- Keep one row per user per url so re-capturing a tab updates instead of duplicating.
create unique index if not exists bookmarks_user_url_key
  on public.bookmarks (user_id, url);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bookmarks_set_updated_at on public.bookmarks;
create trigger bookmarks_set_updated_at
  before update on public.bookmarks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.folders   enable row level security;
alter table public.bookmarks enable row level security;

drop policy if exists "folders are private to their owner" on public.folders;
create policy "folders are private to their owner"
  on public.folders
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "bookmarks are private to their owner" on public.bookmarks;
create policy "bookmarks are private to their owner"
  on public.bookmarks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A folder may only be referenced by its owner. RLS on bookmarks already limits
-- the row to the owner, this guards against pointing at somebody else's folder.
create or replace function public.folder_belongs_to_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.folder_id is not null then
    if not exists (
      select 1 from public.folders f
      where f.id = new.folder_id and f.user_id = new.user_id
    ) then
      raise exception 'folder_id % does not belong to user %', new.folder_id, new.user_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bookmarks_check_folder on public.bookmarks;
create trigger bookmarks_check_folder
  before insert or update of folder_id, user_id on public.bookmarks
  for each row execute function public.folder_belongs_to_user();

-- ---------------------------------------------------------------------------
-- Storage: screenshots
-- Objects are stored under "<user_id>/<bookmark-ish name>.jpg".
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screenshots', 'screenshots', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "screenshots are readable by anyone" on storage.objects;
create policy "screenshots are readable by anyone"
  on storage.objects for select
  using (bucket_id = 'screenshots');

drop policy if exists "users write their own screenshots" on storage.objects;
create policy "users write their own screenshots"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users update their own screenshots" on storage.objects;
create policy "users update their own screenshots"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete their own screenshots" on storage.objects;
create policy "users delete their own screenshots"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
