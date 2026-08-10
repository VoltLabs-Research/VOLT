import { Button } from '@heroui/react';
import EndpointsBarChart from '@/modules/team/components/secret-key/shared/EndpointsBarChart';
import RequestsAreaChart from '@/modules/team/components/secret-key/shared/RequestsAreaChart';
import { renderRequestsAreaTooltip } from '@/modules/team/components/secret-key/shared/chart-tooltip-renderer';
import { SecretKeyAsyncState } from '@/modules/team/components/secret-key/shared/SecretKeyAsyncViews';
import SecretKeyStatCard from '@/modules/team/components/secret-key/shared/SecretKeyStatCard';
import {
    SECRET_KEY_PAGE_CARDS_CLASS,
    SECRET_KEY_PAGE_CHARTS_CLASS,
    SECRET_KEY_PAGE_CLASS,
    SECRET_KEY_PAGE_MAIN_CLASS,
    SECRET_KEY_USAGE_BACK_CLASS
} from '@/modules/team/components/secret-key/shared/secret-key-page-styles';
import RecentRequestsTable from './RecentRequestsTable';
import StatusCodesPieChart from './StatusCodesPieChart';
import UsageSkeleton from './UsageSkeleton';
import useSecretKeyUsage from '@/modules/team/hooks/secret-key/use-secret-key-usage';
import ChartContainer from '@/shared/ui/components/ChartContainer';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Activity, BarChart3, PieChart as PieChartIcon, List, Clock, Zap, CheckCircle, Hash } from 'lucide-react';
import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

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
            className={SECRET_KEY_USAGE_BACK_CLASS}
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
                        <h3 className='text-2xl font-semibold text-foreground'>Key Usage</h3>
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
            icon: Hash,
            title: 'Total Requests',
            value: usage.stats.totalRequests.toLocaleString()
        },
        {
            icon: Zap,
            title: 'Avg Response Time',
            value: `${usage.stats.avgResponseTime.toFixed(0)}ms`
        },
        {
            icon: CheckCircle,
            title: 'Success Rate',
            value: `${usage.stats.successRate.toFixed(1)}%`
        },
        {
            icon: Clock,
            title: 'Last Used',
            /*
             * `smallText` used to add `.secret-key-page-card--small`, a class defined in
             * no stylesheet in the app — so it never did anything. Dropped rather than
             * ported (migration spec §5b.4).
             */
            value: usage.key.lastUsedAt
                ? formatDistanceToNow(new Date(usage.key.lastUsedAt), { addSuffix: true })
                : 'Never'
        }
    ];

    return (
        <div className={SECRET_KEY_PAGE_CLASS}>
            <div className={SECRET_KEY_PAGE_MAIN_CLASS}>
                <div className='flex flex-col gap-2'>
                    <div className='flex flex-row items-center gap-4'>
                        {backButton}
                        <h3 className='text-2xl font-semibold text-foreground'>{`${usage.key.name} (${usage.key.keyPrefix}...)`}</h3>
                    </div>
                    <p className='text-sm text-muted ms-8'>
                        {usage.stats.totalRequests.toLocaleString()} total requests
                    </p>
                </div>

                <div className={SECRET_KEY_PAGE_CARDS_CLASS}>
                    {cards.map((card) => (
                        <SecretKeyStatCard
                            key={card.title}
                            icon={<card.icon size={16} />}
                            label={card.title}
                            value={card.value}
                            className='bg-surface border border-border'
                        />
                    ))}
                </div>

                <div className={SECRET_KEY_PAGE_CHARTS_CLASS}>
                    <ChartContainer
                        icon={Activity}
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
                            gradientId='colorHourlyReqs'
                            height={250}
                            tooltipContent={renderRequestsAreaTooltip}
                            xAxisTickLine={false}
                            yAxisAllowDecimals={false}
                        />
                    </ChartContainer>

                    <ChartContainer
                        icon={BarChart3}
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
                            xAxisAllowDecimals={false}
                            yAxisTickLine={false}
                        />
                    </ChartContainer>

                    <ChartContainer
                        icon={PieChartIcon}
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
                        icon={List}
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
        </div>
    );
}
