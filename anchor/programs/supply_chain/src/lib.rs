#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

declare_id!("JAVuBXeBZqXNtS73azhBDAoYaaAFfo4gWXoZe2e7Jf8H");

#[program]
pub mod supply_chain {
    use super::*;

    pub fn close(_ctx: Context<CloseSupplyChain>) -> Result<()> {
        Ok(())
    }

    pub fn decrement(ctx: Context<Update>) -> Result<()> {
        ctx.accounts.supply_chain.count = ctx.accounts.supply_chain.count.checked_sub(1).unwrap();
        Ok(())
    }

    pub fn increment(ctx: Context<Update>) -> Result<()> {
        ctx.accounts.supply_chain.count = ctx.accounts.supply_chain.count.checked_add(1).unwrap();
        Ok(())
    }

    pub fn initialize(_ctx: Context<InitializeSupplyChain>) -> Result<()> {
        Ok(())
    }

    pub fn set(ctx: Context<Update>, value: u8) -> Result<()> {
        ctx.accounts.supply_chain.count = value.clone();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeSupplyChain<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
  init,
  space = 8 + SupplyChain::INIT_SPACE,
  payer = payer
    )]
    pub supply_chain: Account<'info, SupplyChain>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct CloseSupplyChain<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
  mut,
  close = payer, // close account and return lamports to payer
    )]
    pub supply_chain: Account<'info, SupplyChain>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub supply_chain: Account<'info, SupplyChain>,
}

#[account]
#[derive(InitSpace)]
pub struct SupplyChain {
    count: u8,
}
