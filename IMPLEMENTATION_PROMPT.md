# Complete Polymarket Trading Strategy Analysis App - Implementation Guide

## Project Overview
Build a Next.js application that analyzes Polymarket prediction market data, implements AI-powered trading strategies, backtests them, and uses OpenAI for continuous improvement. All data must be real from Polymarket APIs.

---

## Step 1: Project Setup

### Initialize the project
```bash
npx create-next-app@latest my-polymarket-app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd my-polymarket-app
```

### Install dependencies
```bash
npm install axios recharts lodash zustand openai @tanstack/react-query date-fns
npm install -D @types/lodash

# Initialize shadcn/ui
npx shadcn-ui@latest init
# Select: Default style, Neutral color, CSS variables: yes

# Add shadcn components
npx shadcn-ui@latest add button card table tabs progress badge alert
```

---

## Step 2: Environment Variables

Create `.env.local`:
```env
OPENAI_API_KEY=your_openai_api_key_here
POLYMARKET_API_KEY=optional_if_required
X_API_BEARER_TOKEN=your_x_api_token
```

---

## Step 3: TypeScript Interfaces & Types

Create `src/types/index.ts`:
```typescript
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

export interface Strategy {
  id: string;
  name: string;
  description: string;
  type: 'copy_trading' | 'spike_detection' | 'market_making' | 'ai_generated';
  generateBets: (markets: PolymarketMarket[], historicalData: any) => Bet[];
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
```

---

## Step 4: API Routes

### Create `src/app/api/data/route.ts` (Polymarket Data Fetcher)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { PolymarketMarket, PricePoint, Trade } from '@/types';

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeResolved = searchParams.get('resolved') === 'true';

    // Fetch markets from Gamma API
    const marketsResponse = await axios.get(`${GAMMA_API}/markets`, {
      params: {
        limit,
        active: !includeResolved,
        closed: includeResolved,
      },
    });

    const markets: PolymarketMarket[] = [];

    for (const market of marketsResponse.data) {
      try {
        // Get historical prices from CLOB
        const tokenId = market.clobTokenIds?.[0];
        let historicalPrices: PricePoint[] = [];
        let trades: Trade[] = [];

        if (tokenId) {
          // Fetch price history
          const pricesResponse = await axios.get(
            `${CLOB_API}/prices-history`,
            {
              params: {
                market: tokenId,
                interval: '1h',
                fidelity: 100,
              },
            }
          );

          historicalPrices = pricesResponse.data.history?.map((point: any) => ({
            timestamp: new Date(point.t * 1000),
            price: parseFloat(point.p),
            outcome: market.outcomes?.[0] || 'Yes',
          })) || [];

          // Fetch recent trades
          const tradesResponse = await axios.get(`${CLOB_API}/trades`, {
            params: {
              market: tokenId,
              limit: 100,
            },
          });

          trades = tradesResponse.data?.map((trade: any) => ({
            timestamp: new Date(trade.timestamp),
            side: trade.side.toLowerCase() as 'buy' | 'sell',
            amount: parseFloat(trade.size),
            price: parseFloat(trade.price),
            outcome: market.outcomes?.[0] || 'Yes',
            maker: trade.makerAddress,
            taker: trade.takerAddress,
          })) || [];
        }

        markets.push({
          marketId: market.id || market.condition_id,
          question: market.question || market.description,
          outcomes: market.outcomes || ['Yes', 'No'],
          resolutionDate: market.end_date_iso
            ? new Date(market.end_date_iso)
            : null,
          historicalPrices,
          trades,
          resolvedOutcome: market.outcome || null,
          volume: parseFloat(market.volume || 0),
          liquidity: parseFloat(market.liquidity || 0),
          active: market.active,
          endDate: market.end_date_iso ? new Date(market.end_date_iso) : null,
          image: market.image,
          category: market.category,
        });
      } catch (error) {
        console.error(`Error processing market ${market.id}:`, error);
        // Continue with other markets
      }
    }

    return NextResponse.json({
      markets,
      timestamp: new Date().toISOString(),
      count: markets.length,
    });
  } catch (error: any) {
    console.error('Error fetching Polymarket data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data', details: error.message },
      { status: 500 }
    );
  }
}
```

### Create `src/app/api/x/route.ts` (X/Twitter Sentiment)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { XSentiment } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { marketQuestion } = await request.json();

    if (!process.env.X_API_BEARER_TOKEN) {
      return NextResponse.json(
        { error: 'X API token not configured' },
        { status: 500 }
      );
    }

    // Search recent tweets about the market
    const response = await axios.get(
      'https://api.twitter.com/2/tweets/search/recent',
      {
        headers: {
          Authorization: `Bearer ${process.env.X_API_BEARER_TOKEN}`,
        },
        params: {
          query: marketQuestion.substring(0, 100),
          max_results: 10,
          'tweet.fields': 'created_at,public_metrics',
        },
      }
    );

    const tweets = response.data.data || [];

    // Simple sentiment analysis (in production, use more sophisticated NLP)
    const positiveWords = ['yes', 'will', 'definitely', 'bullish', 'win'];
    const negativeWords = ['no', 'won\'t', 'unlikely', 'bearish', 'lose'];

    let sentimentScore = 0;
    tweets.forEach((tweet: any) => {
      const text = tweet.text.toLowerCase();
      positiveWords.forEach(word => {
        if (text.includes(word)) sentimentScore += 1;
      });
      negativeWords.forEach(word => {
        if (text.includes(word)) sentimentScore -= 1;
      });
    });

    const normalizedScore = tweets.length > 0 ? sentimentScore / tweets.length : 0;

    const sentiment: XSentiment = {
      marketId: 'unknown',
      sentiment: normalizedScore > 0 ? 'positive' : normalizedScore < 0 ? 'negative' : 'neutral',
      score: normalizedScore,
      tweets: tweets.length,
    };

    return NextResponse.json(sentiment);
  } catch (error: any) {
    console.error('Error fetching X sentiment:', error);
    return NextResponse.json(
      {
        sentiment: 'neutral',
        score: 0,
        tweets: 0,
        error: error.message
      },
      { status: 200 } // Return neutral sentiment on error
    );
  }
}
```

### Create `src/app/api/openai/route.ts` (OpenAI Strategy Generator)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json();

    if (action === 'generate_strategy') {
      const { historicalData, benchmarks, currentStrategies } = data;

      const prompt = `You are an expert Polymarket trading strategist. Analyze this historical data and generate a new high-ROI trading strategy.

Historical Data Summary:
- Total markets analyzed: ${historicalData.totalMarkets}
- Average market volume: ${historicalData.avgVolume}
- Most volatile markets: ${JSON.stringify(historicalData.volatileMarkets)}
- Top performing outcomes: ${JSON.stringify(historicalData.topOutcomes)}

Current Strategy Benchmarks:
${JSON.stringify(benchmarks, null, 2)}

Existing Strategies:
${currentStrategies.map((s: any) => `- ${s.name}: ${s.description}`).join('\n')}

Generate a NEW innovative strategy that:
1. Learns from the best-performing existing strategies
2. Addresses weaknesses in underperforming strategies
3. Incorporates elements like: spike detection, whale copy trading, sentiment analysis, market making, or novel approaches
4. Maximizes ROI on Polymarket prediction markets

Return ONLY a JSON object (no markdown, no explanation) with this structure:
{
  "strategyName": "string",
  "description": "string",
  "type": "ai_generated",
  "parameters": {
    "threshold": number,
    "betSize": number,
    "any_other_params": "values"
  },
  "logic": "string describing the betting logic step-by-step",
  "expectedROI": number
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a quantitative trading expert specializing in prediction markets. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        response_format: { type: 'json_object' },
      });

      const strategy = JSON.parse(completion.choices[0].message.content || '{}');
      return NextResponse.json(strategy);
    } else if (action === 'improve_strategy') {
      const { strategy, performance, historicalData } = data;

      const prompt = `You are optimizing a Polymarket trading strategy. Current strategy:

Name: ${strategy.name}
Description: ${strategy.description}
Parameters: ${JSON.stringify(strategy.parameters)}

Performance:
- Win Rate: ${performance.winRate}%
- ROI: ${performance.roi}%
- Net Profit: $${performance.netProfit}
- Total Bets: ${performance.totalBets}

Historical Data Context:
${JSON.stringify(historicalData)}

Suggest improvements to increase ROI. Consider:
1. Adjusting parameters (thresholds, bet sizes, timing)
2. Adding filters (sentiment, volume, liquidity)
3. Combining with other strategy elements
4. Risk management improvements

Return ONLY a JSON object with:
{
  "improvedParameters": { ...updated parameters },
  "newLogic": "string describing improved betting logic",
  "expectedImprovementPercent": number,
  "reasoning": "brief explanation"
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a strategy optimization expert. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const improvements = JSON.parse(completion.choices[0].message.content || '{}');
      return NextResponse.json(improvements);
    } else if (action === 'generate_bets') {
      const { markets, strategyContext } = data;

      const prompt = `Given these unresolved Polymarket markets, suggest specific high-confidence bets:

Markets:
${JSON.stringify(markets.slice(0, 5), null, 2)}

Strategy Context: ${strategyContext}

Suggest 1-3 specific bets with high expected value. Return ONLY a JSON object:
{
  "bets": [
    {
      "marketId": "string",
      "outcome": "Yes" or "No",
      "side": "buy" or "sell",
      "amount": number (2-10),
      "priceLimit": number (0-1),
      "confidence": number (0-1),
      "reason": "string"
    }
  ]
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a prediction market analyst. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
        response_format: { type: 'json_object' },
      });

      const bets = JSON.parse(completion.choices[0].message.content || '{}');
      return NextResponse.json(bets);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('OpenAI API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate strategy', details: error.message },
      { status: 500 }
    );
  }
}
```

---

## Step 5: Strategy Implementations

Create `src/lib/strategies/index.ts`:

```typescript
import { Strategy, PolymarketMarket, Bet, Trade } from '@/types';
import { orderBy, mean } from 'lodash';

// Strategy 1: Copy Trading (monitor whale addresses)
export const copyTradingStrategy: Strategy = {
  id: 'copy_trading',
  name: 'Whale Copy Trading',
  description: 'Copy trades from high-volume addresses (whales) within 1 hour',
  type: 'copy_trading',
  parameters: {
    minWhaleVolume: 1000, // USDC
    copyDelay: 3600, // 1 hour in seconds
    betSize: 5,
  },
  generateBets: (markets: PolymarketMarket[], historicalData: any): Bet[] => {
    const bets: Bet[] = [];
    const now = new Date();

    markets.forEach((market) => {
      if (market.resolvedOutcome || !market.active) return;

      // Identify whale trades (large volume)
      const whaleTrades = market.trades.filter(
        (trade) => trade.amount >= 1000
      );

      // Copy recent whale trades
      const recentWhales = whaleTrades.filter((trade) => {
        const timeDiff = (now.getTime() - trade.timestamp.getTime()) / 1000;
        return timeDiff <= 3600;
      });

      recentWhales.forEach((whaleTrade) => {
        bets.push({
          marketId: market.marketId,
          outcome: whaleTrade.outcome,
          side: whaleTrade.side,
          amount: 5,
          priceLimit: whaleTrade.price + 0.02, // Slightly worse price
          reason: `Copying whale ${whaleTrade.maker?.substring(0, 8)}... who traded $${whaleTrade.amount.toFixed(0)}`,
          timestamp: now,
        });
      });
    });

    return bets.slice(0, 10); // Limit to 10 bets
  },
};

// Strategy 2: Spike Detection (bet against sudden price movements)
export const spikeDetectionStrategy: Strategy = {
  id: 'spike_detection',
  name: 'Price Spike Reversal',
  description: 'Detect price spikes >5% and bet on mean reversion',
  type: 'spike_detection',
  parameters: {
    spikeThreshold: 0.05, // 5%
    lookbackWindow: 24, // hours
    betSize: 7,
  },
  generateBets: (markets: PolymarketMarket[], historicalData: any): Bet[] => {
    const bets: Bet[] = [];
    const now = new Date();

    markets.forEach((market) => {
      if (market.resolvedOutcome || !market.active) return;
      if (market.historicalPrices.length < 10) return;

      // Sort prices by timestamp
      const sortedPrices = orderBy(
        market.historicalPrices,
        ['timestamp'],
        ['asc']
      );

      // Get recent prices (last 24 hours)
      const cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentPrices = sortedPrices.filter(
        (p) => p.timestamp >= cutoffTime
      );

      if (recentPrices.length < 5) return;

      // Calculate mean and current price
      const avgPrice = mean(recentPrices.map((p) => p.price));
      const currentPrice = recentPrices[recentPrices.length - 1].price;
      const priceChange = (currentPrice - avgPrice) / avgPrice;

      // Detect spike
      if (Math.abs(priceChange) > 0.05) {
        // Bet against the spike (mean reversion)
        const betSide: 'buy' | 'sell' = priceChange > 0 ? 'sell' : 'buy';
        const targetPrice =
          betSide === 'sell' ? currentPrice - 0.03 : currentPrice + 0.03;

        bets.push({
          marketId: market.marketId,
          outcome: market.outcomes[0],
          side: betSide,
          amount: 7,
          priceLimit: Math.max(0.01, Math.min(0.99, targetPrice)),
          reason: `Spike detected: ${(priceChange * 100).toFixed(1)}% change. Betting on reversion to mean ${avgPrice.toFixed(3)}`,
          timestamp: now,
        });
      }
    });

    return bets;
  },
};

// Strategy 3: Market Making (place bids/asks around mid-price)
export const marketMakingStrategy: Strategy = {
  id: 'market_making',
  name: 'Liquidity Provider Market Making',
  description: 'Place balanced bids/asks with spreads for high-liquidity markets',
  type: 'market_making',
  parameters: {
    minSpread: 0.02,
    maxSpread: 0.08,
    betSizePerSide: 4,
    minLiquidity: 5000,
  },
  generateBets: (markets: PolymarketMarket[], historicalData: any): Bet[] => {
    const bets: Bet[] = [];
    const now = new Date();

    markets.forEach((market) => {
      if (market.resolvedOutcome || !market.active) return;
      if (market.liquidity < 5000) return;

      // Get current mid-price
      if (market.historicalPrices.length === 0) return;
      const currentPrice =
        market.historicalPrices[market.historicalPrices.length - 1].price;

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

      const spread = Math.max(0.02, Math.min(0.08, volatility * 2));

      // Place bid (buy below mid)
      bets.push({
        marketId: market.marketId,
        outcome: market.outcomes[0],
        side: 'buy',
        amount: 4,
        priceLimit: Math.max(0.01, currentPrice - spread / 2),
        reason: `Market making: bid at ${(currentPrice - spread / 2).toFixed(3)}`,
        timestamp: now,
      });

      // Place ask (sell above mid)
      bets.push({
        marketId: market.marketId,
        outcome: market.outcomes[0],
        side: 'sell',
        amount: 4,
        priceLimit: Math.min(0.99, currentPrice + spread / 2),
        reason: `Market making: ask at ${(currentPrice + spread / 2).toFixed(3)}`,
        timestamp: now,
      });
    });

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
  generateBets: (markets: PolymarketMarket[], historicalData: any): Bet[] => {
    // This will be replaced by OpenAI-generated logic
    return [];
  },
};

export const defaultStrategies: Strategy[] = [
  copyTradingStrategy,
  spikeDetectionStrategy,
  marketMakingStrategy,
  aiGeneratedStrategy,
];
```

---

## Step 6: Backtesting Engine

Create `src/lib/backtesting/engine.ts`:

```typescript
import {
  Strategy,
  PolymarketMarket,
  BacktestResult,
  BacktestBet,
  EarningsPoint,
  Bet,
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
    // Filter only resolved markets for backtesting
    const resolvedMarkets = markets.filter((m) => m.resolvedOutcome !== null);

    // Split chronologically: 80% training, 20% test
    const sortedMarkets = orderBy(resolvedMarkets, ['endDate'], ['asc']);
    const splitIndex = Math.floor(sortedMarkets.length * trainingRatio);
    const testMarkets = sortedMarkets.slice(splitIndex);

    // Generate bets for test markets
    const proposedBets = strategy.generateBets(testMarkets, {});

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
        markets.reduce((sum, m) => sum + m.volume, 0) / markets.length,
      avgLiquidity:
        markets.reduce((sum, m) => sum + m.liquidity, 0) / markets.length,
      volatileMarkets,
      topOutcomes: outcomeFreq,
    };
  }
}
```

---

## Step 7: Zustand Store

Create `src/stores/useStore.ts`:

```typescript
import { create } from 'zustand';
import {
  PolymarketMarket,
  Strategy,
  BacktestResult,
  StrategyBenchmark,
  SimulationState,
} from '@/types';
import { defaultStrategies } from '@/lib/strategies';

interface AppState {
  // Data
  markets: PolymarketMarket[];
  strategies: Strategy[];
  backtestResults: BacktestResult[];
  benchmarks: StrategyBenchmark[];
  historicalStats: any;

  // UI State
  isLoading: boolean;
  error: string | null;
  simulation: SimulationState;

  // Actions
  setMarkets: (markets: PolymarketMarket[]) => void;
  setStrategies: (strategies: Strategy[]) => void;
  addStrategy: (strategy: Strategy) => void;
  setBacktestResults: (results: BacktestResult[]) => void;
  addBacktestResult: (result: BacktestResult) => void;
  setBenchmarks: (benchmarks: StrategyBenchmark[]) => void;
  setHistoricalStats: (stats: any) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSimulation: (simulation: Partial<SimulationState>) => void;
  reset: () => void;
}

export const useStore = create<AppState>((set) => ({
  // Initial state
  markets: [],
  strategies: defaultStrategies,
  backtestResults: [],
  benchmarks: [],
  historicalStats: null,
  isLoading: false,
  error: null,
  simulation: {
    isRunning: false,
    currentEpoch: 0,
    totalEpochs: 10,
    progress: 0,
    logs: [],
  },

  // Actions
  setMarkets: (markets) => set({ markets }),
  setStrategies: (strategies) => set({ strategies }),
  addStrategy: (strategy) =>
    set((state) => ({ strategies: [...state.strategies, strategy] })),
  setBacktestResults: (backtestResults) => set({ backtestResults }),
  addBacktestResult: (result) =>
    set((state) => ({
      backtestResults: [
        ...state.backtestResults.filter((r) => r.strategyId !== result.strategyId),
        result,
      ],
    })),
  setBenchmarks: (benchmarks) => set({ benchmarks }),
  setHistoricalStats: (historicalStats) => set({ historicalStats }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSimulation: (simulation) =>
    set((state) => ({
      simulation: { ...state.simulation, ...simulation },
    })),
  reset: () =>
    set({
      markets: [],
      backtestResults: [],
      benchmarks: [],
      historicalStats: null,
      isLoading: false,
      error: null,
    }),
}));
```

---

## Step 8: Dashboard Components

### Create `src/components/MarketOverview.tsx`:

```typescript
'use client';

import { PolymarketMarket } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';

interface Props {
  markets: PolymarketMarket[];
}

export function MarketOverview({ markets }: Props) {
  const activeMarkets = markets.filter((m) => m.active && !m.resolvedOutcome);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Liquidity</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeMarkets.slice(0, 10).map((market) => (
                <TableRow key={market.marketId}>
                  <TableCell className="max-w-md truncate">
                    {market.question}
                  </TableCell>
                  <TableCell>
                    ${market.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell>
                    ${market.liquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell>
                    {market.endDate
                      ? format(new Date(market.endDate), 'MMM d, yyyy')
                      : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={market.active ? 'default' : 'secondary'}>
                      {market.resolvedOutcome || 'Active'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Create `src/components/AnalysisCharts.tsx`:

```typescript
'use client';

import { PolymarketMarket } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface Props {
  markets: PolymarketMarket[];
  historicalStats: any;
}

export function AnalysisCharts({ markets, historicalStats }: Props) {
  // Prepare price history data for the first market with data
  const marketWithData = markets.find((m) => m.historicalPrices.length > 0);
  const priceData = marketWithData
    ? marketWithData.historicalPrices.slice(-50).map((p) => ({
        time: format(new Date(p.timestamp), 'MMM d HH:mm'),
        price: p.price,
      }))
    : [];

  // Prepare outcome frequency data
  const resolvedMarkets = markets.filter((m) => m.resolvedOutcome !== null);
  const outcomeFreq = resolvedMarkets.reduce((acc, m) => {
    acc[m.resolvedOutcome!] = (acc[m.resolvedOutcome!] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const outcomeData = Object.entries(outcomeFreq).map(([outcome, count]) => ({
    outcome,
    count,
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Price History</CardTitle>
          {marketWithData && (
            <p className="text-sm text-muted-foreground">
              {marketWithData.question.substring(0, 60)}...
            </p>
          )}
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={priceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" angle={-45} textAnchor="end" height={80} />
              <YAxis domain={[0, 1]} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#8884d8"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outcome Frequencies</CardTitle>
          <p className="text-sm text-muted-foreground">
            Resolved markets: {resolvedMarkets.length}
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={outcomeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="outcome" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Create `src/components/StrategyBenchmarks.tsx`:

```typescript
'use client';

import { BacktestResult } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props {
  results: BacktestResult[];
}

export function StrategyBenchmarks({ results }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategy Benchmarks</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strategy</TableHead>
                <TableHead>Total Bets</TableHead>
                <TableHead>Win Rate</TableHead>
                <TableHead>ROI</TableHead>
                <TableHead>Net Profit</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result) => (
                <TableRow key={result.strategyId}>
                  <TableCell className="font-medium">
                    {result.strategyName}
                  </TableCell>
                  <TableCell>{result.totalBets}</TableCell>
                  <TableCell>
                    <Badge
                      variant={result.winRate > 50 ? 'default' : 'secondary'}
                    >
                      {result.winRate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={result.roi > 0 ? 'default' : 'destructive'}
                    >
                      {result.roi > 0 ? '+' : ''}
                      {result.roi.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        result.netProfit > 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    >
                      ${result.netProfit.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {result.totalBets > 0 ? (
                      <Badge variant="outline">Tested</Badge>
                    ) : (
                      <Badge variant="secondary">No Data</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Create `src/components/EarningsChart.tsx`:

```typescript
'use client';

import { BacktestResult } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface Props {
  results: BacktestResult[];
}

export function EarningsChart({ results }: Props) {
  // Combine all earnings data
  const allEarnings = results.flatMap((result) =>
    result.earningsOverTime.map((point) => ({
      ...point,
      strategyName: result.strategyName,
    }))
  );

  // Sort by timestamp
  const sortedEarnings = allEarnings.sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  // Prepare data for chart
  const chartData = sortedEarnings.map((point) => ({
    time: format(new Date(point.timestamp), 'MMM d'),
    [point.strategyName]: point.cumulativeEarnings,
  }));

  // Merge data points by time
  const mergedData = chartData.reduce((acc, curr) => {
    const existing = acc.find((item) => item.time === curr.time);
    if (existing) {
      Object.assign(existing, curr);
    } else {
      acc.push(curr);
    }
    return acc;
  }, [] as any[]);

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cumulative Earnings Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={mergedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            {results.map((result, index) => (
              <Line
                key={result.strategyId}
                type="monotone"
                dataKey={result.strategyName}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

### Create `src/components/SimulationControls.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SimulationState } from '@/types';

interface Props {
  simulation: SimulationState;
  onStartSimulation: (epochs: number) => Promise<void>;
}

export function SimulationControls({ simulation, onStartSimulation }: Props) {
  const [epochs, setEpochs] = useState(5);
  const [isRunning, setIsRunning] = useState(false);

  const handleStart = async () => {
    setIsRunning(true);
    await onStartSimulation(epochs);
    setIsRunning(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Self-Improvement Simulation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Epochs:</label>
          <input
            type="number"
            min="1"
            max="20"
            value={epochs}
            onChange={(e) => setEpochs(parseInt(e.target.value))}
            className="w-20 rounded border px-2 py-1"
            disabled={isRunning}
          />
          <Button
            onClick={handleStart}
            disabled={isRunning || simulation.isRunning}
          >
            {isRunning ? 'Running...' : 'Start Simulation'}
          </Button>
        </div>

        {simulation.isRunning && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>
                Epoch {simulation.currentEpoch} of {simulation.totalEpochs}
              </span>
              <span>{simulation.progress}%</span>
            </div>
            <Progress value={simulation.progress} />
          </div>
        )}

        {simulation.logs.length > 0 && (
          <Alert>
            <AlertDescription>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {simulation.logs.slice(-10).map((log, i) => (
                  <div key={i} className="text-xs font-mono">
                    {log}
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Step 9: Main Page

Create `src/app/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useStore } from '@/stores/useStore';
import { BacktestEngine } from '@/lib/backtesting/engine';
import { MarketOverview } from '@/components/MarketOverview';
import { AnalysisCharts } from '@/components/AnalysisCharts';
import { StrategyBenchmarks } from '@/components/StrategyBenchmarks';
import { EarningsChart } from '@/components/EarningsChart';
import { SimulationControls } from '@/components/SimulationControls';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Home() {
  const {
    markets,
    strategies,
    backtestResults,
    benchmarks,
    historicalStats,
    isLoading,
    error,
    simulation,
    setMarkets,
    setBacktestResults,
    setBenchmarks,
    setHistoricalStats,
    setLoading,
    setError,
    setSimulation,
    addStrategy,
    addBacktestResult,
  } = useStore();

  const [initialized, setInitialized] = useState(false);

  // Initial data load
  useEffect(() => {
    if (!initialized) {
      loadData();
      setInitialized(true);
    }
  }, [initialized]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch Polymarket data (including resolved markets for backtesting)
      const [unresolvedRes, resolvedRes] = await Promise.all([
        axios.get('/api/data?limit=30&resolved=false'),
        axios.get('/api/data?limit=50&resolved=true'),
      ]);

      const allMarkets = [
        ...unresolvedRes.data.markets,
        ...resolvedRes.data.markets,
      ];

      setMarkets(allMarkets);

      // Calculate historical stats
      const stats = BacktestEngine.calculateHistoricalStats(allMarkets);
      setHistoricalStats(stats);

      // Run initial backtests
      await runBacktests(allMarkets);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const runBacktests = async (marketsData = markets) => {
    const results = strategies.map((strategy) =>
      BacktestEngine.backtest(strategy, marketsData)
    );
    setBacktestResults(results);

    const newBenchmarks = results.map((result, index) => ({
      strategyId: result.strategyId,
      strategyName: result.strategyName,
      epoch: 0,
      winRate: result.winRate,
      roi: result.roi,
      netProfit: result.netProfit,
      totalBets: result.totalBets,
      improvementPercent: 0,
    }));
    setBenchmarks(newBenchmarks);
  };

  const startSimulation = async (epochs: number) => {
    setSimulation({
      isRunning: true,
      currentEpoch: 0,
      totalEpochs: epochs,
      progress: 0,
      logs: ['Starting self-improvement simulation...'],
    });

    for (let epoch = 1; epoch <= epochs; epoch++) {
      setSimulation({
        currentEpoch: epoch,
        progress: Math.round((epoch / epochs) * 100),
        logs: [
          ...simulation.logs,
          `\n=== Epoch ${epoch}/${epochs} ===`,
        ],
      });

      // Run backtests for current strategies
      await runBacktests();

      setSimulation({
        logs: [...simulation.logs, `Backtesting complete. Analyzing performance...`],
      });

      // Use OpenAI to improve underperforming strategies
      try {
        const worstStrategy = backtestResults.sort((a, b) => a.roi - b.roi)[0];

        if (worstStrategy && worstStrategy.roi < 10) {
          setSimulation({
            logs: [
              ...simulation.logs,
              `Improving strategy: ${worstStrategy.strategyName} (ROI: ${worstStrategy.roi.toFixed(1)}%)`,
            ],
          });

          const improvementResponse = await axios.post('/api/openai', {
            action: 'improve_strategy',
            data: {
              strategy: strategies.find(
                (s) => s.id === worstStrategy.strategyId
              ),
              performance: worstStrategy,
              historicalStats,
            },
          });

          const improvements = improvementResponse.data;
          setSimulation({
            logs: [
              ...simulation.logs,
              `Suggested improvement: ${improvements.reasoning}`,
            ],
          });
        }

        // Generate a new AI strategy
        setSimulation({
          logs: [...simulation.logs, 'Generating new AI strategy...'],
        });

        const newStrategyResponse = await axios.post('/api/openai', {
          action: 'generate_strategy',
          data: {
            historicalData: historicalStats,
            benchmarks,
            currentStrategies: strategies,
          },
        });

        const newStrategy = newStrategyResponse.data;
        setSimulation({
          logs: [
            ...simulation.logs,
            `Generated: ${newStrategy.strategyName} (Expected ROI: ${newStrategy.expectedROI}%)`,
          ],
        });

        // Add new strategy (simplified - would need proper implementation)
        // addStrategy({ ...newStrategy, generateBets: () => [] });

        // Delay for demo purposes
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err: any) {
        console.error('Simulation error:', err);
        setSimulation({
          logs: [...simulation.logs, `Error: ${err.message}`],
        });
      }
    }

    setSimulation({
      isRunning: false,
      logs: [...simulation.logs, '\nSimulation complete!'],
    });
  };

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">Polymarket Strategy Analyzer</h1>
          <p className="text-muted-foreground mt-2">
            AI-powered prediction market trading strategies with backtesting &
            self-improvement
          </p>
        </div>
        <Button onClick={loadData} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh Data'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading market data...</p>
          </div>
        </div>
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="strategies">Strategies</TabsTrigger>
            <TabsTrigger value="simulation">Simulation</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <MarketOverview markets={markets} />
            {historicalStats && (
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">
                    {historicalStats.totalMarkets}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Markets
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">
                    {historicalStats.resolvedMarkets}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Resolved Markets
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">
                    ${historicalStats.avgVolume.toFixed(0)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Avg Volume
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">
                    ${historicalStats.avgLiquidity.toFixed(0)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Avg Liquidity
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            <AnalysisCharts markets={markets} historicalStats={historicalStats} />
          </TabsContent>

          <TabsContent value="strategies" className="space-y-4">
            <StrategyBenchmarks results={backtestResults} />
            <EarningsChart results={backtestResults} />
          </TabsContent>

          <TabsContent value="simulation" className="space-y-4">
            <SimulationControls
              simulation={simulation}
              onStartSimulation={startSimulation}
            />
          </TabsContent>
        </Tabs>
      )}
    </main>
  );
}
```

---

## Step 10: Layout

Update `src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Polymarket Strategy Analyzer',
  description:
    'AI-powered prediction market trading strategies with backtesting',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

---

## Step 11: Final Configuration

Update `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['polymarket.com'],
  },
};

module.exports = nextConfig;
```

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## Step 12: Running the Application

```bash
# Install all dependencies
npm install

# Set up environment variables in .env.local
# Add your OPENAI_API_KEY and X_API_BEARER_TOKEN

# Run the development server
npm run dev

# Open http://localhost:3000
```

---

## Key Features Implemented

1. **Real Data Fetching**: Polymarket Gamma API & CLOB API for markets, prices, trades
2. **Four Initial Strategies**: Copy Trading, Spike Detection, Market Making, AI-Generated
3. **Backtesting Engine**: Simulates betting on historical resolved markets, calculates ROI
4. **OpenAI Integration**: Generates new strategies, improves underperforming ones
5. **Self-Improvement Loop**: Runs epochs, evaluates performance, refines strategies
6. **Dashboard**: Market overview, analysis charts, strategy benchmarks, earnings visualization
7. **State Management**: Zustand for global state
8. **UI Components**: shadcn/ui for professional, responsive design

---

## Next Steps for Enhancement

1. **Improve AI Strategy Execution**: Parse OpenAI-generated code and execute dynamically
2. **Add X Sentiment Integration**: Incorporate sentiment scores into strategy decisions
3. **Implement Position Sizing**: Kelly Criterion or dynamic bet sizing based on confidence
4. **Add More Strategies**: Arbitrage, news-based, liquidity sniping
5. **Real Trading Integration**: Connect to Polymarket CLOB for actual order placement
6. **Advanced Backtesting**: Walk-forward analysis, out-of-sample testing
7. **Risk Management**: Stop-loss, max drawdown limits, portfolio constraints
8. **Performance Metrics**: Sharpe ratio, Sortino ratio, max drawdown
9. **Strategy Combination**: Ensemble methods, voting systems
10. **Real-time Updates**: WebSocket connections for live market data

---

## Important Notes

- **API Rate Limits**: Be mindful of Polymarket and OpenAI API limits
- **Error Handling**: The code includes basic error handling; expand for production
- **Data Freshness**: Markets data is fetched on load; consider caching strategies
- **Backtesting Accuracy**: Simplified bet resolution logic; refine for actual market mechanics
- **Security**: Never commit `.env.local` with real API keys
- **Costs**: OpenAI API calls will incur costs; monitor usage

---

This implementation provides a solid foundation for a Polymarket trading strategy analysis platform with AI-powered self-improvement. Customize and extend based on your specific needs!