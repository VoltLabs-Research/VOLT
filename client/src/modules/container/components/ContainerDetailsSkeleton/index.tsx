import { Box, Stack, Row, Skeleton } from '@/shared/presentation/primitives';

const ContainerDetailsSkeleton = () => (
    <Stack className='container-details-layout'>
        <Stack className='container-details-header'>
            <Skeleton variant='text' width={60} height={24} style={{ marginBottom: 8 }} />
            <Row justify='between' align='start' style={{ gap: '1rem' }}>
                <Stack gap='05'>
                    <Skeleton variant='text' width={220} height={28} />
                    <Skeleton variant='text' width={320} height={18} />
                </Stack>
                <Row gap='05'>
                    <Skeleton variant='rounded' width={96} height={32} />
                    <Skeleton variant='rounded' width={96} height={32} />
                </Row>
            </Row>
            <Box className='container-details-header-tabs-row'>
                <Skeleton variant='rounded' width={320} height={30} />
            </Box>
        </Stack>

        <Stack className='container-details-content-area' flex='1' p='1-5' gap='1-5'>
            <Row gap='2'>
                <Skeleton variant='rounded' width='33%' height={140} />
                <Skeleton variant='rounded' width='33%' height={140} />
                <Skeleton variant='rounded' width='33%' height={140} />
            </Row>
            <Skeleton variant='rounded' width='100%' height={240} />
        </Stack>
    </Stack>
);

export default ContainerDetailsSkeleton;
