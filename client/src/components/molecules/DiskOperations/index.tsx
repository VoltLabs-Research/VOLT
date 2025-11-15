import { useState, useEffect } from 'react';
import { HardDrive } from 'lucide-react';
import { useServerMetrics } from '@/hooks/metrics/use-server-metrics';
import { ChartContainer } from '@/components/atoms/ChartContainer';
import './DiskOperations.css';

interface DataPoint {
  read: number;
  write: number;
  speed: number;
}

const MAX_POINTS = 60; // 60 seconds

export function DiskOperations() {
  const { metrics, history: metricsHistory, isHistoryLoaded } = useServerMetrics();
  const [history, setHistory] = useState<DataPoint[]>([]);

  // Preload with historical data
  useEffect(() => {
    if (isHistoryLoaded && metricsHistory.length > 0 && history.length === 0) {
      console.log('[DiskOperations] Preloading with', metricsHistory.length, 'historical points')
      const historicalData = metricsHistory
        .filter(m => m.diskOperations)
        .slice(-MAX_POINTS)
        .map(m => ({
          read: m.diskOperations!.read,
          write: m.diskOperations!.write,
          speed: m.diskOperations!.speed
        }))
      setHistory(historicalData)
    }
  }, [isHistoryLoaded, metricsHistory])

  useEffect(() => {
    if (!metrics?.diskOperations) return;

    setHistory(prev => {
      const newHistory = [...prev, {
        read: metrics.diskOperations!.read,
        write: metrics.diskOperations!.write,
        speed: metrics.diskOperations!.speed
      }];

      if (newHistory.length > MAX_POINTS) {
        newHistory.shift();
      }

      return newHistory;
    });
  }, [metrics]);

  const isLoading = !isHistoryLoaded || !metrics?.diskOperations || history.length === 0

  const maxRead = Math.max(...history.map(d => d.read), 1);
  const maxWrite = Math.max(...history.map(d => d.write), 1);
  const maxSpeed = Math.max(...history.map(d => d.speed), 1);
  const maxValue = Math.max(maxRead, maxWrite, Math.ceil(maxSpeed / 10));

  const width = 100;
  const height = 80;
  const padding = 5;

  const getX = (index: number) => (index / (MAX_POINTS - 1)) * 100;
  const getY = (value: number) => 100 - ((value / maxValue) * (100 - padding * 2) + padding);

  const createPath = (values: number[]) => {
    if (values.length === 0) return '';
    
    let path = `M ${getX(0)} ${getY(values[0])}`;
    for (let i = 1; i < values.length; i++) {
      path += ` L ${getX(i)} ${getY(values[i])}`;
    }
    return path;
  };

  const readPath = createPath(history.map(d => d.read));
  const writePath = createPath(history.map(d => d.write));
  const speedPath = createPath(history.map(d => d.speed / 10));

  const currentRead = metrics?.diskOperations?.read || 0;
  const currentWrite = metrics?.diskOperations?.write || 0;
  const currentSpeed = metrics?.diskOperations?.speed || 0;

  const chartContent = (
    <div className="disk-ops-chart">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="diskReadGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0A84FF" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#0A84FF" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="diskWriteGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#30D158" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#30D158" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="diskSpeedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF9F0A" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#FF9F0A" stopOpacity={0} />
          </linearGradient>
        </defs>

        {readPath && (
          <>
            <path
              d={`${readPath} L ${getX(history.length - 1)} 100 L 0 100 Z`}
              fill="url(#diskReadGradient)"
            />
            <path
              d={readPath}
              fill="none"
              stroke="#0A84FF"
              strokeWidth="0.5"
            />
          </>
        )}

        {writePath && (
          <>
            <path
              d={`${writePath} L ${getX(history.length - 1)} 100 L 0 100 Z`}
              fill="url(#diskWriteGradient)"
            />
            <path
              d={writePath}
              fill="none"
              stroke="#30D158"
              strokeWidth="0.5"
            />
          </>
        )}

        {speedPath && (
          <path
            d={speedPath}
            fill="none"
            stroke="#FF9F0A"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />
        )}
      </svg>

      <div className="disk-ops-legend">
        <div className="disk-ops-legend-item">
          <span className="disk-ops-legend-dot" style={{ backgroundColor: '#0A84FF' }}></span>
          <span className="disk-ops-legend-label">Read (MB/s)</span>
        </div>
        <div className="disk-ops-legend-item">
          <span className="disk-ops-legend-dot" style={{ backgroundColor: '#30D158' }}></span>
          <span className="disk-ops-legend-label">Write (MB/s)</span>
        </div>
        <div className="disk-ops-legend-item">
          <span className="disk-ops-legend-dot" style={{ backgroundColor: '#FF9F0A' }}></span>
          <span className="disk-ops-legend-label">IOPS (x10)</span>
        </div>
      </div>
    </div>
  );

  return (
    <ChartContainer
      icon={HardDrive}
      title="Disk Operations"
      isLoading={isLoading}
      stats={[
        { label: 'Read', value: `${currentRead} MB/s` },
        { label: 'Write', value: `${currentWrite} MB/s` },
        { label: 'IOPS', value: currentSpeed }
      ]}
      statsLoading={isLoading}
    >
      {chartContent}
    </ChartContainer>
  );
}
