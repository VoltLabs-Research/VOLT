import { cn } from '@heroui/react';
import { openModal } from '@/shared/ui/modal/use-modal-store';
import Sparkline from '@/modules/dashboard/components/Sparkline';
import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import { getTrendColor } from '@/modules/dashboard/utils/trend-color';
import useDailyActivityData from '@/modules/daily-activity/hooks/use-daily-activity-data';
import { DASHBOARD_DRAWER_IDS } from '@/modules/dashboard/store/use-jobs-drawer-store';
import { Activity as ActivityIcon, ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { useMemo } from 'react';
import type { DailyActivity } from '@volt/contracts/modules/daily-activity/domain';

const ACTIVITY_LOOKBACK_DAYS = 7;
const ACTIVITY_REFRESH_INTERVAL_MS = 10_000;

interface ActivityTileSummary {
    todayActions: number;
    series: number[];
    labels: string[];
    trendPercent: number;
}

const toDayKey = (date: Date): string => date.toISOString().slice(0, 10);

const buildActivityTileSummary = (activityData: DailyActivity[]): ActivityTileSummary => {
    const actionsByDay = new Map<string, number>();
    for (const day of activityData) {
        const key = toDayKey(new Date(day.date));
        actionsByDay.set(key, (actionsByDay.get(key) ?? 0) + day.activity.length);
    }

    const series: number[] = [];
    const labels: string[] = [];
    const today = new Date();

    for (let offset = ACTIVITY_LOOKBACK_DAYS - 1; offset >= 0; offset -= 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - offset);
        const key = toDayKey(date);
        series.push(actionsByDay.get(key) ?? 0);
        labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    }

    const todayActions = series[series.length - 1];
    const yesterdayActions = series[series.length - 2];

    let trendPercent = 0;
    if (yesterdayActions > 0) {
        trendPercent = Math.round(((todayActions - yesterdayActions) / yesterdayActions) * 100);
    } else if (todayActions > 0) {
        trendPercent = 100;
    }

    return {
        todayActions,
        series,
        labels,
        trendPercent
    };
};

const DashboardActivityTile = () => {
    const { activityData } = useDailyActivityData({
        range: ACTIVITY_LOOKBACK_DAYS,
        scope: 'self',
        refetchIntervalMs: ACTIVITY_REFRESH_INTERVAL_MS
    });

    const summary = useMemo(() => buildActivityTileSummary(activityData), [activityData]);
    const isPositiveTrend = summary.trendPercent >= 0;
    const TrendIcon = isPositiveTrend ? ArrowUp : ArrowDown;
    const lineColor = getTrendColor(isPositiveTrend);

    return (
        <DashboardCard className='group/card col-span-3 p-0 min-h-[130px] transition-[background-color,border-color] duration-200 ease-[ease] hover:bg-surface-tertiary max-[1200px]:col-span-6 max-[768px]:col-span-12' isRelative={true} overflowHidden={true}>
            <button
                type='button'
                className='group/statbtn relative h-full w-full cursor-pointer border-none bg-transparent p-4 text-left focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--border),inset_0_0_0_3px_var(--focus)]'
                onClick={() => openModal(DASHBOARD_DRAWER_IDS.activity)}
                aria-label='Open your activity'
            >
                <div className='flex flex-col gap-4 relative z-[5]'>
                    <div className='flex flex-row items-center gap-3'>
                        <span className='inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-base text-muted transition-[color,border-color] duration-200 ease-[ease] group-hover/card:text-foreground group-hover/card:border-foreground' aria-hidden='true'>
                            <ActivityIcon size={16} strokeWidth={1.8} />
                        </span>
                        <span className='text-sm font-medium'>Activity</span>
                    </div>

                    <div className='flex flex-row items-end gap-3'>
                        <span className='text-[2rem] font-semibold leading-none tracking-[-0.02em] text-foreground'>{summary.todayActions}</span>
                        <div className={cn('flex flex-row items-center gap-1 mb-[0.3rem] text-xs font-semibold', isPositiveTrend ? 'text-success' : 'text-danger')}>
                            <TrendIcon size={10} />
                            <span>{Math.abs(summary.trendPercent)}%</span>
                        </div>
                    </div>

                    <span className='text-xs text-muted'>actions today</span>
                </div>

                <div className='absolute top-4 right-4 text-[1.15rem] text-foreground opacity-0 transition-opacity duration-200 ease-[ease] group-hover/card:opacity-100 group-focus-visible/statbtn:opacity-100'>
                    <ArrowRight />
                </div>

                <div className='absolute bottom-0 right-0 pointer-events-none opacity-50 transition-opacity duration-200 ease-[ease] group-hover/card:opacity-85'>
                    <Sparkline
                        color={lineColor}
                        values={summary.series}
                        labels={summary.labels}
                        width={160}
                        height={60}
                    />
                </div>
            </button>
        </DashboardCard>
    );
};

export default DashboardActivityTile;
