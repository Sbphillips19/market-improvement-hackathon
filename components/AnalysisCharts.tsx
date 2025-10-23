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
          {priceData.length > 0 ? (
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
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No price history available
            </div>
          )}
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
          {outcomeData.length > 0 ? (
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
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No resolved markets data
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
