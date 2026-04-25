Create local env files from the checked-in templates without committing secrets.

Backend:

```bash
cp rust_BE/.env.example rust_BE/.env
cp rust_BE/.env.production.example rust_BE/.env.production
cp rust_BE/.env.staging.example rust_BE/.env.staging
```

Expo app:

```bash
cp pierre_two/.env.example pierre_two/.env
cp pierre_two/.env.production.example pierre_two/.env.production
cp pierre_two/.env.staging.example pierre_two/.env.staging
```

Dashboard:

```bash
cp pierre_dashboard/.env.example pierre_dashboard/.env
cp pierre_dashboard/.env.production.example pierre_dashboard/.env.production
cp pierre_dashboard/.env.staging.example pierre_dashboard/.env.staging
```

Fill the copied files locally or in your secret manager. Do not commit real values.
