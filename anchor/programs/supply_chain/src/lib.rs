#![allow(clippy::result_large_err)]

// lib.rs - Supply Chain MVP
use anchor_lang::prelude::*;

declare_id!("6saUBRn5SYZfoejFLjjm6wEULiQr3kbopVUdzttVmJmE");

/// Supply Chain MVP Program
#[program]
pub mod supply_chain_program {
    use super::*;

    /// Initialize a new product in the supply chain
    pub fn initialize_product(
        ctx: Context<InitializeProduct>,
        serial_number: String,
        description: String,
    ) -> Result<()> {
        let product_account = &mut ctx.accounts.product_account;
        let clock = Clock::get()?;

        // Validate input lengths
        require!(
            serial_number.len() <= 50 && !serial_number.is_empty(),
            SupplyChainError::InvalidSerialNumber
        );
        require!(
            description.len() <= 200 && !description.is_empty(),
            SupplyChainError::InvalidDescription
        );

        // Set product account data
        product_account.owner = ctx.accounts.owner.key();
        product_account.serial_number = serial_number;
        product_account.description = description;
        product_account.status = ProductStatus::Created;
        product_account.created_at = clock.unix_timestamp;
        product_account.events_counter = 0;

        Ok(())
    }

    /// Log a new event for a product
    pub fn log_event(
        ctx: Context<LogEvent>,
        event_type: EventType,
        description: String,
    ) -> Result<()> {
        let product_account = &mut ctx.accounts.product_account;
        let event_account = &mut ctx.accounts.event_account;
        let clock = Clock::get()?;

        // Validate input
        require!(
            description.len() <= 200 && !description.is_empty(),
            SupplyChainError::InvalidDescription
        );

        // Authorization check: Only the product owner can log events
        require_eq!(
            ctx.accounts.signer.key(),
            product_account.owner,
            SupplyChainError::UnauthorizedAccess
        );

        // Set event account data
        event_account.product = product_account.key();
        event_account.event_type = event_type.clone();
        event_account.description = description;
        event_account.timestamp = clock.unix_timestamp;
        event_account.event_index = product_account.events_counter;

        // Update product status based on event type
        product_account.status = match event_type {
            EventType::Shipped => ProductStatus::InTransit,
            EventType::Received => ProductStatus::Received,
            EventType::Delivered => ProductStatus::Delivered,
            _ => product_account.status.clone(),
        };

        // Increment event counter
        product_account.events_counter = product_account
            .events_counter
            .checked_add(1)
            .ok_or(SupplyChainError::CounterOverflow)?;

        Ok(())
    }

    /// Transfer ownership of a product
    pub fn transfer_ownership(
        ctx: Context<TransferOwnership>,
        new_owner: Pubkey,
    ) -> Result<()> {
        let product_account = &mut ctx.accounts.product_account;

        // Authorization check: Only the current owner can transfer ownership
        require_eq!(
            ctx.accounts.current_owner.key(),
            product_account.owner,
            SupplyChainError::UnauthorizedAccess
        );

        // Update ownership
        product_account.owner = new_owner;
        product_account.status = ProductStatus::Transferred;

        Ok(())
    }
}

// Account Structures

/// Accounts for initializing a product
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

/// Accounts for logging an event
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

/// Accounts for transferring ownership
#[derive(Accounts)]
pub struct TransferOwnership<'info> {
    #[account(mut)]
    pub product_account: Account<'info, Product>,

    #[account(mut)]
    pub current_owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// Data Structures

/// Product account data
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
        + Self::PUBKEY_LEN // owner
        + Self::STRING_LEN_PREFIX + Self::MAX_SERIAL_NUMBER_LEN // serial_number
        + Self::STRING_LEN_PREFIX + Self::MAX_DESCRIPTION_LEN // description
        + ProductStatus::LEN // status
        + Self::I64_LEN // created_at
        + Self::U64_LEN; // events_counter
}

/// Supply chain event data
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
        + Self::PUBKEY_LEN // product
        + EventType::LEN // event_type
        + Self::STRING_LEN_PREFIX + Self::MAX_DESCRIPTION_LEN // description
        + Self::I64_LEN // timestamp
        + Self::U64_LEN; // event_index
}

// Enums

/// Product status in the supply chain
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

/// Types of events in the supply chain
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

// Error Handling

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

/*
================================================================================
COMMENTED OUT COMPLEX FEATURES FOR MVP
================================================================================

The following features have been commented out to create a simple MVP:

1. NFT Minting and Metaplex Integration
   - mint_product_nft function
   - All mpl-token-metadata dependencies
   - Complex token account management

2. Customer Onboarding System
   - onboard_customer function
   - Customer struct and related logic
   - Subscription tiers and customer management

3. Payment Systems
   - All payment modes (escrow, upfront, credit, etc.)
   - transfer_ownership with SOL payments
   - Escrow account management

4. Advanced Features
   - GPS coordinates tracking
   - Quality metrics URIs
   - Complex event data
   - Product splitting and composition
   - Metadata updates

5. Complex Account Structures
   - Customer accounts
   - Escrow accounts
   - Multi-level authorization
   - Associated token accounts

These features can be incrementally added back once the MVP is stable and working.

Example of commented out complex function:

/*
pub fn mint_product_nft(
    ctx: Context<MintProductNft>,
    product_name: String,
    product_symbol: String,
    product_uri: String,
) -> Result<()> {
    // Complex NFT minting logic with Metaplex
    // This requires anchor-spl and mpl-token-metadata dependencies
    // Commented out for MVP simplicity
}
*/

/*
#[derive(Accounts)]
pub struct MintProductNft<'info> {
    // Complex account structure for NFT minting
    // Requires multiple token accounts and programs
    // Commented out for MVP
}
*/

/*
#[account]
pub struct Customer {
    pub customer_name: String,
    pub admin_key: Pubkey,
    pub subscription_tier: SubscriptionTier,
    pub survey_results_uri: String,
    pub is_active: bool,
    pub onboarding_timestamp: i64,
    pub product_counter: u64,
}
*/

End of commented out features
================================================================================
*/