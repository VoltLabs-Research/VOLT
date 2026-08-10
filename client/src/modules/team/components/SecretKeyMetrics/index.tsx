import { Skeleton, StatCard } from '@voltstack/bravais';
import { useMemo } from 'react';
import { Activity, Clock, Globe, Key } from 'lucide-react';
import ChartContainer from '@/shared/ui/components/ChartContainer';
import useSecretKeyTeamMetrics from '@/modules/team/hooks/secret-key/use-secret-key-team-metrics';
import { renderRequestsAreaTooltip } from '@/modules/team/components/secret-key/shared/chart-tooltip-renderer';
import EndpointsBarChart from '@/modules/team/components/secret-key/shared/EndpointsBarChart';
import RequestsAreaChart from '@/modules/team/components/secret-key/shared/RequestsAreaChart';
import { SecretKeyAsyncState } from '@/modules/team/components/secret-key/shared/SecretKeyAsyncViews';
import PerKeyBreakdownTable from './PerKeyBreakdownTable';
import '../secret-key/shared/SecretKeyShared.css';

const metricsTitle = (
    <div className='flex flex-col gap-2'>
        <h3 className='text-2xl font-semibold text-foreground'>Secret Key Metrics</h3>
    </div>
);

const loadingView = (
    <div className='h-dvh secret-key-page text-foreground'>
        <div className='flex flex-col gap-8 w-full secret-key-page-main'>
            <div className='flex flex-col gap-2'>
                <Skeleton variant='text' width={240} height={32} />
                <Skeleton variant='text' width={160} height={20} />
            </div>
            <div className='gap-4 secret-key-page-cards'>
                {[...Array(4)].map((_, i) => (
                    <div className='rounded-2xl transition-[all] duration-200 ease-out-fluid secret-key-page-card' key={i}>
                        <div className='flex flex-row items-center gap-2 mb-3'>
                            <Skeleton variant='circular' width={16} height={16} />
                            <Skeleton variant='text' width={120} height={20} />
                        </div>
                        <Skeleton variant='rectangular' width={100} height={48} style={{ borderRadius: 4 }} />
                    </div>
                ))}
            </div>
            <div className='secret-key-page-charts'>
                <Skeleton variant='rectangular' width='100%' height={340} style={{ borderRadius: 8 }} />
                <Skeleton variant='rectangular' width='100%' height={340} style={{ borderRadius: 8 }} />
            </div>
        </div>
    </div>
);

export default function SecretKeyMetrics() {
    const { metrics, isLoading, error, refetch } = useSecretKeyTeamMetrics();

    const requestsOverTime = useMemo(() => {
        if(!metrics?.daily) return [];
        return metrics.daily.labels.map((label, i) => ({
            date: label,
            count: metrics.daily.total[i] ?? 0
        }));
    }, [metrics?.daily]);

    const topEndpoints = useMemo(() => {
        if(!metrics?.topEndpoints) return [];
        return metrics.topEndpoints.map((ep) => ({
            endpoint: `${ep.method} ${ep.path}`,
            count: ep.count
        }));
    }, [metrics?.topEndpoints]);

    if (!metrics) {
        return (
            <SecretKeyAsyncState
                header={metricsTitle}
                isLoading={isLoading}
                error={error}
                loadingView={loadingView}
                errorTitle='Unable to load metrics'
                errorFallbackDescription='Something went wrong while loading secret key metrics.'
                emptyMessage='No metrics data available yet.'
                onRetry={() => refetch()}
            />
        );
    }

    const uniqueEndpoints = metrics.topEndpoints.length;

    const cards = [
        {
            icon: Activity,
            title: 'Total Requests',
            value: metrics.overview.totalRequests.toLocaleString()
        },
        {
            icon: Clock,
            title: 'Avg Response Time',
            value: `${Math.round(metrics.overview.avgResponseTime)}`,
            unit: 'ms'
        },
        {
            icon: Globe,
            title: 'Unique Endpoints',
            value: uniqueEndpoints.toString()
        },
        {
            icon: Key,
            title: 'Active Keys',
            value: `${metrics.activeKeys}`,
            unit: `/ ${metrics.totalKeys}`
        }
    ];

    return (
        <div className='h-dvh secret-key-page text-foreground'>
            <div className='flex flex-col gap-8 w-full secret-key-page-main'>
                <div className='flex flex-col gap-2'>
                    <h3 className='text-2xl font-semibold text-foreground'>Secret Key Metrics</h3>
                    <p className='text-sm text-muted'>
                        {metrics.overview.totalRequests.toLocaleString()} total requests across {metrics.totalKeys} keys
                    </p>
                </div>

                <div className='gap-4 secret-key-page-cards'>
                    {cards.map((card) => (
                        <StatCard
                            key={card.title}
                            icon={<card.icon size={16} />}
                            label={card.title}
                            value={card.value}
                            unit={card.unit}
                            className='bg-surface border border-border'
                        />
                    ))}
                </div>

                <div className='secret-key-page-charts'>
                    <ChartContainer
                        icon={Activity}
                        title='Requests Over Time'
                        isLoading={false}
                        stats={[
                            {
                                label: 'Total',
                                value: metrics.overview.totalRequests.toLocaleString()
                            },
                            {
                                label: 'Success Rate',
                                value: `${metrics.overview.successRate.toFixed(1)}%`
                            }
                        ]}
                    >
                        <RequestsAreaChart
                            data={requestsOverTime}
                            gradientId='colorRequests'
                            height={280}
                            tooltipContent={renderRequestsAreaTooltip}
                            areaName='Requests'
                        />
                    </ChartContainer>

                    <ChartContainer
                        icon={Globe}
                        title='Top Endpoints'
                        isLoading={false}
                        stats={[
                            {
                                label: 'Endpoints',
                                value: uniqueEndpoints
                            }
                        ]}
                    >
                        <EndpointsBarChart
                            data={topEndpoints}
                            height={280}
                            barName='Requests'
                        />
                    </ChartContainer>
                </div>

                <PerKeyBreakdownTable perKey={metrics.perKey} />
            </div>
        </div>
    );
}
