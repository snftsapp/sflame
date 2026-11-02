use anchor_lang::prelude::{pubkey, Pubkey};

use crate::GameError;

pub const LAUNCHLAB: Pubkey = pubkey!("LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj");
pub const WSOL: Pubkey = pubkey!("So11111111111111111111111111111111111111112");

const POOL_DISC: [u8; 8] = [247, 237, 227, 245, 215, 195, 222, 70];
const CONFIG_DISC: [u8; 8] = [149, 8, 156, 202, 160, 252, 176, 217];

const OFF_STATUS: usize = 17;
const OFF_QUOTE_DECIMALS: usize = 19;
const OFF_VIRTUAL_BASE: usize = 37;
const OFF_VIRTUAL_QUOTE: usize = 45;
const OFF_REAL_BASE: usize = 53;
const OFF_REAL_QUOTE: usize = 61;
const OFF_CONFIG: usize = 141;
const OFF_BASE_MINT: usize = 205;
const OFF_QUOTE_MINT: usize = 237;
const OFF_CURVE_TYPE: usize = 16;
const OFF_CONFIG_MINT: usize = 83;

const CURVE_OPEN: u8 = 0;
const CONSTANT_PRODUCT: u8 = 0;
const QUOTE_DECIMALS: u8 = 9;
const POOL_MIN_LEN: usize = 429;
const CONFIG_MIN_LEN: usize = 115;

pub fn tokens_for_target(target_lamports: u64, base_reserve: u64, quote_reserve: u64) -> Result<u64, GameError> {
    if base_reserve == 0 || quote_reserve == 0 {
        return Err(GameError::BadReserves);
    }
    let num = (target_lamports as u128)
        .checked_mul(base_reserve as u128)
        .ok_or(GameError::Math)?;
    let tokens = num.div_ceil(quote_reserve as u128);
    u64::try_from(tokens).map_err(|_| GameError::Math)
}

pub fn clamp_burn(tokens: u64, min_burn: u64, max_burn: u64) -> u64 {
    tokens.max(min_burn).min(max_burn)
}

pub const START_WHOLE_TOKENS: u64 = 50_000;

pub fn opening_raw(decimals: u8) -> Result<u64, GameError> {
    let mut raw = START_WHOLE_TOKENS as u128;
    for _ in 0..decimals {
        raw = raw.checked_mul(10).ok_or(GameError::Math)?;
    }
    u64::try_from(raw).map_err(|_| GameError::Math)
}

pub fn lamports_for_tokens(
    pool: &[u8],
    config: &[u8],
    config_key: &Pubkey,
    mint: &Pubkey,
    token_amount: u64,
) -> Result<u64, GameError> {
    let (base_reserve, quote_reserve) = curve_reserves(pool, config, config_key, mint)?;
    if token_amount == 0 {
        return Err(GameError::BurnTooSmall);
    }
    let num = (token_amount as u128)
        .checked_mul(quote_reserve as u128)
        .ok_or(GameError::Math)?;
    let lamports = num.div_ceil(base_reserve as u128);
    u64::try_from(lamports).map_err(|_| GameError::Math)
}

pub fn next_target(current: u64) -> Result<u64, GameError> {
    let next = (current as u128)
        .checked_mul(105)
        .ok_or(GameError::Math)?
        / 100;
    u64::try_from(next).map_err(|_| GameError::Math)
}

pub fn required_burn(
    pool: &[u8],
    config: &[u8],
    config_key: &Pubkey,
    mint: &Pubkey,
    target_lamports: u64,
) -> Result<u64, GameError> {
    let (base_reserve, quote_reserve) = curve_reserves(pool, config, config_key, mint)?;
    tokens_for_target(target_lamports, base_reserve, quote_reserve)
}

fn curve_reserves(pool: &[u8], config: &[u8], config_key: &Pubkey, mint: &Pubkey) -> Result<(u64, u64), GameError> {
    if pool.len() < POOL_MIN_LEN || pool[..8] != POOL_DISC {
        return Err(GameError::BadPool);
    }
    if config.len() < CONFIG_MIN_LEN || config[..8] != CONFIG_DISC {
        return Err(GameError::BadPool);
    }
    if pool[OFF_STATUS] != CURVE_OPEN {
        return Err(GameError::CurveGraduated);
    }
    if pool[OFF_QUOTE_DECIMALS] != QUOTE_DECIMALS || config[OFF_CURVE_TYPE] != CONSTANT_PRODUCT {
        return Err(GameError::CurveUnsupported);
    }

    let base_mint = read_pubkey(pool, OFF_BASE_MINT)?;
    let quote_mint = read_pubkey(pool, OFF_QUOTE_MINT)?;
    let config_id = read_pubkey(pool, OFF_CONFIG)?;
    let config_mint = read_pubkey(config, OFF_CONFIG_MINT)?;
    if base_mint != *mint || quote_mint != WSOL || config_mint != WSOL || config_id != *config_key {
        return Err(GameError::BadPool);
    }

    let virtual_base = read_u64(pool, OFF_VIRTUAL_BASE)?;
    let virtual_quote = read_u64(pool, OFF_VIRTUAL_QUOTE)?;
    let real_base = read_u64(pool, OFF_REAL_BASE)?;
    let real_quote = read_u64(pool, OFF_REAL_QUOTE)?;
    let base_reserve = virtual_base.checked_sub(real_base).ok_or(GameError::BadReserves)?;
    let quote_reserve = virtual_quote.checked_add(real_quote).ok_or(GameError::BadReserves)?;
    if base_reserve == 0 || quote_reserve == 0 {
        return Err(GameError::BadReserves);
    }
    Ok((base_reserve, quote_reserve))
}

pub fn config_on_pool(pool: &[u8]) -> Result<Pubkey, GameError> {
    if pool.len() < POOL_MIN_LEN {
        return Err(GameError::BadPool);
    }
    read_pubkey(pool, OFF_CONFIG)
}

fn read_u64(data: &[u8], offset: usize) -> Result<u64, GameError> {
    let end = offset.checked_add(8).ok_or(GameError::BadPool)?;
    let bytes: [u8; 8] = data.get(offset..end).ok_or(GameError::BadPool)?.try_into().unwrap();
    Ok(u64::from_le_bytes(bytes))
}

fn read_pubkey(data: &[u8], offset: usize) -> Result<Pubkey, GameError> {
    let end = offset.checked_add(32).ok_or(GameError::BadPool)?;
    let bytes: [u8; 32] = data.get(offset..end).ok_or(GameError::BadPool)?.try_into().unwrap();
    Ok(Pubkey::new_from_array(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pool_bytes(mint: &Pubkey, config: &Pubkey, status: u8) -> Vec<u8> {
        let mut buf = vec![0u8; POOL_MIN_LEN];
        buf[..8].copy_from_slice(&POOL_DISC);
        buf[OFF_STATUS] = status;
        buf[OFF_QUOTE_DECIMALS] = QUOTE_DECIMALS;
        put_u64(&mut buf, OFF_VIRTUAL_BASE, 1_000_000_000_000_000);
        put_u64(&mut buf, OFF_VIRTUAL_QUOTE, 30_000_000_000);
        put_u64(&mut buf, OFF_REAL_BASE, 200_000_000_000_000);
        put_u64(&mut buf, OFF_REAL_QUOTE, 10_000_000_000);
        put_pubkey(&mut buf, OFF_CONFIG, config);
        put_pubkey(&mut buf, OFF_BASE_MINT, mint);
        put_pubkey(&mut buf, OFF_QUOTE_MINT, &WSOL);
        buf
    }

    fn config_bytes() -> Vec<u8> {
        let mut buf = vec![0u8; CONFIG_MIN_LEN];
        buf[..8].copy_from_slice(&CONFIG_DISC);
        buf[OFF_CURVE_TYPE] = CONSTANT_PRODUCT;
        put_pubkey(&mut buf, OFF_CONFIG_MINT, &WSOL);
        buf
    }

    fn put_u64(buf: &mut [u8], at: usize, value: u64) {
        buf[at..at + 8].copy_from_slice(&value.to_le_bytes());
    }

    fn put_pubkey(buf: &mut [u8], at: usize, key: &Pubkey) {
        buf[at..at + 32].copy_from_slice(key.as_ref());
    }

    #[test]
    fn ceil_div_matches_a_remainder() {
        assert_eq!(tokens_for_target(10, 3, 2).unwrap(), 15);
    }

    #[test]
    fn half_sol_quote_uses_curve_reserves() {
        let mint = Pubkey::new_unique();
        let config = Pubkey::new_unique();
        let tokens = required_burn(&pool_bytes(&mint, &config, 0), &config_bytes(), &config, &mint, 500_000_000).unwrap();
        // base = 1e15 - 2e14 = 8e14, quote = 3e10 + 1e10 = 4e10
        // ceil(500_000_000 * 8e14 / 4e10) = 10_000_000_000_000
        assert_eq!(tokens, 10_000_000_000_000);
    }

    #[test]
    fn clamp_stops_a_dump_from_taking_the_supply() {
        assert_eq!(clamp_burn(90_000_000_000_000, 1_000, 50_000_000_000_000), 50_000_000_000_000);
        assert_eq!(clamp_burn(10, 1_000, 50_000), 1_000);
    }

    #[test]
    fn target_rises_five_percent() {
        assert_eq!(next_target(500_000_000).unwrap(), 525_000_000);
    }

    #[test]
    fn opening_burn_is_fifty_thousand_whole_tokens() {
        assert_eq!(opening_raw(6).unwrap(), 50_000_000_000);
        assert_eq!(opening_raw(0).unwrap(), 50_000);
    }

    #[test]
    fn graduated_curve_is_rejected() {
        let mint = Pubkey::new_unique();
        let config = Pubkey::new_unique();
        let err = required_burn(&pool_bytes(&mint, &config, 2), &config_bytes(), &config, &mint, 500_000_000).unwrap_err();
        assert!(matches!(err, GameError::CurveGraduated));
    }

    #[test]
    fn wrong_mint_is_rejected() {
        let mint = Pubkey::new_unique();
        let config = Pubkey::new_unique();
        let err = required_burn(&pool_bytes(&mint, &config, 0), &config_bytes(), &config, &Pubkey::new_unique(), 500_000_000).unwrap_err();
        assert!(matches!(err, GameError::BadPool));
    }
}
