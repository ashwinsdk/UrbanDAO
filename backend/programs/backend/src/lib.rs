use anchor_lang::prelude::*;

declare_id!("BbT6KisasaMuPhPtvegEwTvek2nENCkfuw8ASsuKDktg");

#[program]
pub mod backend {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
