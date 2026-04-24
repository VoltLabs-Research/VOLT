import AsyncBoundary from '@/shared/presentation/primitives/AsyncBoundary';
import Skeleton from '@/shared/presentation/primitives/Skeleton';
import StatCard from '@/shared/presentation/primitives/StatCard';
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
import ChartContainer from '@/shared/presentation/components/ChartContainer';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import useSecretKeyTeamMetrics from '@/modules/team/hooks/secret-key/use-secret-key-team-metrics';
import { CHART_COLORS } from '@/modules/team/utilities/secret-key/chart-helpers';
import { createTooltipRenderer } from '@/modules/team/components/secret-key/shared/chart-tooltip-renderer';
import '../secret-key/shared/SecretKeyShared.css';

const renderAreaTooltip = createTooltipRenderer('date', 'Requests', CHART_COLORS.requests);
const renderBarTooltip = createTooltipRenderer('endpoint', 'Requests', CHART_COLORS.endpoints);

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
        <div className='secret-key-page vh-max color-primary'>
            <div className='secret-key-page-main d-flex column gap-2 w-max'>
                <div className='d-flex column gap-05'>
                    <Skeleton variant='text' width={240} height={32} />
                    <Skeleton variant='text' width={160} height={20} />
                </div>
                <div className='secret-key-page-cards gap-1'>
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className='secret-key-page-card radius-lg transition-normal'>
                            <div className='d-flex items-center gap-05 mb-075'>
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

    const errorView = (err: unknown) => (
        <div className='secret-key-page vh-max color-primary'>
            <div className='secret-key-page-main d-flex column gap-2 w-max'>
                <div className='d-flex column gap-05'>
                    <h3 className='font-size-5 font-weight-6 color-primary'>Secret Key Metrics</h3>
                </div>
                <RecoveryState
                    title='Unable to load metrics'
                    description={err instanceof Error ? err.message : 'Something went wrong while loading secret key metrics.'}
                    tone={RecoveryStateTone.Error}
                    retryLabel='Try again'
                    onRetry={() => refetch()}
                />
            </div>
        </div>
    );

    const emptyView = (
        <div className='secret-key-page vh-max color-primary'>
            <div className='secret-key-page-main d-flex column gap-2 w-max'>
                <div className='d-flex column gap-05'>
                    <h3 className='font-size-5 font-weight-6 color-primary'>Secret Key Metrics</h3>
                </div>
                <div className='d-flex flex-center p-3'>
                    <p className='color-muted font-size-3'>No metrics data available yet.</p>
                </div>
            </div>
        </div>
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
        <div className='secret-key-page vh-max color-primary'>
            <div className='secret-key-page-main d-flex column gap-2 w-max'>
                <div className='d-flex column gap-05'>
                    <h3 className='font-size-5 font-weight-6 color-primary'>Secret Key Metrics</h3>
                    <p className='font-size-2 color-secondary'>
                        {metrics.overview.totalRequests.toLocaleString()} total requests across {metrics.totalKeys} keys
                    </p>
                </div>

                <div className='secret-key-page-cards gap-1'>
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
                </div>

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
                </div>

                <div className='d-flex column p-1-5 radius-lg glass-bg'>
                    <h3 className='font-size-3 font-weight-6 color-primary mb-1-5'>Per-Key Breakdown</h3>
                    <div className='x-auto'>
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
                                            <div className='d-flex column'>
                                                <span className='font-weight-5 color-primary'>{key.name}</span>
                                                <span className='font-size-1 font-mono color-muted'>{key.keyPrefix}...</span>
                                            </div>
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
                                            <span style={{ color: key.isActive ? 'var(--status-success)' : 'var(--status-error)' }}>
                                                {key.isActive ? 'Active' : 'Revoked'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
