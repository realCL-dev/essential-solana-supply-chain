use crate::state::*;
use anchor_lang::prelude::*;
use crate::error::*;

#[derive(Accounts)]
pub struct CompleteStage<'info> {
    #[account(mut)]
    pub product_account: Account<'info, Product>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn process_complete_stage(ctx: Context<CompleteStage>) -> Result<()> {
    let product_account = &mut ctx.accounts.product_account;

    require_eq!(
        ctx.accounts.signer.key(),
        product_account.owner,
        SupplyChainError::UnauthorizedAccess
    );

    let current_stage_index = product_account.current_stage_index as usize;

    require!(
        current_stage_index < product_account.stages.len(),
        SupplyChainError::InvalidStageIndex
    );

    // Mark current stage as completed
    product_account.stages[current_stage_index].completed = true;

    // Check if there's a next stage
    if current_stage_index + 1 < product_account.stages.len() {
        let next_stage_index = current_stage_index + 1;

        // If next stage has a wallet, transfer ownership
        if let Some(next_owner) = product_account.stages[next_stage_index].owner {
            product_account.owner = next_owner;
            product_account.status = ProductStatus::Transferred;
        }

        // Move to next stage
        product_account.current_stage_index = next_stage_index as u8;
    } else {
        // All stages completed
        product_account.status = ProductStatus::Delivered;
    }

    Ok(())
}