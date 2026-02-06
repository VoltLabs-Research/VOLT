import { Skeleton } from '@mui/material';
import Container from '@/shared/presentation/components/Container';

const ContainerDetailsSkeleton = () => (
    <Container className='container-details-layout d-flex overflow-hidden'>
        {/* Sidebar skeleton */}
        <Container className='container-details-sidebar d-flex column f-shrink-0'>
            <Container className='container-details-sidebar-header d-flex column gap-1 items-start p-1-5'>
                <Skeleton variant='rounded' width={70} height={32} />
                <Container className='d-flex items-center gap-1'>
                    <Skeleton variant='rounded' width={48} height={48} />
                    <Container className='d-flex column gap-05'>
                        <Skeleton variant='text' width={120} height={24} />
                        <Skeleton variant='rounded' width={80} height={22} />
                    </Container>
                </Container>
            </Container>

            <nav className='container-details-nav d-flex column flex-1 p-1'>
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} variant='rounded' width='100%' height={40} sx={{ mb: 0.5 }} />
                ))}
            </nav>

            <Container className='container-details-actions d-flex column gap-075 p-1-5'>
                <Skeleton variant='rounded' width='100%' height={40} />
            </Container>
        </Container>

        {/* Content area skeleton */}
        <Container className='container-details-content-area flex-1 p-1'>
            <Container className='d-flex content-between items-center mb-2'>
                <Skeleton variant='text' width={150} height={32} />
                <Container className='d-flex gap-075'>
                    <Skeleton variant='rounded' width={100} height={28} />
                    <Skeleton variant='rounded' width={100} height={28} />
                </Container>
            </Container>

            <Container className='d-flex gap-2 mb-2'>
                <Skeleton variant='rounded' width='50%' height={200} />
                <Skeleton variant='rounded' width='50%' height={200} />
            </Container>

            <Container className='d-flex gap-2'>
                <Skeleton variant='rounded' width='50%' height={150} />
                <Skeleton variant='rounded' width='50%' height={150} />
            </Container>
        </Container>
    </Container>
);

export default ContainerDetailsSkeleton;
