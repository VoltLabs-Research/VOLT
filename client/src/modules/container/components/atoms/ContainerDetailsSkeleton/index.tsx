import { Skeleton } from '@mui/material';
import Container from '@/shared/presentation/components/Container';

const ContainerDetailsSkeleton = () => (
    <Container className='container-details-layout d-flex column'>
        <Container className='container-details-header d-flex column'>
            <Skeleton variant='text' width={60} height={24} sx={{ mb: 1 }} />
            <Container className='d-flex content-between items-start' style={{ gap: '1rem' }}>
                <Container className='d-flex column gap-05'>
                    <Skeleton variant='text' width={220} height={28} />
                    <Skeleton variant='text' width={320} height={18} />
                </Container>
                <Container className='d-flex gap-05'>
                    <Skeleton variant='rounded' width={96} height={32} />
                    <Skeleton variant='rounded' width={96} height={32} />
                </Container>
            </Container>
            <Container className='container-details-header-tabs-row'>
                <Skeleton variant='rounded' width={320} height={30} />
            </Container>
        </Container>

        <Container className='container-details-content-area flex-1 p-1-5 d-flex column gap-1-5'>
            <Container className='d-flex gap-2'>
                <Skeleton variant='rounded' width='33%' height={140} />
                <Skeleton variant='rounded' width='33%' height={140} />
                <Skeleton variant='rounded' width='33%' height={140} />
            </Container>
            <Skeleton variant='rounded' width='100%' height={240} />
        </Container>
    </Container>
);

export default ContainerDetailsSkeleton;
