/**
 * The whole schema, applied with `npm run db:push`.
 *
 * Every statement is CREATE IF NOT EXISTS, so pushing repeatedly is safe. What
 * it will not do is alter a table that already exists, so adding a column to a
 * live database needs an ALTER by hand rather than an edit here.
 */
export const SCHEMA = `
create table if not exists users (
  id            text primary key,
  email         text not null check (length(trim(email)) between 3 and 254),
  -- What you are called on the sheet, and the other thing you can sign in
  -- with. Stored as typed so it can be displayed that way, matched without
  -- case so nobody has to remember which capitals they used.
  username      text not null check (length(trim(username)) between 3 and 24),
  password_hash text not null,
  -- What the browser extension sends instead of a password. One per user,
  -- regenerable, so a leaked token can be cut off without a password reset.
  api_token     text not null,
  created_at    text not null
);

-- Case insensitive, so nobody signs up twice with different capitalisation.
create unique index if not exists users_email_key on users (email collate nocase);
create unique index if not exists users_username_key on users (username collate nocase);
create unique index if not exists users_api_token_key on users (api_token);

-- Failed sign in and sign up attempts, so the lock can slow down under a
-- guessing run. A table rather than memory on purpose: this runs serverless,
-- so nothing in one function instance is visible to the next, and a counter
-- held in a module variable would reset every cold start.
create table if not exists auth_attempts (
  id     text primary key,
  -- Who is being counted. Either "id:<what was typed>" or "ip:<address>" or
  -- "signup:<address>", so one account under attack and one address hammering
  -- many accounts are throttled separately.
  bucket text not null,
  -- Epoch milliseconds. An integer rather than the text timestamps everything
  -- else uses, because this column is only ever compared, never displayed.
  at     integer not null
);

create index if not exists auth_attempts_bucket_idx on auth_attempts (bucket, at);

create table if not exists folders (
  id         text primary key,
  user_id    text not null references users (id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 60),
  created_at text not null
);

-- One folder name per person, not one globally.
create unique index if not exists folders_user_name_key on folders (user_id, name collate nocase);
create index if not exists folders_user_idx on folders (user_id);

create table if not exists bookmarks (
  id             text primary key,
  user_id        text not null references users (id) on delete cascade,
  url            text not null check (length(url) between 1 and 4000),
  title          text not null default '' check (length(title) <= 500),
  favicon_url    text,
  screenshot_url text,
  -- A JSON array of strings, "[]" when empty. SQLite has no array column, and
  -- json_each() gives real containment queries instead of LIKE guessing.
  tags           text not null default '[]',
  notes          text not null default '' check (length(notes) <= 10000),
  folder_id      text references folders (id) on delete set null,
  starred        integer not null default 0 check (starred in (0, 1)),
  created_at     text not null,
  updated_at     text not null
);

-- Re-capturing merges rather than duplicating, per person. Two people saving
-- the same page each get their own row, which is the point.
create unique index if not exists bookmarks_user_url_key on bookmarks (user_id, url);

create index if not exists bookmarks_user_folder_idx on bookmarks (user_id, folder_id);

-- One index per sort the sheet offers, each carrying the id tiebreak that
-- keeps paging stable when rows share a sort key.
create index if not exists bookmarks_user_created_idx on bookmarks (user_id, created_at desc, id);
create index if not exists bookmarks_user_updated_idx on bookmarks (user_id, updated_at desc, id);
create index if not exists bookmarks_user_title_idx on bookmarks (user_id, title, id);
`
