#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

#[account]
pub struct Product {
    pub owner: Pubkey,
    pub serial_number: String,
    pub description: String,
    pub status: ProductStatus,
    pub created_at: i64,
    pub events_counter: u64,
}

impl Product {
    const DISCRIMINATOR_LEN: usize = 8;
    const PUBKEY_LEN: usize = 32;
    const STRING_LEN_PREFIX: usize = 4;
    const MAX_SERIAL_NUMBER_LEN: usize = 50;
    const MAX_DESCRIPTION_LEN: usize = 200;
    const I64_LEN: usize = 8;
    const U64_LEN: usize = 8;

    pub const LEN: usize = Self::DISCRIMINATOR_LEN
        + Self::PUBKEY_LEN
        + Self::STRING_LEN_PREFIX
        + Self::MAX_SERIAL_NUMBER_LEN
        + Self::STRING_LEN_PREFIX
        + Self::MAX_DESCRIPTION_LEN
        + ProductStatus::LEN
        + Self::I64_LEN
        + Self::U64_LEN;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProductStatus {
    Created,
    InTransit,
    Received,
    Delivered,
    Transferred,
}

impl ProductStatus {
    pub const LEN: usize = 1;
}
