#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::SupplyChainError;

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



pub fn process_initialize_product(
    ctx: Context<InitializeProduct>,
    serial_number: String,
    description: String,
    stages: Option<Vec<Stage>>,
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

    if let Some(stages) = stages {
        require!(
            stages.len() <= Product::MAX_STAGES,
            SupplyChainError::TooManyStages
        );

        for stage in &stages {
            require!(
                stage.name.len() <= Product::STAGE_NAME_MAX_LEN && !stage.name.is_empty(),
                SupplyChainError::InvalidStageName
            );
        }

        product_account.stages = stages;
        product_account.use_stages = true;
    } else {
        product_account.stages = Vec::new();
        product_account.use_stages = false;
    }

    product_account.current_stage_index = 0;
    product_account.owner = ctx.accounts.owner.key();
    product_account.serial_number = serial_number;
    product_account.description = description;
    product_account.status = ProductStatus::Created;
    product_account.created_at = clock.unix_timestamp;
    product_account.events_counter = 0;

    Ok(())
}
