# RitsuFlow i18n Test Matrix

For every migrated surface, test all three supported organization locales.

| Test | en-US | pt-BR | es |
| --- | --- | --- | --- |
| Initial load uses organization locale | Required | Required | Required |
| Refresh preserves locale | Required | Required | Required |
| Navigation preserves locale | Required | Required | Required |
| Titles and descriptions translated | Required | Required | Required |
| Buttons and navigation translated | Required | Required | Required |
| Loading / empty states translated | Required | Required | Required |
| Controlled validation / errors translated | Required | Required | Required |
| Missing key falls back to English | Required | Required | Required |
| Currency remains independent | Required | Required | Required |
| Timezone remains independent | Required | Required | Required |
| Units remain independent | Required | Required | Required |
| Date-format setting remains independent | Required | Required | Required |

The final platform-wide pass must also audit production routes and shared components for remaining hard-coded user-facing English strings.
