import { AsyncBoundary, Box, Button, Heading, Row, Skeleton, Stack, StatCard, Tag, Text } from '@voltstack/bravais';
import { createTooltipRenderer } from '@/modules/team/components/secret-key/shared/chart-tooltip-renderer';
import RequestsAreaChart from '@/modules/team/components/secret-key/shared/RequestsAreaChart';
import { CHART_COLORS } from '@/modules/team/utilities/secret-key/chart-helpers';
import useSecretKeyUsage from '@/modules/team/hooks/secret-key/use-secret-key-usage';
import ChartContainer from '@/shared/presentation/components/ChartContainer';
import { SecretKeyEmptyView, SecretKeyRecoveryView } from '@/modules/team/components/secret-key/shared/SecretKeyAsyncViews';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Activity, BarChart3, PieChart as PieChartIcon, List, Clock, Zap, CheckCircle, Hash } from 'lucide-react';
import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import type { Params } from 'react-router-dom';
import '../secret-key/shared/SecretKeyShared.css';
import './SecretKeyUsage.css';
interface SecretKeyUsageRouteParams extends Params {
    secretKeyId: string;
}

const STATUS_COLORS: Record<string, string> = {
    '2xx': 'var(--status-success)',
    '3xx': 'var(--accent-blue)',
    '4xx': 'var(--status-warning)',
    '5xx': 'var(--status-error)'
};

const PIE_COLORS = [
    'var(--status-success)',
    'var(--accent-blue)',
    'var(--status-warning)',
    'var(--status-error)',
    'var(--accent-purple)'
];

const METHOD_COLORS: Record<string, string> = {
    GET: 'var(--status-success)',
    POST: 'var(--accent-blue)',
    PUT: 'var(--accent-orange)',
    DELETE: 'var(--status-error)',
    PATCH: 'var(--accent-purple)'
};

const backButton = (onClick: () => void) => (
    <Button
        variant='ghost'
        intent='neutral'
        size='sm'
        className='secret-key-usage-back'
        onClick={onClick}
        leftIcon={<ArrowLeft size={18} />}
    >
        Back
    </Button>
);

const getStatusColorGroup = (code: number): string => {
    if (code >= 200 && code < 300) return '2xx';
    if (code >= 300 && code < 400) return '3xx';
    if (code >= 400 && code < 500) return '4xx';
    return '5xx';
};

const renderAreaTooltip = createTooltipRenderer('date', 'Requests', CHART_COLORS.requests);
const renderBarTooltip = createTooltipRenderer('endpoint', 'Requests', CHART_COLORS.endpoints);
const renderPieTooltip = createTooltipRenderer((payload) => `Status ${payload.statusCode}`, 'Count');

export default function SecretKeyUsage() {
    const { secretKeyId } = useParams<SecretKeyUsageRouteParams>();
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

    const maskedName = useMemo(() => {
        if (!usage?.key) return '';
        return `${usage.key.name} (${usage.key.keyPrefix}...)`;
    }, [usage?.key]);

    const handleBack = () => {
        navigate(-1);
    };
    const usageTitle = (
        <Row gap='1'>
            {backButton(handleBack)}
            <Heading level={3} size='2xl' weight='bold'>Key Usage</Heading>
        </Row>
    );

    const loadingView = (
        <Box height='vh-max' className='secret-key-page color-primary'>
            <Stack gap='2' width='max' className='secret-key-page-main'>
                <Row gap='1'>
                    <Skeleton variant='circular' width={24} height={24} />
                    <Skeleton variant='text' width={300} height={32} />
                </Row>
                <Box gap='1' className='secret-key-page-cards'>
                    {[...Array(4)].map((_, i) => (
                        <Box key={i} radius='lg' transition='normal' className='secret-key-page-card'>
                            <Skeleton variant='text' width={100} height={16} />
                            <Skeleton variant='rectangular' width={80} height={40} style={{ borderRadius: 4, marginTop: '0.5rem' }} />
                        </Box>
                    ))}
                </Box>
                <div className='secret-key-page-charts'>
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} variant='rectangular' width='100%' height={300} style={{ borderRadius: 8 }} />
                    ))}
                </div>
            </Stack>
        </Box>
    );

    const errorView = (err: unknown) => (
        <SecretKeyRecoveryView
            header={usageTitle}
            title='Unable to load usage data'
            description={err instanceof Error ? err.message : 'Something went wrong while loading usage data for this key.'}
            onRetry={() => refetch()}
        />
    );

    const emptyView = (
        <SecretKeyEmptyView
            header={usageTitle}
            message='No usage data available for this key.'
        />
    );

    if (isLoading || (error && !usage) || !usage) {
        return (
            <AsyncBoundary
                state={{ loading: isLoading, error: error && !usage ? error : undefined, empty: !usage }}
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
            value: usage.key.lastUsedAt
                ? formatDistanceToNow(new Date(usage.key.lastUsedAt), { addSuffix: true })
                : 'Never',
            smallText: true
        }
    ];

    return (
        <Box height='vh-max' className='secret-key-page color-primary'>
            <Stack gap='2' width='max' className='secret-key-page-main'>
                <Stack gap='05'>
                    <Row gap='1'>
                        {backButton(handleBack)}
                        <Heading level={3} size='2xl' weight='bold'>{maskedName}</Heading>
                    </Row>
                    <Text as='p' tone='muted' size='md' style={{ marginLeft: '2rem' }}>
                        {usage.stats.totalRequests.toLocaleString()} total requests
                    </Text>
                </Stack>

                <Box gap='1' className='secret-key-page-cards'>
                    {cards.map((card) => (
                        <StatCard
                            key={card.title}
                            icon={<card.icon size={16} />}
                            label={card.title}
                            value={card.value}
                            className={`glass-bg${card.smallText ? ' secret-key-page-card--small' : ''}`}
                        />
                    ))}
                </Box>

                <div className='secret-key-page-charts'>
                    <ChartContainer
                        icon={Activity}
                        title='Hourly Requests'
                        isLoading={false}
                        stats={[
                            { label: '24h', value: usage.stats.requests24h.toLocaleString() },
                            { label: 'Peak Hour', value: usage.stats.peakHour }
                        ]}
                    >
                        <RequestsAreaChart
                            data={hourlyData}
                            gradientId='colorHourlyReqs'
                            height={250}
                            tooltipContent={renderAreaTooltip}
                            xAxisTickLine={false}
                            yAxisAllowDecimals={false}
                        />
                    </ChartContainer>

                    <ChartContainer
                        icon={BarChart3}
                        title='Top Endpoints'
                        isLoading={false}
                        stats={[
                            { label: 'Endpoints', value: usage.endpoints.length }
                        ]}
                    >
                        <ResponsiveContainer width='100%' height={250}>
                            <BarChart data={endpointData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} layout='vertical'>
                                <CartesianGrid strokeDasharray='3 3' stroke='var(--color-border-soft)' />
                                <XAxis
                                    type='number'
                                    stroke='var(--color-text-muted)'
                                    style={{ fontSize: '12px' }}
                                    allowDecimals={false}
                                />
                                <YAxis
                                    type='category'
                                    dataKey='endpoint'
                                    stroke='var(--color-text-muted)'
                                    style={{ fontSize: '11px' }}
                                    width={150}
                                    tickLine={false}
                                />
                                <Tooltip content={renderBarTooltip} />
                                <Bar
                                    dataKey='count'
                                    fill={CHART_COLORS.endpoints}
                                    radius={[0, 4, 4, 0]}
                                    isAnimationActive={false}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartContainer>

                    <ChartContainer
                        icon={PieChartIcon}
                        title='Status Codes'
                        isLoading={false}
                        stats={[
                            { label: 'Codes', value: usage.statusDistribution.length }
                        ]}
                    >
                        <ResponsiveContainer width='100%' height={250}>
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    dataKey='count'
                                    nameKey='statusCode'
                                    cx='50%'
                                    cy='50%'
                                    outerRadius={90}
                                    innerRadius={50}
                                    paddingAngle={2}
                                    isAnimationActive={false}
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell
                                            key={entry.statusCode}
                                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={renderPieTooltip} />
                            </PieChart>
                        </ResponsiveContainer>
                    </ChartContainer>

                    <ChartContainer
                        icon={List}
                        title='Recent Requests'
                        isLoading={false}
                        stats={[
                            { label: 'Shown', value: Math.min(usage.recentRequests.length, 20) }
                        ]}
                    >
                        <div className='x-auto' style={{ maxHeight: 250 }}>
                            <table className='secret-key-page-table'>
                                <thead>
                                    <tr>
                                        <th>Method</th>
                                        <th>Path</th>
                                        <th>Status</th>
                                        <th>Time</th>
                                        <th>When</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usage.recentRequests.slice(0, 20).map((req, i) => (
                                        <tr key={i}>
                                            <td>
                                                <Tag
                                                    size='xs'
                                                    shape='square'
                                                    className='font-mono font-weight-7'
                                                    style={{
                                                        color: METHOD_COLORS[req.method] || 'var(--color-text-muted)',
                                                        background: `color-mix(in srgb, ${METHOD_COLORS[req.method] || 'var(--color-text-muted)'} 12%, transparent)`
                                                    }}
                                                >
                                                    {req.method}
                                                </Tag>
                                            </td>
                                            <td className='font-mono font-size-1 color-secondary text-truncate' style={{ maxWidth: 200 }} title={req.path}>
                                                {req.path}
                                            </td>
                                            <td>
                                                <span style={{ color: STATUS_COLORS[getStatusColorGroup(req.statusCode)] || 'var(--color-text-muted)' }}>
                                                    {req.statusCode}
                                                </span>
                                            </td>
                                            <td className='font-mono font-size-1 color-muted'>
                                                {req.responseTime.toFixed(0)}ms
                                            </td>
                                            <td className='font-size-1 color-muted'>
                                                {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </ChartContainer>
                </div>
            </Stack>
        </Box>
    );
}
