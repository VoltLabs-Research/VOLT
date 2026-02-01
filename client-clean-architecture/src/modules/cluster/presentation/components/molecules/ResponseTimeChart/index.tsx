import { useState, useEffect } from 'react';
import Container from '@/shared/presentation/components/Container';
import ChartContainer from '../../atoms/ChartContainer';
import { CHART_COLORS, MAX_HISTORY_POINTS } from '@/modules/cluster/domain/constants';
import type { ClusterMetrics, ResponseTimes } from '@/modules/cluster/domain/entities';
import './ResponseTimeChart.css';

interface ResponseTimeChartProps {
    metrics: ClusterMetrics | null;
};

type ResponseTimeKey = keyof ResponseTimes;

interface DataPoint {
    mongodb: number;
    redis: number;
    minio: number;
    self: number;
};

const createPathData = (points: number[], maxValue: number, width: number, height: number): string => {
    if(points.length < 2) return '';

    const stepX = width / Math.max(1, points.length - 1);
    const scaleY = height / maxValue;

    return points.map((value, index) => {
        const x = index * stepX;
        const y = height - (value * scaleY);
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
};

const ResponseTimeChart = ({ metrics }: ResponseTimeChartProps) => {
    const [history, setHistory] = useState<DataPoint[]>([]);
    const chartWidth = 100;
    const chartHeight = 100;

    useEffect(() => {
        if(!metrics?.responseTimes) return;

        setHistory((prev) => {
            const newHistory = [...prev, {
                mongodb: metrics.responseTimes.mongodb,
                redis: metrics.responseTimes.redis,
                minio: metrics.responseTimes.minio || 0,
                self: metrics.responseTimes.self
            }];
            return newHistory.slice(-MAX_HISTORY_POINTS);
        });
    }, [metrics]);

    const regions = [
        { name: 'MongoDB', value: metrics?.responseTimes?.mongodb.toFixed(0) || '--', color: CHART_COLORS.mongodb, key: 'mongodb' as ResponseTimeKey },
        { name: 'Redis', value: metrics?.responseTimes?.redis.toFixed(0) || '--', color: CHART_COLORS.redis, key: 'redis' as ResponseTimeKey },
        { name: 'MinIO', value: metrics?.responseTimes?.minio?.toFixed(0) || '--', color: CHART_COLORS.minio, key: 'minio' as ResponseTimeKey },
        { name: 'Server', value: metrics?.responseTimes?.self.toFixed(0) || '--', color: CHART_COLORS.server, key: 'self' as ResponseTimeKey }
    ];

    const maxValue = Math.max(
        ...history.flatMap((d) => [d.mongodb, d.redis, d.minio, d.self]),
        100
    );

    const isLoading = !metrics;

    const renderIcon = () => <div className='response-chart-bar' />;

    return (
        <ChartContainer icon={renderIcon} title='Response Time' isLoading={isLoading}>
            <Container className='d-flex items-center response-chart-legend gap-1-5 flex-wrap'>
                {regions.map((region) => (
                    <Container key={region.name} className='d-flex items-center gap-05 response-chart-legend-item'>
                        <div className='response-chart-legend-dot' style={{ backgroundColor: region.color }} />
                        <span className='font-size-1 color-secondary'>{region.name}</span>
                        <span className='font-size-2 font-weight-5 color-primary'>{region.value}ms</span>
                    </Container>
                ))}
            </Container>

            <Container className='response-chart-container p-relative flex-1'>
                <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    preserveAspectRatio='none'
                    className='response-chart-svg w-max h-max'
                >
                    {[0, 25, 50, 75, 100].map((y) => (
                        <line
                            key={y}
                            x1='0'
                            y1={y}
                            x2={chartWidth}
                            y2={y}
                            stroke='var(--color-border-soft)'
                            strokeWidth='0.2'
                            strokeDasharray='1,1'
                        />
                    ))}

                    {history.length > 1 && regions.map((region) => {
                        const points = history.map((d) => d[region.key]);
                        const pathData = createPathData(points, maxValue, chartWidth, chartHeight);

                        return (
                            <path
                                key={region.key}
                                d={pathData}
                                fill='none'
                                stroke={region.color}
                                strokeWidth='0.8'
                                vectorEffect='non-scaling-stroke'
                            />
                        );
                    })}
                </svg>

                <Container className='d-flex column content-between response-chart-y-labels p-absolute'>
                    {Array.from({ length: 6 }, (_, i) => {
                        const value = Math.round(maxValue - (maxValue / 5) * i);
                        return (
                            <span key={i} className='response-chart-y-label font-size-1 color-muted'>
                                {value}ms
                            </span>
                        );
                    })}
                </Container>
            </Container>
        </ChartContainer>
    );
};

export default ResponseTimeChart;
