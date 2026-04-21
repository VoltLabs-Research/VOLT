import Button from '@/shared/presentation/components/Button';
const ClustersEmptyState = () => {
    return (
        <div className='volt-container clusters-empty-state d-flex column gap-1 p-1-5 radius-lg items-start'>
            <h3 className='volt-title font-size-4 font-weight-6 color-primary'>No clusters connected yet</h3>
            <p className='volt-text font-size-2 color-secondary'>
                Create a team cluster to provision your first compute environment and unlock live metrics on this dashboard.
            </p>
            <Button variant='solid' intent='brand' to='/onboarding/cluster/setup'>
                Add New Cluster
            </Button>
        </div>
    );
};

export default ClustersEmptyState;
