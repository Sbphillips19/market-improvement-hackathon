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
              {activeMarkets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No active markets found
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
