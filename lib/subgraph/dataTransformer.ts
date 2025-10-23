/**
 * Data Transformer for Polymarket Subgraph Data
 *
 * Converts subgraph data into the format expected by the backtesting system
 */

import {
  getOrderFilledEvents,
  getMarketDataByCondition,
  calculateTradePrice,
  paginateQuery,
  OrderFilledEvent,
  getOrderFilledEventsByTimeRange,
} from './client';
import { PricePoint, Trade } from '@/types';

/**
 * Build historical price data from trade events
 */
export async function buildHistoricalPrices(
  tokenId: string,
  maxPoints = 100
): Promise<PricePoint[]> {
  try {
    // Get trade events for this token
    const trades = await paginateQuery(
      (limit, skip) => getOrderFilledEvents(tokenId, limit, skip),
      5000 // Get up to 5000 trades
    );

    if (trades.length === 0) {
      console.log(`No trades found for token ${tokenId}`);
      return [];
    }

    // Sort by timestamp ascending
    trades.sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));

    // Sample trades evenly to get maxPoints
    const sampledTrades = sampleTrades(trades, maxPoints);

    // Convert to price points
    const pricePoints: PricePoint[] = sampledTrades.map((trade) => {
      const timestamp = new Date(parseInt(trade.timestamp) * 1000);
      const price = calculateTradePrice(trade, tokenId);

      return {
        timestamp,
        price: Math.max(0.01, Math.min(0.99, price)),
        outcome: 'Yes', // Will be updated with actual outcome name
      };
    });

    return pricePoints;
  } catch (error) {
    console.error(`Error building historical prices for token ${tokenId}:`, error);
    return [];
  }
}

/**
 * Build trade history from order filled events
 */
export async function buildTradeHistory(
  tokenId: string,
  maxTrades = 100
): Promise<Trade[]> {
  try {
    const events = await paginateQuery(
      (limit, skip) => getOrderFilledEvents(tokenId, limit, skip),
      maxTrades
    );

    return events.map((event) => {
      const timestamp = new Date(parseInt(event.timestamp) * 1000);
      const price = calculateTradePrice(event, tokenId);

      // Determine side based on who is buying/selling the outcome token
      const side = event.takerAssetId === tokenId ? 'buy' : 'sell';

      // Amount in outcome tokens
      const amount =
        event.takerAssetId === tokenId
          ? parseFloat(event.takerAmountFilled) / 1e6 // Convert from micro units
          : parseFloat(event.makerAmountFilled) / 1e6;

      return {
        timestamp,
        side: side as 'buy' | 'sell',
        amount,
        price: Math.max(0.01, Math.min(0.99, price)),
        outcome: 'Yes', // Will be updated with actual outcome name
        maker: event.maker,
        taker: event.taker,
      };
    });
  } catch (error) {
    console.error(`Error building trade history for token ${tokenId}:`, error);
    return [];
  }
}

/**
 * Get all token IDs for a condition (market)
 */
export async function getTokenIdsForCondition(conditionId: string): Promise<string[]> {
  try {
    const marketDatas = await getMarketDataByCondition(conditionId);
    return marketDatas.map((md) => md.id);
  } catch (error) {
    console.error(`Error getting token IDs for condition ${conditionId}:`, error);
    return [];
  }
}

/**
 * Build complete historical data for a market using its condition ID
 */
export async function buildMarketHistoricalData(
  conditionId: string,
  outcomes: string[]
): Promise<{
  historicalPrices: PricePoint[][];
  trades: Trade[][];
}> {
  try {
    // Get all token IDs for this condition
    const tokenIds = await getTokenIdsForCondition(conditionId);

    if (tokenIds.length === 0) {
      console.log(`No token IDs found for condition ${conditionId}`);
      return { historicalPrices: [], trades: [] };
    }

    console.log(`Found ${tokenIds.length} token IDs for condition ${conditionId}`);

    // Build historical data for each outcome
    const historicalPricesArray: PricePoint[][] = [];
    const tradesArray: Trade[][] = [];

    for (let i = 0; i < Math.min(tokenIds.length, outcomes.length); i++) {
      const tokenId = tokenIds[i];
      const outcomeName = outcomes[i];

      console.log(`Building data for outcome "${outcomeName}" (token: ${tokenId})`);

      // Build price history
      const prices = await buildHistoricalPrices(tokenId, 100);
      prices.forEach((p) => (p.outcome = outcomeName));
      historicalPricesArray.push(prices);

      // Build trade history
      const trades = await buildTradeHistory(tokenId, 50);
      trades.forEach((t) => (t.outcome = outcomeName));
      tradesArray.push(trades);
    }

    return {
      historicalPrices: historicalPricesArray,
      trades: tradesArray,
    };
  } catch (error) {
    console.error(`Error building market historical data:`, error);
    return { historicalPrices: [], trades: [] };
  }
}

/**
 * Get historical data for a specific time range (useful for backtesting)
 */
export async function getHistoricalDataByTimeRange(
  startDate: Date,
  endDate: Date,
  maxTrades = 10000
): Promise<OrderFilledEvent[]> {
  try {
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);

    console.log(`Fetching trades from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const trades = await paginateQuery(
      (limit, skip) =>
        getOrderFilledEventsByTimeRange(startTimestamp, endTimestamp, limit, skip),
      maxTrades
    );

    console.log(`Found ${trades.length} trades in time range`);

    return trades;
  } catch (error) {
    console.error('Error getting historical data by time range:', error);
    return [];
  }
}

/**
 * Sample trades evenly to get a specific number of points
 */
function sampleTrades(trades: OrderFilledEvent[], numSamples: number): OrderFilledEvent[] {
  if (trades.length <= numSamples) {
    return trades;
  }

  const sampledTrades: OrderFilledEvent[] = [];
  const step = trades.length / numSamples;

  for (let i = 0; i < numSamples; i++) {
    const index = Math.floor(i * step);
    sampledTrades.push(trades[index]);
  }

  return sampledTrades;
}

/**
 * Flatten price points from multiple outcomes into a single array
 */
export function flattenPricePoints(pricePointsArray: PricePoint[][]): PricePoint[] {
  return pricePointsArray.flat().sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Flatten trades from multiple outcomes into a single array
 */
export function flattenTrades(tradesArray: Trade[][]): Trade[] {
  return tradesArray.flat().sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Calculate volume from trades
 */
export function calculateVolumeFromTrades(trades: Trade[]): number {
  return trades.reduce((sum, trade) => sum + trade.amount * trade.price, 0);
}

/**
 * Calculate liquidity estimate from recent trades
 */
export function estimateLiquidityFromTrades(trades: Trade[]): number {
  if (trades.length === 0) return 0;

  // Use the sum of the last 10 trades as a liquidity estimate
  const recentTrades = trades.slice(-10);
  return recentTrades.reduce((sum, trade) => sum + trade.amount * trade.price, 0);
}

/**
 * Get current price from most recent trade
 */
export function getCurrentPriceFromTrades(
  trades: Trade[],
  outcome: string
): number {
  const outcomeTrades = trades.filter((t) => t.outcome === outcome);
  if (outcomeTrades.length === 0) return 0.5;

  const lastTrade = outcomeTrades[outcomeTrades.length - 1];
  return lastTrade.price;
}
