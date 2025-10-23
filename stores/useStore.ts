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
