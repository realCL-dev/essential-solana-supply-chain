#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Stage {
    pub name: String,
    pub owner: Option<Pubkey>,
    pub completed: bool,
}

#[account]
pub struct Product {
    pub owner: Pubkey,
    pub serial_number: String,
    pub description: String,
    pub status: ProductStatus,
    pub created_at: i64,
    pub events_counter: u64,
    pub stages: Vec<Stage>,
    pub current_stage_index: u8,
}

impl Product {
    const DISCRIMINATOR_LEN: usize = 8;
    const PUBKEY_LEN: usize = 32;
    const STRING_LEN_PREFIX: usize = 4;
    const MAX_SERIAL_NUMBER_LEN: usize = 50;
    const MAX_DESCRIPTION_LEN: usize = 200;
    const I64_LEN: usize = 8;
    const U64_LEN: usize = 8;
    const BOOL_LEN: usize = 1;
    const OPTION_LEN: usize = 1;
    const U8_LEN: usize = 1;
    const VEC_LEN_PREFIX: usize = 4;
    pub const MAX_STAGES: usize = 10; // Maximum number of stages allowed Might need to adjust based on requirements
    pub const STAGE_NAME_MAX_LEN: usize = 50;

    pub const LEN: usize = Self::DISCRIMINATOR_LEN
        + Self::PUBKEY_LEN
        + Self::STRING_LEN_PREFIX
        + Self::MAX_SERIAL_NUMBER_LEN
        + Self::STRING_LEN_PREFIX
        + Self::MAX_DESCRIPTION_LEN
        + ProductStatus::LEN
        + Self::I64_LEN
        + Self::U64_LEN 
        + Self::VEC_LEN_PREFIX
        + (Self::MAX_STAGES * (Self::STRING_LEN_PREFIX + Self::STAGE_NAME_MAX_LEN + Self::OPTION_LEN + Self::PUBKEY_LEN + Self::BOOL_LEN))
        + Self::U8_LEN;
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
