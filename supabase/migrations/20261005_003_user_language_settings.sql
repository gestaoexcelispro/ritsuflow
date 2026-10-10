-- App-wide language settings (English US, Spanish, Portuguese Brazil).
--
-- 1) Each user's own display settings live on their profile. Null means "not chosen":
--    language then falls back to the company default, then to the browser.
-- 2) organizations.default_locale is the single company language setting.
--    Settings > Company used to write organizations.default_language ('en' | 'pt-BR' | 'es'),
--    so its value is copied over once. default_language is kept, unused, until a later cleanup.

alter table public.profiles
  add column if not exists language text,
  add column if not exists number_format text,
  add column if not exists unit_system text;

alter table public.profiles drop constraint if exists profiles_language_check;
alter table public.profiles
  add constraint profiles_language_check
  check (language is null or language in ('en-US', 'es', 'pt-BR'));

alter table public.profiles drop constraint if exists profiles_number_format_check;
alter table public.profiles
  add constraint profiles_number_format_check
  check (number_format is null or number_format in ('en-US', 'pt-BR'));

alter table public.profiles drop constraint if exists profiles_unit_system_check;
alter table public.profiles
  add constraint profiles_unit_system_check
  check (unit_system is null or unit_system in ('metric', 'imperial'));

comment on column public.profiles.language is
  'User-selected RitsuFlow UI language. Null follows organizations.default_locale, then the browser.';
comment on column public.profiles.number_format is
  'User-selected number format. Null follows the UI language (Spanish and Portuguese use 1.234,56).';
comment on column public.profiles.unit_system is
  'User-selected unit system for display. Null means metric.';

-- Carry the value people actually set in Settings > Company into the canonical column.
update public.organizations
set default_locale = case default_language
  when 'en' then 'en-US'
  when 'en-US' then 'en-US'
  when 'pt-BR' then 'pt-BR'
  when 'es' then 'es'
  else default_locale
end
where default_language is not null;

comment on column public.organizations.default_language is
  'Deprecated: replaced by default_locale. Kept until a cleanup migration removes it.';
