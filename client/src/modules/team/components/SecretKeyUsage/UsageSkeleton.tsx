import { Box, Row, Skeleton, Stack } from '@voltstack/bravais';

const UsageSkeleton = () => (
    <Box height='vh-max' className='secret-key-page text-primary'>
        <Stack gap='2' width='max' className='secret-key-page-main'>
            <Row gap='1'>
                <Skeleton variant='circular' width={24} height={24} />
                <Skeleton variant='text' width={300} height={32} />
            </Row>
            <Box gap='1' className='secret-key-page-cards'>
                {[...Array(4)].map((_, index) => (
                    <Box key={index} radius='lg' transition='normal' className='secret-key-page-card'>
                        <Skeleton variant='text' width={100} height={16} />
                        <Skeleton variant='rectangular' width={80} height={40} style={{
                            borderRadius: 4,
                            marginTop: '0.5rem'
                        }} />
                    </Box>
                ))}
            </Box>
            <div className='secret-key-page-charts'>
                {[...Array(4)].map((_, index) => (
                    <Skeleton key={index} variant='rectangular' width='100%' height={300} style={{ borderRadius: 8 }} />
                ))}
            </div>
        </Stack>
    </Box>
);

export default UsageSkeleton;
