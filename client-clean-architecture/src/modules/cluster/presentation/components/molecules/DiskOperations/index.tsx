import { useState, useEffect, useMemo } from 'react';
import { HardDrive } from 'lucide-react';
import type { ClusterMetrics } from '@/modules/cluster/domain/entities';
import { MAX_HISTORY_POINTS, CHART_COLORS } from '@/modules/cluster/domain/constants';
import { createLinePath, createAreaPath, calculateMaxValue } from '@/modules/cluster/presentation/utilities/generate-svg-paths';
import ChartContainer from '@/modules/cluster/presentation/components/atoms/ChartContainer';
import ChartLegend, { type LegendItem } from '@/modules/cluster/presentation/components/atoms/ChartLegend';
import Container from '@/shared/presentation/components/Container';
import './DiskOperations.css';

interface DataPoint {
    read: number;
    write: number;
    speed: number;
};

interface DiskOperationsProps {
    metrics: ClusterMetrics | null;
};

const LEGEND_ITEMS: LegendItem[] = [
    { label: 'Read(MB/s)', color: CHART_COLORS.blue },
    { label: 'Write(MB/s)', color: CHART_COLORS.green },
    { label: 'IOPS(x10)', color: CHART_COLORS.orange }
];

const GRADIENTS = [
    { id: 'diskReadGradient', color: CHART_COLORS.blue },
    { id: 'diskWriteGradient', color: CHART_COLORS.green },
    { id: 'diskSpeedGradient', color: CHART_COLORS.orange }
];

const DiskOperations = ({ metrics }: DiskOperationsProps) => {
    const [history, setHistory] = useState<DataPoint[]>([]);

    useEffect(() => {
        if(!metrics?.diskOperations) return;

        setHistory((prev) => {
            const newPoint = {
                read: metrics.diskOperations!.read,
                write: metrics.diskOperations!.write,
                speed: metrics.diskOperations!.speed
            };
            const updated = [...prev, newPoint];
            return updated.length > MAX_HISTORY_POINTS ? updated.slice(1) : updated;
        });
    }, [metrics]);

    const paths = useMemo(() => {
        if(!history.length) return null;

        const reads = history.map((d) => d.read);
        const writes = history.map((d) => d.write);
        const speeds = history.map((d) => d.speed / 10);
        const maxValue = calculateMaxValue(reads, writes, speeds);

        const readLine = createLinePath(reads, maxValue);
        const writeLine = createLinePath(writes, maxValue);
        const speedLine = createLinePath(speeds, maxValue);

        return {
            read: { line: readLine, area: createAreaPath(readLine, history.length) },
            write: { line: writeLine, area: createAreaPath(writeLine, history.length) },
            speed: { line: speedLine }
        };
    }, [history]);

    const currentValues = {
        read: metrics?.diskOperations?.read ?? 0,
        write: metrics?.diskOperations?.write ?? 0,
        speed: metrics?.diskOperations?.speed ?? 0
    };

    return (
        <ChartContainer
            icon={HardDrive}
            title='Disk Operations'
            isLoading={!metrics}
            stats={[
                { label: 'Read', value: `${currentValues.read} MB/s` },
                { label: 'Write', value: `${currentValues.write} MB/s` },
                { label: 'IOPS', value: currentValues.speed }
            ]}
            statsLoading={!metrics}
        >
            <Container className='d-flex column flex-1 disk-ops-chart'>
                <svg viewBox='0 0 100 80' preserveAspectRatio='none'>
                    <defs>
                        {GRADIENTS.map(({ id, color }) => (
                            <linearGradient key={id} id={id} x1='0' y1='0' x2='0' y2='1'>
                                <stop offset='0%' stopColor={color} stopOpacity={0.3} />
                                <stop offset='100%' stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        ))}
                    </defs>

                    {paths?.read.area && (
                        <path d={paths.read.area} fill='url(#diskReadGradient)' />
                    )}
                    {paths?.read.line && (
                        <path d={paths.read.line} fill='none' stroke={CHART_COLORS.blue} strokeWidth='0.5' />
                    )}

                    {paths?.write.area && (
                        <path d={paths.write.area} fill='url(#diskWriteGradient)' />
                    )}
                    {paths?.write.line && (
                        <path d={paths.write.line} fill='none' stroke={CHART_COLORS.green} strokeWidth='0.5' />
                    )}

                    {paths?.speed.line && (
                        <path 
                            d={paths.speed.line} 
                            fill='none' 
                            stroke={CHART_COLORS.orange} 
                            strokeWidth='0.5' 
                            strokeDasharray='2,2' 
                        />
                    )}
                </svg>

                <ChartLegend items={LEGEND_ITEMS} />
            </Container>
        </ChartContainer>
    );
};

export default DiskOperations;
