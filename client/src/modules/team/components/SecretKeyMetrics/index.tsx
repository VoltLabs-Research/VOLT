import { AsyncBoundary, Box, Heading, Row, Skeleton, Stack, StatCard, Surface, Text } from '@voltstack/bravais';
import { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { Activity, Clock, Globe, Key } from 'lucide-react';
import ChartContainer from '@/shared/presentation/components/ChartContainer';
import useSecretKeyTeamMetrics from '@/modules/team/hooks/secret-key/use-secret-key-team-metrics';
import { CHART_COLORS } from '@/modules/team/utilities/secret-key/chart-helpers';
import { createTooltipRenderer } from '@/modules/team/components/secret-key/shared/chart-tooltip-renderer';
import RequestsAreaChart from '@/modules/team/components/secret-key/shared/RequestsAreaChart';
import { SecretKeyEmptyView, SecretKeyRecoveryView } from '@/modules/team/components/secret-key/shared/SecretKeyAsyncViews';
import '../secret-key/shared/SecretKeyShared.css';

const renderAreaTooltip = createTooltipRenderer('date', 'Requests', CHART_COLORS.requests);
const renderBarTooltip = createTooltipRenderer('endpoint', 'Requests', CHART_COLORS.endpoints);
const metricsTitle = (
    <Stack gap='05'>
        <Heading level={3} size='2xl' weight='bold' tone='primary'>Secret Key Metrics</Heading>
    </Stack>
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

    const uniqueEndpoints = useMemo(() => {
        if(!metrics?.topEndpoints) return 0;
        return metrics.topEndpoints.length;
    }, [metrics?.topEndpoints]);

    const loadingView = (
        <Box height='vh-max' className='secret-key-page color-primary'>
            <Stack gap='2' width='max' className='secret-key-page-main'>
                <Stack gap='05'>
                    <Skeleton variant='text' width={240} height={32} />
                    <Skeleton variant='text' width={160} height={20} />
                </Stack>
                <Box gap='1' className='secret-key-page-cards'>
                    {[...Array(4)].map((_, i) => (
                        <Box key={i} radius='lg' transition='normal' className='secret-key-page-card'>
                            <Row gap='05' className='mb-075'>
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

    const errorView = (err: unknown) => (
        <SecretKeyRecoveryView
            header={metricsTitle}
            title='Unable to load metrics'
            description={err instanceof Error ? err.message : 'Something went wrong while loading secret key metrics.'}
            onRetry={() => refetch()}
        />
    );

    const emptyView = (
        <SecretKeyEmptyView
            header={metricsTitle}
            message='No metrics data available yet.'
        />
    );

    if (isLoading || (error && !metrics) || !metrics) {
        return (
            <AsyncBoundary
                state={{ loading: isLoading, error: error && !metrics ? error : undefined, empty: !metrics }}
                loading={loadingView}
                error={errorView}
                empty={emptyView}
            >
                {null}
            </AsyncBoundary>
        );
    }

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
        <Box height='vh-max' className='secret-key-page color-primary'>
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
                            { label: 'Total', value: metrics.overview.totalRequests.toLocaleString() },
                            { label: 'Success Rate', value: `${metrics.overview.successRate.toFixed(1)}%` }
                        ]}
                    >
                        <RequestsAreaChart
                            data={requestsOverTime}
                            gradientId='colorRequests'
                            height={280}
                            tooltipContent={renderAreaTooltip}
                            areaName='Requests'
                        />
                    </ChartContainer>

                    <ChartContainer
                        icon={Globe}
                        title='Top Endpoints'
                        isLoading={false}
                        stats={[
                            { label: 'Endpoints', value: uniqueEndpoints }
                        ]}
                    >
                        <ResponsiveContainer width='100%' height={280}>
                            <BarChart
                                data={topEndpoints}
                                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                                layout='vertical'
                            >
                                <CartesianGrid strokeDasharray='3 3' stroke='var(--color-border-soft)' />
                                <XAxis
                                    type='number'
                                    stroke='var(--color-text-muted)'
                                    style={{ fontSize: '12px' }}
                                />
                                <YAxis
                                    type='category'
                                    dataKey='endpoint'
                                    stroke='var(--color-text-muted)'
                                    style={{ fontSize: '11px' }}
                                    width={150}
                                />
                                <Tooltip content={renderBarTooltip} />
                                <Bar
                                    dataKey='count'
                                    fill={CHART_COLORS.endpoints}
                                    radius={[0, 4, 4, 0]}
                                    name='Requests'
                                    isAnimationActive={false}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </div>

                <Surface variant='glass' p='1-5' radius='lg'>
                    <Heading level={3} size='lg' weight='bold' tone='primary' className='mb-1-5'>Per-Key Breakdown</Heading>
                    <Box overflow='x-auto'>
                        <table className='secret-key-page-table'>
                            <thead>
                                <tr>
                                    <th>Key</th>
                                    <th>Role</th>
                                    <th>Requests</th>
                                    <th>Avg Response</th>
                                    <th>Last Used</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {metrics.perKey.map((key) => (
                                    <tr key={key.secretKeyId}>
                                        <td>
                                            <Stack>
                                                <Text weight='medium' tone='primary'>{key.name}</Text>
                                                <Text size='sm' tone='muted' className='font-mono'>{key.keyPrefix}...</Text>
                                            </Stack>
                                        </td>
                                        <td className='color-secondary'>{key.roleName}</td>
                                        <td className='font-mono color-primary'>{key.totalRequests.toLocaleString()}</td>
                                        <td className='font-mono color-secondary'>{Math.round(key.avgResponseTime)} ms</td>
                                        <td className='color-secondary'>
                                            {key.lastRequestAt
                                                ? new Date(key.lastRequestAt).toLocaleDateString()
                                                : 'Never'}
                                        </td>
                                        <td>
                                            <Text as='span' style={{ color: key.isActive ? 'var(--status-success)' : 'var(--status-error)' }}>
                                                {key.isActive ? 'Active' : 'Revoked'}
                                            </Text>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Box>
                </Surface>
            </Stack>
        </Box>
    );
}
