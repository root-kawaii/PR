Deploy the Rust backend to Fly.io.

Steps:
1. Run `cargo check` to confirm the code compiles cleanly. If there are errors, fix them first and do not deploy broken code.
2. Confirm which environment is being deployed. For this repo today, `pierre-two-backend` is the live production Fly app unless the user says otherwise.
3. If the check passes, run `flyctl deploy --remote-only --ha=false` from `rust_BE/`.
4. After deploy, run `flyctl status -a pierre-two-backend` and report the machine state.
5. Report the deployed URL: `https://pierre-two-backend.fly.dev`

Run:

```bash
cd rust_BE && cargo check 2>&1 && flyctl deploy --remote-only --ha=false
```
