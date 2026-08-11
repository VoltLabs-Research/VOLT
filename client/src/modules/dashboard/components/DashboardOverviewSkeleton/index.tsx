import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import { Skeleton } from '@heroui/react';

interface DashboardOverviewSkeletonProps {
    count?: number;
}

const DashboardOverviewSkeleton = ({ count = 4 }: DashboardOverviewSkeletonProps) => {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <DashboardCard className='col-span-3 p-4 min-h-[130px] max-[1200px]:col-span-6 max-[768px]:col-span-12' isRelative={true} overflowHidden={true} key={i}>
                    <div className='flex flex-col gap-4'>
                        <div className='flex flex-row items-center gap-3'>
                            <Skeleton className='size-[34px] shrink-0 rounded-xl' aria-hidden='true' />
                            <Skeleton className='h-5 w-[90px] shrink-0 origin-[0_55%] scale-y-[0.6] rounded-md' aria-hidden='true' />
                        </div>
                        <Skeleton className='h-9 w-20 shrink-0 origin-[0_55%] scale-y-[0.6] rounded-md' aria-hidden='true' />
                        <Skeleton className='h-[14px] w-[60px] shrink-0 origin-[0_55%] scale-y-[0.6] rounded-md' aria-hidden='true' />
                    </div>
                </DashboardCard>
            ))}
        </>
    );
};

export default DashboardOverviewSkeleton;
