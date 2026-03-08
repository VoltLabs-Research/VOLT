import { useMemo } from 'react';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { Activity, Clock, Globe, Key } from 'lucide-react';
import { Skeleton } from '@mui/material';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import ChartContainer from '@/shared/presentation/components/ChartContainer';
import useSecretKeyTeamMetrics from '@/modules/team/hooks/secret-key/use-secret-key-team-metrics';
import { CHART_COLORS } from '@/modules/team/utilities/secret-key/chart-helpers';
import { createTooltipRenderer } from '@/modules/team/components/templates/secret-key/shared/chart-tooltip-renderer';
import '../secret-key/shared/SecretKeyShared.css';
import './SecretKeyMetrics.css';

const renderAreaTooltip = createTooltipRenderer('date', 'Requests', CHART_COLORS.requests);
const renderBarTooltip = createTooltipRenderer('endpoint', 'Requests', CHART_COLORS.endpoints);

export default function SecretKeyMetrics() {
    const { metrics, isLoading } = useSecretKeyTeamMetrics();

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

    if(isLoading){
        return (
            <Container className='secret-key-page vh-max color-primary'>
                <Container className='secret-key-page-main d-flex column gap-2 w-max'>
                    <Container className='d-flex column gap-05'>
                        <Skeleton variant='text' width={240} height={32} />
                        <Skeleton variant='text' width={160} height={20} />
                    </Container>
                    <Container className='secret-key-page-cards gap-1'>
                        {[...Array(4)].map((_, i) => (
                            <Container key={i} className='secret-key-page-card radius-lg transition-normal'>
                                <Container className='d-flex items-center gap-05 mb-075'>
                                    <Skeleton variant='circular' width={16} height={16} />
                                    <Skeleton variant='text' width={120} height={20} />
                                </Container>
                                <Skeleton variant='rectangular' width={100} height={48} sx={{ borderRadius: '4px' }} />
                            </Container>
                        ))}
                    </Container>
                    <Container className='secret-key-page-charts'>
                        <Skeleton variant='rectangular' width='100%' height={340} sx={{ borderRadius: '8px' }} />
                        <Skeleton variant='rectangular' width='100%' height={340} sx={{ borderRadius: '8px' }} />
                    </Container>
                </Container>
            </Container>
        );
    }

    if(!metrics){
        return (
            <Container className='secret-key-page vh-max color-primary'>
                <Container className='secret-key-page-main d-flex column gap-2 w-max'>
                    <Container className='d-flex column gap-05'>
                        <Title className='font-size-5 font-weight-6 color-primary'>Secret Key Metrics</Title>
                    </Container>
                    <Container className='d-flex flex-center p-3'>
                        <Paragraph className='color-muted font-size-3'>No metrics data available yet.</Paragraph>
                    </Container>
                </Container>
            </Container>
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
        <Container className='secret-key-page vh-max color-primary'>
            <Container className='secret-key-page-main d-flex column gap-2 w-max'>
                <Container className='d-flex column gap-05'>
                    <Title className='font-size-5 font-weight-6 color-primary'>Secret Key Metrics</Title>
                    <Paragraph className='font-size-2 color-secondary'>
                        {metrics.overview.totalRequests.toLocaleString()} total requests across {metrics.totalKeys} keys
                    </Paragraph>
                </Container>

                <Container className='secret-key-page-cards gap-1'>
                    {cards.map((card) => (
                        <Container key={card.title} className='secret-key-page-card radius-lg transition-normal glass-bg'>
                            <Container className='d-flex items-center gap-05 mb-075'>
                                <card.icon className='color-muted-foreground' style={{ width: 16, height: 16 }} />
                                <span className='font-size-2 color-secondary'>{card.title}</span>
                            </Container>
                            <Container className='d-flex items-baseline gap-05'>
                                <span className='secret-key-page-card-value font-size-6 font-weight-6 color-primary'>
                                    {card.value}
                                </span>
                                {card.unit && (
                                    <span className='font-size-2 font-weight-5 color-muted'>{card.unit}</span>
                                )}
                            </Container>
                        </Container>
                    ))}
                </Container>

                <Container className='secret-key-page-charts'>
                    <ChartContainer
                        icon={Activity}
                        title='Requests Over Time'
                        isLoading={false}
                        stats={[
                            { label: 'Total', value: metrics.overview.totalRequests.toLocaleString() },
                            { label: 'Success Rate', value: `${metrics.overview.successRate.toFixed(1)}%` }
                        ]}
                    >
                        <ResponsiveContainer width='100%' height={280}>
                            <AreaChart
                                data={requestsOverTime}
                                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id='colorRequests' x1='0' y1='0' x2='0' y2='1'>
                                        <stop offset='5%' stopColor={CHART_COLORS.requests} stopOpacity={0.3} />
                                        <stop offset='95%' stopColor={CHART_COLORS.requests} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray='3 3' stroke='var(--color-border-soft)' />
                                <XAxis
                                    dataKey='date'
                                    stroke='var(--color-text-muted)'
                                    style={{ fontSize: '12px' }}
                                />
                                <YAxis
                                    stroke='var(--color-text-muted)'
                                    style={{ fontSize: '12px' }}
                                />
                                <Tooltip content={renderAreaTooltip} />
                                <Area
                                    type='monotone'
                                    dataKey='count'
                                    stroke={CHART_COLORS.requests}
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill='url(#colorRequests)'
                                    name='Requests'
                                    isAnimationActive={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
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
                </Container>

                <Container className='d-flex column p-1-5 radius-lg glass-bg'>
                    <Title className='font-size-3 font-weight-6 color-primary mb-1-5'>Per-Key Breakdown</Title>
                    <Container style={{ overflowX: 'auto' }}>
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
                                            <Container className='d-flex column'>
                                                <span className='font-weight-5 color-primary'>{key.name}</span>
                                                <span className='font-size-1 font-family-mono color-muted'>{key.keyPrefix}...</span>
                                            </Container>
                                        </td>
                                        <td className='color-secondary'>{key.roleName}</td>
                                        <td className='font-family-mono color-primary'>{key.totalRequests.toLocaleString()}</td>
                                        <td className='font-family-mono color-secondary'>{Math.round(key.avgResponseTime)} ms</td>
                                        <td className='color-secondary'>
                                            {key.lastRequestAt
                                                ? new Date(key.lastRequestAt).toLocaleDateString()
                                                : 'Never'}
                                        </td>
                                        <td>
                                            <span style={{ color: key.isActive ? 'var(--status-success)' : 'var(--status-error)' }}>
                                                {key.isActive ? 'Active' : 'Revoked'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Container>
                </Container>
            </Container>
        </Container>
    );
}
