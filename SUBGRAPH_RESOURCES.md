# Polymarket Subgraph - Resources & References

## 📚 Documentation Files

### Created Documentation
- **SUBGRAPH_INTEGRATION.md** - Complete technical documentation (60+ pages)
- **SUBGRAPH_QUICKSTART.md** - Quick start guide and examples
- **SUBGRAPH_RESOURCES.md** - This file (API references, examples)

### Original Project Docs
- **PROJECT_OVERVIEW.md** - Original project overview
- **IMPLEMENTATION_PROMPT.md** - Implementation details
- **FIXES_APPLIED.md** - Historical fixes

---

## 🔗 API Endpoints

### Polymarket Official APIs
```
Gamma API (Market Data):
https://gamma-api.polymarket.com/markets

Parameters:
- limit: Number of markets to return
- active: Show active markets (true/false)
- closed: Show closed markets (true/false)
```

### Goldsky Subgraph Endpoints

**Orderbook Subgraph (Primary)**
```
https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/orderbook-subgraph/prod/gn
```

**Activity Subgraph**
```
https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/activity-subgraph/0.0.4/gn
```

**Positions Subgraph**
```
https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/positions-subgraph/0.0.7/gn
```

**PNL Subgraph**
```
https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/pnl-subgraph/0.0.14/gn
```

**Open Interest Subgraph**
```
https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/oi-subgraph/0.0.6/gn
```

---

## 📖 GraphQL Query Examples

### Basic Queries

**Get Recent Trades**
```graphql
{
  orderFilledEvents(
    first: 10
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    timestamp
    maker
    taker
    makerAssetId
    takerAssetId
    makerAmountFilled
    takerAmountFilled
  }
}
```

**Get Trades for Specific Token**
```graphql
query GetTokenTrades($tokenId: String!) {
  orderFilledEvents(
    where: {
      or: [
        { makerAssetId: $tokenId }
        { takerAssetId: $tokenId }
      ]
    }
    first: 100
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    timestamp
    makerAmountFilled
    takerAmountFilled
  }
}
```

**Get Trades in Time Range**
```graphql
query GetTradesInRange($start: BigInt!, $end: BigInt!) {
  orderFilledEvents(
    where: {
      timestamp_gte: $start
      timestamp_lte: $end
    }
    first: 1000
    orderBy: timestamp
    orderDirection: asc
  ) {
    id
    timestamp
    maker
    taker
    makerAmountFilled
    takerAmountFilled
  }
}
```

**Get Market Data by Condition**
```graphql
query GetMarketData($conditionId: String!) {
  marketDatas(where: { condition: $conditionId }) {
    id
    condition
    outcomeIndex
  }
}
```

---

## 💻 Code Examples

### Example 1: Basic Price Fetching
```typescript
import { buildHistoricalPrices } from '@/lib/subgraph';

async function getMarketPrices() {
  const tokenId = '60487116984468020978247225474488676749601001829886755968952521846780452448915';
  const prices = await buildHistoricalPrices(tokenId, 200);

  console.log(`Fetched ${prices.length} price points`);
  console.log('First price:', prices[0]);
  console.log('Last price:', prices[prices.length - 1]);

  return prices;
}
```

### Example 2: Time Range Analysis
```typescript
import { getHistoricalDataByTimeRange } from '@/lib/subgraph';

async function analyzeQ1Performance() {
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-03-31');

  const trades = await getHistoricalDataByTimeRange(startDate, endDate, 10000);

  const totalVolume = trades.reduce((sum, t) => {
    const amount = parseFloat(t.makerAmountFilled) / 1e6;
    return sum + amount;
  }, 0);

  console.log(`Q1 2024 Analysis:`);
  console.log(`Total trades: ${trades.length}`);
  console.log(`Total volume: $${totalVolume.toFixed(2)}`);

  return trades;
}
```

### Example 3: Multi-Market Comparison
```typescript
import { buildMarketHistoricalData } from '@/lib/subgraph';

async function compareMarkets(markets: Array<{conditionId: string, outcomes: string[]}>) {
  const results = [];

  for (const market of markets) {
    const { historicalPrices, trades } = await buildMarketHistoricalData(
      market.conditionId,
      market.outcomes
    );

    const avgPrice = historicalPrices.flat()
      .reduce((sum, p) => sum + p.price, 0) / historicalPrices.flat().length;

    results.push({
      conditionId: market.conditionId,
      priceCount: historicalPrices.flat().length,
      tradeCount: trades.flat().length,
      avgPrice: avgPrice.toFixed(4)
    });
  }

  return results;
}
```

### Example 4: Whale Trade Detection
```typescript
import { getOrderFilledEvents, calculateTradePrice } from '@/lib/subgraph';

async function findWhaleTrades(tokenId: string, minAmount = 10000) {
  const trades = await getOrderFilledEvents(tokenId, 1000);

  const whaleTrades = trades.filter(trade => {
    const amount = parseFloat(trade.makerAmountFilled) / 1e6;
    return amount >= minAmount;
  });

  console.log(`Found ${whaleTrades.length} whale trades (>$${minAmount})`);

  whaleTrades.forEach(trade => {
    const amount = parseFloat(trade.makerAmountFilled) / 1e6;
    const price = calculateTradePrice(trade, tokenId);
    const timestamp = new Date(parseInt(trade.timestamp) * 1000);

    console.log(`${timestamp.toISOString()}: $${amount.toFixed(2)} @ ${price.toFixed(4)}`);
  });

  return whaleTrades;
}
```

### Example 5: Custom Backtest Period
```typescript
import { buildMarketHistoricalData } from '@/lib/subgraph';
import { BacktestEngine } from '@/lib/backtesting/engine';

async function backtestSpecificPeriod(conditionId: string, strategy: Strategy) {
  // Get all historical data for the market
  const { historicalPrices, trades } = await buildMarketHistoricalData(
    conditionId,
    ['Yes', 'No']
  );

  // Filter to specific date range
  const startDate = new Date('2024-06-01');
  const endDate = new Date('2024-08-31');

  const filteredPrices = historicalPrices.filter(p =>
    p.timestamp >= startDate && p.timestamp <= endDate
  );

  const filteredTrades = trades.filter(t =>
    t.timestamp >= startDate && t.timestamp <= endDate
  );

  console.log(`Backtesting summer 2024:`);
  console.log(`Prices: ${filteredPrices.length}`);
  console.log(`Trades: ${filteredTrades.length}`);

  // Create mock market for backtesting
  const market = {
    marketId: conditionId,
    question: 'Test Market',
    outcomes: ['Yes', 'No'],
    historicalPrices: filteredPrices,
    trades: filteredTrades,
    resolvedOutcome: 'Yes', // Set actual outcome
    volume: calculateVolume(filteredTrades),
    liquidity: 0,
    active: false,
    resolutionDate: endDate,
    endDate: endDate,
  };

  // Run backtest
  const result = BacktestEngine.backtest(strategy, [market], 0.8);

  console.log(`Results: ${result.winRate.toFixed(2)}% win rate, ${result.roi.toFixed(2)}% ROI`);

  return result;
}
```

---

## 🧪 Testing Commands

### cURL Tests

**Test Subgraph Directly**
```bash
# Test orderbook subgraph
curl -X POST \
  https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/orderbook-subgraph/prod/gn \
  -H "Content-Type: application/json" \
  -d '{"query":"{ orderFilledEvents(first: 5, orderBy: timestamp, orderDirection: desc) { id timestamp } }"}' \
  | jq
```

**Test Your API**
```bash
# Get markets with real data
curl 'http://localhost:3000/api/data?limit=5&useSubgraph=true' | jq

# Get specific market details
curl 'http://localhost:3000/api/data?limit=1&useSubgraph=true' | \
  jq '.markets[0] | {question, prices: (.historicalPrices | length), trades: (.trades | length)}'

# Compare real vs synthetic
curl 'http://localhost:3000/api/data?limit=1&useSubgraph=true' | \
  jq '.markets[0].historicalPrices | length' && \
curl 'http://localhost:3000/api/data?limit=1&useSubgraph=false' | \
  jq '.markets[0].historicalPrices | length'
```

### Node.js Test Script

```javascript
// test-subgraph.js
const axios = require('axios');

async function testSubgraph() {
  try {
    // Test your API
    const response = await axios.get('http://localhost:3000/api/data', {
      params: {
        limit: 5,
        useSubgraph: true
      }
    });

    const markets = response.data.markets;
    console.log(`Fetched ${markets.length} markets\n`);

    markets.forEach((market, i) => {
      const dataType = market.historicalPrices.length > 100 ? 'REAL' : 'SYNTHETIC';
      console.log(`${i + 1}. ${market.question}`);
      console.log(`   Data: ${dataType}`);
      console.log(`   Prices: ${market.historicalPrices.length}`);
      console.log(`   Trades: ${market.trades.length}\n`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSubgraph();
```

Run with: `node test-subgraph.js`

---

## 🔍 Debugging Tips

### Check Server Logs
```bash
# Watch logs in real-time
tail -f /tmp/nextjs-dev.log

# Filter for subgraph activity
tail -f /tmp/nextjs-dev.log | grep -E "(Fetching subgraph|Fetched.*trades|conditionId)"

# Look for errors
tail -100 /tmp/nextjs-dev.log | grep -i error
```

### Verify Data Source
```typescript
// Add this to your component to check data source
useEffect(() => {
  const checkDataSource = async () => {
    const res = await fetch('/api/data?limit=1&useSubgraph=true');
    const data = await res.json();
    const market = data.markets[0];

    console.log('Market:', market.question);
    console.log('Prices:', market.historicalPrices.length);
    console.log('Data Source:', market.historicalPrices.length > 100 ? 'REAL (subgraph)' : 'SYNTHETIC');
  };

  checkDataSource();
}, []);
```

### Common Issues

**Issue: No real data showing**
```bash
# Check if markets have conditionId
curl 'https://gamma-api.polymarket.com/markets?limit=10' | jq '.[].conditionId'

# Some markets may not have conditionId yet - try more markets
curl 'http://localhost:3000/api/data?limit=20&useSubgraph=true'
```

**Issue: Subgraph timeout**
```typescript
// Increase timeout in client.ts
timeout: 60000 // 60 seconds instead of 30
```

**Issue: Rate limit exceeded**
```typescript
// Add delay between requests
await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
```

---

## 📊 Data Schema Reference

### OrderFilledEvent
```typescript
interface OrderFilledEvent {
  id: string;                    // Unique event ID
  timestamp: string;             // Unix timestamp (seconds)
  maker: string;                 // Maker wallet address
  taker: string;                 // Taker wallet address
  makerAssetId: string;          // Token ID maker is selling
  takerAssetId: string;          // Token ID taker is selling
  makerAmountFilled: string;     // Amount in micro-units (÷1e6 for actual)
  takerAmountFilled: string;     // Amount in micro-units (÷1e6 for actual)
  fee: string;                   // Fee in micro-units
  transactionHash: string;       // Blockchain tx hash
}
```

### PricePoint (Our Format)
```typescript
interface PricePoint {
  timestamp: Date;               // JavaScript Date object
  price: number;                 // 0.01 - 0.99 (probability)
  outcome: string;               // 'Yes', 'No', etc.
}
```

### Trade (Our Format)
```typescript
interface Trade {
  timestamp: Date;               // JavaScript Date object
  side: 'buy' | 'sell';         // Trade direction
  amount: number;                // Amount in dollars
  price: number;                 // 0.01 - 0.99 (probability)
  outcome: string;               // 'Yes', 'No', etc.
  maker: string;                 // Maker wallet address
  taker: string;                 // Taker wallet address
}
```

---

## 🌐 External Resources

### Official Documentation
- [Polymarket Docs](https://docs.polymarket.com/)
- [Polymarket Subgraph GitHub](https://github.com/Polymarket/polymarket-subgraph)
- [The Graph Docs](https://thegraph.com/docs/)
- [Goldsky Docs](https://docs.goldsky.com/)

### Community Resources
- [Polymarket Discord](https://discord.gg/polymarket)
- [Polymarket Analytics](https://polymarket-analytics.com/)
- [Example Analytics Project](https://github.com/PaulieB14/polymarket-subgraph-analytics)

### GraphQL Tools
- [GraphQL Playground](https://www.apollographql.com/docs/apollo-server/testing/graphql-playground/)
- [GraphiQL](https://github.com/graphql/graphiql)
- [Altair GraphQL Client](https://altairgraphql.dev/)

---

## 📈 Performance Metrics

### Expected Response Times
- Gamma API (market list): 100-300ms
- Subgraph query (single market): 200-500ms
- Complete API call (5 markets): 600-1200ms
- First request (cold start): May take 3-5 seconds

### Rate Limits
- Goldsky public endpoint: 50 requests / 10 seconds
- Gamma API: No documented limit (be reasonable)

### Data Limits
- GraphQL: Max 1000 items per query (use pagination)
- Our client: Automatic pagination up to 10,000 items
- Recommended: 100-500 items per query for best performance

---

## ✅ Checklist for New Developers

- [ ] Read SUBGRAPH_QUICKSTART.md
- [ ] Run `npm run dev` and verify server starts
- [ ] Test API: `curl 'http://localhost:3000/api/data?limit=5&useSubgraph=true'`
- [ ] Check logs: `tail -f /tmp/nextjs-dev.log | grep "Fetched.*trades"`
- [ ] Review lib/subgraph/client.ts
- [ ] Review lib/subgraph/dataTransformer.ts
- [ ] Test custom query with GraphQL playground
- [ ] Read SUBGRAPH_INTEGRATION.md for deep dive
- [ ] Try code examples in this file
- [ ] Understand fallback behavior (synthetic data)

---

**Last Updated**: October 23, 2024
**Maintainer**: Integration complete and production-ready
**Support**: See SUBGRAPH_INTEGRATION.md for troubleshooting
