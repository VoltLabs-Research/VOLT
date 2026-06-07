import { Box, Row, Stack, Skeleton } from '@voltstack/bravais';
interface JobSkeletonProps {
    n?: number;
};

const JobSkeleton = ({ n = 10 }: JobSkeletonProps) => (
    <Stack>
        {Array.from({ length: n }, (_, index) => (
            <Row
                key={index}
                justify='between'
                align='center'
                style={{ paddingTop: 12, paddingBottom: 12 }}
            >
                <Row gap='1' flex='1'>
                    <Skeleton
                        variant='circular'
                        width={30}
                        height={30}
                        style={{ flexShrink: 0 }}
                    />

                    <Box flex='1' style={{ minWidth: 0 }}>
                        <Skeleton
                            variant='text'
                            width='70%'
                            height={20}
                            style={{ marginBottom: 4 }}
                        />
                        <Skeleton
                            variant='text'
                            width='100px'
                            height={16}
                        />
                    </Box>
                </Row>

                <Stack align='center' gap='025'>
                    <Skeleton
                        variant='rounded'
                        width={60}
                        height={18}
                        style={{ borderRadius: 12 }}
                    />
                </Stack>
            </Row>
        ))}
    </Stack>
);

export default JobSkeleton;
