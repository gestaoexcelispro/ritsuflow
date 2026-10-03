alter table public.organizations
  add column if not exists default_locale text not null default 'en-US';

alter table public.organizations
  drop constraint if exists organizations_default_locale_check;

alter table public.organizations
  add constraint organizations_default_locale_check
  check (default_locale in ('en-US', 'pt-BR', 'es'));

comment on column public.organizations.default_locale is
  'Organization-selected RitsuFlow UI locale. Independent from country, timezone, currency and measurement system.';
