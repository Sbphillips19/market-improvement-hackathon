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
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No backtest results available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
