#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

use instructions::*;
mod error;
mod instructions;
mod state;

use state::*;

declare_id!("AiNohysKLFRjwxjsw4Rmg5t5vm6R9wEL6qQxjDtuxfcc");

#[program]
pub mod supply_chain_program {
    use super::*;

    pub fn initialize_product(
        ctx: Context<InitializeProduct>,
        serial_number: String,
        description: String,
    ) -> Result<()> {
        process_initialize_product(ctx, serial_number, description)
    }

    pub fn log_event(
        ctx: Context<LogEvent>,
        event_type: EventType,
        description: String,
    ) -> Result<()> {
        process_log_event(ctx, event_type, description)
    }

    pub fn transfer_ownership(ctx: Context<TransferOwnership>, new_owner: Pubkey) -> Result<()> {
        process_transfer_ownership(ctx, new_owner)
    }
}
