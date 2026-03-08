import Container from '@/shared/presentation/components/Container';
import ProcessingLoader from '@/shared/presentation/components/ProcessingLoader';
import { Skeleton } from '@mui/material';

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
            <Container className='simulation-container loading p-relative w-max overflow-hidden cursor-pointer'>
                <Skeleton variant='rounded' width='100%' height={200} />
                <Container className='p-absolute' style={{ bottom: '1.5rem', left: '1.5rem', zIndex: 10 }}>
                    <Container className='d-flex items-center gap-05'>
                        <ProcessingLoader
                            isVisible={true}
                            message={message}
                            className='text-white'
                        />
                    </Container>
                </Container>
            </Container>
        );
    }

    return (
        <>
            {Array.from({ length: n }).map((_, index) => (
                <Container className='simulation-container loading p-relative w-max overflow-hidden cursor-pointer' key={index}>
                    <Skeleton variant='rounded' width='100%' height={200} />
                </Container>
            ))}
        </>
    );
}
