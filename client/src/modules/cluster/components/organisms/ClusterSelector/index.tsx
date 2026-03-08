import { useMemo } from 'react';
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import Select, { type SelectOption } from '@/shared/presentation/components/Select';

interface ClusterSelectorProps {
    clusters: ClusterMetrics[];
    selectedClusterId: string;
    onClusterChange: (clusterId: string) => void;
}

const ClusterSelector = ({ clusters, selectedClusterId, onClusterChange }: ClusterSelectorProps) => {
    const options = useMemo<SelectOption[]>(() => {
        if(!clusters.length){
            return [{ value: 'main-cluster', title: 'Main Cluster' }];
        }
        
        return clusters.map((cluster) => ({
            value: cluster.clusterId,
            title: cluster.clusterId,
            description: `${cluster.analysisCount ?? 0} analyzes`
        }));
    }, [clusters]);

    return (
        <Container className='d-flex items-center content-between mb-1 flex-wrap gap-1'>
            <Title className='font-weight-6 font-size-3'>Cluster Metrics</Title>
            <Container className='d-flex items-center gap-1'>
                <Paragraph className='font-size-2 color-muted-foreground'>
                    Viewing Cluster:
                </Paragraph>
                <Select
                    options={options}
                    value={selectedClusterId}
                    onChange={onClusterChange}
                    placeholder='Select cluster...'
                />
            </Container>
        </Container>
    );
};

export default ClusterSelector;
