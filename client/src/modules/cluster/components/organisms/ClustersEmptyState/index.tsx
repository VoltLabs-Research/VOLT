import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';

const ClustersEmptyState = () => {
    return (
        <Container className='clusters-empty-state d-flex column gap-1 p-1-5 radius-lg items-start'>
            <Title className='font-size-4 font-weight-6 color-primary'>No clusters connected yet</Title>
            <Paragraph className='font-size-2 color-secondary'>
                Create a team cluster to provision your first compute environment and unlock live metrics on this dashboard.
            </Paragraph>
            <Button variant='solid' intent='brand' to='/onboarding/cluster/setup'>
                Add New Cluster
            </Button>
        </Container>
    );
};

export default ClustersEmptyState;
