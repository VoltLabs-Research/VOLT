import { Box, Stack, Text, EmptyState, formatDuration } from '@voltstack/bravais';
import { useMemo } from 'react';
import { Activity as ActivityIcon } from 'lucide-react';
import {
    Legend,
    PolarAngleAxis,
    PolarGrid,
    Radar,
    RadarChart,
    ResponsiveContainer,
    Tooltip
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import type { DailyActivity } from '@volt/contracts/modules/daily-activity/domain';

interface InAppActivityPanelProps {
    activityData: DailyActivity[];
}

interface InAppActivityBucket {
    actions: number;
    count: number;
    minutes: number;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const toMondayIndex = (jsDay: number): number => {
    if (jsDay === 0) {
        return 6;
    }

    return jsDay - 1;
};

const buildInAppActivitySummary = (activityData: DailyActivity[]) => {
    const buckets = DAY_LABELS.map<InAppActivityBucket>(() => ({
        actions: 0,
        count: 0,
        minutes: 0
    }));
    let totalMinutes = 0;
    let totalActions = 0;

    for (const day of activityData) {
        const index = toMondayIndex(new Date(day.date).getDay());
        const minutes = day.minutesOnline || 0;
        const actions = day.activity.length;

        buckets[index].minutes += minutes;
        buckets[index].actions += actions;
        buckets[index].count += 1;

        totalMinutes += minutes;
        totalActions += actions;
    }

    const radarData = DAY_LABELS.map((dayLabel, index) => {
        const bucket = buckets[index];
        const averageMinutes = bucket.count > 0 ? Math.round(bucket.minutes / bucket.count) : 0;
        const averageActions = bucket.count > 0 ? Math.round((bucket.actions / bucket.count) * 10) / 10 : 0;

        return {
            actions: averageActions,
            day: dayLabel,
            minutes: averageMinutes
        };
    });

    let peakDay = DAY_LABELS[0];
    let peakMinutes = 0;

    for (const day of radarData) {
        if (day.minutes <= peakMinutes) {
            continue;
        }

        peakMinutes = day.minutes;
        peakDay = day.day;
    }

    return {
        peakDay,
        radarData,
        totalActions,
        totalMinutes
    };
};

// recharts renders the tooltip content even while inactive and with no payload, so both
// have to be checked; `value` is recharts' `ValueType` union and needs narrowing to format.
const renderTooltip = ({ active, payload, label }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload?.length) {
        return null;
    }

    return (
        <div className='dashboard-activity-tooltip'>
            <span className='dashboard-activity-tooltip-label'>{label}</span>
            {payload.map((entry, index) => {
                const formattedValue = entry.dataKey === 'minutes' && typeof entry.value === 'number'
                    ? formatDuration(entry.value)
                    : entry.value;

                return (
                    <div key={index} className='dashboard-activity-tooltip-row'>
                        <span className='dashboard-activity-tooltip-dot' style={{ background: entry.color }} />
                        <span className='dashboard-activity-tooltip-name'>{entry.name}</span>
                        <span className='dashboard-activity-tooltip-value'>{formattedValue}</span>
                    </div>
                );
            })}
        </div>
    );
};

const InAppActivityPanel = ({ activityData }: InAppActivityPanelProps) => {
    const inAppActivity = useMemo(() => buildInAppActivitySummary(activityData), [activityData]);

    if (activityData.length === 0) {
        return (
            <EmptyState
                className='dashboard-activity-empty-state h-full'
                icon={<ActivityIcon size={20} strokeWidth={1.6} />}
                title='No activity yet'
                description='Once you start navigating the app, this chart will show your time spent and actions across the week.'
            />
        );
    }

    return (
        <Stack gap='05' flex='1' minH='0' className='dashboard-activity-panel'>
            <Box className='dashboard-activity-chart-surface'>
                <ResponsiveContainer width='100%' height={250}>
                    <RadarChart
                        data={inAppActivity.radarData}
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
                            tick={{
                                fill: 'var(--color-text-muted)',
                                fontSize: 11
                            }}
                        />
                        <Tooltip content={renderTooltip} />
                        <Legend verticalAlign='bottom' height={32} wrapperStyle={{ fontSize: '12px' }} />
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
            </Box>

            <Box className='dashboard-activity-summary'>
                <Box className='dashboard-activity-summary-item'>
                    <Text size='lg' tone='primary' weight='bold'>{formatDuration(inAppActivity.totalMinutes)}</Text>
                    <Text size='sm' tone='muted'>Total time</Text>
                </Box>
                <Box className='dashboard-activity-summary-item'>
                    <Text size='lg' tone='primary' weight='bold'>{inAppActivity.totalActions}</Text>
                    <Text size='sm' tone='muted'>Actions</Text>
                </Box>
                <Box className='dashboard-activity-summary-item dashboard-activity-summary-item-end'>
                    <Text size='md' tone='primary' weight='medium'>{inAppActivity.peakDay}</Text>
                    <Text size='sm' tone='muted'>Peak day</Text>
                </Box>
            </Box>
        </Stack>
    );
};

export default InAppActivityPanel;
