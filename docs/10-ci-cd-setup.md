# CI/CD Setup

This document describes the CI/CD pipeline for deploying the backend to Fly.io, running database migrations, and building the mobile app with EAS.

## Overview

The CI/CD system consists of:

1. **GitHub Actions workflow** - Automated deployment pipeline
2. **Migration system** - Tracks and applies database migrations
3. **Helper scripts** - Local utilities for development

## GitHub Actions Workflow

The main deployment workflow is defined in [.github/workflows/deploy.yml](../.github/workflows/deploy.yml).

### Triggering the Workflow

The workflow is manually triggered via GitHub UI:

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Select **Deploy Backend & Build App** workflow
4. Click **Run workflow**
5. Choose which steps to run:
   - Run database migrations (default: yes)
   - Deploy backend to Fly.io (default: yes)
   - Trigger EAS development build (default: yes)

### Workflow Jobs

#### 1. Migrations Job

- Checks for pending database migrations
- Creates `schema_migrations` table if needed
- Runs only new migrations (skips already applied ones)
- Records each migration in the database

#### 2. Deploy Backend Job

- Runs after migrations complete
- Deploys Rust backend to Fly.io
- Verifies deployment by checking health endpoint
- Requires migrations to succeed (or be skipped)

#### 3. Build App Job

- Runs after backend deployment
- Switches API endpoint to production
- Triggers EAS development build
- Reverts API endpoint back to localhost
- Commits the revert (with `[skip ci]` to avoid loop)

#### 4. Summary Job

- Runs after all jobs complete
- Generates deployment summary
- Shows status of each step

### Required Secrets

Configure these secrets in your GitHub repository settings (**Settings** → **Secrets and variables** → **Actions**):

| Secret | Description | How to get |
|--------|-------------|------------|
| `SUPABASE_HOST` | Supabase database host | From Supabase project settings → Database → Host |
| `SUPABASE_DB_PASSWORD` | Database password | From Supabase project settings → Database → Password |
| `FLY_API_TOKEN` | Fly.io API token | Run `fly auth token` |
| `EXPO_TOKEN` | Expo authentication token | Run `eas login && eas whoami` then get from Expo dashboard |

## Migration System

### How It Works

The migration system uses a `schema_migrations` table to track applied migrations:

```sql
CREATE TABLE schema_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

When migrations run:
1. Lists all `.sql` files in `DB/migrations/`
2. Queries `schema_migrations` for already applied migrations
3. Runs only pending migrations in order
4. Records each migration after successful execution

### Creating a New Migration

1. Create a new SQL file in `DB/migrations/`:
   ```bash
   touch DB/migrations/022_your_migration_name.sql
   ```

2. Write your migration SQL:
   ```sql
   -- Example: Add a new column
   ALTER TABLE events ADD COLUMN new_field VARCHAR(255);

   -- Add indexes if needed
   CREATE INDEX idx_events_new_field ON events(new_field);
   ```

3. The migration will run automatically on next deployment, or run manually:
   ```bash
   ./DB/run-all-migrations.sh
   ```

### Running Migrations Locally

Use the provided script to run all pending migrations:

```bash
cd DB
./run-all-migrations.sh
```

This script:
- Loads `DATABASE_URL` from `rust_BE/.env`
- Uses Docker with PostgreSQL client
- Shows which migrations are pending/applied
- Provides colored output for status

**Prerequisites:**
- Docker installed and running
- `DATABASE_URL` in `rust_BE/.env`

### Running a Single Migration

To run a specific migration file:

```bash
cd DB
./run-migration.sh migrations/022_your_migration.sql
```

## Helper Scripts

### Switch API Endpoint

Switch the frontend API endpoint between production and localhost:

```bash
# Switch to production
node scripts/switch-endpoint.js production

# Switch to localhost
node scripts/switch-endpoint.js localhost

# Aliases also work
node scripts/switch-endpoint.js prod
node scripts/switch-endpoint.js local
```

The script modifies `pierre_two/app.json`:
- **Production**: `https://pierre-two-backend.fly.dev`
- **Localhost**: `http://172.20.10.5:3000`

**When to use:**
- Before testing with production backend
- Before creating a production build
- After testing (revert to localhost)

## Local Development Workflow

### 1. Making Backend Changes

```bash
# 1. Make your changes to Rust code
cd rust_BE
vim src/...

# 2. Test locally
cargo run

# 3. Commit and push
git add .
git commit -m "Your changes"
git push

# 4. Deploy via GitHub Actions
# Go to GitHub → Actions → Run workflow
```

### 2. Adding Database Migrations

```bash
# 1. Create migration file
touch DB/migrations/022_add_new_feature.sql

# 2. Write migration SQL
vim DB/migrations/022_add_new_feature.sql

# 3. Test locally
cd DB
./run-all-migrations.sh

# 4. Commit and push
git add .
git commit -m "Add migration for new feature"
git push

# 5. Migration runs automatically on next deployment
```

### 3. Building the App with Production Backend

```bash
# 1. Switch to production endpoint
node scripts/switch-endpoint.js production

# 2. Trigger build via GitHub Actions
# Or manually:
cd pierre_two
eas build --platform ios --profile development

# 3. Revert to localhost (for local testing)
node scripts/switch-endpoint.js localhost
```

## Deployment Checklist

Before triggering a deployment:

- [ ] All changes committed and pushed to main branch
- [ ] New migrations tested locally
- [ ] Backend compiles without errors (`cargo build`)
- [ ] GitHub secrets are configured
- [ ] Fly.io app is running (`flyctl status`)
- [ ] Supabase database is accessible

## Troubleshooting

### Migration Failed

**Problem:** Migration job fails in GitHub Actions

**Solution:**
1. Check the migration SQL syntax
2. Test locally: `./DB/run-all-migrations.sh`
3. Check Supabase logs in dashboard
4. Verify `schema_migrations` table exists
5. Manually fix database if needed, then re-run

### Backend Deployment Failed

**Problem:** Fly.io deployment fails

**Solution:**
1. Check Rust compilation: `cd rust_BE && cargo build --release`
2. Check Fly.io logs: `flyctl logs`
3. Verify all environment variables are set: `flyctl secrets list`
4. Check Dockerfile and fly.toml configuration

### EAS Build Failed

**Problem:** EAS build fails

**Solution:**
1. Check `EXPO_TOKEN` secret is valid
2. Verify `eas.json` configuration
3. Check Expo dashboard for build logs
4. Ensure app.json is valid JSON
5. Test locally: `eas build --platform ios --profile development --local`

### API Endpoint Not Reverting

**Problem:** app.json stays on production endpoint

**Solution:**
1. Manually revert: `node scripts/switch-endpoint.js localhost`
2. Commit and push the change
3. Check GitHub Actions permissions (needs write access)

### Schema Migrations Table Missing

**Problem:** Migrations can't find `schema_migrations` table

**Solution:**
1. Create manually:
   ```sql
   CREATE TABLE schema_migrations (
     id SERIAL PRIMARY KEY,
     migration_name VARCHAR(255) UNIQUE NOT NULL,
     applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```
2. Or run the workflow - it creates the table automatically

## Best Practices

1. **Always test migrations locally first** before pushing
2. **Make migrations reversible** when possible (document rollback steps)
3. **Use descriptive migration names** with date/number prefix
4. **Keep migrations small and focused** (one logical change per file)
5. **Don't modify applied migrations** (create a new migration instead)
6. **Test the full deployment flow** in a staging environment first
7. **Monitor deployments** - check logs after workflow completes
8. **Revert endpoint after testing** - don't commit production endpoint

## Advanced Usage

### Running Migrations in Production Only

If you want to run migrations manually without full deployment:

1. GitHub Actions → Run workflow
2. Uncheck "Deploy backend" and "Build app"
3. Keep only "Run migrations" checked

### Deploying Without Migrations

If you only changed backend code (no DB changes):

1. GitHub Actions → Run workflow
2. Uncheck "Run migrations"
3. Keep "Deploy backend" checked

### Building App Without Backend Changes

If you only changed frontend code:

1. GitHub Actions → Run workflow
2. Uncheck "Run migrations" and "Deploy backend"
3. Keep only "Build app" checked

## Future Enhancements

Potential improvements to the CI/CD system:

- [ ] Add automated tests before deployment
- [ ] Add database backup before migrations
- [ ] Add rollback mechanism for failed deployments
- [ ] Add staging environment
- [ ] Add Slack/Discord notifications
- [ ] Add production build workflow (separate from development)
- [ ] Add migration validation (dry-run mode)
- [ ] Add automatic version bumping
- [ ] Add changelog generation

## Related Documentation

- [Stripe Payments](./09-stripe-payments.md)
- [Daily Progress](./daily-progress/)
- [Backend README](../rust_BE/README.md)
