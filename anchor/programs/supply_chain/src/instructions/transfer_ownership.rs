#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::*;

pub fn process_transfer_ownership(ctx: Context<TransferOwnership>, new_owner: Pubkey) -> Result<()> {
    let product_account = &mut ctx.accounts.product_account;

    require_eq!(
        ctx.accounts.current_owner.key(),
        product_account.owner,
        SupplyChainError::UnauthorizedAccess
    );

    product_account.owner = new_owner;
    product_account.status = ProductStatus::Transferred;
    Ok(())
}

#[derive(Accounts)]
pub struct TransferOwnership<'info> {
    #[account(mut)]
    pub product_account: Account<'info, Product>,

    #[account(mut)]
    pub current_owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}
