# Pierre Current Release State

Last updated: 2026-04-24 Europe/Rome.

This reference captures known-good staging/prod state from the rebuild onto new accounts. It intentionally excludes secret values.

## Accounts

- Expo/EAS account: `pierre-clubs`
- EAS project: `@pierre-clubs/pierre_two`
- EAS project ID: `6c405b8b-7cb7-454f-a1a7-fb52014dcf35`
- Apple ID used during setup: `teo.regge.99@gmail.com`
- Apple team: `Matteo Regge`, team ID `U8KL7XGS6R`
- Apple provider ID: `128720268`
- Fly account target email: `info@pierreclubs.it`

## Backend

Production:

- Fly app: `pierreclubs-backend-prod`
- Fly config: `rust_BE/fly.production.toml`
- Health URL: `https://pierreclubs-backend-prod.fly.dev/health`
- Public base URL: `https://pierreclubs-backend-prod.fly.dev`

Staging:

- Fly app: `pierreclubs-backend-staging`
- Fly config: `rust_BE/fly.staging.toml`
- Health URL: `https://pierreclubs-backend-staging.fly.dev/health`
- Public base URL: `https://pierreclubs-backend-staging.fly.dev`

Known-good remote deploy commands:

```bash
cd /Users/monolith/Documents/PR/rust_BE
flyctl deploy --config fly.production.toml --remote-only --ha=false
flyctl deploy --config fly.staging.toml --remote-only --ha=false
```

Known-good manual image fallback from 2026-04-24:

```bash
cd /Users/monolith/Documents/PR/rust_BE
flyctl deploy --config fly.production.toml --image registry.fly.io/pierreclubs-backend-prod:manual-prod-20260424-1728 --ha=false --wait-timeout 10m
flyctl deploy --config fly.staging.toml --image registry.fly.io/pierreclubs-backend-staging:manual-staging-20260424-1728 --ha=false --wait-timeout 10m
```

Use the image fallback only when remote builds are flaky. Prefer a fresh build for normal releases.

## Supabase

Production project ref: `uqavntlcurjwwdwrepap`

- Direct host: `db.uqavntlcurjwwdwrepap.supabase.co`
- Shared pooler host: `aws-1-eu-west-2.pooler.supabase.com`
- Pooler user: `postgres.uqavntlcurjwwdwrepap`

Staging project ref: `cnvnugirbftyblxnkqbf`

- Direct host: `db.cnvnugirbftyblxnkqbf.supabase.co`
- Shared pooler host: `aws-0-eu-west-1.pooler.supabase.com`
- Pooler user: `postgres.cnvnugirbftyblxnkqbf`

Use pooler URLs for IPv4 environments. Keep database passwords out of repo docs and skills.

## Mobile Apps

Production iOS:

- Display name: `Pierre`
- Bundle identifier: `com.rootkawaii.pierre`
- App Store Connect app ID: `6761366768`
- EAS profile: `production`
- EAS channel: `production`
- EAS environment: `production`
- Backend: `https://pierreclubs-backend-prod.fly.dev`

Staging iOS:

- Display name: `Pierre (Staging)`
- Bundle identifier: `PR.staging`
- App Store Connect app ID: `6761366076`
- App Store title pulled by metadata: `Pierre Staging`
- EAS profile: `staging`
- EAS channel: `staging`
- EAS environment: `preview`
- Backend: `https://pierreclubs-backend-staging.fly.dev`

Important EAS commands:

```bash
cd /Users/monolith/Documents/PR/pierre_two
npx eas-cli build:view <build-id>
APP_ENV=staging npx eas-cli submit --platform ios --id <staging-build-id> --profile staging --non-interactive --wait
APP_ENV=production npx eas-cli submit --platform ios --id <prod-build-id> --profile production --non-interactive --wait
```

Always force `APP_ENV=staging` when submitting staging. A previous submit without that env resolved credentials for `com.rootkawaii.pierre` while targeting staging ASC app `6761366076`, causing opaque App Store Connect failures.

Staging build `c6777c31-7640-4923-9fdc-66a44e82e60e` completed as `1.1.0 (4)` on 2026-04-24. If future TestFlight uploads fail with duplicate `CFBundleVersion`, use a higher build number.

## Dashboard

- Production dashboard: `https://pierre-dashboard.vercel.app`
- Staging/preview dashboard observed: `https://pierre-dashboard-bqp8quldf-pierre13.vercel.app`
- Dashboard env should point prod to prod backend and staging/preview to staging backend.
- Vercel project: `pierre-dashboard`
- Vercel project ID: `prj_g2AgpsE7SabwoMS1opB83WOJXtqi`
- Vercel org/team ID: `team_IhxaXswFxCRdNVie2OgrOhaA`
- Vercel project root directory was observed as `.` on 2026-04-25, which breaks automatic Git preview deploys for this monorepo because Vite dependencies live under `pierre_dashboard/`.
- Manual prebuilt deploys from `pierre_dashboard/` are the reliable path until the Vercel root directory is set to `pierre_dashboard`.

## Third-Party Services

PostHog:

- Host: `https://eu.i.posthog.com`
- Store API keys in Fly, EAS, Vercel, and GitHub/Vercel deploy secrets as needed.

Stripe:

- Production backend uses live secret key and live webhook secret.
- Staging backend uses test secret key and test webhook secret.
- Mobile apps use publishable keys only: live for production, test for staging.
- Never store Stripe secret keys or webhook secret values in docs, skills, or committed env files.

## Known Gotchas

- Use `npx eas-cli`, not `npx eas`; `npx eas` failed to resolve an executable in this repo.
- `npx expo config` without `APP_ENV=staging` shows prod defaults. Use `APP_ENV=staging npx expo config --type public --json` to verify staging config.
- EAS may warn when values exist both in hosted env and `eas.json`; profile env wins.
- Apple requires `NSCameraUsageDescription` because app/native dependencies reference camera APIs.
- `store.config.json` can be generated by `eas metadata:pull`; do not assume it should be committed unless store metadata is intentionally managed from repo.
- Existing dirty worktree may include user changes. Do not revert unrelated changes.
