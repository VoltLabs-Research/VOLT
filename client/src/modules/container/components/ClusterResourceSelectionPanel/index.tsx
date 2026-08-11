import { Slider } from '@heroui/react';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import SettingsSectionHeader from '@/shared/ui/components/SettingsSectionHeader';
import { Cpu, HardDrive, ServerCog } from 'lucide-react';
import { MIN_CLUSTER_CPU, MIN_CLUSTER_MEMORY_MB } from '@/modules/container/utils/resource-allocation';
import type { ClusterResourceLimits } from '@volt/contracts/modules/cluster/domain';
import type { TeamClusterOption } from '@volt/contracts/modules/container/domain';

interface ClusterResourceSelectionPanelProps {
    teamClusters: TeamClusterOption[];
    isTeamSelected: boolean;
    selectedTeamClusterId: string | null;
    clusterResourceLimits?: ClusterResourceLimits | null;
    isLoadingResourceLimits?: boolean;
    cpus?: number;
    memoryMB?: number;
    onTeamClusterChange: (teamClusterId: string | null) => void;
    onCpusChange?: (value: number) => void;
    onMemoryChange?: (value: number) => void;
    showResourceSelection?: boolean;
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

const getResourceStatusMessage = (resourceLimits: ClusterResourceLimits | null | undefined) => {
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

const getResourceBlocker = (
    selectedTeamClusterId: string | null,
    clusterResourceLimits: ClusterResourceLimits | null | undefined,
    isLoadingResourceLimits: boolean | undefined
) => {
    if (!selectedTeamClusterId) {
        return {
            title: 'Select a cluster first',
            description: 'Select a cluster first to configure container resources.'
        };
    }

    if (isLoadingResourceLimits) {
        return {
            title: 'Loading cluster limits',
            description: 'Fetching the latest CPU and memory capacity for this cluster.'
        };
    }

    if (!clusterResourceLimits?.maxCpus || !clusterResourceLimits?.maxMemoryMB) {
        return {
            title: 'Cluster metrics unavailable',
            description: 'This cluster has not reported resource metrics yet. Try again after the next heartbeat.'
        };
    }

    return null;
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
    showResourceSelection = true,
    clusterLabel = 'Cluster',
    clusterPlaceholder = 'Select a cluster',
    clusterTitle = 'Deployment cluster',
    clusterDescription = 'Choose where the notebook container will be deployed.',
    resourcesTitle = 'Resources',
    resourcesDescription = 'Defaults work for most notebooks. Increase only when the workload needs it.'
}: ClusterResourceSelectionPanelProps) => {
    const clusterFieldError = getClusterFieldError(isTeamSelected, selectedTeamClusterId, teamClusters);
    const resourceStatusMessage = getResourceStatusMessage(clusterResourceLimits);
    const resourceBlocker = getResourceBlocker(selectedTeamClusterId, clusterResourceLimits, isLoadingResourceLimits);

    const teamClusterOptions = teamClusters.map((teamCluster) => ({
        title: teamCluster.name,
        value: teamCluster._id
    }));
    const maxCpu = clusterResourceLimits?.maxCpus ?? MIN_CLUSTER_CPU;
    const maxMemory = clusterResourceLimits?.maxMemoryMB ?? MIN_CLUSTER_MEMORY_MB;
    const selectedCpuValue = cpus ?? MIN_CLUSTER_CPU;
    const selectedMemoryValue = memoryMB ?? MIN_CLUSTER_MEMORY_MB;

    return (
        <div className='grid grid-cols-1 gap-4'>
            <div className='flex flex-col gap-4 rounded-xl border border-border p-6'>
                <SettingsSectionHeader
                    title={clusterTitle}
                    description={clusterDescription}
                    className='mb-4'
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
            </div>

            {showResourceSelection && (
                <div className='flex flex-col gap-4 rounded-xl border border-border p-6'>
                    <SettingsSectionHeader
                        title={resourcesTitle}
                        description={resourcesDescription}
                        className='mb-4'
                    />
                    {resourceBlocker ? (
                        <RecoveryState
                            title={resourceBlocker.title}
                            description={resourceBlocker.description}
                            icon={<ServerCog size={24} />}
                            tone={RecoveryStateTone.Empty}
                            className='w-full'
                        />
                    ) : (
                        <>
                            {resourceStatusMessage && (
                                <p className='text-sm text-muted'>{resourceStatusMessage}</p>
                            )}
                            <div className='mb-3 rounded-lg p-4'>
                                <div className='flex flex-row items-center justify-between mb-3'>
                                    <div className='flex flex-row items-center gap-2'>
                                        <span className='text-sm font-medium text-muted'>
                                            <Cpu size={16} /> CPU
                                        </span>
                                    </div>
                                    <span className='rounded-full bg-surface-tertiary px-[0.6rem] py-[0.2rem] text-[0.8rem] font-semibold text-foreground'>{selectedCpuValue} vCPU</span>
                                </div>
                                <Slider
                                    aria-label='CPU'
                                    minValue={MIN_CLUSTER_CPU}
                                    maxValue={maxCpu}
                                    step={0.5}
                                    value={selectedCpuValue}
                                    onChange={(nextValue) => {
                                        if (typeof nextValue !== 'number') return;
                                        onCpusChange?.(nextValue);
                                    }}
                                >
                                    <Slider.Track>
                                        <Slider.Fill />
                                        <Slider.Thumb />
                                    </Slider.Track>
                                </Slider>
                                <div className='flex flex-row items-center justify-between text-xs text-muted'>
                                    <span>{MIN_CLUSTER_CPU} vCPU</span>
                                    <span>{maxCpu} vCPU</span>
                                </div>
                            </div>
                            <div className='rounded-lg p-4'>
                                <div className='flex flex-row items-center justify-between mb-3'>
                                    <div className='flex flex-row items-center gap-2'>
                                        <span className='text-sm font-medium text-muted'>
                                            <HardDrive size={16} /> Memory
                                        </span>
                                    </div>
                                    <span className='rounded-full bg-surface-tertiary px-[0.6rem] py-[0.2rem] text-[0.8rem] font-semibold text-foreground'>{selectedMemoryValue} MB</span>
                                </div>
                                <Slider
                                    aria-label='Memory'
                                    minValue={MIN_CLUSTER_MEMORY_MB}
                                    maxValue={maxMemory}
                                    step={128}
                                    value={selectedMemoryValue}
                                    onChange={(nextValue) => {
                                        if (typeof nextValue !== 'number') return;
                                        onMemoryChange?.(nextValue);
                                    }}
                                >
                                    <Slider.Track>
                                        <Slider.Fill />
                                        <Slider.Thumb />
                                    </Slider.Track>
                                </Slider>
                                <div className='flex flex-row items-center justify-between text-xs text-muted'>
                                    <span>{MIN_CLUSTER_MEMORY_MB} MB</span>
                                    <span>{maxMemory} MB</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ClusterResourceSelectionPanel;
