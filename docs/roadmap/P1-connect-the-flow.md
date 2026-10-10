# P1 · Connect the flow (12–23 Oct 2026)

**Gate 1:** one project runs from bid to PPC through the screens, with no SQL typed by hand.

| # | Item | What changed | Database |
|---|---|---|---|
| R1 | Constraints write rule | Constraint policies used a `write` permission that does not exist; they now use `constraints.edit` / `constraints.view` | `20261012_001` |
| R2 | Create Lookahead from baseline | **New from baseline** button + empty-state action on the Lookahead page; **Save** pulls packages that now fall in the window | `20261012_002` |
| R3 | Master plan saves in place | One call (`save_master_plan_packages`) keeps package ids, so Lookahead, constraints, weekly items and production keep their links | `20261012_003` |
| R4 | Allocation activates FieldOp | Saving quantities by location creates / switches on the FieldOp activity | — |
| R5 | New company gets its licences | Ritsu Admin › Add organization picks workspaces and an active project limit; `provision_platform_company` writes the licence every check reads | `20261012_004` |
| R6 | Tasks rules | Asymmetric Side A waits for the carrier framing; rooms without a zone are "not allocated", not Exterior; faces only allow face / manual; predecessor lags hold the successor | — |
| R7 | CI | `.github/workflows/ci.yml` runs the platform map, language check and all tests on every PR | — |
| R8 | Production reset + backups | See below | — |
| R9 | End-to-end checklist | This page | — |

## 1. Run the SQL (Supabase › SQL Editor)

Run the four files in `supabase/migrations/` **in this order**, one at a time. Each is wrapped in `begin … commit`, so a failure changes nothing.

1. `20261012_001_constraints_write_rule.sql`
2. `20261012_002_create_lookahead_from_baseline.sql`
3. `20261012_003_master_plan_save_in_place.sql`
4. `20261012_004_provision_company_with_workspaces.sql`

Quick check afterwards:

```sql
select proname from pg_proc
where proname in ('refresh_lookahead_from_baseline', 'create_lookahead_plan_from_baseline',
                  'save_master_plan_packages', 'provision_platform_company');
-- expect 4 rows

select policyname, cmd from pg_policies where tablename = 'constraints';
-- expect constraints_project_select / insert / update / delete, no 'write' in their rules
```

## 2. End-to-end checklist (Gate 1)

Use a test company and one small project (2 rooms sharing one wall, one exterior wall is enough). Tick each line; note anything that needs SQL or a workaround — that is a Gate 1 failure.

| # | Workspace › screen | Do | Expect | ✓ |
|---|---|---|---|---|
| 1 | Ritsu Admin › Organizations | Add organization with Projects, PreCon, FieldOp, RitsuScope, Commercial | The new admin can open every chosen workspace after accepting the invite (R5) | |
| 2 | Commercial | New bid → estimate → issue → **Convert to project** | Project appears in Projects (stage contract) | |
| 3 | Projects › Locations | Floor 1 with Room 1 and Room 2 (and an Exterior area if you like) | Locations listed in flow order | |
| 4 | RitsuScope | Upload a sheet, set scale, draw the walls, zone Room 1 and Room 2, link zones to locations; Tasks › import scope | Framing in the carrier room; Side A / Side B boards each 100% in the room they face; outside face in Exterior (R6) | |
| 5 | RitsuScope › Tasks ⚙ on a board line | Open the rule list | Only *Face* and *Manual* offered (R6) | |
| 6 | Projects › Locations › Scope allocation | Fill from RitsuScope, **Save** | FieldOp › project › activities shows it **active** (R4) | |
| 7 | PreCon › Master plan | Build the plan, save the scenario; change a duration and save again | Saves without error both times (R3) | |
| 8 | PreCon › Master plan | **Freeze baseline** | Baseline badge | |
| 9 | PreCon › Lookahead | **New from baseline** (6 weeks from this Monday) | Notice "Lookahead created: N packages in M rows"; package rows in the sheet (R2) | |
| 10 | PreCon › Lookahead | Mark a Koskela cell blocked → **Send to Constraints** | Constraint created, no permission error (R1) | |
| 11 | PreCon › Constraints | Create a manual constraint, edit it, close it | All three save (R1) | |
| 12 | PreCon › Master plan | Unfreeze, change something, save, freeze again | Saves; Lookahead still opens with its items (R3) | |
| 13 | PreCon › Lookahead | Move the window one week, **Save** | "N new packages came in from the baseline" when the window reaches new ones (R2) | |
| 14 | PreCon › Weekly plan | Create the week from the Lookahead, commit items | Items committed | |
| 15 | PreCon › Weekly plan | Record results (done / not done + reason), close the week | **PPC** shown | |
| 16 | FieldOp | Open the project; daily report / QR for an activity | The allocated activity is available | |

## 3. R8 · Production reset and backups

- On 10 Oct 2026 at 17:40 production held **0 projects**. *Waiting for Eduardo's answer: was this reset on purpose?*
- The Supabase project is on the **free plan: no automatic backups**. Decision (10 Oct): **option C** before the
  trial — a nightly, encrypted backup through GitHub Actions, kept 30 days, with a manual restore workflow.
  See [database backup and restore](../runbooks/database-backup-and-restore.md).
