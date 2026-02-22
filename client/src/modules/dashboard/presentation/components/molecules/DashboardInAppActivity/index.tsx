import { useEffect, useMemo } from 'react';
import {
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    ResponsiveContainer,
    Tooltip
} from 'recharts';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import useDailyActivityData from '@/modules/daily-activity/presentation/hooks/use-daily-activity-data';
import './DashboardInAppActivity.css';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const formatMinutes = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
};

// Map JS getDay() (0=Sun) to Mon-first index (0=Mon)
const toMondayIndex = (jsDay: number): number => (jsDay === 0 ? 6 : jsDay - 1);

const DashboardInAppActivity = () => {
    const { activityData, isLoading, fetchActivity } = useDailyActivityData();

    useEffect(() => {
        fetchActivity(365);
    }, [fetchActivity]);

    const { radarData, totalMinutes, totalActions, peakDay } = useMemo(() => {
        const buckets = DAY_LABELS.map(() => ({ minutes: 0, actions: 0, count: 0 }));
        let sumMinutes = 0;
        let sumActions = 0;

        for (const day of activityData) {
            const date = new Date(day.date);
            const idx = toMondayIndex(date.getDay());
            const mins = day.minutesOnline || 0;
            const acts = day.activity?.length || 0;

            buckets[idx].minutes += mins;
            buckets[idx].actions += acts;
            buckets[idx].count += 1;

            sumMinutes += mins;
            sumActions += acts;
        }

        const data = DAY_LABELS.map((label, i) => {
            const b = buckets[i];
            const avgMinutes = b.count > 0 ? Math.round(b.minutes / b.count) : 0;
            const avgActions = b.count > 0 ? Math.round((b.actions / b.count) * 10) / 10 : 0;
            return { day: label, minutes: avgMinutes, actions: avgActions };
        });

        // Find peak day
        let peakIdx = 0;
        let peakVal = 0;
        data.forEach((d, i) => {
            if (d.minutes > peakVal) {
                peakVal = d.minutes;
                peakIdx = i;
            }
        });

        return {
            radarData: data,
            totalMinutes: sumMinutes,
            totalActions: sumActions,
            peakDay: DAY_LABELS[peakIdx]
        };
    }, [activityData]);

    const renderTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;

        return (
            <div className='dashboard-chart-tooltip'>
                <span className='dashboard-chart-tooltip-label'>{label}</span>
                {payload.map((entry: any, i: number) => (
                    <div key={i} className='dashboard-chart-tooltip-row'>
                        <span className='dashboard-chart-tooltip-dot' style={{ background: entry.color }} />
                        <span className='dashboard-chart-tooltip-name'>{entry.name}</span>
                        <span className='dashboard-chart-tooltip-value'>
                            {entry.dataKey === 'minutes' ? formatMinutes(entry.value) : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    if (isLoading) {
        return (
            <Container className='dashboard-inapp-activity-card'>
                <Container className='dashboard-inapp-activity-header'>
                    <Title className='font-size-3 color-primary font-weight-5'>In-app Activity</Title>
                </Container>
                <Container className='dashboard-inapp-activity-inner d-flex flex-center' />
            </Container>
        );
    }

    const hasData = activityData.length > 0;

    return (
        <Container className='dashboard-inapp-activity-card'>
            <Container className='dashboard-inapp-activity-header'>
                <Title className='font-size-3 color-primary font-weight-5'>In-app Activity</Title>
                <span className='font-size-1 color-muted'>Avg / day of week</span>
            </Container>

            <Container className='dashboard-inapp-activity-inner'>
                {hasData ? (
                    <ResponsiveContainer width='100%' height='100%'>
                        <RadarChart
                            data={radarData}
                            cx='50%'
                            cy='50%'
                            outerRadius='70%'
                        >
                            <PolarGrid
                                stroke='var(--color-border-strong)'
                                strokeDasharray='4 4'
                            />
                            <PolarAngleAxis
                                dataKey='day'
                                tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                            />
                            <Tooltip content={renderTooltip} />
                            <Radar
                                name='Avg. time'
                                dataKey='minutes'
                                stroke='var(--accent-blue)'
                                fill='var(--accent-blue)'
                                fillOpacity={0.12}
                                strokeWidth={2}
                            />
                            <Radar
                                name='Avg. actions'
                                dataKey='actions'
                                stroke='var(--accent-green)'
                                fill='var(--accent-green)'
                                fillOpacity={0.06}
                                strokeWidth={1.5}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                ) : (
                    <Container className='d-flex flex-center h-max'>
                        <span className='color-muted font-size-2'>No activity yet</span>
                    </Container>
                )}
            </Container>

            {hasData && (
                <Container className='dashboard-chart-summary'>
                    <Container className='dashboard-chart-summary-item'>
                        <span className='font-size-3 color-primary font-weight-6'>{formatMinutes(totalMinutes)}</span>
                        <span className='font-size-1 color-muted'>Total time</span>
                    </Container>
                    <Container className='dashboard-chart-summary-item'>
                        <span className='font-size-3 color-primary font-weight-6'>{totalActions}</span>
                        <span className='font-size-1 color-muted'>Actions</span>
                    </Container>
                    <Container className='dashboard-chart-summary-item' style={{ marginLeft: 'auto' }}>
                        <span className='font-size-2 color-primary font-weight-5'>{peakDay}</span>
                        <span className='font-size-1 color-muted'>Peak day</span>
                    </Container>
                </Container>
            )}
        </Container>
    );
};

export default DashboardInAppActivity;
