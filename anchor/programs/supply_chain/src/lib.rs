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
        stages: Option<Vec<Stage>>,
    ) -> Result<()> {
        process_initialize_product(ctx, serial_number, description, stages)
    }

    pub fn log_event(
        ctx: Context<LogEvent>,
        stage_name: String,
        description: String,
        event_type: EventType
    ) -> Result<()> {
        process_log_event(ctx, stage_name, description, event_type)
    }

    pub fn transfer_ownership(ctx: Context<TransferOwnership>, new_owner: Pubkey) -> Result<()> {
        process_transfer_ownership(ctx, new_owner)
    }

    pub fn complete_stage(ctx: Context<CompleteStage>) -> Result<()> {
        process_complete_stage(ctx)
    }
}
