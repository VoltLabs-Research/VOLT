import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import DashboardStat from '@/modules/dashboard/components/DashboardStat';
import { abbreviateNumber, buildDelta } from '@/modules/dashboard/utils/delta';
import { openModal } from '@/shared/ui/modal/use-modal-store';
import { toBucketKey } from '@/modules/dashboard/utils/metric-buckets';
import useDailyActivityData from '@/modules/daily-activity/hooks/use-daily-activity-data';
import { DASHBOARD_DRAWER_IDS } from '@/modules/dashboard/store/use-jobs-drawer-store';
import { Activity as ActivityIcon, ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import type { DailyActivity } from '@volt/contracts/modules/daily-activity/domain';
import type { DashboardCardDelta } from '@/modules/dashboard/contracts/cards';
import type { DashboardRangeOption } from '@/modules/dashboard/contracts/range';

const ACTIVITY_REFRESH_INTERVAL_MS = 60_000;

interface DashboardActivityTileProps {
    range: DashboardRangeOption;
}

interface ActivityTileSummary {
    windowTotal: number;
    delta: DashboardCardDelta;
}

/*
 * Fetches twice the window so the delta compares like with like: the selected
 * window against the previous stretch of the same length. The old tile compared
 * today against yesterday while its neighbours compared month against month,
 * which made three tiles in one row silently describe three different spans.
 */
const buildActivityTileSummary = (
    activityData: DailyActivity[],
    range: DashboardRangeOption
): ActivityTileSummary => {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - (range.days - 1));

    const windowStartKey = toBucketKey(windowStart, 'day');

    let windowTotal = 0;
    let previousTotal = 0;

    for (const day of activityData) {
        const key = toBucketKey(new Date(day.date), 'day');

        if (key >= windowStartKey) {
            windowTotal += day.activity.length;
        } else {
            previousTotal += day.activity.length;
        }
    }

    return {
        windowTotal,
        delta: buildDelta(windowTotal, previousTotal)
    };
};

const DashboardActivityTile = ({ range }: DashboardActivityTileProps) => {
    const { activityData } = useDailyActivityData({
        range: range.days * 2,
        scope: 'self',
        refetchIntervalMs: ACTIVITY_REFRESH_INTERVAL_MS
    });

    const summary = useMemo(
        () => buildActivityTileSummary(activityData, range),
        [activityData, range]
    );

    return (
        <DashboardCard
            className='group/card col-span-4 min-h-[130px] p-0 transition-[border-color] duration-200 ease-[ease] max-[1200px]:col-span-6 max-[768px]:col-span-12'
            isRelative={true}
            overflowHidden={true}
        >
            <button
                type='button'
                className='group/statbtn relative h-full w-full cursor-pointer border-none bg-transparent p-0 text-left focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--border),inset_0_0_0_3px_var(--focus)]'
                onClick={() => openModal(DASHBOARD_DRAWER_IDS.activity)}
                aria-label='Open your activity'
            >
                {/*
                  * Named "Your activity", not "Activity": the chart below plots the
                  * whole team, and two numbers that differ need labels that differ.
                  */}
                <DashboardStat
                    icon={<ActivityIcon size={16} strokeWidth={1.8} />}
                    name='Your activity'
                    value={abbreviateNumber(summary.windowTotal)}
                    delta={summary.delta}
                    deltaLabel={`vs previous ${range.label.replace('last ', '')}`}
                    context={`your actions · ${range.label}`}
                />

                <div className='absolute top-4 right-4 text-lg text-foreground opacity-0 transition-opacity duration-200 ease-[ease] group-hover/card:opacity-100 group-focus-visible/statbtn:opacity-100'>
                    <ArrowRight />
                </div>
            </button>
        </DashboardCard>
    );
};

export default DashboardActivityTile;
