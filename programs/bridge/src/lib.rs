use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("6TosvM79pTn5ZmCyYUMuSeDcWjESY4bT7wmdyEArKia5");

#[program]
pub mod bridge {
    use super::*;

    /// Initialize the bridge with admin authority
    pub fn initialize(ctx: Context<Initialize>, admin: Pubkey) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;
        bridge_state.admin = admin;
        bridge_state.total_locked = 0;
        bridge_state.bump = ctx.bumps.bridge_state;

        msg!("Bridge initialized with admin: {:?}", admin);
        Ok(())
    }

    /// Lock SOL tokens and emit event for indexer (Solana -> Sepolia)
    pub fn lock(
        ctx: Context<Lock>,
        amount: u64,
        destination_address: String // EVM address as string
    ) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;

        // Validate amount
        require!(amount > 0, BridgeError::InvalidAmount);
        require!(amount <= 1_000_000_000, BridgeError::AmountTooLarge); // Max 1 SOL per tx

        // Validate destination address format (basic check)
        require!(
            destination_address.starts_with("0x") && destination_address.len() == 42,
            BridgeError::InvalidDestinationAddress
        );

        // Transfer SOL from user to bridge admin
        let transfer_instruction = system_program::Transfer {
            from: ctx.accounts.user.to_account_info(),
            to: ctx.accounts.admin.to_account_info(),
        };

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_instruction,
        );

        system_program::transfer(cpi_context, amount)?;

        // Update bridge state
        bridge_state.total_locked = bridge_state.total_locked.checked_add(amount)
            .ok_or(BridgeError::MathOverflow)?;

        // Emit event for indexer to catch
        emit!(LockEvent {
            source_address: ctx.accounts.user.key(),
            destination_address: destination_address.clone(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "Locked {} lamports from {} to destination {}",
            amount,
            ctx.accounts.user.key(),
            destination_address
        );

        Ok(())
    }

    /// Release SOL tokens to user after BTK is locked on EVM (Sepolia -> Solana)
    pub fn release(
        ctx: Context<Release>,
        amount: u64,
        evm_tx_hash: String, // EVM transaction hash as string
        recipient: Pubkey
    ) -> Result<()> {
        let bridge_state = &mut ctx.accounts.bridge_state;

        // Validate amount
        require!(amount > 0, BridgeError::InvalidAmount);
        require!(amount <= 1_000_000_000, BridgeError::AmountTooLarge); // Max 1 SOL per tx

        // Check if transaction already processed
        let processed_tx = &mut ctx.accounts.processed_tx;
        require!(!processed_tx.is_processed, BridgeError::TransactionAlreadyProcessed);

        // Validate admin has sufficient SOL balance
        let admin_balance = ctx.accounts.admin.lamports();
        require!(admin_balance >= amount, BridgeError::InsufficientBalance);

        // Transfer SOL from admin to recipient
        **ctx.accounts.admin.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.recipient.to_account_info().try_borrow_mut_lamports()? += amount;

        // Mark transaction as processed
        processed_tx.is_processed = true;
        processed_tx.evm_tx_hash = evm_tx_hash.clone();
        processed_tx.amount = amount;
        processed_tx.recipient = recipient;
        processed_tx.timestamp = Clock::get()?.unix_timestamp;

        // Update bridge state
        bridge_state.total_locked = bridge_state.total_locked.checked_sub(amount)
            .ok_or(BridgeError::MathUnderflow)?;

        // Emit event for tracking
        emit!(ReleaseEvent {
            recipient,
            amount,
            evm_tx_hash: evm_tx_hash.clone(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "Released {} lamports to {} for EVM tx {}",
            amount,
            recipient,
            evm_tx_hash
        );

        Ok(())
    }

}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + BridgeState::INIT_SPACE,
        seeds = [b"bridge_state"],
        bump
    )]
    pub bridge_state: Account<'info, BridgeState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Lock<'info> {
    #[account(
        mut,
        seeds = [b"bridge_state"],
        bump = bridge_state.bump
    )]
    pub bridge_state: Account<'info, BridgeState>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: This is the admin account where SOL will be transferred
    #[account(
        mut,
        constraint = admin.key() == bridge_state.admin @ BridgeError::InvalidAdmin
    )]
    pub admin: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, evm_tx_hash: String)]
pub struct Release<'info> {
    #[account(
        mut,
        seeds = [b"bridge_state"],
        bump = bridge_state.bump
    )]
    pub bridge_state: Account<'info, BridgeState>,
    
    #[account(
        mut,
        constraint = admin.key() == bridge_state.admin @ BridgeError::InvalidAdmin
    )]
    pub admin: Signer<'info>,
    
    /// CHECK: Recipient account where SOL will be sent
    #[account(mut)]
    pub recipient: AccountInfo<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + ProcessedTransaction::INIT_SPACE,
        seeds = [b"processed_tx", evm_tx_hash.as_bytes()],
        bump
    )]
    pub processed_tx: Account<'info, ProcessedTransaction>,
    
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct BridgeState {
    pub admin: Pubkey,
    pub total_locked: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ProcessedTransaction {
    pub is_processed: bool,
    #[max_len(66)] // EVM tx hash with 0x prefix
    pub evm_tx_hash: String,
    pub amount: u64,
    pub recipient: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct LockEvent {
    pub source_address: Pubkey,
    pub destination_address: String,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct ReleaseEvent {
    pub recipient: Pubkey,
    pub amount: u64,
    pub evm_tx_hash: String,
    pub timestamp: i64,
}

#[error_code]
pub enum BridgeError {
    #[msg("Invalid amt must be greater than 0")]
    InvalidAmount,
    #[msg("Amount too large")]
    AmountTooLarge,
    #[msg("Invalid destination address ")]
    InvalidDestinationAddress,
    #[msg("math overflow")]
    MathOverflow,
    #[msg("Math underflow")]
    MathUnderflow,
    #[msg("Invalid admin authority")]
    InvalidAdmin,
    #[msg("Transaction already processed")]
    TransactionAlreadyProcessed,
    #[msg("Insufficient balance")]
    InsufficientBalance,
}