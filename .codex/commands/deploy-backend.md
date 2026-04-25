Deploy the Rust backend to Fly.io.

Steps:
1. Run `cargo check` to confirm the code compiles cleanly. If there are errors, fix them first and do not deploy broken code.
2. Confirm which environment is being deployed:
   - production: `pierreclubs-backend-prod` using `fly.production.toml`
   - staging: `pierreclubs-backend-staging` using `fly.staging.toml`
3. If the check passes, run the environment-specific deploy command from `rust_BE/`.
4. After deploy, run `flyctl status -a <app>` and report the machine state.
5. Report the deployed URL for the selected environment.

Production:

```bash
cd rust_BE && cargo check && flyctl deploy --config fly.production.toml --remote-only --ha=false
```

Staging:

```bash
cd rust_BE && cargo check && flyctl deploy --config fly.staging.toml --remote-only --ha=false
```
