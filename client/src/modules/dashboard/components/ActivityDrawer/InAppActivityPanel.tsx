import RecoveryState from '@/shared/ui/components/RecoveryState';
import { formatDuration } from '@/shared/utils/format';
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

const renderTooltip = ({ active, payload, label }: TooltipContentProps<ValueType, NameType>) => {
    if (!active || !payload?.length) {
        return null;
    }

    return (
        <div className='min-w-[120px] rounded-lg border border-border bg-surface-secondary px-[0.65rem] py-2'>
            <span className='block text-[0.7rem] font-medium text-muted mb-[0.35rem]'>{label}</span>
            {payload.map((entry, index) => {
                const formattedValue = entry.dataKey === 'minutes' && typeof entry.value === 'number'
                    ? formatDuration(entry.value)
                    : entry.value;

                return (
                    <div key={index} className='flex items-center gap-[0.35rem] py-[0.1rem]'>
                        <span className='size-1.5 shrink-0 rounded-full' style={{ background: entry.color }} />
                        <span className='flex-1 text-xs text-muted'>{entry.name}</span>
                        <span className='text-xs font-semibold text-foreground'>{formattedValue}</span>
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
            <RecoveryState
                className='h-full min-h-full'
                icon={<ActivityIcon size={20} strokeWidth={1.6} />}
                title='No activity yet'
                description='Once you start navigating the app, this chart will show your time spent and actions across the week.'
            />
        );
    }

    return (
        <div className='flex flex-col gap-2 flex-1 min-h-0'>
            <div className='min-h-0 flex-1 overflow-hidden rounded-2xl border border-border'>
                <ResponsiveContainer width='100%' height={250}>
                    <RadarChart
                        data={inAppActivity.radarData}
                        cx='50%'
                        cy='50%'
                        outerRadius='70%'
                    >
                        <PolarGrid
                            stroke='var(--border-secondary)'
                            strokeDasharray='4 4'
                        />
                        <PolarAngleAxis
                            dataKey='day'
                            tick={{
                                fill: 'var(--muted)',
                                fontSize: 11
                            }}
                        />
                        <Tooltip content={renderTooltip} />
                        <Legend verticalAlign='bottom' height={32} wrapperStyle={{ fontSize: '12px' }} />
                        <Radar
                            name='Avg. time'
                            dataKey='minutes'
                            stroke='var(--accent)'
                            fill='var(--accent)'
                            fillOpacity={0.12}
                            strokeWidth={2}
                        />
                        <Radar
                            name='Avg. actions'
                            dataKey='actions'
                            stroke='var(--success)'
                            fill='var(--success)'
                            fillOpacity={0.06}
                            strokeWidth={1.5}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
            <div className='flex items-center gap-6 mt-3 max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-3'>
                <div className='flex flex-col gap-[0.1rem]'>
                    <span className='text-base font-semibold text-foreground'>{formatDuration(inAppActivity.totalMinutes)}</span>
                    <span className='text-xs text-muted'>Total time</span>
                </div>
                <div className='flex flex-col gap-[0.1rem]'>
                    <span className='text-base font-semibold text-foreground'>{inAppActivity.totalActions}</span>
                    <span className='text-xs text-muted'>Actions</span>
                </div>
                <div className='flex flex-col gap-[0.1rem] ml-auto max-[768px]:ml-0'>
                    <span className='text-sm font-medium text-foreground'>{inAppActivity.peakDay}</span>
                    <span className='text-xs text-muted'>Peak day</span>
                </div>
            </div>
        </div>
    );
};

export default InAppActivityPanel;
