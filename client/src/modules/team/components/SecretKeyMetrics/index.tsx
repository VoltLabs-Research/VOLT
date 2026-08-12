import { Skeleton } from '@heroui/react';
import { useMemo } from 'react';
import { Activity, Clock, Globe, Key } from 'lucide-react';
import ChartContainer from '@/shared/ui/components/ChartContainer';
import useSecretKeyTeamMetrics from '@/modules/team/hooks/secret-key/use-secret-key-team-metrics';
import { renderRequestsAreaTooltip } from '@/modules/team/components/secret-key/shared/chart-tooltip-renderer';
import EndpointsBarChart from '@/modules/team/components/secret-key/shared/EndpointsBarChart';
import RequestsAreaChart from '@/modules/team/components/secret-key/shared/RequestsAreaChart';
import { SecretKeyAsyncState } from '@/modules/team/components/secret-key/shared/SecretKeyAsyncViews';
import SecretKeyStatCard from '@/modules/team/components/secret-key/shared/SecretKeyStatCard';
import PerKeyBreakdownTable from './PerKeyBreakdownTable';

const metricsTitle = (
    <div className='flex flex-col gap-2'>
        <h3 className='text-2xl font-semibold text-foreground'>Secret Key Metrics</h3>
    </div>
);

const CARD_SKELETON_KEYS = ['total-requests', 'avg-response-time', 'unique-endpoints', 'active-keys'];
const CHART_SKELETON_KEYS = ['requests-over-time', 'top-endpoints'];

const loadingView = (
    <div className='h-full overflow-scroll text-foreground'>
        <div className='flex flex-col gap-8 w-full max-w-[1600px] mx-auto md:py-4 md:px-8 min-[1440px]:px-12'>
            <div className='flex flex-col gap-2'>
                <Skeleton className='h-8 w-[240px] rounded-md' />
                <Skeleton className='h-5 w-[160px] rounded-md' />
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                {CARD_SKELETON_KEYS.map((key) => (
                    <div className='border border-border p-5 rounded-xl transition-[all] duration-200 ease-out-fluid hover:bg-surface-hover hover:shadow-overlay' key={key}>
                        <div className='flex flex-row items-center gap-2 mb-3'>
                            <Skeleton className='size-4 rounded-full' />
                            <Skeleton className='h-5 w-[120px] rounded-md' />
                        </div>
                        <Skeleton className='h-12 w-[100px] rounded-sm' />
                    </div>
                ))}
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6 min-[1440px]:gap-8'>
                {CHART_SKELETON_KEYS.map((key) => (
                    <Skeleton key={key} className='h-[340px] w-full rounded-lg' />
                ))}
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
        <div className='h-full overflow-scroll text-foreground'>
            <div className='flex flex-col gap-8 w-full max-w-[1600px] mx-auto md:py-4 md:px-8 min-[1440px]:px-12'>
                <div className='flex flex-col gap-2'>
                    <h3 className='text-2xl font-semibold text-foreground'>Secret Key Metrics</h3>
                    <p className='text-sm text-muted'>
                        {metrics.overview.totalRequests.toLocaleString()} total requests across {metrics.totalKeys} keys
                    </p>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                    {cards.map((card) => (
                        <SecretKeyStatCard
                            key={card.title}
                            icon={<card.icon size={16} />}
                            label={card.title}
                            value={card.value}
                            unit={card.unit}
                            className='bg-surface border border-border'
                        />
                    ))}
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-6 min-[1440px]:gap-8'>
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
