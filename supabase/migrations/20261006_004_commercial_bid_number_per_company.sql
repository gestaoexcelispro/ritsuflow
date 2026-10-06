-- Commercial: bid numbers per company (BID-0001, BID-0002, … for each company) instead of one
-- sequence shared by every company on the platform.
--   * commercial_bids.organization_id: the bid's company, copied from its project by a trigger;
--   * commercial_bid_counters: last number used by each company (row lock = no duplicates under
--     concurrent inserts);
--   * the number is unique per company, not across the platform.
-- Existing bids keep their numbers; each company's counter starts after its highest BID-nnnn.

-- 1. Company on the bid
alter table public.commercial_bids add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
update public.commercial_bids b set organization_id = p.organization_id
  from public.projects p where p.id = b.project_id and b.organization_id is distinct from p.organization_id;
alter table public.commercial_bids alter column organization_id set not null;

-- 2. Counters (only the trigger below writes them; no direct access for app users)
create table if not exists public.commercial_bid_counters (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  last_number integer not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now()
);
alter table public.commercial_bid_counters enable row level security;
revoke all on public.commercial_bid_counters from anon, authenticated;

insert into public.commercial_bid_counters (organization_id, last_number)
select b.organization_id, max(substring(b.bid_number from '^BID-(\d+)$')::integer)
  from public.commercial_bids b
 where b.bid_number ~ '^BID-\d+$'
 group by b.organization_id
on conflict (organization_id) do update set last_number = greatest(public.commercial_bid_counters.last_number, excluded.last_number);

-- 3. Unique per company
alter table public.commercial_bids alter column bid_number drop default;
alter table public.commercial_bids drop constraint if exists commercial_bids_bid_number_key;
create unique index if not exists commercial_bids_org_number_key on public.commercial_bids (organization_id, bid_number);

-- 4. Trigger: company from the project; next number on insert when none is given
create or replace function private.commercial_bid_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_next integer;
begin
  select p.organization_id into v_org from public.projects p where p.id = new.project_id;
  if v_org is null then
    raise exception 'Bid project % has no company', new.project_id using errcode = '23502';
  end if;
  new.organization_id := v_org;

  if tg_op = 'INSERT' and coalesce(btrim(new.bid_number), '') = '' then
    insert into public.commercial_bid_counters as c (organization_id, last_number)
    values (v_org, 1)
    on conflict (organization_id) do update set last_number = c.last_number + 1, updated_at = now()
    returning c.last_number into v_next;
    new.bid_number := 'BID-' || lpad(v_next::text, 4, '0');
  elsif tg_op = 'UPDATE' and new.bid_number is distinct from old.bid_number then
    raise exception 'The bid number cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.commercial_bid_number() from public, anon, authenticated;

drop trigger if exists commercial_bids_number on public.commercial_bids;
create trigger commercial_bids_number before insert or update of project_id, organization_id, bid_number on public.commercial_bids
  for each row execute function private.commercial_bid_number();

-- 5. The shared sequence is no longer used
drop sequence if exists public.commercial_bid_number_seq;
