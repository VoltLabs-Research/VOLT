import { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import ChartContainer from '../../atoms/ChartContainer';
import { MAX_HISTORY_POINTS } from '@/modules/cluster/domain/constants';
import type { ClusterMetrics } from '@/modules/cluster/domain/entities';
import './CpuDistribution.css';

interface CpuDistributionProps {
    metrics: ClusterMetrics | null;
};

interface DataPoint {
    coresUsage?: number[];
};

const generateCoreColors = (numCores: number): string[] => {
    return Array.from({ length: numCores }, (_, i) => {
        const hue = (i * 360) / numCores;
        return `hsl(${hue}, 80%, 65%)`;
    });
};

const CpuDistribution = ({ metrics }: CpuDistributionProps) => {
    const [history, setHistory] = useState<DataPoint[]>([]);

    const numCores = metrics?.cpu?.cores || 0;
    const coreColors = generateCoreColors(numCores);

    useEffect(() => {
        if(!metrics?.cpu) return;

        setHistory((prev) => {
            const newHistory = [...prev, { coresUsage: metrics.cpu.coresUsage }];
            if(newHistory.length > MAX_HISTORY_POINTS) newHistory.shift();
            return newHistory;
        });
    }, [metrics]);

    const stats = (() => {
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
    })();

    const isLoading = !metrics;
    const hasCoreData = history.some((d) => d.coresUsage && d.coresUsage.length > 0);

    if(!hasCoreData && !isLoading){
        return (
            <ChartContainer icon={Cpu} title='CPU' isLoading={false}>
                <Container className='d-flex flex-center flex-1 font-size-2 color-muted'>
                    Waiting for per-core data...
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
            title='CPU'
            isLoading={isLoading}
            stats={[
                { label: 'Cores', value: numCores },
                { label: 'Avg Usage', value: `${stats.avgUsage}%` },
                { label: 'Max Core', value: `${stats.maxCore}%` },
                { label: 'Min Core', value: `${stats.minCore}%` }
            ]}
            statsLoading={isLoading}
        >
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio='none' className='cpu-distribution-chart'>
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
