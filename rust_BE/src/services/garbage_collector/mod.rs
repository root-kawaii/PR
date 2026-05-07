//! Garbage collection cleaners.
//!
//! Each cleaner is a self-contained function that detects and removes one
//! class of orphan rows or storage objects. Cleaners are invoked by
//! `jobs::garbage_collector` and isolated from each other so a failure in one
//! does not stop the others.

use serde::Serialize;

/// Maximum number of identifiers (UUIDs / storage paths) included in each
/// cleaner's `sample` for the audit log. Bounds the size of the JSON payload
/// written to `background_job_runs.details`.
pub const SAMPLE_SIZE: usize = 25;

#[derive(Debug, Default, Clone, Serialize)]
pub struct CleanerStats {
    pub detected: u64,
    pub deleted: u64,
    /// Up to `SAMPLE_SIZE` identifiers (UUID strings for DB rows, storage
    /// paths for bucket objects). In dry-run mode these are the rows that
    /// *would* be deleted; in live mode they are the rows that *were*
    /// deleted.
    pub sample: Vec<String>,
}

#[derive(Debug, Clone, Copy)]
pub struct CleanerCtx {
    pub dry_run: bool,
    pub min_orphan_age_hours: i64,
}

pub mod events_orphans;
pub mod payments_orphans;
pub mod reservation_guests_orphans;
pub mod reservation_shares_orphans;
pub mod reservations_orphans;
pub mod storage;
pub mod table_images_orphans;
pub mod tables_orphans;
pub mod tickets_orphans;
