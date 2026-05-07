//! Garbage collection cleaners.
//!
//! Each cleaner is a self-contained function that detects and removes one
//! class of orphan rows or storage objects. Cleaners are invoked by
//! `jobs::garbage_collector` and isolated from each other so a failure in one
//! does not stop the others.

use serde::Serialize;

#[derive(Debug, Default, Clone, Copy, Serialize)]
pub struct CleanerStats {
    pub detected: u64,
    pub deleted: u64,
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
