import './DashboardOverviewSkeleton.css';
import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import { Row, Skeleton, Stack } from '@voltstack/bravais';

interface DashboardOverviewSkeletonProps {
    count?: number;
}

const DashboardOverviewSkeleton = ({ count = 4 }: DashboardOverviewSkeletonProps) => {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <DashboardCard className='dashboard-stat-skeleton' isRelative={true} overflowHidden={true} key={i}>
                    <Stack gap='1'>
                        <Row gap='075'>
                            <Skeleton variant='rounded' width={34} height={34} />
                            <Skeleton variant='text' width={90} height={20} />
                        </Row>
                        <Skeleton variant='text' width={80} height={36} />
                        <Skeleton variant='text' width={60} height={14} />
                    </Stack>
                </DashboardCard>
            ))}
        </>
    );
};

export default DashboardOverviewSkeleton;
