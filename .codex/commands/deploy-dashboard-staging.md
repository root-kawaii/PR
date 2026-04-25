Deploy the Pierre dashboard to Vercel Preview using the staging branch/env.

Use this when deploying the dashboard against the staging backend:

```bash
cd /Users/monolith/Documents/PR/pierre_dashboard
vercel pull --yes --environment=preview --git-branch=staging
npm ci
vercel build --target=preview
vercel deploy --prebuilt --target=preview
```

Expected Vercel env values:

```text
VITE_API_URL=https://pierreclubs-backend-staging.fly.dev
VITE_APP_ENV=staging
VITE_POSTHOG_HOST=https://eu.i.posthog.com
VITE_POSTHOG_KEY=<staging-or-shared-posthog-project-key>
```

Notes:
- The current Vercel project is `pierre-dashboard`.
- Preview env vars are scoped to branch `staging`.
- Automatic Git preview deploys will fail until the Vercel project root directory is set to `pierre_dashboard` or the root package/build config is made monorepo-aware.
- Do not print secret values.
