-- Commercial: why a bid was lost or declined, as a fixed list (for Insights). Additive only.
alter table public.commercial_bids
  add column if not exists outcome_reason text
    check (outcome_reason is null or outcome_reason in ('price', 'scope', 'deadline', 'relationship', 'competitor', 'technical', 'cancelled', 'capacity', 'other'));

create index if not exists commercial_bids_outcome_reason_idx on public.commercial_bids (outcome_reason) where outcome_reason is not null;
