import { Box, Heading, Row, Skeleton, Stack, StatCard, Text } from '@voltstack/bravais';
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
    <Stack gap='05'>
        <Heading level={3} size='2xl' weight='bold' tone='primary'>Secret Key Metrics</Heading>
    </Stack>
);

const loadingView = (
    <Box height='vh-max' className='secret-key-page text-primary'>
        <Stack gap='2' width='max' className='secret-key-page-main'>
            <Stack gap='05'>
                <Skeleton variant='text' width={240} height={32} />
                <Skeleton variant='text' width={160} height={20} />
            </Stack>
            <Box gap='1' className='secret-key-page-cards'>
                {[...Array(4)].map((_, i) => (
                    <Box key={i} radius='lg' transition='normal' className='secret-key-page-card'>
                        <Row gap='05' className='mb-3'>
                            <Skeleton variant='circular' width={16} height={16} />
                            <Skeleton variant='text' width={120} height={20} />
                        </Row>
                        <Skeleton variant='rectangular' width={100} height={48} style={{ borderRadius: 4 }} />
                    </Box>
                ))}
            </Box>
            <div className='secret-key-page-charts'>
                <Skeleton variant='rectangular' width='100%' height={340} style={{ borderRadius: 8 }} />
                <Skeleton variant='rectangular' width='100%' height={340} style={{ borderRadius: 8 }} />
            </div>
        </Stack>
    </Box>
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
        <Box height='vh-max' className='secret-key-page text-primary'>
            <Stack gap='2' width='max' className='secret-key-page-main'>
                <Stack gap='05'>
                    <Heading level={3} size='2xl' weight='bold' tone='primary'>Secret Key Metrics</Heading>
                    <Text as='p' size='md' tone='secondary'>
                        {metrics.overview.totalRequests.toLocaleString()} total requests across {metrics.totalKeys} keys
                    </Text>
                </Stack>

                <Box gap='1' className='secret-key-page-cards'>
                    {cards.map((card) => (
                        <StatCard
                            key={card.title}
                            icon={<card.icon size={16} />}
                            label={card.title}
                            value={card.value}
                            unit={card.unit}
                            className='glass-bg'
                        />
                    ))}
                </Box>

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
            </Stack>
        </Box>
    );
}
