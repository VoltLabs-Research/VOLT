import { Skeleton } from '@mui/material';
import Container from '@/shared/presentation/components/Container';
import '../DashboardOverviewCard/DashboardOverviewCard.css';

interface DashboardOverviewSkeletonProps {
    count?: number;
};

const DashboardOverviewSkeleton = ({ count = 4 }: DashboardOverviewSkeletonProps) => {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <Container className='dashboard-stat-card' key={i}>
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
