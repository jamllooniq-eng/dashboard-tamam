-- =============================================================================
-- تمام شوب - إعداد قاعدة البيانات (Supabase)
-- الصق هذا الملف كاملاً في: Supabase > SQL Editor > New query ثم اضغط Run
-- آمن للتشغيل أكثر من مرة.
-- =============================================================================

-- 1) المنتجات اليدوية (تضاف من لوحة التحكم /admin)
create table if not exists public.manual_products (
  id           bigint generated always as identity primary key,
  title        text        not null check (char_length(title) between 2 and 200),
  price        numeric     not null check (price > 0),
  description  text,
  images       jsonb       not null default '[]'::jsonb,
  sheet_target text        not null default 'other' check (sheet_target in ('rolemall', 'other')),
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists manual_products_active_idx
  on public.manual_products (is_active, created_at desc);

-- 2) نسخة احتياطية من منتجات رولمول (تُحدَّث تلقائياً، تُعرض إذا توقف رولمول)
create table if not exists public.cache_entries (
  key        text        primary key,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

-- 3) الحماية: تفعيل RLS بدون أي صلاحيات عامة.
--    يعني لا أحد يقرأ أو يكتب من المتصفح؛ فقط سيرفر الموقع بالمفتاح السري.
alter table public.manual_products enable row level security;
alter table public.cache_entries   enable row level security;

-- 4) مخزن صور المنتجات (قراءة عامة حتى تظهر الصور بالمتجر، والرفع من السيرفر فقط)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
