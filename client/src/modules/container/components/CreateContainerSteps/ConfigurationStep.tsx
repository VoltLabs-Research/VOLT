import ClusterResourceSelectionPanel from '@/modules/container/components/ClusterResourceSelectionPanel';
import EditableKeyValueCard from '@/shared/ui/components/EditableKeyValueCard';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import OptionalConfigSection from './OptionalConfigSection';
import SettingsSectionHeader from '@/shared/ui/components/SettingsSectionHeader';
import { Button } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import { normalizePortMapping } from '../../utils/port-mapping';
import type { ClusterResourceLimits } from '@volt/contracts/modules/cluster/domain';
import type { ContainerConfig, EnvVariableFormItem, PortMappingFormItem } from '@/modules/container/contracts/forms';
import type { FieldConfig } from '@/shared/ui/components/EditableKeyValueCard';
import type { Team } from '@volt/contracts/modules/team/domain';
import type { TeamClusterOption } from '@volt/contracts/modules/container/domain';
import { useDemoClusterStore } from '@/modules/cluster/store/use-demo-cluster-store';

interface ConfigurationStepProps {
    config: ContainerConfig;
    teams: Team[];
    teamClusters: TeamClusterOption[];
    selectedTeamId: string | null;
    selectedTeamClusterId: string | null;
    clusterResourceLimits: ClusterResourceLimits | null;
    isLoadingResourceLimits: boolean;
    canProceed: boolean;
    onConfigChange: <K extends keyof ContainerConfig>(key: K, value: ContainerConfig[K]) => void;
    onTeamChange: (teamId: string | null) => void;
    onTeamClusterChange: (teamClusterId: string | null) => void;
    onBack: () => void;
    onNext: () => void;
}

const PORT_FIELDS: FieldConfig[] = [
    {
        key: 'private',
        placeholder: 'Container',
        type: 'number',
        label: 'Private'
    },
    {
        key: 'public',
        placeholder: 'Auto',
        type: 'number',
        label: 'Public'
    }
];

const ENV_FIELDS: FieldConfig[] = [
    {
        key: 'key',
        placeholder: 'KEY',
        type: 'text',
        label: 'Key'
    },
    {
        key: 'value',
        placeholder: 'VALUE',
        type: 'text',
        label: 'Value'
    }
];

const getTeamFieldError = (selectedTeamId: string | null, teams: Team[]) => {
    if (selectedTeamId) {
        return undefined;
    }

    if (teams.length === 0) {
        return 'No teams are available for deployment.';
    }

    return 'Select a team to continue.';
};

const ConfigurationStep = ({
    config,
    teams,
    teamClusters,
    selectedTeamId,
    selectedTeamClusterId,
    clusterResourceLimits,
    isLoadingResourceLimits,
    canProceed,
    onConfigChange,
    onTeamChange,
    onTeamClusterChange,
    onBack,
    onNext
}: ConfigurationStepProps) => {
    const isDemoCluster = useDemoClusterStore((state) => state.isDemo);
    const portItems: PortMappingFormItem[] = config.ports.map(normalizePortMapping);
    const envItems: EnvVariableFormItem[] = config.env.map((item) => ({
        key: item.key,
        value: item.value
    }));
    const teamFieldError = getTeamFieldError(selectedTeamId, teams);
    const teamOptions: SelectOption[] = teams.map((team) => ({
        value: team._id,
        title: team.name
    }));
    const requiredRemainingCount = [
        !config.name.trim(),
        Boolean(teamFieldError),
        !selectedTeamId || !selectedTeamClusterId,
        Boolean(selectedTeamClusterId && !isLoadingResourceLimits && (!clusterResourceLimits?.maxCpus || !clusterResourceLimits?.maxMemoryMB))
    ].filter(Boolean).length;
    const remainingItemsLabel = `${requiredRemainingCount} required item${requiredRemainingCount === 1 ? '' : 's'} remaining before review.`;

    return (
        <div className='flex flex-col gap-8 create-container-step'>
            <div className='flex flex-col gap-2'>
                <h3 className='text-xl font-semibold text-foreground'>Configuration</h3>
                <p className='text-base text-muted create-container-step-copy'>Fill in the required deployment details, then adjust optional settings only if needed.</p>
            </div>

            <div className='create-container-config-grid gap-6 mt-6'>
                <div className='flex flex-col gap-4 p-6 rounded-xl create-container-config-card full-width'>
                    <SettingsSectionHeader
                        title='Deployment details'
                        description='These fields are required before you can continue to review.'
                        className='create-container-config-section-header mb-4 pb-075'
                    />
                    <div className='create-container-deployment-fields'>
                        <div className='create-container-deployment-name'>
                            <FormFieldRHF
                                label='Container Name'
                                placeholder='my-container-app'
                                value={config.name}
                                onChange={(e) => onConfigChange('name', e.target.value)}
                                error={!config.name.trim() ? 'A container name is required before review.' : undefined}
                                className='w-full'
                            />
                        </div>
                        <div className='flex flex-col gap-4 create-container-deployment-selects'>
                            <FormFieldRHF
                                fieldType='select'
                                label='Team'
                                name='team'
                                value={selectedTeamId || ''}
                                onChange={(e) => onTeamChange(e.target.value || null)}
                                options={teamOptions}
                                placeholder='Select a team'
                                error={teamFieldError}
                                disabled={teams.length === 0}
                            />
                        </div>
                    </div>
                </div>

                <ClusterResourceSelectionPanel
                    teamClusters={teamClusters}
                    isTeamSelected={Boolean(selectedTeamId)}
                    selectedTeamClusterId={selectedTeamClusterId}
                    clusterResourceLimits={clusterResourceLimits}
                    isLoadingResourceLimits={isLoadingResourceLimits}
                    cpus={config.cpus}
                    memoryMB={config.memory}
                    onTeamClusterChange={onTeamClusterChange}
                    onCpusChange={(value) => onConfigChange('cpus', value)}
                    onMemoryChange={(value) => onConfigChange('memory', value)}
                    clusterTitle='Deployment cluster'
                    clusterDescription='Choose where this container will be deployed.'
                />

                <OptionalConfigSection
                    title='Network'
                    description='Optional public port mappings.'
                >
                    <EditableKeyValueCard<PortMappingFormItem>
                        items={portItems}
                        fields={PORT_FIELDS}
                        alwaysEditing
                        showCard={false}
                        onChange={(items) => onConfigChange('ports', items.map(normalizePortMapping))}
                        createEmpty={() => ({ private: 80 })}
                        emptyMessage='No port mappings added.'
                    />
                </OptionalConfigSection>

                <OptionalConfigSection
                    title='Environment variables'
                    description='Optional runtime values for the container.'
                >
                    <EditableKeyValueCard<EnvVariableFormItem>
                        items={envItems}
                        fields={ENV_FIELDS}
                        alwaysEditing
                        showCard={false}
                        onChange={(items) => onConfigChange('env', items)}
                        createEmpty={() => ({
                            key: '',
                            value: ''
                        })}
                        emptyMessage='No environment variables added.'
                    />
                </OptionalConfigSection>

                <OptionalConfigSection
                    title='Advanced'
                    description='Enable only when the image needs direct access to the host Docker socket.'
                >
                    <FormFieldRHF
                        variant='inline'
                        fieldType='checkbox'
                        label='Docker socket access'
                        name='mountDockerSocket'
                        value={isDemoCluster ? false : config.mountDockerSocket}
                        disabled={isDemoCluster}
                        onChange={(event) => {
                            if (isDemoCluster) return;
                            onConfigChange('mountDockerSocket', event.target.value === 'true');
                        }}
                    />
                    <p className='text-sm text-muted'>
                        {isDemoCluster
                            ? 'Disabled in demo mode — connect your own cluster to enable this option.'
                            : 'Mounts /var/run/docker.sock inside the container.'}
                    </p>
                </OptionalConfigSection>
            </div>

            <div className='flex flex-row items-center justify-between gap-4 create-container-step-actions mt-8'>
                <p className='text-sm text-muted'>
                    {canProceed ? 'Required fields complete. Continue when you are ready.' : remainingItemsLabel}
                </p>
                <div className='flex flex-row items-center gap-4 create-container-step-actions-buttons'>
                    <Button variant='outline' intent='neutral' onClick={onBack}>Back</Button>
                    <Button variant='solid' intent='brand' onClick={onNext} disabled={!canProceed}>Continue to review</Button>
                </div>
            </div>
        </div>
    );
};

export default ConfigurationStep;
