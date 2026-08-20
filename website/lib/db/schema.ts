/**
 * The whole schema, applied with CREATE TABLE IF NOT EXISTS so opening the
 * database for the first time is the migration. There is no separate
 * migrations directory, there is one file and one user.
 */
export const SCHEMA = `
create table if not exists folders (
  id         text primary key,
  name       text not null check (length(trim(name)) between 1 and 60),
  created_at text not null
);

-- One folder name, case insensitive, same rule the old Postgres unique index had.
create unique index if not exists folders_name_key on folders (name collate nocase);

create table if not exists bookmarks (
  id             text primary key,
  url            text not null check (length(url) between 1 and 4000),
  title          text not null default '' check (length(title) <= 500),
  favicon_url    text,
  screenshot_url text,
  -- A JSON array of strings, "[]" when empty. SQLite has no array column, and
  -- json_each() below gives real containment queries instead of LIKE guessing.
  tags           text not null default '[]',
  notes          text not null default '' check (length(notes) <= 10000),
  folder_id      text references folders (id) on delete set null,
  starred        integer not null default 0 check (starred in (0, 1)),
  created_at     text not null,
  updated_at     text not null
);

create unique index if not exists bookmarks_url_key on bookmarks (url);
create index if not exists bookmarks_folder_idx on bookmarks (folder_id);
create index if not exists bookmarks_created_idx on bookmarks (created_at desc, id);
create index if not exists bookmarks_updated_idx on bookmarks (updated_at desc, id);
create index if not exists bookmarks_title_idx on bookmarks (title, id);
`
