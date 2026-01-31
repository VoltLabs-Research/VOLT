import { Skeleton } from '@mui/material';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './SimulationSkeletonCard.css';

interface SimulationSkeletonCardProps{
    uploadProgress?: number;
    message?: string;
    count?: number;
};

const SingleSkeletonCard = ({ uploadProgress, message }: SimulationSkeletonCardProps) => {
    const hasProgress = uploadProgress !== undefined;

    return (
        <Container className='simulation-skeleton-card radius-md b-soft'>
            <Container className='skeleton-preview'>
                <Skeleton variant='rectangular' width='100%' height='100%' />
            </Container>
            <Container className='d-flex column gap-05 p-1 skeleton-content'>
                {hasProgress ? (
                    <>
                        <Container className='progress-bar radius-sm'>
                            <Container
                                className='progress-fill radius-sm'
                                style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                            />
                        </Container>
                        <Paragraph className='font-size-2 color-secondary'>
                            {message ?? `Uploading... ${Math.round(uploadProgress * 100)}%`}
                        </Paragraph>
                    </>
                ) : (
                    <>
                        <Skeleton variant='text' width='60%' height={20} />
                        <Skeleton variant='text' width='40%' height={16} />
                    </>
                )}
            </Container>
        </Container>
    );
};

const SimulationSkeletonCard = ({ count = 1, uploadProgress, message }: SimulationSkeletonCardProps) => {
    if(count === 1){
        return <SingleSkeletonCard uploadProgress={uploadProgress} message={message} />;
    }

    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <SingleSkeletonCard key={i} />
            ))}
        </>
    );
};

export default SimulationSkeletonCard;
