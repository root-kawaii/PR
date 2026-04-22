---
name: release-environments
description: Audit, document, and plan staging and production environments for this repo, including GitHub Actions, Fly.io, Expo/EAS, repo env variables, and repeatable release commands. Use when the user asks about staging/prod pipelines, deployment environment separation, release readiness, or environment status for Pierre.
---

# Release Environments

Use this skill when the task is about staging and production pipelines, environment audits, deployment readiness, or repeatable release operations for Pierre.

## Quick Start

1. Read [docs/STAGING_PROD_ENVIRONMENTS.md](../../../docs/STAGING_PROD_ENVIRONMENTS.md).
2. Use the command docs in [`.codex/commands/`](../../commands/) instead of inventing ad hoc shell sequences:
   - [`repo-env-audit.md`](../../commands/repo-env-audit.md)
   - [`github-actions-status.md`](../../commands/github-actions-status.md)
   - [`fly-status.md`](../../commands/fly-status.md)
   - [`eas-status.md`](../../commands/eas-status.md)
   - [`setup-production-env.md`](../../commands/setup-production-env.md)
3. Distinguish clearly between:
   - checked-in repo config
   - live GitHub/Fly/Expo state
   - inferred recommendations
4. Always include exact dates for live workflow and deployment findings.
5. Never print secret values. List secret names only.

## Pierre-Specific Rules

- Treat `main` as the intended production branch and `staging` as the intended fast-iteration branch unless the user says otherwise.
- Do not assume Expo, Fly, and GitHub use the same environment naming today. Verify and call out mismatches.
- Treat the current Fly app `pierre-two-backend` as production unless a separate staging app is explicitly confirmed.
- If Expo/EAS authentication is unavailable, stop the live Expo audit and document the gap instead of guessing.
- If a workflow can deploy from arbitrary branches, call that out as a release-control risk.

## Expected Output

When using this skill, the response should usually include:
- a current-state snapshot
- the most important gaps and risks
- a recommended target staging/prod model
- the next implementation steps in order
