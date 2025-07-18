#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

use instructions::*;
mod error;
mod instructions;
mod state;

use state::*;

declare_id!("7dBmFPmotzJcBjFzAtgkxM3ctX6X6GiHhVTHLYbHfxeE");

#[program]
pub mod supply_chain_program {
    use super::*;

    pub fn initialize_product(
        ctx: Context<InitializeProduct>,
        serial_number: String,
        description: String,
        stages: Option<Vec<Stage>>,
    ) -> Result<()> {
        process_initialize_product(ctx, serial_number, description, stages)
    }

    pub fn log_event(
        ctx: Context<LogEvent>,
        event_type: EventType,
        description: String
    ) -> Result<()> {
        process_log_event(ctx, event_type, description)
    }

    pub fn transfer_ownership(ctx: Context<TransferOwnership>, new_owner: Pubkey) -> Result<()> {
        process_transfer_ownership(ctx, new_owner)
    }
}
