import { Strategy, PolymarketMarket, Bet, StrategyContext } from '@/types';
import { orderBy, mean } from 'lodash';

type StrategyMode = StrategyContext['mode'];

const COPY_TRADING_DEFAULTS = {
  minWhaleVolume: 1000,        // Minimum $1,000 trade to be considered a whale
  copyDelay: 7200,              // Copy trades within 2 hours (7200 seconds)
  betSize: 100,                 // $100 per bet
  maxBetsPerMarket: 3,          // Maximum 3 whale trades to copy per market
  minMarketLiquidity: 50000,    // Minimum $50k market liquidity
};

const SPIKE_DETECTION_DEFAULTS = {
  spikeThreshold: 0.05,
  lookbackWindow: 24,
  betSize: 100,  // $100 per bet
};

const MARKET_MAKING_DEFAULTS = {
  minSpread: 0.02,
  maxSpread: 0.08,
  betSizePerSide: 100,  // $100 per side
  minLiquidity: 30000,  // Minimum $30k liquidity
};

const resolveMode = (context: StrategyContext): StrategyMode =>
  context?.mode ?? 'live';

const isMarketEligible = (
  market: PolymarketMarket,
  mode: StrategyMode
): boolean => {
  if (mode === 'backtest') {
    return true;
  }

  return !market.resolvedOutcome && market.active;
};

const determineDecisionTime = (
  market: PolymarketMarket,
  mode: StrategyMode
): Date => {
  if (mode === 'backtest') {
    if (market.historicalPrices.length > 0) {
      const latestPoint =
        market.historicalPrices[market.historicalPrices.length - 1];
      return new Date(latestPoint.timestamp);
    }

    if (market.endDate) {
      return new Date(market.endDate);
    }

    if (market.resolutionDate) {
      return new Date(market.resolutionDate);
    }
  }

  return new Date();
};

const clampPrice = (price: number) =>
  Math.max(0.01, Math.min(0.99, price));

// Strategy 1: Copy Trading (monitor whale addresses)
export const copyTradingStrategy: Strategy = {
  id: 'copy_trading',
  name: 'Whale Copy Trading',
  description: 'Copy trades from high-volume addresses (whales) within 1 hour',
  type: 'copy_trading',
  parameters: { ...COPY_TRADING_DEFAULTS },
  generateBets: (markets: PolymarketMarket[], context: StrategyContext): Bet[] => {
    const bets: Bet[] = [];
    const mode = resolveMode(context);

    // Use strategy parameters (which can be updated by AI)
    const params = copyTradingStrategy.parameters as typeof COPY_TRADING_DEFAULTS;
    const { minWhaleVolume, copyDelay, betSize, maxBetsPerMarket, minMarketLiquidity } = params;

    console.log(`\n[Whale Copy Trading] Processing ${markets.length} markets in ${mode} mode`);
    console.log(`Parameters: minWhale=$${minWhaleVolume}, copyDelay=${copyDelay}s, betSize=$${betSize}, maxPerMarket=${maxBetsPerMarket}, minLiq=$${minMarketLiquidity}`);

    let eligibleCount = 0;
    let liquidCount = 0;
    let totalWhaleTrades = 0;
    let totalRecentWhales = 0;
    let marketsWithBets = 0;

    markets.forEach((market) => {
      if (!isMarketEligible(market, mode)) return;
      eligibleCount++;

      // Check liquidity requirement
      if (market.liquidity < minMarketLiquidity) return;
      liquidCount++;

      const decisionTime = determineDecisionTime(market, mode);

      // Identify whale trades (large volume)
      const whaleTrades = market.trades.filter((trade) => {
        if (trade.amount < minWhaleVolume) return false;
        return trade.timestamp.getTime() <= decisionTime.getTime();
      });
      totalWhaleTrades += whaleTrades.length;

      // Copy recent whale trades
      const recentWhales = whaleTrades.filter((trade) => {
        const timeDiff =
          (decisionTime.getTime() - trade.timestamp.getTime()) / 1000;
        return timeDiff >= 0 && timeDiff <= copyDelay;
      });
      totalRecentWhales += recentWhales.length;

      // Sort by trade size (copy biggest whales first) and limit per market
      const topWhales = orderBy(recentWhales, ['amount'], ['desc']).slice(0, maxBetsPerMarket);

      if (topWhales.length > 0) {
        marketsWithBets++;
      }

      topWhales.forEach((whaleTrade) => {
        bets.push({
          marketId: market.marketId,
          outcome: whaleTrade.outcome,
          side: whaleTrade.side,
          amount: betSize,
          priceLimit: clampPrice(whaleTrade.price + 0.02),
          reason: `Whale $${whaleTrade.amount.toFixed(0)} @ ${whaleTrade.price.toFixed(3)}`,
          timestamp: decisionTime,
        });
      });
    });

    console.log(`[Whale Copy Trading] Markets: ${eligibleCount} eligible, ${liquidCount} liquid (>$${minMarketLiquidity}), ${marketsWithBets} with bets | Whales: ${totalWhaleTrades} total, ${totalRecentWhales} recent → ${bets.length} bets generated`);
    return bets; // Return all whale copy bets
  },
};

// Strategy 2: Spike Detection (bet against sudden price movements)
export const spikeDetectionStrategy: Strategy = {
  id: 'spike_detection',
  name: 'Price Spike Reversal',
  description: 'Detect price spikes >5% and bet on mean reversion',
  type: 'spike_detection',
  parameters: { ...SPIKE_DETECTION_DEFAULTS },
  generateBets: (markets: PolymarketMarket[], context: StrategyContext): Bet[] => {
    const bets: Bet[] = [];
    const mode = resolveMode(context);
    const { spikeThreshold, lookbackWindow, betSize } =
      SPIKE_DETECTION_DEFAULTS;

    console.log(`\n[Spike Detection] Processing ${markets.length} markets in ${mode} mode`);
    let eligibleCount = 0;
    let sufficientDataCount = 0;
    let spikesDetected = 0;

    markets.forEach((market) => {
      if (!isMarketEligible(market, mode)) return;
      eligibleCount++;
      if (market.historicalPrices.length < 10) return;
      sufficientDataCount++;

      const decisionTime = determineDecisionTime(market, mode);

      // Sort prices by timestamp
      const sortedPrices = orderBy(
        market.historicalPrices,
        ['timestamp'],
        ['asc']
      );

      // Get recent prices (last 24 hours)
      const cutoffTime = new Date(
        decisionTime.getTime() - lookbackWindow * 60 * 60 * 1000
      );
      const recentPrices = sortedPrices.filter(
        (p) =>
          p.timestamp >= cutoffTime &&
          p.timestamp.getTime() <= decisionTime.getTime()
      );

      if (recentPrices.length < 5) return;

      // Calculate mean and current price
      const avgPrice = mean(recentPrices.map((p) => p.price));
      const currentPrice = recentPrices[recentPrices.length - 1].price;
      const priceChange = (currentPrice - avgPrice) / avgPrice;

      // Detect spike
      if (Math.abs(priceChange) > spikeThreshold) {
        spikesDetected++;
        // Bet against the spike (mean reversion)
        const betSide: 'buy' | 'sell' = priceChange > 0 ? 'sell' : 'buy';
        const targetPrice =
          betSide === 'sell' ? currentPrice - 0.03 : currentPrice + 0.03;

        bets.push({
          marketId: market.marketId,
          outcome: market.outcomes[0],
          side: betSide,
          amount: betSize,
          priceLimit: clampPrice(targetPrice),
          reason: `Spike detected: ${(priceChange * 100).toFixed(1)}% change. Betting on reversion to mean ${avgPrice.toFixed(3)}`,
          timestamp: decisionTime,
        });
      }
    });

    console.log(`[Spike Detection] Eligible: ${eligibleCount}, Sufficient data: ${sufficientDataCount}, Spikes detected: ${spikesDetected}, Bets: ${bets.length}`);
    return bets;
  },
};

// Strategy 3: Market Making (place bids/asks around mid-price)
export const marketMakingStrategy: Strategy = {
  id: 'market_making',
  name: 'Liquidity Provider Market Making',
  description: 'Place balanced bids/asks with spreads for high-liquidity markets',
  type: 'market_making',
  parameters: { ...MARKET_MAKING_DEFAULTS },
  generateBets: (markets: PolymarketMarket[], context: StrategyContext): Bet[] => {
    const bets: Bet[] = [];
    const mode = resolveMode(context);
    const { minSpread, maxSpread, betSizePerSide, minLiquidity } =
      MARKET_MAKING_DEFAULTS;

    console.log(`\n[Market Making] Processing ${markets.length} markets in ${mode} mode`);
    let eligibleCount = 0;
    let liquidCount = 0;
    let withPricesCount = 0;

    markets.forEach((market) => {
      if (!isMarketEligible(market, mode)) return;
      eligibleCount++;
      if (market.liquidity < minLiquidity) return;
      liquidCount++;

      // Get current mid-price
      if (market.historicalPrices.length === 0) return;
      withPricesCount++;
      const currentPrice =
        market.historicalPrices[market.historicalPrices.length - 1].price;
      const decisionTime = determineDecisionTime(market, mode);

      // Calculate spreads based on volatility
      const recentPrices = market.historicalPrices.slice(-20);
      const volatility =
        recentPrices.length > 1
          ? Math.sqrt(
              mean(
                recentPrices.map((p) => Math.pow(p.price - currentPrice, 2))
              )
            )
          : 0.03;

      const spread = Math.max(minSpread, Math.min(maxSpread, volatility * 2));

      // Place bid (buy below mid)
      bets.push({
        marketId: market.marketId,
        outcome: market.outcomes[0],
        side: 'buy',
        amount: betSizePerSide,
        priceLimit: clampPrice(currentPrice - spread / 2),
        reason: `Market making: bid at ${(currentPrice - spread / 2).toFixed(3)}`,
        timestamp: decisionTime,
      });

      // Place ask (sell above mid)
      bets.push({
        marketId: market.marketId,
        outcome: market.outcomes[0],
        side: 'sell',
        amount: betSizePerSide,
        priceLimit: clampPrice(currentPrice + spread / 2),
        reason: `Market making: ask at ${(currentPrice + spread / 2).toFixed(3)}`,
        timestamp: decisionTime,
      });
    });

    console.log(`[Market Making] Eligible: ${eligibleCount}, Liquid (>${minLiquidity}): ${liquidCount}, With prices: ${withPricesCount}, Bets: ${bets.length}`);
    return bets;
  },
};

// Strategy 4: AI-Generated (placeholder - will be dynamically created)
export const aiGeneratedStrategy: Strategy = {
  id: 'ai_generated',
  name: 'AI-Generated Strategy',
  description: 'Dynamically generated by OpenAI based on market conditions',
  type: 'ai_generated',
  parameters: {},
  generateBets: (markets: PolymarketMarket[], context: StrategyContext): Bet[] => {
    void markets;
    void context;
    // This will be replaced by OpenAI-generated logic
    return [];
  },
};

// FOCUS: Only Whale Copy Trading strategy for optimization
export const defaultStrategies: Strategy[] = [
  copyTradingStrategy,
  // spikeDetectionStrategy,      // Disabled - focusing on whale trading
  // marketMakingStrategy,         // Disabled - focusing on whale trading
  // aiGeneratedStrategy,          // Disabled - focusing on whale trading
];
