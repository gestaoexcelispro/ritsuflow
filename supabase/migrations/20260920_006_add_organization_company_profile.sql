begin;

alter table public.organizations
  add column if not exists legal_name text,
  add column if not exists tax_id text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists address_line text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists state_region text,
  add column if not exists postal_code text,
  add column if not exists country_code text default 'BR',
  add column if not exists default_currency text not null default 'BRL',
  add column if not exists timezone text not null default 'America/Sao_Paulo',
  add column if not exists unit_system text not null default 'metric'
    check (unit_system in ('metric','imperial')),
  add column if not exists logo_url text;

commit;
