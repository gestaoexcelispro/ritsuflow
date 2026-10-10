-- ============================================================
-- RITSUFLOW
-- TENANT USER PROFILE VISIBILITY
-- ============================================================
--
-- Purpose:
-- Allow an authenticated user to:
--
--   1. Always read their own profile.
--
--   2. Read another user's profile only when the caller has
--      administration.users_manage permission in an organization
--      to which the target user belongs.
--
-- This preserves tenant isolation.
-- It does NOT expose every RitsuFlow user profile globally.
-- ============================================================


-- ============================================================
-- PRIVATE AUTHORIZATION HELPER
-- ============================================================

create or replace function private.rbac_can_read_user_profile(
    target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$

    select
        auth.uid() is not null

        and (

            -- -------------------------------------------------
            -- A user can always read their own profile.
            -- -------------------------------------------------

            target_user_id = auth.uid()

            or

            -- -------------------------------------------------
            -- Authorized organization administrators/managers
            -- may read profiles belonging to users in an
            -- organization they are authorized to manage.
            -- -------------------------------------------------

            exists (

                select 1

                from public.organization_members target_membership

                where
                    target_membership.user_id =
                        target_user_id

                    and target_membership.status in (
                        'active',
                        'invited'
                    )

                    and private.rbac_has_permission(
                        target_membership.organization_id,
                        'administration.users_manage'
                    )
            )
        );

$function$;


-- ============================================================
-- USER_PROFILES SELECT POLICY
-- ============================================================

drop policy if exists
    "Users can read own profile"
on public.user_profiles;


drop policy if exists
    "Authorized organization managers can read user profiles"
on public.user_profiles;


create policy
    "Authorized organization managers can read user profiles"

on public.user_profiles

for select

to authenticated

using (
    private.rbac_can_read_user_profile(
        user_id
    )
);
