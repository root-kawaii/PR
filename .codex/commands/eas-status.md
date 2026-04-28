Inspect Expo/EAS account, branches, channels, builds, and environment variables.

Use the workspace root as the starting point.

If `eas` is not installed, use `npx eas-cli@latest`.

Run:

```bash
npx eas-cli@latest whoami
```

If the CLI reports `Not logged in`, stop and report the Expo audit as blocked.

If logged in, continue with:

```bash
npx eas-cli@latest branch:list
npx eas-cli@latest channel:list
npx eas-cli@latest build:list --limit 10
npx eas-cli@latest env:list
```

Compare the live Expo state with `pierre_two/eas.json` and call out:
- Whether `staging`, `preview`, and `production` names are aligned
- Which channels point to which branches
- Whether environment variables exist for both staging and production
- Whether builds are using the intended API URL for each environment

Do not reveal secret values.

