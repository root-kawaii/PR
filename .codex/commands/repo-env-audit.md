Audit the current staging and production environment setup for this repo.

Goal:
- Distinguish checked-in config from live platform state.
- Verify GitHub Actions, Fly.io, and Expo/EAS status.
- Produce a dated summary with risks, gaps, and recommended next steps.

Use the workspace root as the starting point.

Steps:
1. Inspect checked-in config:
   ```bash
   rg --files --hidden .github
   sed -n '1,260p' .github/workflows/deploy.yml
   sed -n '1,260p' .github/workflows/staging-app.yml
   sed -n '1,260p' rust_BE/fly.toml
   sed -n '1,260p' pierre_two/eas.json
   sed -n '1,260p' pierre_two/app.config.js
   sed -n '1,220p' pierre_two/config/api.ts
   sed -n '1,220p' pierre_dashboard/src/config/api.ts
   sed -n '1,260p' rust_BE/src/bootstrap/config.rs
   ```
2. Verify branch and remote context:
   ```bash
   git branch --all --verbose --no-abbrev
   git remote -v
   git status --short
   ```
3. Verify live GitHub state:
   ```bash
   gh auth status
   gh workflow list
   gh run list --limit 10
   gh api repos/root-kawaii/PR/environments
   gh secret list
   gh variable list
   gh secret list --env Production
   gh secret list --env Preview
   ```
4. Verify Fly state:
   ```bash
   flyctl apps list
   flyctl status -a pierre-two-backend
   flyctl secrets list -a pierre-two-backend
   ```
5. Verify Expo/EAS state:
   ```bash
   npx eas-cli@latest whoami
   ```
   If logged in, continue with:
   ```bash
   npx eas-cli@latest branch:list
   npx eas-cli@latest channel:list
   npx eas-cli@latest build:list --limit 10
   npx eas-cli@latest env:list
   ```
   If not logged in, stop and document the Expo audit as blocked rather than guessing.
6. Write the results with exact dates and names. Never print secret values; only list secret names and whether they are repo-scoped or environment-scoped.

