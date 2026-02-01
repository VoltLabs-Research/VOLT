import React from 'react';
import { Skeleton } from '@mui/material';
import Container from '@/shared/presentation/components/Container';

interface DashboardStatsSkeletonProps {
    count?: number;
};

const DashboardStatsSkeleton: React.FC<DashboardStatsSkeletonProps> = ({ count = 3 }) => {
    return (
        <Container className='d-flex dashboard-stats-container w-max overflow-hidden'>
            {Array.from({ length: count }).map((_, i) => (
                <Container className='dashboard-stat-container p-relative cursor-pointer' key={i}>
                    <Container className='d-flex column gap-2 w-max'>
                        <Container className='d-flex items-center gap-1'>
                            <i className='dashboard-stat-icon-container color-muted'>
                                <Skeleton variant='circular' width={28} height={28} />
                            </i>
                            <Container style={{ width: 120 }}>
                                <Skeleton variant='text' width='100%' height={22} />
                            </Container>
                        </Container>
                        <Container className='d-flex column gap-1'>
                            <Container style={{ width: 100 }}>
                                <Skeleton variant='text' width='100%' height={36} />
                            </Container>
                            <Container className='d-flex gap-025'>
                                <Container className='dashboard-stat-last-month-icon-container d-flex items-center gap-05'>
                                    <Skeleton variant='circular' width={16} height={16} />
                                    <Skeleton variant='text' width={36} height={16} />
                                </Container>
                                <Container style={{ width: 80 }}>
                                    <Skeleton variant='text' width='100%' height={14} />
                                </Container>
                            </Container>
                        </Container>
                    </Container>
                    <Container className='dashboard-stat-analytic-container p-absolute'>
                        <Skeleton variant='rounded' width={150} height='100%' />
                    </Container>
                </Container>
            ))}
        </Container>
    );
};

export default DashboardStatsSkeleton;
