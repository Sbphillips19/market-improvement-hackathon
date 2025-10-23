/**
 * Polymarket Subgraph Client
 *
 * Queries real historical data from Polymarket's subgraphs hosted on Goldsky:
 * - Orderbook: Trade data, market data
 * - Activity: Position changes, market conditions
 * - Positions: User balances and positions
 * - PNL: Profit and loss tracking
 */

import axios from 'axios';

// Goldsky subgraph endpoints
export const SUBGRAPH_ENDPOINTS = {
  orderbook: 'https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/orderbook-subgraph/prod/gn',
  activity: 'https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/activity-subgraph/0.0.4/gn',
  positions: 'https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/positions-subgraph/0.0.7/gn',
  pnl: 'https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/pnl-subgraph/0.0.14/gn',
  openInterest: 'https://api.goldsky.com/api/public/project_cl6mb8i9h0003e201j6li0diw/subgraphs/oi-subgraph/0.0.6/gn',
};

export interface OrderFilledEvent {
  id: string;
  timestamp: string;
  maker: string;
  taker: string;
  makerAssetId: string;
  takerAssetId: string;
  makerAmountFilled: string;
  takerAmountFilled: string;
  fee: string;
  transactionHash: string;
}

export interface MarketData {
  id: string;
  condition: string;
  outcomeIndex: string | null;
}

export interface Condition {
  id: string;
  // Add more fields as discovered from the subgraph
}

export interface SubgraphQueryResult<T> {
  data: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

/**
 * Generic GraphQL query executor
 */
export async function querySubgraph<T>(
  endpoint: string,
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  try {
    const response = await axios.post<SubgraphQueryResult<T>>(
      endpoint,
      {
        query,
        variables,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      }
    );

    if (response.data.errors) {
      console.error('GraphQL errors:', response.data.errors);
      throw new Error(
        `GraphQL query failed: ${response.data.errors.map((e) => e.message).join(', ')}`
      );
    }

    return response.data.data;
  } catch (error: any) {
    console.error('Subgraph query error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get order filled events (trades) for a specific token/asset
 */
export async function getOrderFilledEvents(
  tokenId: string,
  limit = 1000,
  skip = 0
): Promise<OrderFilledEvent[]> {
  const query = `
    query GetOrderFilledEvents($tokenId: String!, $limit: Int!, $skip: Int!) {
      orderFilledEvents(
        where: {
          or: [
            { makerAssetId: $tokenId }
            { takerAssetId: $tokenId }
          ]
        }
        first: $limit
        skip: $skip
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
        fee
        transactionHash
      }
    }
  `;

  const result = await querySubgraph<{ orderFilledEvents: OrderFilledEvent[] }>(
    SUBGRAPH_ENDPOINTS.orderbook,
    query,
    { tokenId, limit, skip }
  );

  return result.orderFilledEvents;
}

/**
 * Get all order filled events within a time range
 */
export async function getOrderFilledEventsByTimeRange(
  startTimestamp: number,
  endTimestamp: number,
  limit = 1000,
  skip = 0
): Promise<OrderFilledEvent[]> {
  const query = `
    query GetOrderFilledEventsByTimeRange($startTimestamp: BigInt!, $endTimestamp: BigInt!, $limit: Int!, $skip: Int!) {
      orderFilledEvents(
        where: {
          timestamp_gte: $startTimestamp
          timestamp_lte: $endTimestamp
        }
        first: $limit
        skip: $skip
        orderBy: timestamp
        orderDirection: asc
      ) {
        id
        timestamp
        maker
        taker
        makerAssetId
        takerAssetId
        makerAmountFilled
        takerAmountFilled
        fee
        transactionHash
      }
    }
  `;

  const result = await querySubgraph<{ orderFilledEvents: OrderFilledEvent[] }>(
    SUBGRAPH_ENDPOINTS.orderbook,
    query,
    {
      startTimestamp: startTimestamp.toString(),
      endTimestamp: endTimestamp.toString(),
      limit,
      skip
    }
  );

  return result.orderFilledEvents;
}

/**
 * Get market data for specific tokens
 */
export async function getMarketData(tokenIds: string[]): Promise<MarketData[]> {
  const query = `
    query GetMarketData($tokenIds: [ID!]!) {
      marketDatas(where: { id_in: $tokenIds }) {
        id
        condition
        outcomeIndex
      }
    }
  `;

  const result = await querySubgraph<{ marketDatas: MarketData[] }>(
    SUBGRAPH_ENDPOINTS.orderbook,
    query,
    { tokenIds }
  );

  return result.marketDatas;
}

/**
 * Get market data by condition ID
 */
export async function getMarketDataByCondition(conditionId: string): Promise<MarketData[]> {
  const query = `
    query GetMarketDataByCondition($conditionId: String!) {
      marketDatas(where: { condition: $conditionId }) {
        id
        condition
        outcomeIndex
      }
    }
  `;

  const result = await querySubgraph<{ marketDatas: MarketData[] }>(
    SUBGRAPH_ENDPOINTS.orderbook,
    query,
    { conditionId }
  );

  return result.marketDatas;
}

/**
 * Get condition information from activity subgraph
 */
export async function getConditions(
  conditionIds: string[],
  limit = 100
): Promise<Condition[]> {
  const query = `
    query GetConditions($conditionIds: [ID!]!, $limit: Int!) {
      conditions(where: { id_in: $conditionIds }, first: $limit) {
        id
      }
    }
  `;

  const result = await querySubgraph<{ conditions: Condition[] }>(
    SUBGRAPH_ENDPOINTS.activity,
    query,
    { conditionIds, limit }
  );

  return result.conditions;
}

/**
 * Get recent trades across all markets
 */
export async function getRecentTrades(limit = 100): Promise<OrderFilledEvent[]> {
  const query = `
    query GetRecentTrades($limit: Int!) {
      orderFilledEvents(
        first: $limit
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
        fee
        transactionHash
      }
    }
  `;

  const result = await querySubgraph<{ orderFilledEvents: OrderFilledEvent[] }>(
    SUBGRAPH_ENDPOINTS.orderbook,
    query,
    { limit }
  );

  return result.orderFilledEvents;
}

/**
 * Calculate price from trade data
 * Price = takerAmount / makerAmount when taker is buying the outcome
 */
export function calculateTradePrice(trade: OrderFilledEvent, outcomeTokenId: string): number {
  const makerAmount = parseFloat(trade.makerAmountFilled);
  const takerAmount = parseFloat(trade.takerAmountFilled);

  // If maker is selling the outcome token
  if (trade.makerAssetId === outcomeTokenId) {
    // Price = USDC amount / outcome amount
    return takerAmount / makerAmount;
  }
  // If taker is buying the outcome token (maker has USDC)
  else if (trade.takerAssetId === outcomeTokenId) {
    // Price = USDC amount / outcome amount
    return makerAmount / takerAmount;
  }

  return 0.5; // Default if neither matches
}

/**
 * Paginate through all results (handles GraphQL 1000 item limit)
 */
export async function paginateQuery<T>(
  queryFn: (limit: number, skip: number) => Promise<T[]>,
  maxResults = 10000
): Promise<T[]> {
  const results: T[] = [];
  const pageSize = 1000; // GraphQL limit
  let skip = 0;

  while (results.length < maxResults) {
    const page = await queryFn(pageSize, skip);
    if (page.length === 0) break;

    results.push(...page);
    skip += pageSize;

    // If we got less than a full page, we're done
    if (page.length < pageSize) break;
  }

  return results.slice(0, maxResults);
}
