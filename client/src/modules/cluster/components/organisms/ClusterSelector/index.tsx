import { getTeamClusterStatusLabel } from '@/modules/cluster/utilities/team-cluster-status';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import Select from '@/shared/presentation/components/Select';
import { useMemo } from 'react';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type { SelectOption } from '@/shared/presentation/components/Select';

interface ClusterSelectorProps {
    clusters: TeamCluster[];
    selectedClusterId: string | null;
    onClusterChange: (clusterId: string) => void;
};

const ClusterSelector = ({ clusters, selectedClusterId, onClusterChange }: ClusterSelectorProps) => {
    const options = useMemo<SelectOption[]>(() => {
        return clusters.map((cluster) => ({
            value: cluster._id,
            title: cluster.name,
            description: getTeamClusterStatusLabel(cluster.status)
        }));
    }, [clusters]);

    return (
        <Container className='d-flex items-center content-end mb-1 flex-wrap gap-1'>
            <Container className='d-flex items-center gap-1'>
                <Paragraph className='font-size-2 color-muted-foreground'>
                    Viewing Cluster:
                </Paragraph>
                <Select
                    options={options}
                    value={selectedClusterId}
                    onChange={onClusterChange}
                    placeholder='No clusters yet'
                    disabled={!options.length}
                />
            </Container>

            <Container className='d-flex items-start content-end mb-1 flex-wrap gap-1'>
                <Button variant='solid' shape='pill' size='sm' intent='brand' to='/onboarding/cluster/setup'>
                    Add New Cluster
                </Button>
            </Container>
        </Container>
    );
};

export default ClusterSelector;
