Inspect the live GitHub Actions setup for this repository.

Use the workspace root as the starting point.

Run:

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

Focus on:
- Which workflows are active
- The latest successful and failed runs, with exact timestamps
- Whether workflows are using GitHub `environment:` blocks
- Whether environment-scoped secrets exist
- Naming mismatches such as `staging` vs `Preview` vs `Production`

Do not reveal secret values.

