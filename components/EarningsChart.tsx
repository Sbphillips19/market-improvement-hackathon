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
        {mergedData.length > 0 ? (
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
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No earnings data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
