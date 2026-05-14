use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReservationStatus {
    Pending,
    Confirmed,
    Completed,
    Refused,
    Cancelled,
}

impl ReservationStatus {
    pub const ALL: [Self; 5] = [
        Self::Pending,
        Self::Confirmed,
        Self::Completed,
        Self::Refused,
        Self::Cancelled,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Confirmed => "confirmed",
            Self::Completed => "completed",
            Self::Refused => "refused",
            Self::Cancelled => "cancelled",
        }
    }

    pub fn can_transition_to(self, next: Self) -> bool {
        if self == next {
            return true;
        }

        match self {
            Self::Pending => matches!(next, Self::Confirmed | Self::Refused | Self::Cancelled),
            Self::Confirmed => matches!(
                next,
                Self::Pending | Self::Completed | Self::Refused | Self::Cancelled
            ),
            Self::Completed | Self::Refused | Self::Cancelled => false,
        }
    }

    pub fn active_for_table_capacity(self) -> bool {
        matches!(self, Self::Pending | Self::Confirmed)
    }

    pub fn counts_as_reserved(self) -> bool {
        matches!(self, Self::Pending | Self::Confirmed | Self::Completed)
    }

    pub fn can_check_in(self) -> bool {
        matches!(self, Self::Confirmed)
    }
}

impl TryFrom<&str> for ReservationStatus {
    type Error = ();

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value.trim() {
            "pending" => Ok(Self::Pending),
            "confirmed" => Ok(Self::Confirmed),
            "completed" => Ok(Self::Completed),
            "refused" => Ok(Self::Refused),
            "cancelled" => Ok(Self::Cancelled),
            _ => Err(()),
        }
    }
}

pub fn normalize_refusal_reason(
    target_status: ReservationStatus,
    refusal_reason: Option<String>,
) -> Option<String> {
    if target_status != ReservationStatus::Refused {
        return None;
    }

    refusal_reason.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}
