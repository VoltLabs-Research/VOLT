import { Button } from '@heroui/react';
import EndpointsBarChart from '@/modules/team/components/secret-key/shared/EndpointsBarChart';
import RequestsAreaChart from '@/modules/team/components/secret-key/shared/RequestsAreaChart';
import { renderRequestsAreaTooltip } from '@/modules/team/components/secret-key/shared/chart-tooltip-renderer';
import { SecretKeyAsyncState } from '@/modules/team/components/secret-key/shared/SecretKeyAsyncViews';
import SecretKeyStatCard from '@/modules/team/components/secret-key/shared/SecretKeyStatCard';
import RecentRequestsTable from './RecentRequestsTable';
import StatusCodesPieChart from './StatusCodesPieChart';
import UsageSkeleton from './UsageSkeleton';
import useSecretKeyUsage from './use-secret-key-usage';
import ChartContainer from '@/shared/ui/components/ChartContainer';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Scrollable from '@/shared/ui/components/Scrollable';

export default function SecretKeyUsage() {
    const { secretKeyId } = useParams<{ secretKeyId: string }>();
    const navigate = useNavigate();
    const { usage, isLoading, error, refetch } = useSecretKeyUsage(secretKeyId);

    usePageTitle(usage?.key?.name ? `${usage.key.name} Usage` : 'Secret Key Usage');

    const hourlyData = useMemo(() => {
        if (!usage?.hourly) return [];
        return usage.hourly.labels.map((label, i) => ({
            date: label,
            count: usage.hourly.data[i] || 0
        }));
    }, [usage?.hourly]);

    const endpointData = useMemo(() => {
        if (!usage?.endpoints) return [];
        return usage.endpoints.slice(0, 10).map((ep) => ({
            endpoint: `${ep.method} ${ep.path}`,
            count: ep.count
        }));
    }, [usage?.endpoints]);

    const statusData = useMemo(() => {
        if (!usage?.statusDistribution) return [];
        return usage.statusDistribution.map((s) => ({
            statusCode: `${s.code}`,
            count: s.count
        }));
    }, [usage?.statusDistribution]);

    const backButton = (
        <Button
            variant='ghost'
            size='sm'
            className='shrink-0'
            onPress={() => navigate(-1)}
        >
            <ArrowLeft size={18} aria-hidden='true' />
            Back
        </Button>
    );

    if (!usage) {
        return (
            <SecretKeyAsyncState
                header={(
                    <div className='flex flex-row items-center gap-4'>
                        {backButton}
                        <h1 className='text-2xl font-semibold tracking-[-0.01em] text-foreground'>Key Usage</h1>
                    </div>
                )}
                isLoading={isLoading}
                error={error}
                loadingView={<UsageSkeleton />}
                errorTitle='Unable to load usage data'
                errorFallbackDescription='Something went wrong while loading usage data for this key.'
                emptyMessage='No usage data available for this key.'
                onRetry={() => refetch()}
            />
        );
    }

    const cards = [
        {
            title: 'Total Requests',
            value: usage.stats.totalRequests.toLocaleString()
        },
        {
            title: 'Avg Response Time',
            value: `${usage.stats.avgResponseTime.toFixed(0)}ms`
        },
        {
            title: 'Success Rate',
            value: `${usage.stats.successRate.toFixed(1)}%`
        },
        {
            title: 'Last Used',
            value: usage.key.lastUsedAt
                ? formatDistanceToNow(new Date(usage.key.lastUsedAt), { addSuffix: true })
                : 'Never'
        }
    ];

    return (
        <Scrollable className='h-full text-foreground'>
            <div className='flex flex-col gap-8 w-full max-w-[1600px] mx-auto p-4 md:px-8 min-[1440px]:px-12'>
                <div className='flex flex-row items-start gap-4'>
                    {backButton}
                    <div className='flex min-w-0 flex-col gap-2'>
                        <h1 className='text-2xl font-semibold tracking-[-0.01em] text-foreground'>{`${usage.key.name} (${usage.key.keyPrefix}...)`}</h1>
                        <p className='text-sm text-muted tabular-nums'>
                            {usage.stats.totalRequests.toLocaleString()} total requests
                        </p>
                    </div>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                    {cards.map((card) => (
                        <SecretKeyStatCard
                            key={card.title}
                            label={card.title}
                            value={card.value}
                        />
                    ))}
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6 min-[1440px]:gap-8'>
                    <ChartContainer
                        title='Hourly Requests'
                        isLoading={false}
                        stats={[
                            {
                                label: '24h',
                                value: usage.stats.requests24h.toLocaleString()
                            },
                            {
                                label: 'Peak Hour',
                                value: usage.stats.peakHour
                            }
                        ]}
                    >
                        <RequestsAreaChart
                            data={hourlyData}
                            height={250}
                            tooltipContent={renderRequestsAreaTooltip}
                            yAxisAllowDecimals={false}
                        />
                    </ChartContainer>
                    <ChartContainer
                        title='Top Endpoints'
                        isLoading={false}
                        stats={[
                            {
                                label: 'Endpoints',
                                value: usage.endpoints.length
                            }
                        ]}
                    >
                        <EndpointsBarChart
                            data={endpointData}
                            height={250}
                        />
                    </ChartContainer>
                    <ChartContainer
                        title='Status Codes'
                        isLoading={false}
                        stats={[
                            {
                                label: 'Codes',
                                value: usage.statusDistribution.length
                            }
                        ]}
                    >
                        <StatusCodesPieChart data={statusData} />
                    </ChartContainer>
                    <ChartContainer
                        title='Recent Requests'
                        isLoading={false}
                        stats={[
                            {
                                label: 'Shown',
                                value: Math.min(usage.recentRequests.length, 20)
                            }
                        ]}
                    >
                        <RecentRequestsTable requests={usage.recentRequests.slice(0, 20)} />
                    </ChartContainer>
                </div>
            </div>
        </Scrollable>
    );
}
