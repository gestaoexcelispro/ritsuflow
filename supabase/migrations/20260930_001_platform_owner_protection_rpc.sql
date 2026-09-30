-- ============================================================
-- RITSUFLOW
-- PLATFORM OWNER PROTECTION RPC
-- ============================================================
-- Keeps private.platform_users inaccessible through PostgREST
-- while exposing only the boolean protection check required by
-- organization Users & Access server routes.
-- ============================================================

create or replace function public.is_protected_platform_owner(
    target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
    select exists (
        select 1
        from private.platform_users pu
        where pu.user_id = target_user_id
          and pu.platform_role = 'platform_owner'
          and pu.status = 'active'
    );
$function$;

revoke all
on function public.is_protected_platform_owner(uuid)
from public;

grant execute
on function public.is_protected_platform_owner(uuid)
to authenticated;
