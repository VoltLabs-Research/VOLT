import ProcessingLoader from '@/shared/presentation/components/ProcessingLoader';
import { Skeleton, Box, Row } from '@/shared/presentation/primitives';

interface SimulationSkeletonCardProps {
    n?: number;
    progress?: number;
    status?: 'uploading' | 'processing' | 'waiting_for_jobs' | 'failed';
};

export default function SimulationSkeletonCard({ n = 1, progress, status }: SimulationSkeletonCardProps) {
    if (progress !== undefined) {
        let message = `Uploading ${Math.round(progress * 100)}%`;

        if (status === 'processing') {
            message = 'Processing...';
        } else if (status === 'waiting_for_jobs') {
            message = 'Queued...';
        } else if (status === 'failed') {
            message = 'Upload failed';
        }

        return (
            <Box position='relative' width='max' overflow='hidden' cursor='pointer' className='simulation-container loading'>
                <Skeleton variant='rounded' width='100%' height={200} />
                <Box position='absolute' style={{ bottom: '1.5rem', left: '1.5rem', zIndex: 10 }}>
                    <Row gap='05'>
                        <ProcessingLoader
                            isVisible={true}
                            message={message}
                            className='text-white'
                        />
                    </Row>
                </Box>
            </Box>
        );
    }

    return (
        <>
            {Array.from({ length: n }).map((_, index) => (
                <Box position='relative' width='max' overflow='hidden' cursor='pointer' className='simulation-container loading' key={index}>
                    <Skeleton variant='rounded' width='100%' height={200} />
                </Box>
            ))}
        </>
    );
}
