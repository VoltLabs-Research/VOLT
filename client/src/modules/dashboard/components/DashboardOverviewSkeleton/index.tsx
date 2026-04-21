import './DashboardOverviewSkeleton.css';
import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import Skeleton from '@/shared/presentation/components/Skeleton';

interface DashboardOverviewSkeletonProps {
    count?: number;
};

const DashboardOverviewSkeleton = ({ count = 4 }: DashboardOverviewSkeletonProps) => {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <DashboardCard className='dashboard-stat-skeleton' isRelative={true} overflowHidden={true} key={i}>
                    <div className='volt-container d-flex column gap-1'>
                        <div className='volt-container d-flex items-center gap-075'>
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
