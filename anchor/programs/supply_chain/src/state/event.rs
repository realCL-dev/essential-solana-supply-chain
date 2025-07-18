use anchor_lang::prelude::*;

#[account]
pub struct SupplyChainEvent {
    pub product: Pubkey,
    pub event_type: EventType,
    pub description: String,
    pub stage_name: String,
    pub timestamp: i64,
    pub event_index: u64,
}

impl SupplyChainEvent {
    const DISCRIMINATOR_LEN: usize = 8;
    const PUBKEY_LEN: usize = 32;
    const STRING_LEN_PREFIX: usize = 4;
    const MAX_DESCRIPTION_LEN: usize = 200;
    const MAX_STAGE_NAME_LEN: usize = 50;
    const I64_LEN: usize = 8;
    const U64_LEN: usize = 8;

    pub const LEN: usize = Self::DISCRIMINATOR_LEN
        + Self::PUBKEY_LEN
        + EventType::LEN
        + Self::STRING_LEN_PREFIX
        + Self::MAX_DESCRIPTION_LEN
        + Self::STRING_LEN_PREFIX
        + Self::MAX_STAGE_NAME_LEN
        + Self::I64_LEN
        + Self::U64_LEN;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EventType {
    Ongoing,
    Complete,
}

impl EventType {
    pub const LEN: usize = 1;
}