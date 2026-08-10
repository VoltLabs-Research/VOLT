import ClusterResourceSelectionPanel from '@/modules/container/components/ClusterResourceSelectionPanel';
import EditableKeyValueCard from '@/shared/ui/components/EditableKeyValueCard';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import OptionalConfigSection from './OptionalConfigSection';
import SettingsSectionHeader from '@/shared/ui/components/SettingsSectionHeader';
import { Button } from '@heroui/react';
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

/**
 * From the deleted `CreateContainer.css`.
 *
 * `.create-container-config-grid` was `display: flex; flex-direction: column;
 * gap: 1rem` — its 768px arm set `grid-template-columns: 1fr` on a flex container,
 * which did nothing. The `gap-6` the call site already carried wins over the
 * sheet's `gap: 1rem`, so `flex flex-col gap-6` is what actually rendered.
 * `.full-width`'s `grid-column: 1 / -1` is likewise inert inside a flex column, but
 * it is preserved as `col-span-full` because `OptionalConfigSection` shares the
 * class and the grid could come back.
 *
 * `.create-container-step-actions` is the one rule with a real responsive arm: at
 * 768px the row becomes a reversed column whose children each go full width.
 */
const CONFIG_GRID_CLASS_NAMES = 'mt-6 flex flex-col gap-6';
const CONFIG_CARD_CLASS_NAMES = 'col-span-full flex flex-col gap-4 rounded-xl border border-border p-6';
const DEPLOYMENT_FIELDS_CLASS_NAMES = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 max-[768px]:grid-cols-1';
const STEP_ACTIONS_CLASS_NAMES = 'mt-8 flex flex-row items-center justify-between gap-4 border-t border-border pt-6 max-[768px]:flex-col-reverse max-[768px]:gap-3 max-[768px]:[&>*]:w-full';
const STEP_COPY_CLASS_NAMES = 'max-w-[46rem] text-base text-muted';

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
    /*
     * Was annotated `SelectOption[]`, a bravais type. The inferred shape still
     * satisfies `FormFieldRHF`'s `options`, so no type needs naming here.
     */
    const teamOptions = teams.map((team) => ({
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
        <div className='flex flex-col gap-8'>
            <div className='flex flex-col gap-2'>
                <h3 className='text-xl font-semibold text-foreground'>Configuration</h3>
                <p className={STEP_COPY_CLASS_NAMES}>Fill in the required deployment details, then adjust optional settings only if needed.</p>
            </div>

            <div className={CONFIG_GRID_CLASS_NAMES}>
                <div className={CONFIG_CARD_CLASS_NAMES}>
                    <SettingsSectionHeader
                        title='Deployment details'
                        description='These fields are required before you can continue to review.'
                        className='mb-4'
                    />
                    {/*
                      * `.create-container-deployment-name` and
                      * `.create-container-deployment-selects` existed only to force
                      * `width: 100%` onto FormFieldRHF's internals through
                      * `.form-field-container`, `.form-field-input`, `.render-input-container`
                      * and `.select-trigger`. All four arms are now dead: the migrated
                      * stacked renderer carries `w-full` on `.form-field-container` itself
                      * and passes `fullWidth` to HeroUI's TextField and Select, and it emits
                      * neither `.form-field-input`, `.render-input-container` nor
                      * `.select-trigger` at all. So the wrappers keep only `w-full`, which is
                      * what they were reaching for.
                      */}
                    <div className={DEPLOYMENT_FIELDS_CLASS_NAMES}>
                        <div className='w-full'>
                            <FormFieldRHF
                                label='Container Name'
                                placeholder='my-container-app'
                                value={config.name}
                                onChange={(e) => onConfigChange('name', e.target.value)}
                                error={!config.name.trim() ? 'A container name is required before review.' : undefined}
                                className='w-full'
                            />
                        </div>
                        <div className='flex w-full flex-col gap-4'>
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

            <div className={STEP_ACTIONS_CLASS_NAMES}>
                <p className='text-sm text-muted'>
                    {canProceed ? 'Required fields complete. Continue when you are ready.' : remainingItemsLabel}
                </p>
                <div className='flex shrink-0 flex-row items-center gap-4'>
                    <Button variant='outline' onPress={onBack}>Back</Button>
                    <Button variant='primary' onPress={onNext} isDisabled={!canProceed}>Continue to review</Button>
                </div>
            </div>
        </div>
    );
};

export default ConfigurationStep;
