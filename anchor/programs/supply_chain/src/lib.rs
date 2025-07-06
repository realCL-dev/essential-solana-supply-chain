#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

declare_id!("87Uuewo7TdvRdHjbNhb2pVnF3vjFi64XPmT8Ty8mzyzx");

#[program]
pub mod supply_chain_program {
    use super::*;

    pub fn initialize_product(
        ctx: Context<InitializeProduct>,
        serial_number: String,
        description: String,
    ) -> Result<()> {
        let product_account = &mut ctx.accounts.product_account;
        let clock = Clock::get()?;

        require!(
            serial_number.len() <= 50 && !serial_number.is_empty(),
            SupplyChainError::InvalidSerialNumber
        );
        
        require!(
            description.len() <= 200 && !description.is_empty(),
            SupplyChainError::InvalidDescription
        );

        product_account.owner = ctx.accounts.owner.key();
        product_account.serial_number = serial_number;
        product_account.description = description;
        product_account.status = ProductStatus::Created;
        product_account.created_at = clock.unix_timestamp;
        product_account.events_counter = 0;
        Ok(())
    }

    pub fn log_event(
        ctx: Context<LogEvent>,
        event_type: EventType,
        description: String,
    ) -> Result<()> {
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

    pub fn transfer_ownership(
        ctx: Context<TransferOwnership>,
        new_owner: Pubkey,
    ) -> Result<()> {
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
}


#[derive(Accounts)]
#[instruction(serial_number: String)]
pub struct InitializeProduct<'info> {
    #[account(
        init,
        payer = owner,
        space = Product::LEN,
        seeds = [b"product", owner.key().as_ref(), serial_number.as_bytes()],
        bump
    )]
    pub product_account: Account<'info, Product>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

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

#[derive(Accounts)]
pub struct TransferOwnership<'info> {
    #[account(mut)]
    pub product_account: Account<'info, Product>,

    #[account(mut)]
    pub current_owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}


#[account]
pub struct Product {
    pub owner: Pubkey,
    pub serial_number: String,
    pub description: String,
    pub status: ProductStatus,
    pub created_at: i64,
    pub events_counter: u64,
}

impl Product {
    const DISCRIMINATOR_LEN: usize = 8;
    const PUBKEY_LEN: usize = 32;
    const STRING_LEN_PREFIX: usize = 4;
    const MAX_SERIAL_NUMBER_LEN: usize = 50;
    const MAX_DESCRIPTION_LEN: usize = 200;
    const I64_LEN: usize = 8;
    const U64_LEN: usize = 8;

    pub const LEN: usize = Self::DISCRIMINATOR_LEN
        + Self::PUBKEY_LEN
        + Self::STRING_LEN_PREFIX + Self::MAX_SERIAL_NUMBER_LEN
        + Self::STRING_LEN_PREFIX + Self::MAX_DESCRIPTION_LEN
        + ProductStatus::LEN
        + Self::I64_LEN
        + Self::U64_LEN;
}

#[account]
pub struct SupplyChainEvent {
    pub product: Pubkey,
    pub event_type: EventType,
    pub description: String,
    pub timestamp: i64,
    pub event_index: u64,
}

impl SupplyChainEvent {
    const DISCRIMINATOR_LEN: usize = 8;
    const PUBKEY_LEN: usize = 32;
    const STRING_LEN_PREFIX: usize = 4;
    const MAX_DESCRIPTION_LEN: usize = 200;
    const I64_LEN: usize = 8;
    const U64_LEN: usize = 8;

    pub const LEN: usize = Self::DISCRIMINATOR_LEN
        + Self::PUBKEY_LEN
        + EventType::LEN
        + Self::STRING_LEN_PREFIX + Self::MAX_DESCRIPTION_LEN
        + Self::I64_LEN
        + Self::U64_LEN;
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EventType {
    Created,
    Shipped,
    Received,
    QualityCheck,
    Delivered,
    Other,
}

impl EventType {
    pub const LEN: usize = 1;
}


#[error_code]
pub enum SupplyChainError {
    #[msg("Invalid serial number: must be 1-50 characters")]
    InvalidSerialNumber,
    #[msg("Invalid description: must be 1-200 characters")]
    InvalidDescription,
    #[msg("Unauthorized access")]
    UnauthorizedAccess,
    #[msg("Counter overflow")]
    CounterOverflow,
}

