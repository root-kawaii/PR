Inspect Fly.io apps and environment configuration for this project.

Arguments: `$ARGUMENTS` optional Fly app name. Default: `pierre-two-backend`

Use the workspace root as the starting point.

If `$ARGUMENTS` is empty, use `pierre-two-backend`.

Run:

```bash
flyctl apps list
flyctl status -a ${APP_NAME:-pierre-two-backend}
flyctl secrets list -a ${APP_NAME:-pierre-two-backend}
```

Report:
- Whether a separate staging app exists
- Current machine state and latest deployment details
- Secret names present or missing
- Whether `APP_ENV`, `OWNER_APP_BASE_URL`, and other environment-specific settings are configured

Do not reveal secret values.

