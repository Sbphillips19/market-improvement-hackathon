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
    setStrategies,
    setBacktestResults,
    setBenchmarks,
    setHistoricalStats,
    setLoading,
    setError,
    setSimulation,
  } = useStore();

  // Initial data load - runs once on mount
  useEffect(() => {
    // Skip if already loading or if we already have data
    if (isLoading || markets.length > 0) {
      console.log('⏭️ Skipping load - already loading or data exists');
      return;
    }

    console.log('🚀 Starting initial load...');
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Starting data load...');

      // Fetch Polymarket data (including resolved markets for backtesting)
      // EXTREME data load for comprehensive backtesting
      // Disable subgraph temporarily for faster loading
      console.log('Fetching unresolved markets...');
      const unresolvedRes = await axios.get('/api/data?limit=100&resolved=false&useSubgraph=false', { timeout: 90000 });
      console.log('✅ Unresolved markets fetched');

      console.log('Fetching resolved markets (loading MASSIVE dataset)...');
      const resolvedRes = await axios.get('/api/data?limit=400&resolved=true&useSubgraph=false', { timeout: 120000 });
      console.log('✅ Resolved markets fetched');

      console.log('✅ API Response received');
      console.log('Unresolved markets:', unresolvedRes.data.count);
      console.log('Resolved markets:', resolvedRes.data.count);

      const allMarkets = [
        ...unresolvedRes.data.markets,
        ...resolvedRes.data.markets,
      ];

      // Convert timestamp strings to Date objects
      allMarkets.forEach(market => {
        if (market.resolutionDate && typeof market.resolutionDate === 'string') {
          market.resolutionDate = new Date(market.resolutionDate);
        }
        if (market.endDate && typeof market.endDate === 'string') {
          market.endDate = new Date(market.endDate);
        }
        market.historicalPrices = market.historicalPrices.map((p: any) => ({
          ...p,
          timestamp: new Date(p.timestamp),
        }));
        market.trades = market.trades.map((t: any) => ({
          ...t,
          timestamp: new Date(t.timestamp),
        }));
      });

      console.log('Total markets:', allMarkets.length);
      setMarkets(allMarkets);

      // Calculate historical stats
      const stats = BacktestEngine.calculateHistoricalStats(allMarkets);
      console.log('Historical stats:', stats);
      setHistoricalStats(stats);

      // Run initial backtests
      console.log('Running backtests...');
      await runBacktests(allMarkets);
      console.log('Data load complete!');
    } catch (err: any) {
      console.error('❌ Error loading data:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load data from API';
      console.error('Error details:', errorMessage);
      setError(errorMessage + ' - Check console for details');
    } finally {
      setLoading(false);
      console.log('✅ Loading complete');
    }
  };

  const runBacktests = async (marketsData = markets) => {
    try {
      console.log('Running backtests on', marketsData.length, 'markets...');
      const results = strategies.map((strategy) => {
        console.log('Backtesting strategy:', strategy.name);
        return BacktestEngine.backtest(strategy, marketsData);
      });

      console.log('Backtest results:', results);
      setBacktestResults(results);

      const newBenchmarks = results.map((result) => ({
        strategyId: result.strategyId,
        strategyName: result.strategyName,
        epoch: 0,
        winRate: result.winRate,
        roi: result.roi,
        netProfit: result.netProfit,
        totalBets: result.totalBets,
        improvementPercent: 0,
      }));

      console.log('Benchmarks:', newBenchmarks);
      setBenchmarks(newBenchmarks);
    } catch (err) {
      console.error('Error in runBacktests:', err);
    }
  };

  const startSimulation = async (epochs: number) => {
    // Maintain local state to avoid closure issues
    let currentStrategies = [...strategies];
    let currentLogs: string[] = ['🚀 Starting AI Self-Improvement Simulation...', 'Initial strategy pool: ' + currentStrategies.length + ' strategies'];

    setSimulation({
      isRunning: true,
      currentEpoch: 0,
      totalEpochs: epochs,
      progress: 0,
      logs: currentLogs,
    });

    // Store epoch results for comparison
    const epochResults: { [epoch: number]: BacktestResult[] } = {};

    for (let epoch = 1; epoch <= epochs; epoch++) {
      currentLogs = [
        ...currentLogs,
        `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🔄 EPOCH ${epoch}/${epochs}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ];

      setSimulation({
        currentEpoch: epoch,
        progress: Math.round((epoch / epochs) * 100),
        logs: currentLogs,
      });

      // Run backtests for current strategies
      console.log(`[Epoch ${epoch}] Running backtests on ${currentStrategies.length} strategies...`);
      const currentResults = currentStrategies.map((strategy) => {
        return BacktestEngine.backtest(strategy, markets);
      });

      setBacktestResults(currentResults);

      // Store results for this epoch
      epochResults[epoch] = [...currentResults];

      // Log results for each strategy
      currentLogs.push('📊 Strategy Performance:');
      currentResults.forEach((result) => {
        const prevEpochResult = epoch > 1 ? epochResults[epoch - 1]?.find(r => r.strategyId === result.strategyId) : null;
        const roiChange = prevEpochResult ? (result.roi - prevEpochResult.roi).toFixed(1) : '0.0';
        const changeIcon = parseFloat(roiChange) > 0 ? '📈' : parseFloat(roiChange) < 0 ? '📉' : '➡️';

        currentLogs.push(`  ${changeIcon} ${result.strategyName}:`);
        currentLogs.push(`     ROI: ${result.roi.toFixed(1)}% ${epoch > 1 ? `(${roiChange > 0 ? '+' : ''}${roiChange}%)` : ''}`);
        currentLogs.push(`     Win Rate: ${result.winRate.toFixed(1)}% | Bets: ${result.totalBets} | Profit: $${result.netProfit.toFixed(2)}`);
      });

      setSimulation({
        logs: currentLogs,
      });

      // Use OpenAI to improve underperforming strategies
      try {
        // Sort to find worst performing strategy
        const sortedResults = [...currentResults].sort((a, b) => a.roi - b.roi);
        const worstStrategy = sortedResults[0];
        const worstStrategyDef = currentStrategies.find((s) => s.id === worstStrategy.strategyId);

        if (worstStrategy && worstStrategyDef && worstStrategy.roi < 50) {
          currentLogs = [
            ...currentLogs,
            `\n🔧 Improving worst performer: ${worstStrategy.strategyName}`,
            `   Current ROI: ${worstStrategy.roi.toFixed(1)}% | Win Rate: ${worstStrategy.winRate.toFixed(1)}%`,
          ];

          setSimulation({
            logs: currentLogs,
          });

          const improvementResponse = await axios.post('/api/openai', {
            action: 'improve_strategy',
            data: {
              strategy: worstStrategyDef,
              performance: worstStrategy,
              historicalStats,
            },
          });

          const improvements = improvementResponse.data;

          // Actually apply the improvements to the strategy
          currentStrategies = currentStrategies.map((s) => {
            if (s.id === worstStrategy.strategyId) {
              const improvedStrategy = {
                ...s,
                parameters: {
                  ...s.parameters,
                  ...improvements.improvedParameters,
                },
              };

              // If new code is provided, compile and inject it
              if (improvements.generateBetsCode) {
                try {
                  // Create executable function from AI-generated code
                  // Inject utility functions for AI code to use
                  // eslint-disable-next-line no-new-func
                  const generateBetsFn = new Function(
                    'markets',
                    'context',
                    'parameters',
                    'Math',
                    'Date',
                    `
                    // Utility functions available to AI code
                    const clampPrice = (price) => Math.max(0.01, Math.min(0.99, price));
                    const mean = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
                    const sortBy = (arr, fn) => [...arr].sort((a, b) => fn(a) - fn(b));

                    ${improvements.generateBetsCode}
                    `
                  );

                  improvedStrategy.generateBets = (markets, context) => {
                    return generateBetsFn(markets, context, improvedStrategy.parameters, Math, Date);
                  };

                  console.log(`✅ Compiled new strategy logic for ${s.name}`);
                } catch (err) {
                  console.error(`❌ Failed to compile strategy code:`, err);
                }
              }

              return improvedStrategy;
            }
            return s;
          });
          setStrategies(currentStrategies);

          currentLogs = [
            ...currentLogs,
            `   ✅ Applied improvements:`,
            `   ${improvements.reasoning}`,
            `   Expected improvement: +${improvements.expectedImprovementPercent}%`,
          ];

          setSimulation({
            logs: currentLogs,
          });
        }

        // Generate a new AI strategy every few epochs
        if (epoch % 2 === 0 || epoch === epochs) {
          currentLogs = [...currentLogs, '\n🤖 Generating new AI strategy from learnings...'];
          setSimulation({
            logs: currentLogs,
          });

          const newStrategyResponse = await axios.post('/api/openai', {
            action: 'generate_strategy',
            data: {
              historicalData: historicalStats,
              benchmarks,
              currentStrategies: currentStrategies,
            },
          });

          const newStrategy = newStrategyResponse.data;

          // Add the new AI-generated strategy to the strategy pool
          const aiStrategy: Strategy = {
            id: `ai_${Date.now()}`,
            name: newStrategy.strategyName,
            description: newStrategy.description,
            type: 'ai_generated' as const,
            parameters: newStrategy.parameters,
            generateBets: () => {
              // Placeholder - will be replaced below if code is provided
              return [];
            },
          };

          // Compile and inject AI-generated code
          if (newStrategy.generateBetsCode) {
            try {
              // Create executable function from AI-generated code
              // Inject utility functions for AI code to use
              // eslint-disable-next-line no-new-func
              const generateBetsFn = new Function(
                'markets',
                'context',
                'parameters',
                'Math',
                'Date',
                `
                // Utility functions available to AI code
                const clampPrice = (price) => Math.max(0.01, Math.min(0.99, price));
                const mean = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
                const sortBy = (arr, fn) => [...arr].sort((a, b) => fn(a) - fn(b));

                ${newStrategy.generateBetsCode}
                `
              );

              aiStrategy.generateBets = (markets, context) => {
                return generateBetsFn(markets, context, aiStrategy.parameters, Math, Date);
              };

              console.log(`✅ Compiled AI strategy: ${newStrategy.strategyName}`);
            } catch (err) {
              console.error(`❌ Failed to compile AI strategy code:`, err);
              currentLogs = [...currentLogs, `   ⚠️ Warning: Strategy code compilation failed`];
            }
          }

          // Add strategy to local array
          currentStrategies = [...currentStrategies, aiStrategy];
          setStrategies(currentStrategies);

          currentLogs = [
            ...currentLogs,
            `   ✅ Generated: "${newStrategy.strategyName}"`,
            `   Expected ROI: ${newStrategy.expectedROI}%`,
            `   📈 Total strategies: ${currentStrategies.length}`,
          ];

          setSimulation({
            logs: currentLogs,
          });
        }

        // Delay to let user see progress
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err: any) {
        console.error('Simulation error:', err);
        currentLogs = [...currentLogs, `❌ Error: ${err.message}`];
        setSimulation({
          logs: currentLogs,
        });
      }
    }

    // Final summary
    const finalLogs = [...currentLogs];
    finalLogs.push('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    finalLogs.push('🎉 SIMULATION COMPLETE!');
    finalLogs.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    finalLogs.push('\n📈 Final Performance Summary:');

    // Compare first epoch to last epoch
    const firstEpochResults = epochResults[1] || [];
    const lastEpochResults = epochResults[epochs] || [];

    firstEpochResults.forEach((firstResult) => {
      const lastResult = lastEpochResults.find(r => r.strategyId === firstResult.strategyId);
      if (lastResult) {
        const roiImprovement = lastResult.roi - firstResult.roi;
        const improvementIcon = roiImprovement > 0 ? '✅' : roiImprovement < 0 ? '⚠️' : '➡️';

        finalLogs.push(`\n${improvementIcon} ${lastResult.strategyName}:`);
        finalLogs.push(`   Initial ROI: ${firstResult.roi.toFixed(1)}% → Final ROI: ${lastResult.roi.toFixed(1)}%`);
        finalLogs.push(`   Improvement: ${roiImprovement > 0 ? '+' : ''}${roiImprovement.toFixed(1)}%`);
        finalLogs.push(`   Final Stats: ${lastResult.totalBets} bets, ${lastResult.winRate.toFixed(1)}% win rate, $${lastResult.netProfit.toFixed(2)} profit`);
      }
    });

    finalLogs.push(`\n🧠 Total Strategies Generated: ${currentStrategies.length}`);
    finalLogs.push(`💡 AI learned from ${markets.length} markets with ${markets.reduce((acc, m) => acc + m.trades.length, 0).toLocaleString()} trades`);

    setSimulation({
      isRunning: false,
      logs: finalLogs,
    });
  };

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">Polymarket Strategy Analyzer</h1>
          <p className="text-muted-foreground mt-2">
            AI-powered prediction market trading strategies with backtesting & self-improvement
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
            <p className="mt-4 text-muted-foreground">
              Loading market data... ({markets.length} markets loaded)
            </p>
          </div>
        </div>
      ) : markets.length === 0 ? (
        <Alert>
          <AlertDescription>
            <div className="space-y-2">
              <p>No markets loaded yet. Click "Refresh Data" to load markets.</p>
              <Button onClick={loadData}>Refresh Data</Button>
            </div>
          </AlertDescription>
        </Alert>
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
