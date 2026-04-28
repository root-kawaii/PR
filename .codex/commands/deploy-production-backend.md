Deploy the Rust backend to the company-owned production Fly app.

Run from `rust_BE/` so Fly can see the backend Dockerfile.

Pre-flight:
1. Confirm the active Fly account is the company account:

```bash
flyctl auth whoami
```

2. Confirm the production app exists and secrets are present:

```bash
flyctl status -a pierreclubs-backend-prod
flyctl secrets list -a pierreclubs-backend-prod
```

3. Confirm the code compiles before deploy:

```bash
cargo check
```

Deploy:

```bash
cd rust_BE && flyctl deploy --config fly.production.toml --remote-only --ha=false
```

Verify:

```bash
flyctl status -a pierreclubs-backend-prod
curl -i https://pierreclubs-backend-prod.fly.dev/health
```

Do not print secret values.
