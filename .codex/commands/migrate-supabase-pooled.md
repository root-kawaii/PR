Run repo migrations against Supabase using pooled connection strings.

Use this when direct `db.<ref>.supabase.co:5432` access is unavailable or when the current network is IPv4-only.

Required environment variables:
- `PROD_DATABASE_URL`
- `STAGING_DATABASE_URL`

Recommended values are the Supabase shared pooler URLs, for example:

```bash
export PROD_DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-1-eu-west-2.pooler.supabase.com:5432/postgres'
export STAGING_DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'
```

Use the repo helper sequence:

```bash
mkdir -p /tmp/pr-supabase-prod-cont/supabase/migrations
mkdir -p /tmp/pr-supabase-staging-cont/supabase/migrations
```

When the repo has duplicate numeric migration prefixes, copy them into a temporary `supabase/migrations` folder with unique sequential prefixes first, then run:

```bash
supabase db push --db-url "$PROD_DATABASE_URL" --workdir /tmp/pr-supabase-prod-cont
supabase db push --db-url "$STAGING_DATABASE_URL" --workdir /tmp/pr-supabase-staging-cont
```

Afterward, verify the final migration output ends with:

```text
Finished supabase db push.
```
