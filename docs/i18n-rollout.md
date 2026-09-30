# RitsuFlow Internationalization Rollout

Supported locales: `en-US`, `pt-BR`, `es`.

## Platform rule
Every user-facing string in RitsuFlow must resolve through the shared internationalization layer. Organization language is sourced from `organizations.default_locale` and must remain independent from country, currency, timezone, date format and unit system.

## Fallback
English (`en-US`) is the canonical fallback locale.

## Migration order
1. Shared locale resolver and application shell
2. Settings and all Settings subpages
3. Workspaces, dashboard and projects
4. Project Setup and Location Structure
5. PreCon / Pre-Planning
6. Master Plan
7. Lookahead / Make Ready / Constraints
8. Weekly Planning / PPC / Pull Planning
9. FieldOp / Daily Reports / Workforce
10. RitsuCAD and Reports
11. Platform/commercial administration
12. Repository-wide hard-coded UI string audit

## Definition of done for a surface
- Titles, labels, buttons, descriptions and navigation are translated.
- Modals, empty states, loading states, validation and error messages are translated where controlled by the UI.
- Locale survives navigation and refresh.
- No language is inferred from geography or regional settings.
- Construction and project-controls terminology is reviewed for meaning, not translated mechanically.
