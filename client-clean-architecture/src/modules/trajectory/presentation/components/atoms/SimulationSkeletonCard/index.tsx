import { Skeleton } from '@mui/material';
import Container from '@/shared/presentation/components/primitives/Container';
import ProcessingLoader from '@/shared/presentation/components/atoms/common/ProcessingLoader';

type Props = {
    n?: number;
    progress?: number;
    status?: 'uploading' | 'processing' | 'waiting_for_jobs';
};

const SimulationSkeletonCard: React.FC<Props> = ({ n = 8, progress, status }) => {
    if (progress !== undefined) {
        let message = `Uploading ${Math.round(progress * 100)}%`;

        if (status === 'processing') {
            message = `Processing ${Math.round(progress * 100)}%`;
        } else if (status === 'waiting_for_jobs') {
            message = 'Preparing...';
        }

        return (
            <Container className='simulation-container loading p-relative w-max overflow-hidden cursor-pointer'>
                <Skeleton variant='rounded' width='100%' height={200} />

                <div className="p-absolute" style={{ bottom: '1.5rem', left: '1.5rem', zIndex: 10 }}>
                    <div className="d-flex items-center gap-05">
                        <ProcessingLoader
                            isVisible={true}
                            message={message}
                            className="text-white"
                        />
                    </div>
                </div>
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
};

export default SimulationSkeletonCard;
