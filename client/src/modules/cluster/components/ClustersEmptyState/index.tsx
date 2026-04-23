import { Stack, Text, Heading, Button } from '@/shared/presentation/primitives';
const ClustersEmptyState = () => {
    return (
        <Stack align='start' gap='1' p='1-5' radius='lg' className='clusters-empty-state'>
            <Heading level={3} size='xl' weight='bold'>No clusters connected yet</Heading>
            <Text as='p' size='md' tone='secondary'>
                Create a team cluster to provision your first compute environment and unlock live metrics on this dashboard.
            </Text>
            <Button variant='solid' intent='brand' to='/onboarding/cluster/setup'>
                Add New Cluster
            </Button>
        </Stack>
    );
};

export default ClustersEmptyState;
