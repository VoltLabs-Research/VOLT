import './DashboardOverviewSkeleton.css';
import Container from '@/shared/presentation/components/Container';
import { Skeleton } from '@mui/material';

interface DashboardOverviewSkeletonProps {
    count?: number;
};

const DashboardOverviewSkeleton = ({ count = 4 }: DashboardOverviewSkeletonProps) => {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <Container className='dashboard-stat-skeleton' key={i}>
                    <Container className='d-flex column gap-1'>
                        <Container className='d-flex items-center gap-075'>
                            <Skeleton variant='rounded' width={34} height={34} />
                            <Skeleton variant='text' width={90} height={20} />
                        </Container>
                        <Skeleton variant='text' width={80} height={36} />
                        <Skeleton variant='text' width={60} height={14} />
                    </Container>
                </Container>
            ))}
        </>
    );
};

export default DashboardOverviewSkeleton;
