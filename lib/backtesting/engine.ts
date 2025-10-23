import {
  Strategy,
  PolymarketMarket,
  BacktestResult,
  BacktestBet,
  EarningsPoint,
  Bet,
  StrategyContext,
} from '@/types';
import { orderBy } from 'lodash';

export class BacktestEngine {
  /**
   * Backtest a strategy on historical market data
   */
  static backtest(
    strategy: Strategy,
    markets: PolymarketMarket[],
    trainingRatio = 0.8
  ): BacktestResult {
    console.log(`\n=== Backtesting ${strategy.name} ===`);
    console.log(`Total markets provided: ${markets.length}`);

    // Filter only resolved markets for backtesting
    const resolvedMarkets = markets.filter((m) => m.resolvedOutcome !== null);
    console.log(`Resolved markets: ${resolvedMarkets.length}`);

    if (resolvedMarkets.length === 0) {
      console.warn(`⚠️ No resolved markets found for backtesting ${strategy.name}`);
    }

    // Split chronologically: 80% training, 20% test
    const sortedMarkets = orderBy(resolvedMarkets, ['endDate'], ['asc']);
    const splitIndex = Math.floor(sortedMarkets.length * trainingRatio);
    const testMarkets = sortedMarkets.slice(splitIndex);
    const trainingMarkets = sortedMarkets.slice(0, splitIndex);

    console.log(`Training markets: ${trainingMarkets.length}, Test markets: ${testMarkets.length}`);

    const preparedTestMarkets = testMarkets.map((market) =>
      this.prepareMarketSnapshot(market)
    );

    const backtestContext: StrategyContext = {
      mode: 'backtest',
      trainingMarkets,
      evaluationMarkets: testMarkets,
    };

    // Generate bets for test markets
    console.log(`Generating bets for ${preparedTestMarkets.length} test markets...`);
    const proposedBets = strategy.generateBets(
      preparedTestMarkets,
      backtestContext
    );
    console.log(`Generated ${proposedBets.length} bets`);

    const backtestBets: BacktestBet[] = [];
    let cumulativeEarnings = 0;
    const earningsOverTime: EarningsPoint[] = [];

    // Simulate each bet
    proposedBets.forEach((bet) => {
      const market = testMarkets.find((m) => m.marketId === bet.marketId);
      if (!market || !market.resolvedOutcome) return;

      // Calculate bet outcome
      const betWon = this.isBetWinner(bet, market.resolvedOutcome);
      const cost = bet.amount * bet.priceLimit;
      const payout = betWon ? bet.amount : 0; // Simplified: 1 share = $1 if won

      cumulativeEarnings += payout - cost;

      backtestBets.push({
        ...bet,
        result: betWon ? 'win' : 'loss',
        payout,
        cost,
      });

      earningsOverTime.push({
        timestamp: bet.timestamp,
        cumulativeEarnings,
        strategyId: strategy.id,
      });
    });

    // Calculate metrics
    const wins = backtestBets.filter((b) => b.result === 'win').length;
    const losses = backtestBets.filter((b) => b.result === 'loss').length;
    const totalCost = backtestBets.reduce((sum, b) => sum + b.cost, 0);
    const totalWinnings = backtestBets.reduce((sum, b) => sum + b.payout, 0);
    const netProfit = totalWinnings - totalCost;
    const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      totalBets: backtestBets.length,
      wins,
      losses,
      winRate: backtestBets.length > 0 ? (wins / backtestBets.length) * 100 : 0,
      totalCost,
      totalWinnings,
      netProfit,
      roi,
      bets: backtestBets,
      earningsOverTime,
    };
  }

  /**
   * Determine if a bet won based on market resolution
   */
  private static isBetWinner(bet: Bet, resolvedOutcome: string): boolean {
    // Simplified logic: buy bets win if outcome matches
    if (bet.side === 'buy') {
      return bet.outcome.toLowerCase() === resolvedOutcome.toLowerCase();
    } else {
      // Sell bets win if outcome doesn't match
      return bet.outcome.toLowerCase() !== resolvedOutcome.toLowerCase();
    }
  }

  /**
   * Calculate summary statistics for historical data
   */
  static calculateHistoricalStats(markets: PolymarketMarket[]) {
    const resolvedMarkets = markets.filter((m) => m.resolvedOutcome !== null);
    const volatileMarkets = markets
      .filter((m) => m.historicalPrices.length > 10)
      .map((m) => {
        const prices = m.historicalPrices.map((p) => p.price);
        const variance =
          prices.reduce((sum, p) => sum + Math.pow(p - 0.5, 2), 0) /
          prices.length;
        return { marketId: m.marketId, question: m.question, variance };
      })
      .sort((a, b) => b.variance - a.variance)
      .slice(0, 5);

    const outcomeFreq = resolvedMarkets.reduce((acc, m) => {
      acc[m.resolvedOutcome!] = (acc[m.resolvedOutcome!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalMarkets: markets.length,
      resolvedMarkets: resolvedMarkets.length,
      avgVolume:
        markets.length > 0
          ? markets.reduce((sum, m) => sum + m.volume, 0) / markets.length
          : 0,
      avgLiquidity:
        markets.length > 0
          ? markets.reduce((sum, m) => sum + m.liquidity, 0) / markets.length
          : 0,
      volatileMarkets,
      topOutcomes: outcomeFreq,
    };
  }

  /**
   * Prepare a market snapshot for backtesting so strategies see unresolved data
   */
  private static prepareMarketSnapshot(
    market: PolymarketMarket
  ): PolymarketMarket {
    const historicalPrices = orderBy(
      market.historicalPrices.map((price) => ({ ...price })),
      ['timestamp'],
      ['asc']
    );
    const trades = orderBy(
      market.trades.map((trade) => ({ ...trade })),
      ['timestamp'],
      ['asc']
    );

    return {
      ...market,
      active: true,
      resolvedOutcome: null,
      historicalPrices,
      trades,
    };
  }
}
