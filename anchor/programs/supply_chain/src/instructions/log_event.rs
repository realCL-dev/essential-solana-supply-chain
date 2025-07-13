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

pub fn process_log_event(ctx: Context<LogEvent>, event_type: EventType, description: String) -> Result<()> {
    let product_account = &mut ctx.accounts.product_account;
    let event_account = &mut ctx.accounts.event_account;
    let clock = Clock::get()?;

    require!(
        description.len() <= 200 && !description.is_empty(),
        SupplyChainError::InvalidDescription
    );

    require_eq!(
        ctx.accounts.signer.key(),
        product_account.owner,
        SupplyChainError::UnauthorizedAccess
    );

    event_account.product = product_account.key();
    event_account.event_type = event_type.clone();
    event_account.description = description;
    event_account.timestamp = clock.unix_timestamp;
    event_account.event_index = product_account.events_counter;

    product_account.status = match event_type {
        EventType::Shipped => ProductStatus::InTransit,
        EventType::Received => ProductStatus::Received,
        EventType::Delivered => ProductStatus::Delivered,
        _ => product_account.status.clone(),
    };

    product_account.events_counter = product_account
        .events_counter
        .checked_add(1)
        .ok_or(SupplyChainError::CounterOverflow)?;
    Ok(())
}
