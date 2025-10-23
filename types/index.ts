export interface PolymarketMarket {
  marketId: string;
  question: string;
  outcomes: string[];
  resolutionDate: Date | null;
  historicalPrices: PricePoint[];
  trades: Trade[];
  resolvedOutcome: string | null;
  volume: number;
  liquidity: number;
  active: boolean;
  endDate: Date | null;
  image?: string;
  category?: string;
}

export interface PricePoint {
  timestamp: Date;
  price: number;
  outcome: string;
}

export interface Trade {
  timestamp: Date;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  outcome: string;
  maker?: string;
  taker?: string;
}

export interface Bet {
  marketId: string;
  outcome: string;
  side: 'buy' | 'sell';
  amount: number;
  priceLimit: number;
  reason: string;
  timestamp: Date;
}

export interface StrategyContext {
  mode: 'live' | 'backtest';
  asOf?: Date;
  trainingMarkets?: PolymarketMarket[];
  evaluationMarkets?: PolymarketMarket[];
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  type: 'copy_trading' | 'spike_detection' | 'market_making' | 'ai_generated';
  generateBets: (markets: PolymarketMarket[], context: StrategyContext) => Bet[];
  parameters: Record<string, any>;
  code?: string;
}

export interface BacktestResult {
  strategyId: string;
  strategyName: string;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  totalCost: number;
  totalWinnings: number;
  netProfit: number;
  roi: number;
  bets: BacktestBet[];
  earningsOverTime: EarningsPoint[];
}

export interface BacktestBet extends Bet {
  result: 'win' | 'loss' | 'pending';
  payout: number;
  cost: number;
}

export interface EarningsPoint {
  timestamp: Date;
  cumulativeEarnings: number;
  strategyId: string;
}

export interface StrategyBenchmark {
  strategyId: string;
  strategyName: string;
  epoch: number;
  winRate: number;
  roi: number;
  netProfit: number;
  totalBets: number;
  improvementPercent: number;
}

export interface XSentiment {
  marketId: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  tweets: number;
}

export interface SimulationState {
  isRunning: boolean;
  currentEpoch: number;
  totalEpochs: number;
  progress: number;
  logs: string[];
}
