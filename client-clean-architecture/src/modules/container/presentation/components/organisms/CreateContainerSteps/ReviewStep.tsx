import { Box } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Button from '@/shared/presentation/components/Button';
import ReviewItem from '../../atoms/ReviewItem';
import type { ContainerConfig } from '../../../hooks/use-create-container-form';

interface ReviewStepProps {
    config: ContainerConfig;
    teams: { _id: string; name: string }[];
    selectedTeamId: string | null;
    image: string | undefined;
    isLoading: boolean;
    onBack: () => void;
    onCreate: () => void;
};

const ReviewStep = ({
    config,
    teams,
    selectedTeamId,
    image,
    isLoading,
    onBack,
    onCreate
}: ReviewStepProps) => {
    const portsDisplay = config.ports.length > 0 
        ? config.ports.map((p) => `${p.private}:${p.public || 'Auto'}`).join(', ') 
        : 'None';

    return (
        <Container className='create-container-step d-flex column gap-2'>
            <Title className='font-size-5 font-weight-6'>Review & Deploy</Title>
            <Container className='create-container-review-card radius-md overflow-hidden'>
                <ReviewItem label='Name' value={config.name} />
                <ReviewItem label='Team' value={teams.find((t) => t._id === selectedTeamId)?.name || 'None'} />
                <ReviewItem label='Image' value={image} valueClassName='font-family-mono' />
                <ReviewItem label='CPU' value={`${config.cpus} vCPU`} />
                <ReviewItem label='Memory' value={`${config.memory} MB`} />
                <ReviewItem label='Ports' value={portsDisplay} />
            </Container>
            <Container className='d-flex content-end gap-1 create-container-step-actions mt-3'>
                <Button variant='outline' intent='neutral' onClick={onBack}>Back</Button>
                <Button
                    variant='solid'
                    intent='brand'
                    onClick={onCreate}
                    isLoading={isLoading}
                    leftIcon={!isLoading ? <Box size={18} /> : undefined}
                >
                    {!isLoading && 'Deploy Container'}
                </Button>
            </Container>
        </Container>
    );
};

export default ReviewStep;
