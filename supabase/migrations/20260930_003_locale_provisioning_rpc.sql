-- Locale-aware provisioning is deployed in Supabase with backward compatibility.
-- The existing 9-argument RPC remains available and defaults to en-US.
-- The 10-argument RPC accepts target_default_locale and validates it against:
-- en-US, pt-BR, es.
--
-- This migration marker keeps the repository history aligned with the deployed
-- schema change. The complete function body is managed by the platform schema
-- migration applied on 2026-09-30.

comment on function public.provision_platform_organization(text,text,uuid,text,integer,text,date,date,text[],text) is
  'Platform-owner tenant provisioning with an explicit organization default locale.';
