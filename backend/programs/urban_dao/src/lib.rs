use anchor_lang::prelude::*;

// The program's on-chain address.
declare_id!("7bod71ofqkMs9DhCKY6tt14buE7Ke2kGdtBcyFMKTCYJ");

#[program]
pub mod urban_dao {
    use super::*;

    // Initializes the main state of the program. Must be run once after deployment.
    pub fn initialize(ctx: Context<Initialize>, admin_govt: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.admin_govt = admin_govt;
        state.admin_head = Pubkey::default(); // Initially unassigned
        state.current_tax_year = 2024; // Set initial tax year
        state.treasury_bump = ctx.bumps.treasury;
        state.state_bump = ctx.bumps.state; // Store state PDA bump
        Ok(())
    }

    // Assign a new Municipal Head (only by Government Officer).
    pub fn assign_admin_head(ctx: Context<AssignAdminHead>, new_admin_head: Pubkey) -> Result<()> {
        ctx.accounts.state.admin_head = new_admin_head;
        Ok(())
    }

    // Set tax amount for a specific ward (only by Government Officer).
    pub fn set_ward_tax(ctx: Context<SetWardTax>, ward: u16, amount: u64) -> Result<()> {
        let ward_tax = &mut ctx.accounts.ward_tax;
        ward_tax.ward = ward;
        ward_tax.amount = amount;
        ward_tax.bump = ctx.bumps.ward_tax;
        Ok(())
    }

    // User pays their yearly tax.
    pub fn pay_tax(ctx: Context<PayTax>, _ward: u16, year: u16) -> Result<()> {
        let tax_payment = &mut ctx.accounts.tax_payment;
        tax_payment.user = *ctx.accounts.user.key;
        tax_payment.amount = ctx.accounts.ward_tax.amount;
        tax_payment.year = year;
        tax_payment.timestamp = Clock::get()?.unix_timestamp;

        // Securely transfer SOL from the user's wallet to the program's treasury PDA.
        let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.treasury.key(),
            ctx.accounts.ward_tax.amount,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        Ok(())
    }

    // File a new grievance.
    pub fn file_grievance(ctx: Context<FileGrievance>, details: String) -> Result<()> {
        let grievance = &mut ctx.accounts.grievance;
        grievance.user = *ctx.accounts.user.key;
        grievance.details = details;
        grievance.status = GrievanceStatus::Pending;
        grievance.timestamp = Clock::get()?.unix_timestamp;
        Ok(())
    }

    // Update the status of a grievance (only by Municipal Head).
    pub fn update_grievance_status(
        ctx: Context<UpdateGrievanceStatus>,
        new_status: GrievanceStatus,
    ) -> Result<()> {
        ctx.accounts.grievance.status = new_status;
        Ok(())
    }

    // Create a new project (only by Municipal Head).
    pub fn create_project(ctx: Context<CreateProject>, name: String, details: String) -> Result<()> {
        let project = &mut ctx.accounts.project;
        project.name = name;
        project.details = details;
        project.status = ProjectStatus::Planning;
        Ok(())
    }

    // Update the status of a project (e.g., to Done) (only by Municipal Head).
    pub fn update_project_status(
        ctx: Context<UpdateProjectStatus>,
        new_status: ProjectStatus,
    ) -> Result<()> {
        ctx.accounts.project.status = new_status;
        Ok(())
    }

    // User gives feedback on a completed project.
    pub fn give_feedback(ctx: Context<GiveFeedback>, comment: String, satisfied: bool) -> Result<()> {
        let feedback = &mut ctx.accounts.feedback;
        feedback.user = *ctx.accounts.user.key;
        feedback.project = ctx.accounts.project.key();
        feedback.comment = comment;
        feedback.satisfied = satisfied;
        Ok(())
    }
}

// ====== ACCOUNTS & INSTRUCTIONS CONTEXTS ======

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, seeds = [b"state"], bump, payer = user, space = State::LEN)]
    pub state: Account<'info, State>,
    /// CHECK: This is a PDA for the treasury, it is owned by the program and safe.
    #[account(mut, seeds = [b"treasury"], bump)]
    pub treasury: AccountInfo<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AssignAdminHead<'info> {
    #[account(
        mut, 
        seeds = [b"state"], 
        bump = state.state_bump,
        has_one = admin_govt @ ErrorCode::Unauthorized
    )]
    pub state: Account<'info, State>,
    pub admin_govt: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(ward: u16)]
pub struct SetWardTax<'info> {
    #[account(
        mut, 
        seeds = [b"state"], 
        bump = state.state_bump,
        has_one = admin_govt @ ErrorCode::Unauthorized
    )]
    pub state: Account<'info, State>,
    #[account(
        init_if_needed,
        payer = admin_govt,
        space = WardTax::LEN,
        seeds = [b"ward_tax", ward.to_le_bytes().as_ref()],
        bump
    )]
    pub ward_tax: Account<'info, WardTax>,
    #[account(mut)]
    pub admin_govt: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(ward: u16, year: u16)]
pub struct PayTax<'info> {
    #[account(
        init,
        payer = user,
        space = TaxPayment::LEN,
        seeds = [b"tax", user.key().as_ref(), year.to_le_bytes().as_ref()],
        bump
    )]
    pub tax_payment: Account<'info, TaxPayment>,
    #[account(seeds = [b"ward_tax", ward.to_le_bytes().as_ref()], bump = ward_tax.bump)]
    pub ward_tax: Account<'info, WardTax>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: This is a PDA for the treasury, it is owned by the program and safe.
    #[account(mut, seeds = [b"treasury"], bump = state.treasury_bump)]
    pub treasury: AccountInfo<'info>,
    #[account(seeds = [b"state"], bump = state.state_bump)]
    pub state: Account<'info, State>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FileGrievance<'info> {
    // Space allocation: 8 (discriminator) + 32 (user) + 4 + 512 (details string) + 1 (status) + 8 (timestamp)
    #[account(init, payer = user, space = 8 + 32 + 4 + 512 + 1 + 8)]
    pub grievance: Account<'info, Grievance>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateGrievanceStatus<'info> {
    #[account(mut)]
    pub grievance: Account<'info, Grievance>,
    // The signer of this transaction must be the admin_head.
    pub admin_head: Signer<'info>,
    // The `has_one` constraint checks that the `admin_head` field in the `state` account
    // matches the public key of the `admin_head` signer.
    #[account(
        seeds = [b"state"], 
        bump = state.state_bump,
        has_one = admin_head @ ErrorCode::Unauthorized
    )]
    pub state: Account<'info, State>,
}

#[derive(Accounts)]
pub struct CreateProject<'info> {
    // Space: 8 + 4 + 256 (name) + 4 + 512 (details) + 1 (status)
    #[account(init, payer = admin_head, space = 8 + 4 + 256 + 4 + 512 + 1)]
    pub project: Account<'info, Project>,
    #[account(mut)]
    pub admin_head: Signer<'info>,
    // The signer must be the authorized admin head.
    #[account(
        seeds = [b"state"], 
        bump = state.state_bump,
        has_one = admin_head @ ErrorCode::Unauthorized
    )]
    pub state: Account<'info, State>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateProjectStatus<'info> {
    #[account(mut)]
    pub project: Account<'info, Project>,
    pub admin_head: Signer<'info>,
    // Ensure the signer is the authorized admin head.
    #[account(
        seeds = [b"state"], 
        bump = state.state_bump,
        has_one = admin_head @ ErrorCode::Unauthorized
    )]
    pub state: Account<'info, State>,
}

#[derive(Accounts)]
pub struct GiveFeedback<'info> {
    // Space: 8 + 32 (user) + 32 (project) + 4 + 256 (comment) + 1 (satisfied)
    #[account(init, payer = user, space = 8 + 32 + 32 + 4 + 256 + 1)]
    pub feedback: Account<'info, Feedback>,
    #[account(constraint = project.status == ProjectStatus::Done @ ErrorCode::ProjectNotDone)]
    pub project: Account<'info, Project>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ====== DATA STRUCTS & ACCOUNTS ======

#[account]
pub struct State {
    pub admin_govt: Pubkey,
    pub admin_head: Pubkey,
    pub current_tax_year: u16,
    pub treasury_bump: u8,
    pub state_bump: u8, // Added state PDA bump
}

impl State {
    // 8 (discriminator) + 32 (admin_govt) + 32 (admin_head) + 2 (year) + 1 (treasury_bump) + 1 (state_bump)
    const LEN: usize = 8 + 32 + 32 + 2 + 1 + 1;
}

#[account]
pub struct WardTax {
    pub ward: u16,
    pub amount: u64, // in lamports
    pub bump: u8,
}

impl WardTax {
    // 8 (discriminator) + 2 (ward) + 8 (amount) + 1 (bump)
    const LEN: usize = 8 + 2 + 8 + 1;
}

#[account]
pub struct TaxPayment {
    pub user: Pubkey,
    pub amount: u64,
    pub year: u16,
    pub timestamp: i64,
}

impl TaxPayment {
    // 8 (discriminator) + 32 (user) + 8 (amount) + 2 (year) + 8 (timestamp)
    const LEN: usize = 8 + 32 + 8 + 2 + 8;
}

#[account]
pub struct Grievance {
    pub user: Pubkey,
    pub details: String,
    pub status: GrievanceStatus,
    pub timestamp: i64,
}

#[account]
pub struct Project {
    pub name: String,
    pub details: String,
    pub status: ProjectStatus,
}

#[account]
pub struct Feedback {
    pub user: Pubkey,
    pub project: Pubkey,
    pub comment: String,
    pub satisfied: bool,
}

// ====== ENUMS ======

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum GrievanceStatus {
    Pending,
    Accepted,
    Rejected,
    Done,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProjectStatus {
    Planning,
    Ongoing,
    Done,
}

// ====== ERRORS ======

#[error_code]
pub enum ErrorCode {
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,
    #[msg("The project must be marked as 'Done' to provide feedback.")]
    ProjectNotDone,
}