#![allow(clippy::result_large_err)]

use crate::state::*;
use anchor_lang::prelude::*;
use crate::error::*;

#[derive(Accounts)]
pub struct LogEvent<'info> {
    #[account(mut)]
    pub product_account: Account<'info, Product>,

    #[account(
        init,
        payer = signer,
        space = SupplyChainEvent::LEN,
        seeds = [b"event", product_account.key().as_ref(), product_account.events_counter.to_le_bytes().as_ref()],
        bump
    )]
    pub event_account: Account<'info, SupplyChainEvent>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/**
 * Processes the log_event instruction.
 * This function logs an event for a product, updating its status and stages as necessary.
 * Allows logging multiple events per stage, with the ability to mark stages as completed.
 */
pub fn process_log_event(ctx: Context<LogEvent>, stage_name: String, description: String, event_type: EventType) -> Result<()> {
    let product_account = &mut ctx.accounts.product_account;
    let event_account = &mut ctx.accounts.event_account;
    let clock = Clock::get()?;

    require!(
        description.len() <= 200 && !description.is_empty(),
        SupplyChainError::InvalidDescription
    );

    require!(
        stage_name.len() <= Product::STAGE_NAME_MAX_LEN && !stage_name.is_empty(),
        SupplyChainError::InvalidStageName
    );

    // Check if product has stages
    if !product_account.stages.is_empty() {
        // Product has stages - validate current stage access
        let current_stage_index = product_account.current_stage_index as usize;
        
        require!(
            current_stage_index < product_account.stages.len(),
            SupplyChainError::InvalidStageIndex
        );

        let current_stage = &product_account.stages[current_stage_index];
        
        // Check if current stage is already completed
        require!(
            !current_stage.completed,
            SupplyChainError::StageNotCompleted
        );

        // Verify that the signer is the owner of the current stage
        if let Some(stage_owner) = current_stage.owner {
            require_eq!(
                ctx.accounts.signer.key(),
                stage_owner,
                SupplyChainError::UnauthorizedAccess
            );
        }

        // Use the current stage name for the event
        event_account.stage_name = current_stage.name.clone();

        // If event type is Complete, mark the current stage as completed
        if event_type == EventType::Complete {
            product_account.stages[current_stage_index].completed = true;
            
            // Move to next stage if not the last stage
            if current_stage_index + 1 < product_account.stages.len() {
                product_account.current_stage_index += 1;
            }
        }
    } else {
        // Product has no stages - create a new stage
        require!(
            product_account.stages.len() < Product::MAX_STAGES,
            SupplyChainError::TooManyStages
        );

        let new_stage = Stage {
            name: stage_name.clone(),
            owner: Some(ctx.accounts.signer.key()),
            completed: event_type == EventType::Complete,
        };

        product_account.stages.push(new_stage);
        
        // Set current stage index to the newly created stage
        product_account.current_stage_index = (product_account.stages.len() - 1) as u8;
        
        // Use the provided stage name for the event
        event_account.stage_name = stage_name;
    }

    // Populate event account
    event_account.product = product_account.key();
    event_account.event_type = event_type.clone();
    event_account.description = description;
    event_account.timestamp = clock.unix_timestamp;
    event_account.event_index = product_account.events_counter;

    product_account.events_counter = product_account
        .events_counter
        .checked_add(1)
        .ok_or(SupplyChainError::CounterOverflow)?;
    Ok(())
}
