Deploy the Rust backend to Fly.io.

Steps:
1. Run `cargo check` to confirm the code compiles cleanly. If there are errors, fix them first and do not deploy broken code.
2. If the check passes, run `fly deploy` from the `rust_BE` directory.
3. Report the deployed URL: `https://pierre-two-backend.fly.dev`

Run:

```bash
cd /Users/root-kawaii/Desktop/PR/rust_BE && cargo check 2>&1 && fly deploy
```
