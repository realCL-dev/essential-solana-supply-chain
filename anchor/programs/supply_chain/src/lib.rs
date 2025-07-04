/**
 * SOLANA SUPPLY CHAIN TRACKING PROGRAM
 * 
 * This file contains the complete Solana program (smart contract) for supply chain tracking.
 * It is written using the Anchor framework, which provides a high-level abstraction for
 * building Solana programs with improved developer experience and safety.
 * 
 * PROGRAM ARCHITECTURE:
 * 
 * This program implements a blockchain-based supply chain tracking system where:
 * 
 * 1. PRODUCTS:
 *    - Each product is a unique account on the Solana blockchain
 *    - Products have owners, serial numbers, descriptions, and status
 *    - Products maintain an event counter for audit trail tracking
 * 
 * 2. EVENTS:
 *    - Events represent actions that happen to products (shipping, receiving, etc.)
 *    - Each event is stored in its own account linked to a product
 *    - Events are numbered sequentially to create an immutable audit trail
 * 
 * 3. OWNERSHIP:
 *    - Products have owners who can transfer ownership and log events
 *    - Only the current owner can perform operations on a product
 *    - Ownership transfers are permanent and recorded on-chain
 * 
 * KEY SOLANA CONCEPTS EXPLAINED:
 * 
 * 1. PROGRAM DERIVED ADDRESSES (PDAs):
 *    - PDAs are deterministic addresses derived from seeds
 *    - They allow creating accounts without private keys
 *    - Used for both product accounts and event accounts
 *    - Seeds include owner address, serial number, and counters
 * 
 * 2. ACCOUNT RENT:
 *    - All accounts on Solana require rent to remain active
 *    - Accounts with sufficient balance (rent-exempt) stay active forever
 *    - The payer provides SOL to make accounts rent-exempt
 * 
 * 3. INSTRUCTION PROCESSING:
 *    - Each function is an instruction that modifies blockchain state
 *    - Instructions are atomic - they either succeed completely or fail completely
 *    - Failed instructions don't modify any state
 * 
 * 4. SERIALIZATION:
 *    - All data is serialized to bytes for blockchain storage
 *    - Anchor handles serialization/deserialization automatically
 *    - String fields have length prefixes for proper encoding
 * 
 * BUSINESS LOGIC:
 * 
 * The program supports three main operations:
 * 1. Creating products with unique identifiers
 * 2. Logging events as products move through the supply chain
 * 3. Transferring ownership between parties
 * 
 * SECURITY FEATURES:
 * 
 * - Authorization checks ensure only owners can modify their products
 * - Input validation prevents invalid data from being stored
 * - Overflow protection prevents counter manipulation
 * - Immutable audit trails provide tamper-proof event history
 */

// Disable clippy warning for large error types (common in Solana programs)
#![allow(clippy::result_large_err)]

// Import the Anchor framework prelude which includes commonly used types and macros
use anchor_lang::prelude::*;

/**
 * PROGRAM ID DECLARATION
 * 
 * This macro declares the unique identifier for this Solana program.
 * The program ID is:
 * - A 32-byte public key that uniquely identifies this program on Solana
 * - Generated when the program is first deployed
 * - Used by clients to send transactions to this specific program
 * - Required for Program Derived Address (PDA) calculation
 * 
 * This ID is embedded in the compiled program and cannot be changed after deployment.
 */
declare_id!("87Uuewo7TdvRdHjbNhb2pVnF3vjFi64XPmT8Ty8mzyzx");

/**
 * MAIN PROGRAM MODULE
 * 
 * The #[program] macro tells Anchor that this module contains the program's
 * instruction handlers (functions that can be called from external clients).
 * 
 * Each function in this module becomes a callable instruction that can:
 * - Modify blockchain state (create/update accounts)
 * - Validate input parameters
 * - Perform authorization checks
 * - Return success or error results
 * 
 * INSTRUCTION EXECUTION MODEL:
 * 
 * When a client calls an instruction:
 * 1. Solana runtime loads the program
 * 2. Anchor deserializes the instruction data
 * 3. Anchor validates account constraints
 * 4. The instruction function executes
 * 5. Results are serialized back to accounts
 * 6. Transaction succeeds or fails atomically
 */
#[program]
pub mod supply_chain_program {
    use super::*;

    /**
     * INITIALIZE PRODUCT INSTRUCTION
     * 
     * This instruction creates a new product in the supply chain system.
     * It initializes a new Product account with the provided metadata.
     * 
     * PROCESS FLOW:
     * 
     * 1. ACCOUNT CREATION:
     *    - Creates a new Product account using a Program Derived Address (PDA)
     *    - PDA is derived from: ["product", owner_pubkey, serial_number]
     *    - This ensures each owner can only create one product per serial number
     *    - The account is rent-exempt (funded with enough SOL to avoid deletion)
     * 
     * 2. INPUT VALIDATION:
     *    - Serial number must be 1-50 characters (prevents abuse and ensures storage efficiency)
     *    - Description must be 1-200 characters (provides meaningful info without bloat)
     *    - Empty strings are rejected to ensure data quality
     * 
     * 3. INITIAL STATE SETUP:
     *    - Owner is set to the transaction signer
     *    - Status is set to 'Created' (first state in supply chain)
     *    - Creation timestamp is recorded from Solana's clock
     *    - Event counter starts at 0 (no events logged yet)
     * 
     * PARAMETERS:
     * @param ctx - Anchor context containing validated accounts
     * @param serial_number - Unique identifier for the product (1-50 chars)
     * @param description - Human-readable product description (1-200 chars)
     * 
     * RETURNS:
     * @returns Result<()> - Success (empty) or error
     * 
     * ERRORS:
     * - InvalidSerialNumber: Serial number is empty or too long
     * - InvalidDescription: Description is empty or too long
     * - Account creation errors: Insufficient funds, account already exists
     */
    pub fn initialize_product(
        ctx: Context<InitializeProduct>,
        serial_number: String,
        description: String,
    ) -> Result<()> {
        // Get mutable reference to the product account being initialized
        let product_account = &mut ctx.accounts.product_account;
        
        /**
         * SOLANA CLOCK ACCESS
         * 
         * Clock::get() retrieves the current blockchain time information.
         * This provides:
         * - unix_timestamp: Current Unix timestamp (seconds since epoch)
         * - slot: Current slot number in the blockchain
         * - epoch: Current epoch (period of time in Solana)
         * 
         * We use unix_timestamp for human-readable timestamps.
         */
        let clock = Clock::get()?;

        /**
         * INPUT VALIDATION
         * 
         * The require! macro provides early validation with custom error messages.
         * If the condition is false, the transaction fails with the specified error.
         * This prevents invalid data from being stored on-chain.
         */
        
        // Validate serial number constraints
        require!(
            serial_number.len() <= 50 && !serial_number.is_empty(),
            SupplyChainError::InvalidSerialNumber
        );
        
        // Validate description constraints
        require!(
            description.len() <= 200 && !description.is_empty(),
            SupplyChainError::InvalidDescription
        );

        /**
         * ACCOUNT DATA INITIALIZATION
         * 
         * Set all fields of the Product account to their initial values.
         * This data will be serialized and stored on the Solana blockchain.
         */
        
        // Set the owner to the transaction signer's public key
        product_account.owner = ctx.accounts.owner.key();
        
        // Store the product's unique identifier
        product_account.serial_number = serial_number;
        
        // Store the product description
        product_account.description = description;
        
        // Set initial status to 'Created'
        product_account.status = ProductStatus::Created;
        
        // Record creation timestamp
        product_account.created_at = clock.unix_timestamp;
        
        // Initialize event counter to 0 (no events logged yet)
        product_account.events_counter = 0;

        // Return success
        Ok(())
    }

    /**
     * LOG EVENT INSTRUCTION
     * 
     * This instruction logs a new event for an existing product in the supply chain.
     * Events represent actions that happen to products (shipping, receiving, quality checks, etc.)
     * and create an immutable audit trail.
     * 
     * PROCESS FLOW:
     * 
     * 1. AUTHORIZATION:
     *    - Only the current product owner can log events
     *    - This prevents unauthorized parties from tampering with the audit trail
     *    - The signer must match the product's owner field
     * 
     * 2. EVENT ACCOUNT CREATION:
     *    - Creates a new SupplyChainEvent account for this event
     *    - Uses PDA derived from: ["event", product_address, event_counter]
     *    - This ensures events are numbered sequentially and cannot be duplicated
     * 
     * 3. AUDIT TRAIL MAINTENANCE:
     *    - Each event gets a unique index number (0, 1, 2, ...)
     *    - Events are linked to their parent product
     *    - Timestamps provide chronological ordering
     * 
     * 4. STATUS UPDATES:
     *    - Certain event types automatically update the product's status
     *    - This provides a quick way to see the current state of products
     *    - Status transitions follow supply chain logic
     * 
     * PARAMETERS:
     * @param ctx - Anchor context with validated accounts
     * @param event_type - Type of event (Created, Shipped, Received, etc.)
     * @param description - Human-readable description of the event (1-200 chars)
     * 
     * RETURNS:
     * @returns Result<()> - Success (empty) or error
     * 
     * ERRORS:
     * - UnauthorizedAccess: Signer is not the product owner
     * - InvalidDescription: Description is empty or too long
     * - CounterOverflow: Too many events logged (extremely unlikely)
     */
    pub fn log_event(
        ctx: Context<LogEvent>,
        event_type: EventType,
        description: String,
    ) -> Result<()> {
        // Get mutable references to the accounts being modified
        let product_account = &mut ctx.accounts.product_account;
        let event_account = &mut ctx.accounts.event_account;
        
        // Get current blockchain time
        let clock = Clock::get()?;

        /**
         * INPUT VALIDATION
         * 
         * Validate the event description meets length requirements.
         * This ensures data quality and prevents storage abuse.
         */
        require!(
            description.len() <= 200 && !description.is_empty(),
            SupplyChainError::InvalidDescription
        );

        /**
         * AUTHORIZATION CHECK
         * 
         * Only the product owner can log events. This is critical for:
         * - Preventing unauthorized modifications to the audit trail
         * - Ensuring only legitimate supply chain participants can add events
         * - Maintaining data integrity and trust
         * 
         * The require_eq! macro compares two values and fails with an error if they don't match.
         */
        require_eq!(
            ctx.accounts.signer.key(),
            product_account.owner,
            SupplyChainError::UnauthorizedAccess
        );

        /**
         * EVENT ACCOUNT INITIALIZATION
         * 
         * Set all fields of the new event account. This creates a permanent
         * record of this event that cannot be modified or deleted.
         */
        
        // Link event to its parent product
        event_account.product = product_account.key();
        
        // Store the type of event (Created, Shipped, etc.)
        event_account.event_type = event_type.clone();
        
        // Store the event description
        event_account.description = description;
        
        // Record when this event occurred
        event_account.timestamp = clock.unix_timestamp;
        
        // Set the sequential index for this event
        event_account.event_index = product_account.events_counter;

        /**
         * PRODUCT STATUS UPDATES
         * 
         * Some event types automatically update the product's status.
         * This provides a quick way to see the current state without
         * needing to scan through all events.
         * 
         * STATUS TRANSITIONS:
         * - Shipped → InTransit: Product is being transported
         * - Received → Received: Product has arrived at destination
         * - Delivered → Delivered: Product has been delivered to end customer
         * - Other events don't change status (quality checks, inspections, etc.)
         */
        product_account.status = match event_type {
            EventType::Shipped => ProductStatus::InTransit,
            EventType::Received => ProductStatus::Received,
            EventType::Delivered => ProductStatus::Delivered,
            // For other event types, keep the current status
            _ => product_account.status.clone(),
        };

        /**
         * EVENT COUNTER INCREMENT
         * 
         * Increment the product's event counter for the next event.
         * Uses checked_add to prevent overflow attacks.
         * 
         * OVERFLOW PROTECTION:
         * - checked_add returns None if overflow would occur
         * - This prevents malicious actors from wrapping the counter
         * - In practice, overflow is virtually impossible (2^64 events)
         */
        product_account.events_counter = product_account
            .events_counter
            .checked_add(1)
            .ok_or(SupplyChainError::CounterOverflow)?;

        // Return success
        Ok(())
    }

    /**
     * TRANSFER OWNERSHIP INSTRUCTION
     * 
     * This instruction transfers ownership of a product from the current owner to a new owner.
     * This is a critical operation in supply chain management for:
     * - Selling products to customers
     * - Transferring between supply chain partners
     * - Moving products between different business units
     * 
     * PROCESS FLOW:
     * 
     * 1. AUTHORIZATION:
     *    - Only the current owner can initiate ownership transfers
     *    - The current owner must sign the transaction
     *    - This prevents unauthorized ownership changes
     * 
     * 2. OWNERSHIP UPDATE:
     *    - The product's owner field is updated to the new owner
     *    - The status is changed to 'Transferred' to indicate this change
     *    - This creates an audit trail of ownership changes
     * 
     * 3. PERMANENCE:
     *    - Ownership transfers are permanent and irreversible
     *    - The original owner loses all rights to the product
     *    - Only the new owner can log events or transfer ownership again
     * 
     * BUSINESS IMPLICATIONS:
     * 
     * - SUPPLY CHAIN HANDOFFS:
     *   When products move between manufacturers, distributors, retailers
     * 
     * - SALES TRANSACTIONS:
     *   When products are sold to end customers
     * 
     * - CORPORATE RESTRUCTURING:
     *   When products move between divisions or subsidiaries
     * 
     * PARAMETERS:
     * @param ctx - Anchor context with validated accounts
     * @param new_owner - Public key of the new owner
     * 
     * RETURNS:
     * @returns Result<()> - Success (empty) or error
     * 
     * ERRORS:
     * - UnauthorizedAccess: Signer is not the current owner
     * - Invalid public key: New owner address is invalid
     */
    pub fn transfer_ownership(
        ctx: Context<TransferOwnership>,
        new_owner: Pubkey,
    ) -> Result<()> {
        // Get mutable reference to the product account being transferred
        let product_account = &mut ctx.accounts.product_account;

        /**
         * AUTHORIZATION CHECK
         * 
         * Verify that the transaction signer is the current owner of the product.
         * This is essential for:
         * - Preventing theft of products
         * - Ensuring only legitimate owners can transfer ownership
         * - Maintaining the integrity of the supply chain
         */
        require_eq!(
            ctx.accounts.current_owner.key(),
            product_account.owner,
            SupplyChainError::UnauthorizedAccess
        );

        /**
         * OWNERSHIP UPDATE
         * 
         * Update the product's ownership information.
         * This change is permanent and cannot be undone.
         */
        
        // Set the new owner
        product_account.owner = new_owner;
        
        // Update status to indicate ownership transfer
        product_account.status = ProductStatus::Transferred;

        // Return success
        Ok(())
    }
}

/**
 * ACCOUNT STRUCTURES
 * 
 * These structures define the accounts required for each instruction.
 * Anchor uses these to:
 * - Validate that the correct accounts are provided
 * - Enforce account constraints (seeds, space, permissions)
 * - Handle account creation and initialization
 * 
 * ACCOUNT CONSTRAINT SYSTEM:
 * 
 * Each account can have constraints that are enforced before the instruction runs:
 * - init: Create a new account
 * - mut: Account will be modified
 * - seeds: PDA derivation seeds
 * - bump: PDA bump seed for uniqueness
 * - space: Required storage space
 * - payer: Who pays for account creation
 */

/**
 * INITIALIZE PRODUCT ACCOUNTS
 * 
 * This structure defines the accounts needed to create a new product.
 * The #[instruction] attribute allows using instruction parameters in constraints.
 * 
 * ACCOUNT BREAKDOWN:
 * 
 * 1. product_account: The new Product account being created
 * 2. owner: The user creating the product (signs and pays)
 * 3. system_program: Solana's system program for account creation
 * 
 * PDA DERIVATION:
 * 
 * The product account uses a Program Derived Address (PDA) derived from:
 * - "product" (constant string)
 * - owner.key() (owner's public key)
 * - serial_number (product's serial number)
 * 
 * This ensures:
 * - Each owner can only create one product per serial number
 * - Product addresses are deterministic and discoverable
 * - No private keys are needed for product accounts
 */
#[derive(Accounts)]
#[instruction(serial_number: String)]
pub struct InitializeProduct<'info> {
    /**
     * PRODUCT ACCOUNT CONSTRAINTS
     * 
     * - init: Create a new account (fails if already exists)
     * - payer = owner: The owner pays for account creation
     * - space = Product::LEN: Allocate exactly enough space for Product data
     * - seeds: PDA derivation seeds for deterministic addressing
     * - bump: Anchor finds the canonical bump seed automatically
     */
    #[account(
        init,
        payer = owner,
        space = Product::LEN,
        seeds = [b"product", owner.key().as_ref(), serial_number.as_bytes()],
        bump
    )]
    pub product_account: Account<'info, Product>,

    /**
     * OWNER ACCOUNT CONSTRAINTS
     * 
     * - mut: Account will be modified (balance reduced for rent payment)
     * - Signer: This account must sign the transaction
     */
    #[account(mut)]
    pub owner: Signer<'info>,

    /**
     * SYSTEM PROGRAM
     * 
     * Required for creating new accounts. This is Solana's built-in program
     * that handles account creation, SOL transfers, and other system operations.
     */
    pub system_program: Program<'info, System>,
}

/**
 * LOG EVENT ACCOUNTS
 * 
 * This structure defines the accounts needed to log an event for a product.
 * Events are stored in separate accounts to maintain a clear audit trail.
 * 
 * ACCOUNT BREAKDOWN:
 * 
 * 1. product_account: The existing Product account being updated
 * 2. event_account: The new SupplyChainEvent account being created
 * 3. signer: The user logging the event (must be product owner)
 * 4. system_program: For creating the event account
 * 
 * EVENT PDA DERIVATION:
 * 
 * Event accounts use PDAs derived from:
 * - "event" (constant string)
 * - product_account.key() (the product this event belongs to)
 * - events_counter (sequential number for this event)
 * 
 * This ensures:
 * - Events are numbered sequentially (0, 1, 2, ...)
 * - Event addresses are deterministic
 * - Events cannot be duplicated or reordered
 * - Each event has a unique address
 */
#[derive(Accounts)]
pub struct LogEvent<'info> {
    /**
     * PRODUCT ACCOUNT CONSTRAINTS
     * 
     * - mut: Will be modified (event counter incremented, status possibly updated)
     * - Must be an existing Product account
     */
    #[account(mut)]
    pub product_account: Account<'info, Product>,

    /**
     * EVENT ACCOUNT CONSTRAINTS
     * 
     * - init: Create a new event account
     * - payer = signer: The signer pays for event account creation
     * - space = SupplyChainEvent::LEN: Allocate space for event data
     * - seeds: PDA derivation using product and event counter
     * - bump: Canonical bump seed for uniqueness
     * 
     * COUNTER ENCODING:
     * product_account.events_counter.to_le_bytes() converts the counter
     * to a little-endian byte array for consistent PDA derivation.
     */
    #[account(
        init,
        payer = signer,
        space = SupplyChainEvent::LEN,
        seeds = [b"event", product_account.key().as_ref(), product_account.events_counter.to_le_bytes().as_ref()],
        bump
    )]
    pub event_account: Account<'info, SupplyChainEvent>,

    /**
     * SIGNER ACCOUNT CONSTRAINTS
     * 
     * - mut: Balance will be reduced to pay for event account creation
     * - Signer: Must sign the transaction to prove authorization
     */
    #[account(mut)]
    pub signer: Signer<'info>,

    /**
     * SYSTEM PROGRAM
     * 
     * Required for creating the new event account.
     */
    pub system_program: Program<'info, System>,
}

/**
 * TRANSFER OWNERSHIP ACCOUNTS
 * 
 * This structure defines the accounts needed to transfer ownership of a product.
 * Ownership transfers are simpler than other operations since they only modify
 * an existing account without creating new ones.
 * 
 * ACCOUNT BREAKDOWN:
 * 
 * 1. product_account: The Product account whose ownership is being transferred
 * 2. current_owner: The current owner who must sign to authorize the transfer
 * 3. system_program: Required by Anchor for consistency
 * 
 * AUTHORIZATION MODEL:
 * 
 * Only the current owner can transfer ownership. This is enforced by:
 * - Requiring the current owner to sign the transaction
 * - Checking that the signer matches the product's owner field
 * - Preventing unauthorized ownership changes
 */
#[derive(Accounts)]
pub struct TransferOwnership<'info> {
    /**
     * PRODUCT ACCOUNT CONSTRAINTS
     * 
     * - mut: Will be modified (owner field updated, status changed)
     * - Must be an existing Product account
     */
    #[account(mut)]
    pub product_account: Account<'info, Product>,

    /**
     * CURRENT OWNER CONSTRAINTS
     * 
     * - mut: Included for consistency (though balance isn't changed)
     * - Signer: Must sign to prove they are the current owner
     * 
     * The instruction will verify that this signer matches the
     * product's current owner field.
     */
    #[account(mut)]
    pub current_owner: Signer<'info>,

    /**
     * SYSTEM PROGRAM
     * 
     * Required by Anchor for consistency, though no new accounts are created.
     */
    pub system_program: Program<'info, System>,
}

/**
 * DATA STRUCTURES
 * 
 * These structures define the data stored in Solana accounts.
 * They are automatically serialized/deserialized by Anchor.
 * 
 * SERIALIZATION DETAILS:
 * 
 * - All data is stored as bytes on the blockchain
 * - Anchor handles conversion between Rust types and bytes
 * - String fields include a 4-byte length prefix
 * - Numbers are stored in little-endian format
 * - Enums are stored as single bytes
 */

/**
 * PRODUCT ACCOUNT DATA
 * 
 * This structure represents a product in the supply chain.
 * Each product is stored in its own account on the Solana blockchain.
 * 
 * FIELD DESCRIPTIONS:
 * 
 * - owner: The current owner of the product (32-byte public key)
 * - serial_number: Unique identifier for the product (string, max 50 chars)
 * - description: Human-readable description (string, max 200 chars)
 * - status: Current status in the supply chain (enum, 1 byte)
 * - created_at: Unix timestamp when product was created (8-byte integer)
 * - events_counter: Number of events logged for this product (8-byte integer)
 * 
 * DESIGN DECISIONS:
 * 
 * - Serial numbers are limited to 50 characters to prevent abuse
 * - Descriptions are limited to 200 characters for reasonable detail
 * - Unix timestamps provide interoperability with external systems
 * - Event counters enable sequential event numbering
 * 
 * STORAGE EFFICIENCY:
 * 
 * The account size is fixed at creation time based on maximum field sizes.
 * This ensures consistent storage costs and prevents account size issues.
 */
#[account]
pub struct Product {
    /// Current owner of the product (can transfer ownership and log events)
    pub owner: Pubkey,
    
    /// Unique identifier for the product (1-50 characters)
    pub serial_number: String,
    
    /// Human-readable description of the product (1-200 characters)
    pub description: String,
    
    /// Current status of the product in the supply chain
    pub status: ProductStatus,
    
    /// Unix timestamp when the product was created
    pub created_at: i64,
    
    /// Number of events logged for this product (used for event PDA derivation)
    pub events_counter: u64,
}

/**
 * PRODUCT ACCOUNT SIZE CALCULATION
 * 
 * Solana accounts must specify their size at creation time.
 * This implementation calculates the exact space needed for Product accounts.
 * 
 * SIZE BREAKDOWN:
 * 
 * 1. DISCRIMINATOR (8 bytes):
 *    - Anchor adds an 8-byte discriminator to identify account types
 *    - This distinguishes Product accounts from other account types
 *    - Used for account validation and deserialization
 * 
 * 2. FIXED-SIZE FIELDS:
 *    - owner: 32 bytes (Solana public key)
 *    - created_at: 8 bytes (i64 timestamp)
 *    - events_counter: 8 bytes (u64 counter)
 *    - status: 1 byte (enum variant)
 * 
 * 3. VARIABLE-SIZE FIELDS (WITH PREFIXES):
 *    - serial_number: 4 bytes (length) + 50 bytes (max content)
 *    - description: 4 bytes (length) + 200 bytes (max content)
 * 
 * STRING STORAGE FORMAT:
 * 
 * Strings are stored with a 4-byte length prefix followed by the UTF-8 bytes.
 * This allows for variable-length strings while maintaining predictable account sizes.
 * 
 * TOTAL SIZE: 8 + 32 + 4 + 50 + 4 + 200 + 1 + 8 + 8 = 315 bytes
 */
impl Product {
    /// Anchor discriminator for account type identification
    const DISCRIMINATOR_LEN: usize = 8;
    
    /// Size of a Solana public key (32 bytes)
    const PUBKEY_LEN: usize = 32;
    
    /// Size of string length prefix (4 bytes for u32)
    const STRING_LEN_PREFIX: usize = 4;
    
    /// Maximum allowed length for serial numbers
    const MAX_SERIAL_NUMBER_LEN: usize = 50;
    
    /// Maximum allowed length for descriptions
    const MAX_DESCRIPTION_LEN: usize = 200;
    
    /// Size of i64 timestamp (8 bytes)
    const I64_LEN: usize = 8;
    
    /// Size of u64 counter (8 bytes)
    const U64_LEN: usize = 8;

    /**
     * TOTAL ACCOUNT SIZE
     * 
     * This constant calculates the total space needed for a Product account.
     * It's used in the account constraints to ensure proper space allocation.
     */
    pub const LEN: usize = Self::DISCRIMINATOR_LEN
        + Self::PUBKEY_LEN // owner
        + Self::STRING_LEN_PREFIX + Self::MAX_SERIAL_NUMBER_LEN // serial_number
        + Self::STRING_LEN_PREFIX + Self::MAX_DESCRIPTION_LEN // description
        + ProductStatus::LEN // status
        + Self::I64_LEN // created_at
        + Self::U64_LEN; // events_counter
}

/**
 * SUPPLY CHAIN EVENT DATA
 * 
 * This structure represents a single event in a product's history.
 * Each event is stored in its own account, creating an immutable audit trail.
 * 
 * FIELD DESCRIPTIONS:
 * 
 * - product: Reference to the Product account this event belongs to
 * - event_type: Type of event (Created, Shipped, Received, etc.)
 * - description: Human-readable description of what happened
 * - timestamp: When the event occurred (Unix timestamp)
 * - event_index: Sequential number of this event (0, 1, 2, ...)
 * 
 * AUDIT TRAIL DESIGN:
 * 
 * Events are designed to be immutable once created:
 * - Each event gets its own account (cannot be modified)
 * - Events are numbered sequentially (cannot be reordered)
 * - Timestamps provide chronological ordering
 * - All events reference their parent product
 * 
 * QUERY PATTERNS:
 * 
 * - Get all events for a product: Use product field to filter
 * - Get events in order: Sort by event_index
 * - Get events by time: Sort by timestamp
 * - Get specific event: Use product + event_index for PDA derivation
 */
#[account]
pub struct SupplyChainEvent {
    /// Reference to the Product account this event belongs to
    pub product: Pubkey,
    
    /// Type of event that occurred
    pub event_type: EventType,
    
    /// Human-readable description of the event (1-200 characters)
    pub description: String,
    
    /// Unix timestamp when the event occurred
    pub timestamp: i64,
    
    /// Sequential index of this event for the product (0, 1, 2, ...)
    pub event_index: u64,
}

/**
 * SUPPLY CHAIN EVENT SIZE CALCULATION
 * 
 * Similar to Product accounts, SupplyChainEvent accounts need fixed size calculation.
 * 
 * SIZE BREAKDOWN:
 * 
 * 1. DISCRIMINATOR (8 bytes):
 *    - Anchor discriminator to identify SupplyChainEvent accounts
 *    - Distinguishes from Product accounts and other types
 * 
 * 2. FIXED-SIZE FIELDS:
 *    - product: 32 bytes (Solana public key)
 *    - event_type: 1 byte (enum variant)
 *    - timestamp: 8 bytes (i64 timestamp)
 *    - event_index: 8 bytes (u64 index)
 * 
 * 3. VARIABLE-SIZE FIELDS:
 *    - description: 4 bytes (length) + 200 bytes (max content)
 * 
 * TOTAL SIZE: 8 + 32 + 1 + 4 + 200 + 8 + 8 = 261 bytes
 */
impl SupplyChainEvent {
    /// Anchor discriminator for account type identification
    const DISCRIMINATOR_LEN: usize = 8;
    
    /// Size of a Solana public key (32 bytes)
    const PUBKEY_LEN: usize = 32;
    
    /// Size of string length prefix (4 bytes)
    const STRING_LEN_PREFIX: usize = 4;
    
    /// Maximum allowed length for event descriptions
    const MAX_DESCRIPTION_LEN: usize = 200;
    
    /// Size of i64 timestamp (8 bytes)
    const I64_LEN: usize = 8;
    
    /// Size of u64 index (8 bytes)
    const U64_LEN: usize = 8;

    /**
     * TOTAL ACCOUNT SIZE
     * 
     * This constant calculates the total space needed for a SupplyChainEvent account.
     */
    pub const LEN: usize = Self::DISCRIMINATOR_LEN
        + Self::PUBKEY_LEN // product
        + EventType::LEN // event_type
        + Self::STRING_LEN_PREFIX + Self::MAX_DESCRIPTION_LEN // description
        + Self::I64_LEN // timestamp
        + Self::U64_LEN; // event_index
}

/**
 * ENUMS
 * 
 * These enums define the allowed values for certain fields.
 * They are serialized as single bytes (variants 0, 1, 2, ...).
 * 
 * ENUM BENEFITS:
 * 
 * - Type safety: Only valid values can be stored
 * - Storage efficiency: Single byte per enum value
 * - Clear semantics: Named variants are self-documenting
 * - Pattern matching: Can use match statements for logic
 */

/**
 * PRODUCT STATUS ENUM
 * 
 * Represents the current state of a product in the supply chain.
 * Products move through these states as they progress through the system.
 * 
 * STATUS FLOW:
 * 
 * 1. Created: Product is initially created in the system
 * 2. InTransit: Product is being shipped/transported
 * 3. Received: Product has been received at destination
 * 4. Delivered: Product has been delivered to end customer
 * 5. Transferred: Product ownership has been transferred
 * 
 * AUTOMATIC TRANSITIONS:
 * 
 * Some event types automatically update the product status:
 * - Shipped event → InTransit status
 * - Received event → Received status
 * - Delivered event → Delivered status
 * - Transfer ownership → Transferred status
 * 
 * CUSTOM TRANSITIONS:
 * 
 * Other event types (QualityCheck, Other) don't change status,
 * allowing for custom business logic.
 */
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProductStatus {
    /// Product has been created but not yet shipped
    Created,
    
    /// Product is currently being transported
    InTransit,
    
    /// Product has been received at destination
    Received,
    
    /// Product has been delivered to end customer
    Delivered,
    
    /// Product ownership has been transferred
    Transferred,
}

/**
 * PRODUCT STATUS SIZE
 * 
 * Enums are serialized as single bytes in Anchor.
 * Each variant gets a number (0, 1, 2, ...) stored as a byte.
 */
impl ProductStatus {
    /// Size of ProductStatus enum when serialized (1 byte)
    pub const LEN: usize = 1;
}

/**
 * EVENT TYPE ENUM
 * 
 * Defines the types of events that can occur in the supply chain.
 * Each event type has specific semantics and may trigger status changes.
 * 
 * EVENT TYPE DESCRIPTIONS:
 * 
 * - Created: Product was initially created (usually first event)
 * - Shipped: Product was shipped from one location to another
 * - Received: Product was received at a destination
 * - QualityCheck: Product underwent quality inspection
 * - Delivered: Product was delivered to end customer
 * - Other: Custom event type for business-specific actions
 * 
 * STATUS IMPACTS:
 * 
 * - Shipped → Changes product status to InTransit
 * - Received → Changes product status to Received
 * - Delivered → Changes product status to Delivered
 * - Created, QualityCheck, Other → No status change
 * 
 * EXTENSIBILITY:
 * 
 * The 'Other' variant allows for custom event types while maintaining
 * the enum structure. Future versions could add more specific types.
 */
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EventType {
    /// Product was initially created in the system
    Created,
    
    /// Product was shipped from one location to another
    Shipped,
    
    /// Product was received at a destination
    Received,
    
    /// Product underwent quality inspection or testing
    QualityCheck,
    
    /// Product was delivered to end customer
    Delivered,
    
    /// Custom event type for business-specific actions
    Other,
}

/**
 * EVENT TYPE SIZE
 * 
 * Like ProductStatus, EventType is serialized as a single byte.
 */
impl EventType {
    /// Size of EventType enum when serialized (1 byte)
    pub const LEN: usize = 1;
}

/**
 * ERROR HANDLING
 * 
 * Anchor's error system provides structured error handling with custom messages.
 * Each error gets a unique error code that can be caught and handled by clients.
 * 
 * ERROR CATEGORIES:
 * 
 * 1. VALIDATION ERRORS:
 *    - InvalidSerialNumber: Input validation failed
 *    - InvalidDescription: Input validation failed
 * 
 * 2. AUTHORIZATION ERRORS:
 *    - UnauthorizedAccess: User lacks permission for operation
 * 
 * 3. SYSTEM ERRORS:
 *    - CounterOverflow: Numeric overflow protection
 * 
 * ERROR HANDLING STRATEGY:
 * 
 * - Fail fast: Validate inputs before making changes
 * - Clear messages: Provide actionable error information
 * - Atomic operations: If any step fails, nothing changes
 * - Consistent codes: Same error conditions always return same codes
 */

/**
 * SUPPLY CHAIN ERROR CODES
 * 
 * These errors can be returned by any instruction in the program.
 * The #[msg] attribute provides human-readable error messages.
 */
#[error_code]
pub enum SupplyChainError {
    /**
     * INVALID SERIAL NUMBER
     * 
     * Thrown when:
     * - Serial number is empty
     * - Serial number is longer than 50 characters
     * 
     * Prevention:
     * - Validate input length in UI
     * - Use proper form validation
     */
    #[msg("Invalid serial number: must be 1-50 characters")]
    InvalidSerialNumber,
    
    /**
     * INVALID DESCRIPTION
     * 
     * Thrown when:
     * - Description is empty
     * - Description is longer than 200 characters
     * 
     * Prevention:
     * - Validate input length in UI
     * - Use proper form validation
     */
    #[msg("Invalid description: must be 1-200 characters")]
    InvalidDescription,
    
    /**
     * UNAUTHORIZED ACCESS
     * 
     * Thrown when:
     * - Non-owner tries to log events
     * - Non-owner tries to transfer ownership
     * - Transaction signer doesn't match required permissions
     * 
     * Prevention:
     * - Verify ownership before calling instructions
     * - Use proper wallet connection
     * - Check product owner in UI
     */
    #[msg("Unauthorized access")]
    UnauthorizedAccess,
    
    /**
     * COUNTER OVERFLOW
     * 
     * Thrown when:
     * - Event counter would exceed u64::MAX
     * - This is extremely unlikely in practice
     * 
     * Prevention:
     * - This is a safety check, not a realistic scenario
     * - A product would need 2^64 events to trigger this
     */
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