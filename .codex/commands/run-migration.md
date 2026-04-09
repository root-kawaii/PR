Run a SQL migration file against the Supabase database.

Arguments: `$ARGUMENTS` (filename only, for example `037_foo.sql`)

Run:

```bash
/opt/homebrew/bin/psql $DATABASE_URL -f /Users/root-kawaii/Desktop/PR/DB/migrations/$ARGUMENTS
```

If `$ARGUMENTS` is not provided, list the available migration files and choose one:

```bash
ls /Users/root-kawaii/Desktop/PR/DB/migrations/*.sql | sort
```

After running, confirm success or show the error output.
