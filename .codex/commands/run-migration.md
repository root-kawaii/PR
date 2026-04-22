Run a SQL migration file against the Supabase database.

Arguments: `$ARGUMENTS` (filename only, for example `037_foo.sql`)

Use the repo helper so `DATABASE_URL` is loaded the same way as the rest of the project.

Run:

```bash
cd DB && ./run-migration.sh migrations/$ARGUMENTS
```

If `$ARGUMENTS` is not provided, list the available migration files and choose one:

```bash
ls DB/migrations/*.sql | sort
```

After running, confirm success or show the error output.
