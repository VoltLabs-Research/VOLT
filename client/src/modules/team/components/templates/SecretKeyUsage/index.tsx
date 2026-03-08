import { createTooltipRenderer } from '@/modules/team/components/templates/secret-key/shared/chart-tooltip-renderer';
import { CHART_COLORS } from '@/modules/team/utilities/secret-key/chart-helpers';
import useSecretKeyUsage from '@/modules/team/hooks/secret-key/use-secret-key-usage';
import ChartContainer from '@/shared/presentation/components/ChartContainer';
import ChartTooltip from '@/shared/presentation/components/ChartTooltip';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@mui/material';
import { ArrowLeft, Activity, BarChart3, PieChart as PieChartIcon, List, Clock, Zap, CheckCircle, Hash } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    AreaChart,
    Area,
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
import type { TooltipContentProps } from 'recharts';
import '../secret-key/shared/SecretKeyShared.css';
import './SecretKeyUsage.css';

interface SecretKeyUsageRouteParams extends Params {
    secretKeyId: string;
};

interface TooltipPayloadRecord {
    [key: string]: string | number;
};

const STATUS_COLORS: Record<string, string> = {
    '2xx': 'var(--status-success)',
    '3xx': 'var(--accent-blue)',
    '4xx': 'var(--status-warning)',
    '5xx': 'var(--status-error)'
};

const PIE_COLORS = ['#2dcc70', '#0062FF', '#ff9f0a', '#ff453a', '#af52de'];

const METHOD_COLORS: Record<string, string> = {
    GET: 'var(--status-success)',
    POST: 'var(--accent-blue)',
    PUT: 'var(--accent-orange)',
    DELETE: 'var(--status-error)',
    PATCH: '#af52de'
};

const getStatusColorGroup = (code: number): string => {
    if (code >= 200 && code < 300) return '2xx';
    if (code >= 300 && code < 400) return '3xx';
    if (code >= 400 && code < 500) return '4xx';
    return '5xx';
};

const renderAreaTooltip = createTooltipRenderer('date', 'Requests', CHART_COLORS.requests);
const renderBarTooltip = createTooltipRenderer('endpoint', 'Requests', CHART_COLORS.endpoints);

const isTooltipPayloadRecord = (value: unknown): value is TooltipPayloadRecord => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    return Object.values(value).every((entry) => typeof entry === 'string' || typeof entry === 'number');
};

const renderPieTooltip = ({ active, payload }: TooltipContentProps<string | number, string>) => {
    if (!active || !payload?.length) return null;

    const firstPayload = payload[0]?.payload;
    const firstValue = payload[0]?.value;
    if (!isTooltipPayloadRecord(firstPayload) || (typeof firstValue !== 'string' && typeof firstValue !== 'number')) {
        return null;
    }

    return (
        <ChartTooltip
            title={`Status ${firstPayload.statusCode}`}
            items={[{ label: 'Count', value: firstValue }]}
        />
    );
};

export default function SecretKeyUsage() {
    const { secretKeyId } = useParams<SecretKeyUsageRouteParams>();
    const navigate = useNavigate();
    const { usage, isLoading } = useSecretKeyUsage(secretKeyId);

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

    if (isLoading) {
        return (
            <Container className='secret-key-page vh-max color-primary'>
                <Container className='secret-key-page-main d-flex column gap-2 w-max'>
                    <Container className='d-flex items-center gap-1'>
                        <Skeleton variant='circular' width={24} height={24} />
                        <Skeleton variant='text' width={300} height={32} />
                    </Container>
                    <Container className='secret-key-page-cards gap-1'>
                        {[...Array(4)].map((_, i) => (
                            <Container key={i} className='secret-key-page-card radius-lg transition-normal'>
                                <Skeleton variant='text' width={100} height={16} />
                                <Skeleton variant='rectangular' width={80} height={40} sx={{ borderRadius: '4px', marginTop: '0.5rem' }} />
                            </Container>
                        ))}
                    </Container>
                    <Container className='secret-key-page-charts'>
                        {[...Array(4)].map((_, i) => (
                            <Skeleton key={i} variant='rectangular' width='100%' height={300} sx={{ borderRadius: '8px' }} />
                        ))}
                    </Container>
                </Container>
            </Container>
        );
    }

    if (!usage) {
        return (
            <Container className='secret-key-page vh-max color-primary'>
                <Container className='secret-key-page-main d-flex column gap-2 w-max'>
                    <Container className='d-flex items-center gap-1'>
                        <ArrowLeft
                            className='secret-key-usage-back color-muted'
                            style={{ width: 20, height: 20 }}
                            onClick={handleBack}
                        />
                        <Title className='font-size-5 font-weight-6'>Key Usage</Title>
                    </Container>
                    <Container className='d-flex flex-center p-3'>
                        <Paragraph className='color-muted font-size-3'>No usage data available for this key.</Paragraph>
                    </Container>
                </Container>
            </Container>
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
        <Container className='secret-key-page vh-max color-primary'>
            <Container className='secret-key-page-main d-flex column gap-2 w-max'>
                <Container className='d-flex column gap-05'>
                    <Container className='d-flex items-center gap-1'>
                        <ArrowLeft
                            className='secret-key-usage-back color-muted'
                            style={{ width: 20, height: 20 }}
                            onClick={handleBack}
                        />
                        <Title className='font-size-5 font-weight-6'>{maskedName}</Title>
                    </Container>
                    <Paragraph className='color-muted font-size-2' style={{ marginLeft: '2rem' }}>
                        {usage.stats.totalRequests.toLocaleString()} total requests
                    </Paragraph>
                </Container>

                <Container className='secret-key-page-cards gap-1'>
                    {cards.map((card) => (
                        <Container key={card.title} className='secret-key-page-card radius-lg transition-normal glass-bg'>
                            <Container className='d-flex items-center gap-05 mb-075'>
                                <card.icon className='color-muted-foreground' style={{ width: 16, height: 16 }} />
                                <span className='font-size-2 color-secondary'>{card.title}</span>
                            </Container>
                            <span className={`secret-key-page-card-value ${card.smallText ? 'font-size-4' : 'font-size-6'} font-weight-6 color-primary`}>
                                {card.value}
                            </span>
                        </Container>
                    ))}
                </Container>

                <Container className='secret-key-page-charts'>
                    <ChartContainer
                        icon={Activity}
                        title='Hourly Requests'
                        isLoading={false}
                        stats={[
                            { label: '24h', value: usage.stats.requests24h.toLocaleString() },
                            { label: 'Peak Hour', value: usage.stats.peakHour }
                        ]}
                    >
                        <ResponsiveContainer width='100%' height={250}>
                            <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id='colorHourlyReqs' x1='0' y1='0' x2='0' y2='1'>
                                        <stop offset='5%' stopColor={CHART_COLORS.requests} stopOpacity={0.3} />
                                        <stop offset='95%' stopColor={CHART_COLORS.requests} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray='3 3' stroke='var(--color-border-soft)' />
                                <XAxis
                                    dataKey='date'
                                    stroke='var(--color-text-muted)'
                                    style={{ fontSize: '12px' }}
                                    tickLine={false}
                                />
                                <YAxis
                                    stroke='var(--color-text-muted)'
                                    style={{ fontSize: '12px' }}
                                    allowDecimals={false}
                                />
                                <Tooltip content={renderAreaTooltip} />
                                <Area
                                    type='monotone'
                                    dataKey='count'
                                    stroke={CHART_COLORS.requests}
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill='url(#colorHourlyReqs)'
                                    isAnimationActive={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
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
                        <Container style={{ overflowX: 'auto', maxHeight: 250 }}>
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
                                                <span
                                                    className='secret-key-usage-method-badge'
                                                    style={{
                                                        color: METHOD_COLORS[req.method] || 'var(--color-text-muted)',
                                                        background: `color-mix(in srgb, ${METHOD_COLORS[req.method] || 'var(--color-text-muted)'} 12%, transparent)`
                                                    }}
                                                >
                                                    {req.method}
                                                </span>
                                            </td>
                                            <td className='font-family-mono font-size-1 color-secondary text-truncate' style={{ maxWidth: 200 }}>
                                                {req.path}
                                            </td>
                                            <td>
                                                <span style={{ color: STATUS_COLORS[getStatusColorGroup(req.statusCode)] || 'var(--color-text-muted)' }}>
                                                    {req.statusCode}
                                                </span>
                                            </td>
                                            <td className='font-family-mono font-size-1 color-muted'>
                                                {req.responseTime.toFixed(0)}ms
                                            </td>
                                            <td className='font-size-1 color-muted'>
                                                {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Container>
                    </ChartContainer>
                </Container>
            </Container>
        </Container>
    );
}
