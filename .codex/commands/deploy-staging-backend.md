Deploy the Rust backend to the company-owned staging Fly app.

Run from the `staging` branch and from `rust_BE/` so Fly can see the backend Dockerfile.

Pre-flight:
1. Confirm branch:

```bash
git branch --show-current
```

2. Confirm the active Fly account is the company account:

```bash
flyctl auth whoami
```

3. Confirm the staging app exists and secrets are present:

```bash
flyctl status -a pierreclubs-backend-staging
flyctl secrets list -a pierreclubs-backend-staging
```

4. Confirm the code compiles before deploy:

```bash
cd rust_BE && cargo check
```

Deploy:

```bash
cd rust_BE && flyctl deploy --config fly.staging.toml --remote-only --ha=false
```

Verify:

```bash
flyctl status -a pierreclubs-backend-staging
curl -i https://pierreclubs-backend-staging.fly.dev/health
```

Do not print secret values.
