import EmptyState from '@/shared/presentation/primitives/EmptyState';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import SettingsSectionHeader from '@/shared/presentation/components/SettingsSectionHeader';
import Box from '@/shared/presentation/primitives/Box';
import Row from '@/shared/presentation/primitives/Row';
import Slider from '@/shared/presentation/primitives/Slider';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import './ClusterResourceSelectionPanel.css';
import { Cpu, HardDrive, ServerCog } from 'lucide-react';
import { MIN_CLUSTER_CPU, MIN_CLUSTER_MEMORY_MB } from '@/modules/container/utilities/resource-allocation';
import { useMemo } from 'react';
import type { ClusterResourceLimits } from '@/modules/container/api/entities/cluster-resource-limits';
import type { SelectOption } from '@/shared/presentation/primitives/Select';
import type { TeamClusterOption } from '@/modules/container/api/entities/team-cluster-option';

interface ClusterResourceSelectionPanelProps {
    teamClusters: TeamClusterOption[];
    isTeamSelected: boolean;
    selectedTeamClusterId: string | null;
    clusterResourceLimits: ClusterResourceLimits | null;
    isLoadingResourceLimits: boolean;
    cpus: number;
    memoryMB: number;
    onTeamClusterChange: (teamClusterId: string | null) => void;
    onCpusChange: (value: number) => void;
    onMemoryChange: (value: number) => void;
    clusterLabel?: string;
    clusterPlaceholder?: string;
    clusterTitle?: string;
    clusterDescription?: string;
    resourcesTitle?: string;
    resourcesDescription?: string;
}

const getClusterFieldError = (
    isTeamSelected: boolean,
    selectedTeamClusterId: string | null,
    teamClusters: TeamClusterOption[]
) => {
    if (!isTeamSelected) {
        return 'Select a team to continue.';
    }

    if (selectedTeamClusterId) {
        return undefined;
    }

    if (teamClusters.length === 0) {
        return 'No clusters are available for the selected team.';
    }

    return 'Select a cluster to continue.';
};

const getResourceStatusMessage = (resourceLimits: ClusterResourceLimits | null) => {
    if (!resourceLimits?.status) {
        return null;
    }

    if (resourceLimits.status === 'Critical') {
        return 'This cluster is under heavy load. New containers may have limited headroom.';
    }

    if (resourceLimits.status === 'Warning') {
        return 'This cluster is nearing capacity. Consider smaller resource allocations.';
    }

    return 'Cluster health is good. Resource limits reflect the latest heartbeat metrics.';
};

const ClusterResourceSelectionPanel = ({
    teamClusters,
    isTeamSelected,
    selectedTeamClusterId,
    clusterResourceLimits,
    isLoadingResourceLimits,
    cpus,
    memoryMB,
    onTeamClusterChange,
    onCpusChange,
    onMemoryChange,
    clusterLabel = 'Cluster',
    clusterPlaceholder = 'Select a cluster',
    clusterTitle = 'Deployment cluster',
    clusterDescription = 'Choose where the notebook container will be deployed.',
    resourcesTitle = 'Resources',
    resourcesDescription = 'Defaults work for most notebooks. Increase only when the workload needs it.'
}: ClusterResourceSelectionPanelProps) => {
    const clusterFieldError = getClusterFieldError(isTeamSelected, selectedTeamClusterId, teamClusters);
    const resourceStatusMessage = getResourceStatusMessage(clusterResourceLimits);
    const teamClusterOptions: SelectOption[] = useMemo(() => {
        return teamClusters.map((teamCluster) => ({
            title: teamCluster.name,
            value: teamCluster._id
        }));
    }, [teamClusters]);
    const maxCpu = clusterResourceLimits?.maxCpus ?? MIN_CLUSTER_CPU;
    const maxMemory = clusterResourceLimits?.maxMemoryMB ?? MIN_CLUSTER_MEMORY_MB;

    return (
        <Box className='cluster-resource-selection-grid'>
            <Stack className='cluster-resource-selection-card' radius='md' gap='1' p='1-5'>
                <SettingsSectionHeader
                    title={clusterTitle}
                    description={clusterDescription}
                    className='mb-1 pb-075'
                />
                <FormFieldRHF
                    fieldType='select'
                    label={clusterLabel}
                    name='teamCluster'
                    value={selectedTeamClusterId || ''}
                    onChange={(event) => onTeamClusterChange(event.target.value || null)}
                    options={teamClusterOptions}
                    placeholder={clusterPlaceholder}
                    error={clusterFieldError}
                    disabled={!isTeamSelected || teamClusters.length === 0}
                />
            </Stack>

            <Stack className='cluster-resource-selection-card' radius='md' gap='1' p='1-5'>
                <SettingsSectionHeader
                    title={resourcesTitle}
                    description={resourcesDescription}
                    className='mb-1 pb-075'
                />
                {!selectedTeamClusterId ? (
                    <EmptyState
                        title='Select a cluster first'
                        description='Select a cluster first to configure container resources.'
                        icon={<ServerCog size={24} />}
                        headingLevel='h3'
                        announce
                        className='w-full'
                    />
                ) : isLoadingResourceLimits ? (
                    <EmptyState
                        title='Loading cluster limits'
                        description='Fetching the latest CPU and memory capacity for this cluster.'
                        icon={<ServerCog size={24} />}
                        headingLevel='h3'
                        announce
                        className='w-full'
                    />
                ) : !clusterResourceLimits?.maxCpus || !clusterResourceLimits?.maxMemoryMB ? (
                    <EmptyState
                        title='Cluster metrics unavailable'
                        description='This cluster has not reported resource metrics yet. Try again after the next heartbeat.'
                        icon={<ServerCog size={24} />}
                        headingLevel='h3'
                        announce
                        className='w-full'
                    />
                ) : (
                    <>
                        {resourceStatusMessage && (
                            <Text as='p' size='md' tone='secondary'>{resourceStatusMessage}</Text>
                        )}
                        <Box className='cluster-resource-selection-row mb-075' radius='sm' p='1'>
                            <Row className='mb-075' justify='between'>
                                <span className='d-flex items-center gap-05 font-size-2 font-weight-5 color-secondary'>
                                    <Cpu size={16} /> CPU
                                </span>
                                <span className='cluster-resource-selection-value radius-full font-weight-6'>{cpus} vCPU</span>
                            </Row>
                            <Slider
                                min={MIN_CLUSTER_CPU}
                                max={maxCpu}
                                step={0.5}
                                value={cpus}
                                onChange={onCpusChange}
                            />
                            <Box className='d-flex content-between font-size-1 color-muted'>
                                <span>{MIN_CLUSTER_CPU} vCPU</span>
                                <span>{maxCpu} vCPU</span>
                            </Box>
                        </Box>
                        <Box className='cluster-resource-selection-row' radius='sm' p='1'>
                            <Row className='mb-075' justify='between'>
                                <span className='d-flex items-center gap-05 font-size-2 font-weight-5 color-secondary'>
                                    <HardDrive size={16} /> Memory
                                </span>
                                <span className='cluster-resource-selection-value radius-full font-weight-6'>{memoryMB} MB</span>
                            </Row>
                            <Slider
                                min={MIN_CLUSTER_MEMORY_MB}
                                max={maxMemory}
                                step={128}
                                value={memoryMB}
                                onChange={onMemoryChange}
                            />
                            <Box className='d-flex content-between font-size-1 color-muted'>
                                <span>{MIN_CLUSTER_MEMORY_MB} MB</span>
                                <span>{maxMemory} MB</span>
                            </Box>
                        </Box>
                    </>
                )}
            </Stack>
        </Box>
    );
};

export default ClusterResourceSelectionPanel;
