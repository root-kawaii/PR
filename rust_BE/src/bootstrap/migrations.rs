use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;

use sqlx::{PgPool, Row};
use tracing::info;

const MIGRATION_TRACKING_TABLE: &str = "app_file_migrations";

pub async fn run_startup_migrations(pool: &PgPool) -> Result<usize, String> {
    sqlx::raw_sql("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
        .execute(pool)
        .await
        .map_err(|error| format!("failed to ensure pgcrypto extension: {error}"))?;

    sqlx::raw_sql(&format!(
        "CREATE TABLE IF NOT EXISTS {MIGRATION_TRACKING_TABLE} (
            filename TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );"
    ))
    .execute(pool)
    .await
    .map_err(|error| format!("failed to create migration tracking table: {error}"))?;

    let migrations_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../DB/migrations");
    let mut migration_paths = fs::read_dir(&migrations_dir)
        .map_err(|error| format!("failed to read migrations directory {:?}: {error}", migrations_dir))?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.extension().is_some_and(|ext| ext == "sql"))
        .collect::<Vec<_>>();

    migration_paths.sort_by_key(|path| path.file_name().map(|name| name.to_os_string()));

    let applied_rows = sqlx::query(&format!("SELECT filename FROM {MIGRATION_TRACKING_TABLE}"))
        .fetch_all(pool)
        .await
        .map_err(|error| format!("failed to load applied migrations: {error}"))?;

    let applied_filenames = applied_rows
        .into_iter()
        .map(|row| row.get::<String, _>("filename"))
        .collect::<HashSet<_>>();

    let mut applied_count = 0;

    for path in migration_paths {
        let filename = path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| format!("migration path is not valid UTF-8: {:?}", path))?
            .to_string();

        if applied_filenames.contains(&filename) {
            continue;
        }

        if filename == "039_enforce_non_null_table_areas.sql" {
            ensure_table_events_have_club_ids(pool).await?;
        }

        let sql = fs::read_to_string(&path)
            .map_err(|error| format!("failed to read migration {}: {error}", filename))?;

        info!(migration = %filename, "Applying startup DB migration");

        let mut tx = pool
            .begin()
            .await
            .map_err(|error| format!("failed to open transaction for {filename}: {error}"))?;

        sqlx::raw_sql(&sql)
            .execute(&mut *tx)
            .await
            .map_err(|error| format!("failed to execute migration {filename}: {error}"))?;

        sqlx::query(&format!(
            "INSERT INTO {MIGRATION_TRACKING_TABLE} (filename) VALUES ($1)"
        ))
        .bind(&filename)
        .execute(&mut *tx)
        .await
        .map_err(|error| format!("failed to record migration {filename}: {error}"))?;

        tx.commit()
            .await
            .map_err(|error| format!("failed to commit migration {filename}: {error}"))?;

        applied_count += 1;
    }

    Ok(applied_count)
}

async fn ensure_table_events_have_club_ids(pool: &PgPool) -> Result<(), String> {
    sqlx::raw_sql(
        r#"
        UPDATE events e
        SET club_id = c.id
        FROM clubs c
        WHERE e.club_id IS NULL
          AND EXISTS (
              SELECT 1
              FROM tables t
              WHERE t.event_id = e.id
          )
          AND (
              UPPER(COALESCE(e.venue, '')) LIKE '%' || UPPER(TRIM(c.name)) || '%'
              OR UPPER(TRIM(c.name)) LIKE '%' || UPPER(TRIM(split_part(COALESCE(e.venue, ''), ',', 1))) || '%'
          );

        WITH missing_event_clubs AS (
            SELECT DISTINCT
                e.id AS event_id,
                COALESCE(NULLIF(TRIM(split_part(e.venue, ',', 1)), ''), e.title) AS inferred_club_name,
                COALESCE(NULLIF(TRIM(e.venue), ''), e.title) AS inferred_address,
                COALESCE(NULLIF(e.image, ''), 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300') AS inferred_image
            FROM events e
            JOIN tables t ON t.event_id = e.id
            WHERE e.club_id IS NULL
        ),
        inserted_clubs AS (
            INSERT INTO clubs (id, name, subtitle, image, address, created_at, updated_at)
            SELECT
                gen_random_uuid(),
                missing.inferred_club_name,
                missing.inferred_address,
                missing.inferred_image,
                missing.inferred_address,
                NOW(),
                NOW()
            FROM missing_event_clubs missing
            WHERE NOT EXISTS (
                SELECT 1
                FROM clubs c
                WHERE UPPER(TRIM(c.name)) = UPPER(TRIM(missing.inferred_club_name))
            )
            RETURNING id, name
        )
        UPDATE events e
        SET club_id = c.id
        FROM missing_event_clubs missing
        JOIN clubs c
          ON UPPER(TRIM(c.name)) = UPPER(TRIM(missing.inferred_club_name))
        WHERE e.id = missing.event_id
          AND e.club_id IS NULL;
        "#,
    )
    .execute(pool)
    .await
    .map_err(|error| format!("failed to backfill event club_ids before area migration: {error}"))?;

    Ok(())
}
