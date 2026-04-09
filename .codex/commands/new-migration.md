Scaffold a new numbered SQL migration file in `DB/migrations/`.

Arguments: `$ARGUMENTS` (describe what the migration should do)

Steps:
1. Find the highest-numbered migration file:
   ```bash
   ls /Users/root-kawaii/Desktop/PR/DB/migrations/*.sql | sort | tail -1
   ```
2. Increment the number by 1 with zero padding to 3 digits.
3. Convert the description in `$ARGUMENTS` to a `snake_case` slug.
4. Create the file at `DB/migrations/<NNN>_<slug>.sql` with the appropriate SQL.
5. Print the full file path and contents.

Migration conventions:
- Use `IF NOT EXISTS` / `IF EXISTS` guards so migrations are re-runnable.
- Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for column additions.
- For unique indexes on payment shares use the partial index pattern:
  `WHERE phone_number IS NOT NULL AND is_owner = false AND status IN ('paid', 'checkout_pending')`
- Add a comment at the top of the file describing what the migration does.
