use soroban_sdk::{contracttype, Address, String, Symbol, Vec};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Keyed by market_id. Represents a prediction market instance.
    Market(u64),
    /// Keyed by (market_id, predictor). Represents a user's prediction in a given market.
    Prediction(u64, Address),
    /// Keyed by user address. Represents an individual user's profile or state.
    User(Address),
    /// Keyed by season_id. Stores the leaderboard rankings per season.
    Leaderboard(u64),
    /// Keyed by season number. Represents a season's metadata and schedule.
    Season(u32),
    /// Keyed by code symbol. Maps an invite code to its underlying metadata.
    InviteCode(Symbol),
    /// Singleton. Holds global configuration for the platform.
    Config,
    /// Global counter. Tracks the total number of markets created.
    MarketCount,
    /// Global counter. Tracks the total number of seasons.
    SeasonCount,
    /// Emergency pause flag. Used to halt sensitive operations across the platform.
    Paused,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Market {
    /// Unique identifier for the market.
    pub market_id: u64,
    /// Address of the user who created this market.
    pub creator: Address,
    /// Title of the prediction market.
    pub title: String,
    /// Detailed description or rules for resolution.
    pub description: String,
    /// Category of the market (e.g., "Sports", "Crypto").
    pub category: Symbol,
    /// Valid outcome symbols users can predict (e.g., ["TeamA", "TeamB"]).
    pub outcome_options: Vec<Symbol>,
    /// The ledger timestamp indicating when the market becomes active.
    pub start_time: u64,
    /// The ledger timestamp after which predictions are no longer accepted.
    pub end_time: u64,
    /// The ledger timestamp after which the outcome can be officially resolved.
    pub resolution_time: u64,
    /// The final outcome, set only after the market is resolved. Defaults to None.
    pub resolved_outcome: Option<Symbol>,
    /// Indicates whether the market has been resolved and payouts processed. Defaults to false.
    pub is_resolved: bool,
    /// If true, the market is open to anyone. If false, it acts as a private competition.
    pub is_public: bool,
    /// The aggregate amount of native tokens (XLM in stroops) staked in the market. Defaults to 0.
    pub total_pool: i128,
    /// The fee fraction assigned to the creator, measured in basis points (bps). Max 500 (5%).
    pub creator_fee_bps: u32,
    /// The predefined minimum stake permissible for a single prediction.
    pub min_stake: i128,
    /// The predefined maximum stake permissible for a single prediction.
    pub max_stake: i128,
    /// The current number of unique participants holding a stake. Defaults to 0.
    pub participant_count: u32,
}

impl Market {
    /// Creates a novel, un-resolved Market struct instance initialized with default participant and pooling metrics.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        market_id: u64,
        creator: Address,
        title: String,
        description: String,
        category: Symbol,
        outcome_options: Vec<Symbol>,
        start_time: u64,
        end_time: u64,
        resolution_time: u64,
        is_public: bool,
        creator_fee_bps: u32,
        min_stake: i128,
        max_stake: i128,
    ) -> Self {
        Self {
            market_id,
            creator,
            title,
            description,
            category,
            outcome_options,
            start_time,
            end_time,
            resolution_time,
            resolved_outcome: None,
            is_resolved: false,
            is_public,
            total_pool: 0,
            creator_fee_bps,
            min_stake,
            max_stake,
            participant_count: 0,
        }
    }
}
