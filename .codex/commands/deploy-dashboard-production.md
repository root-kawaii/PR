Deploy the Pierre dashboard to Vercel Production.

Use this when deploying the dashboard against the production backend:

```bash
cd /Users/monolith/Documents/PR/pierre_dashboard
vercel pull --yes --environment=production
npm ci
vercel build --prod
vercel deploy --prebuilt --prod
```

Expected Vercel env values:

```text
VITE_API_URL=https://pierreclubs-backend-prod.fly.dev
VITE_APP_ENV=production
VITE_POSTHOG_HOST=https://eu.i.posthog.com
VITE_POSTHOG_KEY=<production-or-shared-posthog-project-key>
```

Notes:
- Production URL is `https://pierre-dashboard.vercel.app`.
- The project currently has no custom domains configured in Vercel.
- Do not print secret values.
