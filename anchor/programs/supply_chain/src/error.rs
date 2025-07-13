use anchor_lang::prelude::*;

#[error_code]
pub enum SupplyChainError {
    #[msg("Invalid serial number: must be 1-50 characters")]
    InvalidSerialNumber,
    #[msg("Invalid description: must be 1-200 characters")]
    InvalidDescription,
    #[msg("Unauthorized access")]
    UnauthorizedAccess,
    #[msg("Counter overflow")]
    CounterOverflow,
}
