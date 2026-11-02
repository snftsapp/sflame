use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token_interface::{self, Burn, Mint, TokenAccount, TokenInterface};

mod quote;

use quote::{clamp_burn, config_on_pool, lamports_for_tokens, next_target, opening_raw, required_burn, LAUNCHLAB};

declare_id!("7C148tGcgFECnaEivuWGZ3pyDAzmevgFRLoVzmiQ2Cc3");

const GAME_SEED: &[u8] = b"game";
const ROUND_SECONDS: i64 = 180;
const START_TARGET: u64 = 500_000_000;

#[program]
pub mod sflame {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        game.authority = ctx.accounts.authority.key();
        game.target_lamports = START_TARGET;
        game.bump = ctx.bumps.game;
        Ok(())
    }

    pub fn set_mint(ctx: Context<SetMint>, min_burn: u64, max_burn: u64) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(game.mint == Pubkey::default(), GameError::MintSet);
        require!(game.deadline == 0, GameError::RoundLive);
        let opening = opening_raw(ctx.accounts.mint.decimals)?;
        require!(min_burn > 0 && min_burn <= opening && opening <= max_burn, GameError::BadBounds);
        game.mint = ctx.accounts.mint.key();
        game.token_program = ctx.accounts.token_program.key();
        game.min_burn = min_burn;
        game.max_burn = max_burn;
        game.opening_burn = opening;
        Ok(())
    }

    pub fn set_bounds(ctx: Context<AuthorityOnly>, min_burn: u64, max_burn: u64) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(game.deadline == 0, GameError::RoundLive);
        require!(game.mint != Pubkey::default(), GameError::MintUnset);
        require!(
            min_burn > 0 && min_burn <= game.opening_burn && game.opening_burn <= max_burn,
            GameError::BadBounds
        );
        game.min_burn = min_burn;
        game.max_burn = max_burn;
        Ok(())
    }

    pub fn fund(ctx: Context<Fund>, amount: u64) -> Result<()> {
        require!(amount > 0, GameError::Math);
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.funder.to_account_info(),
                    to: ctx.accounts.game.to_account_info(),
                },
            ),
            amount,
        )
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let game = &ctx.accounts.game;
        require!(game.deadline == 0, GameError::RoundLive);
        let pot = pot_of(&ctx.accounts.game.to_account_info())?;
        require!(amount > 0 && amount <= pot, GameError::NothingToWithdraw);
        move_lamports(&ctx.accounts.game.to_account_info(), &ctx.accounts.authority.to_account_info(), amount)
    }

    pub fn burn(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let game = &ctx.accounts.game;
        require!(game.mint != Pubkey::default(), GameError::MintUnset);
        require!(game.deadline == 0 || now < game.deadline, GameError::RoundOver);
        require!(amount > 0, GameError::BurnTooSmall);

        let pot = pot_of(&game.to_account_info())?;
        require!(pot > 0, GameError::EmptyPot);

        let pool = ctx.accounts.pool.try_borrow_data()?;
        let config = ctx.accounts.curve_config.try_borrow_data()?;
        require!(ctx.accounts.pool.owner == &LAUNCHLAB, GameError::BadPool);
        require!(ctx.accounts.curve_config.owner == &LAUNCHLAB, GameError::BadPool);
        require!(config_on_pool(&pool)? == ctx.accounts.curve_config.key(), GameError::BadPool);

        let (required, paid_target) = if game.round_burns == 0 {
            let sol = lamports_for_tokens(
                &pool,
                &config,
                &ctx.accounts.curve_config.key(),
                &game.mint,
                game.opening_burn,
            )?;
            (game.opening_burn, sol)
        } else {
            let quoted = required_burn(
                &pool,
                &config,
                &ctx.accounts.curve_config.key(),
                &game.mint,
                game.target_lamports,
            )?;
            (clamp_burn(quoted, game.min_burn, game.max_burn), game.target_lamports)
        };
        require!(amount >= required, GameError::BurnTooSmall);
        drop(pool);
        drop(config);

        token_interface::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.user_token.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        let game = &mut ctx.accounts.game;
        game.last_burner = ctx.accounts.user.key();
        game.last_amount = amount;
        game.last_target_lamports = paid_target;
        game.burns = game.burns.checked_add(1).ok_or(GameError::Math)?;
        game.round_burns = game.round_burns.checked_add(1).ok_or(GameError::Math)?;
        game.deadline = now.checked_add(ROUND_SECONDS).ok_or(GameError::Math)?;
        game.target_lamports = next_target(paid_target)?;
        emit!(Burned {
            burner: game.last_burner,
            amount,
            target_lamports: paid_target,
            deadline: game.deadline,
            round: game.round,
        });
        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let game = &ctx.accounts.game;
        require!(game.deadline != 0 && now >= game.deadline, GameError::RoundLive);
        require!(game.last_burner == ctx.accounts.winner.key(), GameError::BadWinner);
        let pot = pot_of(&game.to_account_info())?;
        require!(pot > 0, GameError::EmptyPot);
        move_lamports(&ctx.accounts.game.to_account_info(), &ctx.accounts.winner.to_account_info(), pot)?;

        let game = &mut ctx.accounts.game;
        game.deadline = 0;
        game.last_burner = Pubkey::default();
        game.last_amount = 0;
        game.last_target_lamports = 0;
        game.target_lamports = START_TARGET;
        game.round_burns = 0;
        game.round = game.round.checked_add(1).ok_or(GameError::Math)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Game::INIT_SPACE,
        seeds = [GAME_SEED],
        bump
    )]
    pub game: Account<'info, Game>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetMint<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [GAME_SEED], bump = game.bump, has_one = authority)]
    pub game: Account<'info, Game>,
    #[account(constraint = *mint.to_account_info().owner == token_program.key())]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct AuthorityOnly<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [GAME_SEED], bump = game.bump, has_one = authority)]
    pub game: Account<'info, Game>,
}

#[derive(Accounts)]
pub struct Fund<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,
    #[account(mut, seeds = [GAME_SEED], bump = game.bump)]
    pub game: Account<'info, Game>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [GAME_SEED], bump = game.bump, has_one = authority)]
    pub game: Account<'info, Game>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    pub user: Signer<'info>,
    #[account(mut, seeds = [GAME_SEED], bump = game.bump)]
    pub game: Account<'info, Game>,
    #[account(
        mut,
        constraint = user_token.mint == game.mint,
        constraint = user_token.owner == user.key(),
    )]
    pub user_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        constraint = mint.key() == game.mint,
        constraint = token_program.key() == game.token_program,
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    /// CHECK: owner, discriminator, mint, and curve status are checked in `required_burn`.
    pub pool: UncheckedAccount<'info>,
    /// CHECK: owner and the pool's stored config id are checked before the quote is read.
    pub curve_config: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    pub crank: Signer<'info>,
    #[account(mut, seeds = [GAME_SEED], bump = game.bump)]
    pub game: Account<'info, Game>,
    /// CHECK: must be the stored last burner. Lamports are credited, not debited.
    #[account(mut)]
    pub winner: UncheckedAccount<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Game {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub token_program: Pubkey,
    pub min_burn: u64,
    pub max_burn: u64,
    pub target_lamports: u64,
    pub deadline: i64,
    pub last_burner: Pubkey,
    pub last_amount: u64,
    pub last_target_lamports: u64,
    pub opening_burn: u64,
    pub burns: u64,
    pub round_burns: u64,
    pub round: u64,
    pub bump: u8,
}

#[event]
pub struct Burned {
    pub burner: Pubkey,
    pub amount: u64,
    pub target_lamports: u64,
    pub deadline: i64,
    pub round: u64,
}

#[error_code]
pub enum GameError {
    #[msg("Mint is already set")]
    MintSet,
    #[msg("Mint is not set")]
    MintUnset,
    #[msg("Round is still live")]
    RoundLive,
    #[msg("Clock is over. Claim the pot.")]
    RoundOver,
    #[msg("Pot is empty")]
    EmptyPot,
    #[msg("Burn is below the quote")]
    BurnTooSmall,
    #[msg("Floor must be above zero and below the ceiling")]
    BadBounds,
    #[msg("Nothing to withdraw")]
    NothingToWithdraw,
    #[msg("Pool is not the sFlame SOL curve")]
    BadPool,
    #[msg("Curve reserves are unusable")]
    BadReserves,
    #[msg("Curve has graduated. Price has to come from the Raydium pool.")]
    CurveGraduated,
    #[msg("Only a SOL constant-product curve is priced")]
    CurveUnsupported,
    #[msg("Winner account does not match the last burn")]
    BadWinner,
    #[msg("Math overflow")]
    Math,
}

fn pot_of(game: &AccountInfo) -> Result<u64> {
    let rent = Rent::get()?.minimum_balance(game.data_len());
    Ok(game.lamports().saturating_sub(rent))
}

fn move_lamports(from: &AccountInfo, to: &AccountInfo, amount: u64) -> Result<()> {
    let next_from = from.lamports().checked_sub(amount).ok_or(GameError::Math)?;
    let next_to = to.lamports().checked_add(amount).ok_or(GameError::Math)?;
    **from.try_borrow_mut_lamports()? = next_from;
    **to.try_borrow_mut_lamports()? = next_to;
    Ok(())
}
