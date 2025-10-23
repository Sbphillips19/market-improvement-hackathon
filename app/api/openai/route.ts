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

      const prompt = `You are an expert Polymarket trading strategist. Generate a NEW executable trading strategy.

Historical Data Summary:
- Total markets: ${historicalData.totalMarkets}
- Resolved markets: ${historicalData.resolvedMarkets}
- Avg volume: $${historicalData.avgVolume.toFixed(0)}
- Avg liquidity: $${historicalData.avgLiquidity.toFixed(0)}

Current Strategy Performance:
${JSON.stringify(benchmarks, null, 2)}

Existing Strategies:
${currentStrategies.map((s: any) => `- ${s.name} (ROI: ${benchmarks.find((b: any) => b.strategyId === s.id)?.roi?.toFixed(1) || 'N/A'}%): ${s.description}`).join('\n')}

CRITICAL DATA STRUCTURES:
- Market: { marketId, question, outcomes: ["Yes", "No"], liquidity, volume, active, resolvedOutcome, historicalPrices: [{timestamp: Date, price: number, outcome: string}], trades: [{timestamp: Date, side: "buy"|"sell", amount: number, price: number, outcome: string, maker: string, taker: string}], endDate, resolutionDate }
- Required Bet format: { marketId: string, outcome: string (pick from market.outcomes), side: "buy"|"sell", amount: number, priceLimit: number (0-1), reason: string, timestamp: Date }

EXAMPLE STRATEGY CODE PATTERN:
\`\`\`javascript
const bets = [];
const params = parameters;
markets.forEach((market) => {
  // Check if market is eligible (in backtest mode, all resolved markets are eligible)
  if (context.mode === 'live' && (!market.active || market.resolvedOutcome)) return;

  // Get decision time (for backtesting, use historical data)
  const decisionTime = context.mode === 'backtest' && market.historicalPrices.length > 0
    ? new Date(market.historicalPrices[market.historicalPrices.length - 1].timestamp)
    : new Date();

  // Filter data before decision time
  const relevantPrices = market.historicalPrices.filter(p => new Date(p.timestamp) <= decisionTime);
  const relevantTrades = market.trades.filter(t => new Date(t.timestamp) <= decisionTime);

  // Example: Bet on markets with high liquidity
  if (market.liquidity > 50000 && relevantPrices.length > 0) {
    const currentPrice = relevantPrices[relevantPrices.length - 1].price;
    bets.push({
      marketId: market.marketId,  // CRITICAL: use market.marketId
      outcome: market.outcomes[0],  // Pick from market.outcomes array
      side: currentPrice > 0.7 ? 'sell' : 'buy',
      amount: params.betSize,
      priceLimit: clampPrice(currentPrice > 0.7 ? currentPrice - 0.05 : currentPrice + 0.05),
      reason: 'High liquidity market with edge',
      timestamp: decisionTime
    });
  }
});
return bets;
\`\`\`

Generate a NEW strategy with ACTUAL executable JavaScript code. Be creative but ensure the code:
1. Uses only available market data: marketId, question, outcomes, liquidity, volume, active, resolvedOutcome, historicalPrices[], trades[], endDate, resolutionDate
2. Properly filters data by timestamp (CRITICAL for backtesting)
3. Returns array of bets with: marketId, outcome, side, amount, priceLimit, reason, timestamp
4. Includes clear betting logic based on patterns you identify in the data
5. Uses parameters that can be tuned
6. Available utilities: clampPrice(price), mean(array), sortBy(array, fn), Math, Date

Return ONLY valid JSON (no markdown):
{
  "strategyName": "string",
  "description": "string",
  "type": "ai_generated",
  "parameters": {
    "betSize": number,
    "...other tunable params": "values"
  },
  "generateBetsCode": "FULL executable JavaScript function body as string - include all the code from const bets = []; to return bets;",
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
      const { strategy, performance, historicalStats } = data;

      const prompt = `You are optimizing a Polymarket trading strategy.

Current Strategy:
Name: ${strategy.name}
Type: ${strategy.type}
Description: ${strategy.description}
Parameters: ${JSON.stringify(strategy.parameters)}

Performance:
- Win Rate: ${performance.winRate.toFixed(1)}%
- ROI: ${performance.roi.toFixed(1)}%
- Net Profit: $${performance.netProfit.toFixed(2)}
- Total Bets: ${performance.totalBets}

Market Context:
- Total markets: ${historicalStats?.totalMarkets || 'N/A'}
- Resolved markets: ${historicalStats?.resolvedMarkets || 'N/A'}
- Avg volume: $${historicalStats?.avgVolume?.toFixed(0) || 'N/A'}

TASK: Generate IMPROVED executable strategy code that fixes the weaknesses and boosts ROI.

CRITICAL DATA STRUCTURES:
- Market: { marketId, question, outcomes: ["Yes", "No"], liquidity, volume, active, resolvedOutcome, historicalPrices: [{timestamp: Date, price: number, outcome: string}], trades: [{timestamp: Date, side: "buy"|"sell", amount: number, price: number, outcome: string}], endDate, resolutionDate }
- Required Bet format: { marketId: string, outcome: "Yes" or "No", side: "buy" or "sell", amount: number, priceLimit: number (0-1), reason: string, timestamp: Date }

The code must:
1. Follow this EXACT pattern:
\`\`\`javascript
const bets = [];
const params = parameters; // Access improved parameters
markets.forEach((market) => {
  if (context.mode === 'live' && (!market.active || market.resolvedOutcome)) return;

  const decisionTime = context.mode === 'backtest' && market.historicalPrices.length > 0
    ? new Date(market.historicalPrices[market.historicalPrices.length - 1].timestamp)
    : new Date();

  const relevantPrices = market.historicalPrices.filter(p => new Date(p.timestamp) <= decisionTime);
  const relevantTrades = market.trades.filter(t => new Date(t.timestamp) <= decisionTime);

  // YOUR IMPROVED LOGIC - add filters, check conditions, then push bets in CORRECT format:
  // Example: if (market.liquidity > params.minLiquidity && relevantTrades.length > 10) {
  //   const currentPrice = relevantPrices[relevantPrices.length - 1].price;
  //   bets.push({
  //     marketId: market.marketId,  // MUST be market.marketId
  //     outcome: market.outcomes[0],  // Pick "Yes" or "No" from market.outcomes
  //     side: 'buy',  // or 'sell'
  //     amount: params.betSize,
  //     priceLimit: clampPrice(currentPrice + 0.05),
  //     reason: 'Strategy reasoning',
  //     timestamp: decisionTime
  //   });
  // }
});
return bets;
\`\`\`

2. Make SIGNIFICANT changes to improve performance (${performance.roi.toFixed(1)}% ROI is ${performance.roi < 20 ? 'poor' : 'mediocre'})
3. If ROI is negative, completely rethink the approach
4. Add filters for liquidity, volume, price patterns, whale behavior, etc.
5. Be more selective - quality over quantity
6. Available utilities: clampPrice(price), mean(array), sortBy(array, fn), Math, Date

Return ONLY valid JSON:
{
  "improvedParameters": { ...updated parameters },
  "generateBetsCode": "FULL executable JavaScript function body as string",
  "expectedImprovementPercent": number,
  "reasoning": "brief explanation of key changes"
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
