import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import { Skeleton } from '@heroui/react';

interface DashboardOverviewSkeletonProps {
    count?: number;
}

/** `.dashboard-stat-skeleton`, including both of its column-span breakpoints. */
const STAT_SKELETON_CARD = 'col-span-3 p-4 min-h-[130px] max-[1200px]:col-span-6 max-[768px]:col-span-12';

/** bravais's `variant='rounded'` was `var(--radius-md)` — 12px, HeroUI's `rounded-xl` (spec §3b). */
const ROUNDED_SKELETON = 'shrink-0 rounded-xl';

/**
 * bravais's `variant='text'` painted at `scale(1, 0.6)` from `0 55%` while still
 * reserving its full declared height, so `height={20}` drew ~12px tall inside a
 * 20px box. Reproduced rather than dropped: without it every row here renders
 * ~1.67× taller than the text it stands in for and the card grows while loading.
 * Radius is bravais's `--radius-xs` (6px) → `rounded-md`.
 */
const TEXT_SKELETON = 'shrink-0 origin-[0_55%] scale-y-[0.6] rounded-md';

const DashboardOverviewSkeleton = ({ count = 4 }: DashboardOverviewSkeletonProps) => {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <DashboardCard className={STAT_SKELETON_CARD} isRelative={true} overflowHidden={true} key={i}>
                    <div className='flex flex-col gap-4'>
                        <div className='flex flex-row items-center gap-3'>
                            <Skeleton className={`size-[34px] ${ROUNDED_SKELETON}`} aria-hidden='true' />
                            <Skeleton className={`h-5 w-[90px] ${TEXT_SKELETON}`} aria-hidden='true' />
                        </div>
                        <Skeleton className={`h-9 w-20 ${TEXT_SKELETON}`} aria-hidden='true' />
                        <Skeleton className={`h-[14px] w-[60px] ${TEXT_SKELETON}`} aria-hidden='true' />
                    </div>
                </DashboardCard>
            ))}
        </>
    );
};

export default DashboardOverviewSkeleton;
