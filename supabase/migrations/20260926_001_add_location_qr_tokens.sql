-- Canonical FieldOp location QR identity.
-- Prepared on the feature branch only. Do not apply to production until the feature is approved.

alter table public.locations
  add column if not exists qr_token uuid;

create unique index if not exists locations_qr_token_key
  on public.locations (qr_token)
  where qr_token is not null;

comment on column public.locations.qr_token is
  'Stable opaque token used by physical FieldOp QR codes to resolve a canonical production location. The QR identifies place only; it does not encode worker, activity, quantity, or production transaction data.';
