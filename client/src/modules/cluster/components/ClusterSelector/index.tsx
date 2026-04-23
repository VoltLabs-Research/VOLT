import { getTeamClusterStatusLabel } from '@/modules/cluster/utilities/team-cluster-status';
import { Row, Text, Button } from '@/shared/presentation/primitives';
import { Select } from '@/shared/presentation/primitives';
import { useMemo } from 'react';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type { SelectOption } from '@/shared/presentation/primitives';

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
        <Row justify='end' wrap gap='1' className='mb-1'>
            <Row gap='1'>
                <Text as='p' size='md' tone='muted-foreground'>
                    Viewing Cluster:
                </Text>
                <Select
                    options={options}
                    value={selectedClusterId}
                    onChange={onClusterChange}
                    placeholder='No clusters yet'
                    disabled={!options.length}
                />
            </Row>

            <Row align='start' justify='end' wrap gap='1' className='mb-1'>
                <Button variant='solid' shape='pill' size='sm' intent='brand' to='/onboarding/cluster/setup'>
                    Add New Cluster
                </Button>
            </Row>
        </Row>
    );
};

export default ClusterSelector;
