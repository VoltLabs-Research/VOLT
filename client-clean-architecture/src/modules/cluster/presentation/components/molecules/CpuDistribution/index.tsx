import { useState, useEffect, useMemo } from 'react';
import { Cpu } from 'lucide-react';
import type { ClusterMetrics } from '@/modules/cluster/domain/entities';
import ChartContainer from '@/shared/presentation/components/ChartContainer';
import Container from '@/shared/presentation/components/Container';

const MAX_HISTORY_POINTS = 60;

interface CpuDistributionProps {
    metrics: ClusterMetrics | null;
};

interface DataPoint {
    coresUsage?: number[];
};

const generateCoreColors = (numCores: number): string[] => {
    const baseColors = [
        '#0A84FF', '#30D158', '#FF9F0A', '#FF453A',
        '#BF5AF2', '#64D2FF', '#FFD60A', '#FF375F',
        '#AC8E68', '#5E5CE6', '#32D74B', '#FF6482'
    ];
    return Array.from({ length: numCores }, (_, i) => baseColors[i % baseColors.length]);
};

const CpuDistribution = ({ metrics }: CpuDistributionProps) => {
    const [history, setHistory] = useState<DataPoint[]>([]);

    const numCores = metrics?.cpu?.cores || 0;
    const coreColors = useMemo(() => generateCoreColors(numCores), [numCores]);

    useEffect(() => {
        if(!metrics?.cpu?.coresUsage) return;

        setHistory((prev) => {
            const newHistory = [...prev, { coresUsage: metrics.cpu.coresUsage }];
            if(newHistory.length > MAX_HISTORY_POINTS) newHistory.shift();
            return newHistory;
        });
    }, [metrics]);

    const stats = useMemo(() => {
        if(history.length === 0 || numCores === 0){
            return { avgUsage: '0', maxCore: '0', minCore: '0' };
        }

        const coreAverages = Array(numCores).fill(0).map((_, coreIndex) => {
            const values = history
                .filter((d) => d.coresUsage?.[coreIndex] !== undefined)
                .map((d) => d.coresUsage![coreIndex]);
            if(values.length === 0) return 0;
            return values.reduce((sum, val) => sum + val, 0) / values.length;
        });

        return {
            avgUsage: (coreAverages.reduce((a, b) => a + b, 0) / numCores).toFixed(1),
            maxCore: Math.max(...coreAverages).toFixed(1),
            minCore: Math.min(...coreAverages).toFixed(1)
        };
    }, [history, numCores]);

    const hasCoreData = history.some((d) => d.coresUsage && d.coresUsage.length > 0);

    if(!hasCoreData && !metrics){
        return (
            <ChartContainer icon={Cpu} title='CPU Distribution' isLoading={!metrics}>
                <Container className='d-flex flex-center flex-1 font-size-2 color-muted'>
                    Waiting for data...
                </Container>
            </ChartContainer>
        );
    }

    const width = 100;
    const height = 100;
    const padding = 10;
    const maxValue = 100;

    const getX = (index: number, length: number) => {
        if(length <= 1) return 50;
        return (index / (length - 1)) * 100;
    };

    const createPath = (values: number[], maxVal: number) => {
        if(values.length === 0) return '';
        const getY = (value: number) => {
            const scaledValue = (value / maxVal) * (100 - padding * 2);
            return 100 - scaledValue - padding;
        };
        let path = `M ${getX(0, values.length)} ${getY(values[0])}`;
        for(let i = 1; i < values.length; i++){
            path += ` L ${getX(i, values.length)} ${getY(values[i])}`;
        }
        return path;
    };

    return (
        <ChartContainer
            icon={Cpu}
            title='CPU Distribution'
            isLoading={!metrics}
            stats={[
                { label: 'Cores', value: numCores },
                { label: 'Avg', value: `${stats.avgUsage}%` },
                { label: 'Max', value: `${stats.maxCore}%` },
                { label: 'Min', value: `${stats.minCore}%` }
            ]}
            statsLoading={!metrics}
        >
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio='none' style={{ width: '100%', height: '300px' }}>
                {history.length > 0 && coreColors.map((color, coreIndex) => {
                    const points = history
                        .filter((d) => d.coresUsage?.[coreIndex] !== undefined)
                        .map((d) => d.coresUsage![coreIndex]);

                    if(points.length === 0) return null;

                    return (
                        <path
                            key={`core-${coreIndex}`}
                            d={createPath(points, maxValue)}
                            fill='none'
                            stroke={color}
                            strokeWidth='1'
                            vectorEffect='non-scaling-stroke'
                            opacity={0.8}
                        />
                    );
                })}
            </svg>
        </ChartContainer>
    );
};

export default CpuDistribution;
