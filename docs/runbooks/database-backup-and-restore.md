# Database backup and restore (R8)

RitsuFlow's Supabase project is on the **free plan**, which has **no automatic backups** in Supabase. Until the
project moves to a paid plan, GitHub keeps the backups.

## What runs

| Workflow | When | What it does |
|---|---|---|
| **Nightly database backup** (`.github/workflows/backup.yml`) | Every night at 03:00 (São Paulo), or on demand | Saves `roles.sql`, `schema.sql` and `data.sql` (every row, including sign-in accounts), **encrypted** with your passphrase, as an artifact kept **30 days** |
| **Restore database backup** (`.github/workflows/restore.yml`) | Only by hand | Restores one of those backups into the database in `SUPABASE_RESTORE_DB_URL` |

**Not included:** files in Supabase Storage (uploaded PDF sheets, photos). The backup has their records, not the files.

**Why encrypted:** the repository is public, and the artifacts of a public repository can be downloaded by anyone
signed in to GitHub. Only the encrypted file `ritsuflow-db.tar.gz.gpg` is uploaded; without the passphrase it is
unreadable. To open one by hand: `gpg -d ritsuflow-db.tar.gz.gpg > ritsuflow-db.tar.gz` (asks for the passphrase),
then unzip it.

## One-time setup

1. Supabase › your project › **Connect** › **Session pooler**: copy the connection string and put the database
   password in place of `[YOUR-PASSWORD]` (reset it under Database › Settings if you don't have it).
2. GitHub › repository › **Settings › Secrets and variables › Actions › New repository secret**, twice:
   - `SUPABASE_DB_URL` = the connection string from step 1
   - `BACKUP_PASSPHRASE` = a long passphrase (16+ characters) only you know. **Keep a copy outside GitHub**
     (e.g. your password manager): GitHub never shows a secret again, and without it no backup can be opened.
3. GitHub › **Actions › Nightly database backup › Run workflow** to take the first backup now.
   A green run with an artifact named `ritsuflow-db-…` means it works.

## Check the backups (once a week)

Actions › Nightly database backup: the last run is green and has an artifact. A red run sends GitHub's usual
failure e-mail to the repository owner. The run log shows how many tables and table copies it saved.

## Restore

Never restore straight over production. Restore into a new project first, check it, then decide.

1. Create a **new, empty** Supabase project (same region, us-west-2).
2. Copy its Session pooler connection string (with password) into a repository secret named
   `SUPABASE_RESTORE_DB_URL`.
3. Actions › Nightly database backup › open the run you want › copy the **run id** (the number at the end of the
   page address).
4. Actions › **Restore database backup › Run workflow** › paste the run id › type `RESTORE` › Run.
5. Open the new project and check the data (projects, users, plans).
6. Then either point the app at the new project (Vercel environment variables `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), or — deliberately — set
   `SUPABASE_RESTORE_DB_URL` to an emptied production database and run the restore again.

If the restore stops on a `supabase_admin` or `cli_login_postgres` permission error, see Supabase's guide
"Backup and Restore using the CLI" (troubleshooting) — those lines can be commented out of the files.

## Later

Moving to the Supabase Pro plan adds 7 days of automatic daily backups with one-click restore; the GitHub
backup can stay as a second copy outside Supabase.
