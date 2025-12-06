# Quick Deployment Reference

## 🚀 Deploy Everything (GitHub Actions)

1. Go to **GitHub** → **Actions** → **Deploy Backend & Build App**
2. Click **Run workflow**
3. Select what to run (all checked by default)
4. Click **Run workflow** button

## 📦 Local Scripts

### Switch API Endpoint

```bash
# Production
node scripts/switch-endpoint.js production

# Localhost
node scripts/switch-endpoint.js localhost
```

### Run All Pending Migrations

```bash
cd DB
./run-all-migrations.sh
```

### Run Single Migration

```bash
cd DB
./run-migration.sh migrations/022_your_migration.sql
```

## 🔧 Manual Deployment

### Backend Only

```bash
cd rust_BE
flyctl deploy --remote-only --ha=false
```

### Migrations Only

```bash
cd DB
./run-all-migrations.sh
```

### App Build Only

```bash
# Switch to production endpoint first
node scripts/switch-endpoint.js production

# Build
cd pierre_two
eas build --platform ios --profile development

# Revert endpoint
node scripts/switch-endpoint.js localhost
```

## ⚙️ GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `SUPABASE_HOST` | Database host from Supabase |
| `SUPABASE_DB_PASSWORD` | Database password |
| `FLY_API_TOKEN` | From `fly auth token` |
| `EXPO_TOKEN` | From Expo dashboard |

## 📋 Pre-Deployment Checklist

- [ ] Changes committed and pushed
- [ ] Migrations tested locally
- [ ] Backend compiles (`cargo build`)
- [ ] GitHub secrets configured

## 🔗 Important URLs

- Backend: https://pierre-two-backend.fly.dev
- Expo Dashboard: https://expo.dev
- Fly.io Dashboard: https://fly.io/dashboard
- Supabase Dashboard: https://supabase.com/dashboard

## 📚 Full Documentation

See [docs/10-ci-cd-setup.md](docs/10-ci-cd-setup.md) for complete CI/CD documentation.
