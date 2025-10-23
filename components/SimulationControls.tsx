'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SimulationState } from '@/types';

interface Props {
  simulation: SimulationState;
  onStartSimulation: (epochs: number) => Promise<void>;
}

export function SimulationControls({ simulation, onStartSimulation }: Props) {
  const [epochs, setEpochs] = useState(5);
  const [isRunning, setIsRunning] = useState(false);

  const handleStart = async () => {
    setIsRunning(true);
    await onStartSimulation(epochs);
    setIsRunning(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Self-Improvement Simulation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Epochs:</label>
          <input
            type="number"
            min="1"
            max="20"
            value={epochs}
            onChange={(e) => setEpochs(parseInt(e.target.value))}
            className="w-20 rounded border px-2 py-1"
            disabled={isRunning}
          />
          <Button
            onClick={handleStart}
            disabled={isRunning || simulation.isRunning}
          >
            {isRunning ? 'Running...' : 'Start Simulation'}
          </Button>
        </div>

        {simulation.isRunning && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>
                Epoch {simulation.currentEpoch} of {simulation.totalEpochs}
              </span>
              <span>{simulation.progress}%</span>
            </div>
            <Progress value={simulation.progress} />
          </div>
        )}

        {simulation.logs.length > 0 && (
          <Alert>
            <AlertDescription>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {simulation.logs.slice(-10).map((log, i) => (
                  <div key={i} className="text-xs font-mono">
                    {log}
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
