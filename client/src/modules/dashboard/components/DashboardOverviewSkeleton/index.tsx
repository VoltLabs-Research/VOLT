import './DashboardOverviewSkeleton.css';
import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import { Skeleton } from '@voltstack/bravais';

interface DashboardOverviewSkeletonProps {
    count?: number;
}

const DashboardOverviewSkeleton = ({ count = 4 }: DashboardOverviewSkeletonProps) => {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <DashboardCard className='dashboard-stat-skeleton' isRelative={true} overflowHidden={true} key={i}>
                    <div className='flex flex-col gap-4'>
                        <div className='flex flex-row items-center gap-3'>
                            <Skeleton variant='rounded' width={34} height={34} />
                            <Skeleton variant='text' width={90} height={20} />
                        </div>
                        <Skeleton variant='text' width={80} height={36} />
                        <Skeleton variant='text' width={60} height={14} />
                    </div>
                </DashboardCard>
            ))}
        </>
    );
};

export default DashboardOverviewSkeleton;
