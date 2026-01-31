import useTrajectoryPreview from '../../../hooks/trajectory/use-trajectory-preview';
import { Skeleton } from '@mui/material';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';

interface SimulationCardPreviewProps{
    trajectoryId: string;
    version?: string;
    className?: string;
};

const SimulationCardPreview = ({ trajectoryId, version, className = '' }: SimulationCardPreviewProps) => {
    const { previewBlobUrl, isLoading, error, retry } = useTrajectoryPreview({
        trajectoryId,
        version,
        enabled: true
    });

    if(isLoading){
        return <Skeleton variant='rectangular' className={`preview-skeleton ${className}`} />;
    }

    if(error){
        return (
            <Container className={`preview-error ${className}`} onClick={retry}>
                <Paragraph>Failed to load preview</Paragraph>
                <Paragraph className='retry-text'>Click to retry</Paragraph>
            </Container>
        );
    }

    if(!previewBlobUrl){
        return <Container className={`preview-placeholder ${className}`} />;
    }

    return (
        <img
            src={previewBlobUrl}
            alt='Trajectory preview'
            className={`preview-image ${className}`}
        />
    );
};

export default SimulationCardPreview;
