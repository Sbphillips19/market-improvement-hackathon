'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

export default function TestPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('/api/data?limit=5&resolved=false');
        console.log('API Response:', res.data);
        setData(res.data);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Test Page</h1>

      <div className="mb-4">
        <strong>Count:</strong> {data?.count || 0}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Markets:</h2>
        {data?.markets?.map((market: any, i: number) => (
          <div key={i} className="border p-4 rounded">
            <div><strong>Question:</strong> {market.question}</div>
            <div><strong>Outcomes:</strong> {JSON.stringify(market.outcomes)}</div>
            <div><strong>Volume:</strong> ${market.volume.toFixed(2)}</div>
            <div><strong>Liquidity:</strong> ${market.liquidity.toFixed(2)}</div>
            <div><strong>Active:</strong> {market.active ? 'Yes' : 'No'}</div>
            <div><strong>Historical Prices:</strong> {market.historicalPrices?.length || 0} points</div>
            <div><strong>Trades:</strong> {market.trades?.length || 0} trades</div>
          </div>
        ))}
      </div>

      <details className="mt-8">
        <summary className="cursor-pointer font-bold">Raw JSON</summary>
        <pre className="mt-2 p-4 bg-gray-100 rounded overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
