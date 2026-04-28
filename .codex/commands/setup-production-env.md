Set up and verify the production environment metadata for this repository.

Use the workspace root as the starting point.

1. Make sure the GitHub environment `Production` exists.
2. Set the non-sensitive GitHub environment variables:

```bash
gh variable set APP_ENV --env Production --body production
gh variable set API_URL --env Production --body https://pierre-two-backend.fly.dev
gh variable set FLY_APP_NAME --env Production --body pierre-two-backend
gh variable set EAS_BUILD_PROFILE --env Production --body production
gh variable set SUPPORT_URL --env Production --body https://pierre.app/support
gh variable set PRIVACY_URL --env Production --body https://pierre.app/privacy
gh variable set TERMS_URL --env Production --body https://pierre.app/terms
```

3. Verify the environment variables:

```bash
gh variable list --env Production
```

4. Verify the workflow and docs are aligned:

```bash
sed -n '1,260p' .github/workflows/deploy.yml
sed -n '1,240p' docs/PRODUCTION_ENVIRONMENT_SETUP.md
```

Do not print or commit secret values.
