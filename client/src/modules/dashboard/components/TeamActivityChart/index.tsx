import { Skeleton } from '@heroui/react';
import ActivityPanel from '@/modules/dashboard/components/TeamActivityChart/ActivityPanel';
import ActivityTableView from '@/modules/dashboard/components/TeamActivityChart/ActivityTableView';
import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import DashboardRangeSelector from '@/modules/dashboard/components/DashboardRangeSelector';
import useTeamActivitySeries from '@/modules/dashboard/hooks/use-team-activity-series';
import { formatBucketTitle } from '@/modules/dashboard/utils/metric-buckets';
import { usePrefersReducedMotion } from '@/shared/ui/hooks/use-prefers-reduced-motion';
import { useId, useMemo, useState } from 'react';
import type { DashboardRangeKey, DashboardRangeOption } from '@/modules/dashboard/contracts/range';
import type { TeamActivityPoint } from '@/modules/dashboard/hooks/use-team-activity-series';

interface TeamActivityChartProps {
    range: DashboardRangeOption;
    onRangeChange: (value: DashboardRangeKey) => void;
}

type PanelKey = 'trajectories' | 'analyses' | 'actions';

interface PanelConfig {
    dataKey: PanelKey;
    label: string;
}

const PANELS: PanelConfig[] = [
    {
        dataKey: 'trajectories',
        label: 'Trajectories created'
    },
    {
        dataKey: 'analyses',
        label: 'Analyses run'
    },
    {
        dataKey: 'actions',
        label: 'Team actions'
    }
];

const sumBy = (points: TeamActivityPoint[], key: PanelKey): number =>
    points.reduce((total, point) => total + point[key], 0);

const TeamActivityChart = ({ range, onRangeChange }: TeamActivityChartProps) => {
    const { points, isLoading, error } = useTeamActivitySeries(range);
    const prefersReducedMotion = usePrefersReducedMotion();
    const syncId = useId();

    /*
     * One hovered bucket for all three panels. Lifting it here is what makes the
     * comparison work: the reader lands on a bucket once and every panel reports
     * its own value beside its own label, so nothing rests on matching colors.
     */
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const totals = useMemo(() => ({
        trajectories: sumBy(points, 'trajectories'),
        analyses: sumBy(points, 'analyses'),
        actions: sumBy(points, 'actions')
    }), [points]);

    const activePoint = activeIndex === null ? undefined : points[activeIndex];
    const isEmpty = !isLoading && points.length === 0;

    const caption = activePoint
        ? formatBucketTitle(activePoint.label, range.bucket)
        : `${range.label} · by ${range.bucket}`;

    return (
        <DashboardCard className='col-span-12 p-6 max-[768px]:p-4'>
            <div className='flex flex-row items-start justify-between gap-4'>
                <div className='flex flex-col gap-1 min-w-0'>
                    <h3 className='text-base font-semibold text-foreground'>Team activity</h3>
                    {/*
                      * The window is written down, never implied. The three panels below
                      * describe exactly this stretch of time and nothing else.
                      */}
                    <p className='text-xs text-muted'>{caption}</p>
                </div>
                <DashboardRangeSelector value={range.key} onChange={onRangeChange} />
            </div>

            {error && (
                <p className='mt-6 text-sm text-danger-soft-foreground'>{error}</p>
            )}

            {!error && isLoading && points.length === 0 && (
                <div className='mt-6 flex flex-col gap-6'>
                    <Skeleton className='h-20 w-full rounded-lg' />
                    <Skeleton className='h-20 w-full rounded-lg' />
                    <Skeleton className='h-24 w-full rounded-lg' />
                </div>
            )}

            {!error && isEmpty && (
                <p className='mt-6 text-sm text-muted'>
                    Nothing recorded in this window yet.
                </p>
            )}

            {!error && points.length > 0 && (
                <>
                    <div className='mt-6 flex flex-col gap-5'>
                        {PANELS.map((panel, index) => (
                            <ActivityPanel
                                key={panel.dataKey}
                                label={panel.label}
                                dataKey={panel.dataKey}
                                points={points}
                                range={range}
                                readout={String(activePoint
                                    ? activePoint[panel.dataKey]
                                    : totals[panel.dataKey])}
                                readoutLabel={activePoint ? '' : 'total'}
                                showAxis={index === PANELS.length - 1}
                                animate={!prefersReducedMotion}
                                syncId={syncId}
                                onActiveIndexChange={setActiveIndex}
                            />
                        ))}
                    </div>

                    <ActivityTableView points={points} range={range} />
                </>
            )}
        </DashboardCard>
    );
};

export default TeamActivityChart;
