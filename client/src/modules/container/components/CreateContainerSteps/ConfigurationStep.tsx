import Button from '@/shared/presentation/components/Button';
import ClusterResourceSelectionPanel from '@/modules/container/components/ClusterResourceSelectionPanel';
import EditableKeyValueCard from '@/shared/presentation/components/EditableKeyValueCard';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import SettingsSectionHeader from '@/shared/presentation/components/SettingsSectionHeader';
import { getCustomFieldValidationError } from '../../hooks/use-create-container-form';
import { ContainerTemplateCustomFieldType } from '../../api/entities/container-template';
import type { ContainerConfig } from '../../hooks/use-create-container-form';
import type { ClusterResourceLimits } from '../../api/entities/cluster-resource-limits';
import type { ContainerTemplateCustomField } from '../../api/entities/container-template';
import type { FieldConfig } from '@/shared/presentation/components/EditableKeyValueCard';
import type { SelectOption } from '@/shared/presentation/components/FormFieldRHF';
import type { Team } from '@/modules/team/api/entities/team/team';
import type { TeamClusterOption } from '@/modules/container/api/entities/team-cluster-option';

interface PortMappingFormItem extends Record<string, unknown> {
    private: number;
    public?: number;
};

interface EnvVariableFormItem extends Record<string, unknown> {
    key: string;
    value: string;
};

type PortMappingSourceItem = ContainerConfig['ports'][number] | PortMappingFormItem;

const getPortMappingFormItem = (item: PortMappingSourceItem): PortMappingFormItem => {
    if (typeof item.public === 'number' && item.public > 0) {
        return {
            private: item.private,
            public: item.public
        };
    }

    return {
        private: item.private
    };
};

interface ValueChangeTarget {
    value: string | boolean;
};

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
};

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

const hasValueChangeTarget = (value: unknown): value is ValueChangeTarget => {
    return typeof value === 'object' && value !== null && 'value' in value;
};

const getCustomFieldValidationErrorCount = (
    customFields: ContainerTemplateCustomField[],
    customFieldValues: ContainerConfig['customFieldValues']
): number => {
    return customFields.reduce((count, customField) => {
        const customFieldValue = customFieldValues[customField.id] ?? '';
        return getCustomFieldValidationError(customField, customFieldValue) ? count + 1 : count;
    }, 0);
};

const getCustomFieldType = (customField: ContainerTemplateCustomField) => {
    if (customField.type === ContainerTemplateCustomFieldType.Password) {
        return 'password';
    }

    return 'text';
};

const renderCustomFieldsSection = (
    customFields: ContainerTemplateCustomField[],
    customFieldValues: ContainerConfig['customFieldValues'],
    onConfigChange: <K extends keyof ContainerConfig>(key: K, value: ContainerConfig[K]) => void
) => {
    if (customFields.length === 0) {
        return null;
    }

    const handleCustomFieldChange = (customFieldId: string, value: string) => {
        onConfigChange('customFieldValues', {
            ...customFieldValues,
            [customFieldId]: value
        });
    };

    const renderCustomField = (customField: ContainerTemplateCustomField) => {
        const fieldValue = customFieldValues[customField.id] ?? '';
        const fieldError = getCustomFieldValidationError(customField, fieldValue) ?? undefined;

        return (
            <div key={customField.id} className='volt-container d-flex column gap-05'>
                <FormFieldRHF
                    label={customField.label}
                    name={customField.id}
                    placeholder={customField.placeholder}
                    value={fieldValue}
                    onChange={(event) => handleCustomFieldChange(customField.id, event.target.value)}
                    type={getCustomFieldType(customField)}
                    error={fieldError}
                    inputProps={{
                        autoComplete: customField.type === ContainerTemplateCustomFieldType.Password
                            ? 'new-password'
                            : 'off'
                    }}
                    className='w-full'
                />
                {customField.description && (
                    <p className='volt-text font-size-2 color-muted'>{customField.description}</p>
                )}
            </div>
        );
    };

    return (
        <div className='volt-container create-container-config-card full-width radius-md d-flex column gap-1 p-1-5'>
            <SettingsSectionHeader
                title='Template settings'
                description='These options come from the selected template.'
                className='create-container-config-section-header mb-1 pb-075'
            />
            <div className='volt-container d-flex column gap-1'>
                {customFields.map(renderCustomField)}
            </div>
        </div>
    );
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
    const portItems: PortMappingFormItem[] = config.ports.map(getPortMappingFormItem);
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
    ].filter(Boolean).length + getCustomFieldValidationErrorCount(config.customFields, config.customFieldValues);
    const remainingItemsLabel = `${requiredRemainingCount} required item${requiredRemainingCount === 1 ? '' : 's'} remaining before review.`;

    return (
        <div className='volt-container create-container-step d-flex column gap-2'>
            <div className='volt-container d-flex column gap-05'>
                <h3 className='volt-title font-size-5 font-weight-6'>Configuration</h3>
                <p className='volt-text font-size-3 color-secondary create-container-step-copy'>Fill in the required deployment details, then adjust optional settings only if needed.</p>
            </div>

            <div className='volt-container create-container-config-grid gap-1-5 mt-1-5'>
                <div className='volt-container create-container-config-card full-width radius-md d-flex column gap-1 p-1-5'>
                    <SettingsSectionHeader
                        title='Deployment details'
                        description='These fields are required before you can continue to review.'
                        className='create-container-config-section-header mb-1 pb-075'
                    />
                    <div className='volt-container create-container-deployment-fields'>
                        <div className='volt-container create-container-deployment-name'>
                            <FormFieldRHF
                                label='Name'
                                placeholder='my-container-app'
                                value={config.name}
                                onChange={(e) => onConfigChange('name', e.target.value)}
                                error={!config.name.trim() ? 'A container name is required before review.' : undefined}
                                className='w-full'
                            />
                        </div>
                        <div className='volt-container create-container-deployment-selects d-flex gap-1 column'>
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

                <div className='volt-container create-container-config-card radius-md d-flex column gap-1 p-1-5'>
                    <SettingsSectionHeader
                        title='Network'
                        description='Optional public port mappings.'
                        className='create-container-config-section-header mb-1 pb-075'
                    />
                    <EditableKeyValueCard<PortMappingFormItem>
                        items={portItems}
                        fields={PORT_FIELDS}
                        alwaysEditing
                        showCard={false}
                        onChange={(items) => onConfigChange('ports', items.map(getPortMappingFormItem))}
                        createEmpty={() => ({ private: 80 })}
                        emptyMessage='No port mappings added.'
                    />
                </div>

                <div className='volt-container create-container-config-card radius-md d-flex column gap-1 p-1-5'>
                    <SettingsSectionHeader
                        title='Environment variables'
                        description='Optional runtime values for the container.'
                        className='create-container-config-section-header mb-1 pb-075'
                    />
                    <EditableKeyValueCard<EnvVariableFormItem>
                        items={envItems}
                        fields={ENV_FIELDS}
                        alwaysEditing
                        showCard={false}
                        onChange={(items) => onConfigChange('env', items)}
                        createEmpty={() => ({ key: '', value: '' })}
                        emptyMessage='No environment variables added.'
                    />
                </div>

                {renderCustomFieldsSection(config.customFields, config.customFieldValues, onConfigChange)}

                <div className='volt-container create-container-config-card full-width radius-md d-flex column gap-1 p-1-5'>
                    <SettingsSectionHeader
                        title='Advanced'
                        description='Enable only when the image needs direct access to the host Docker socket.'
                        className='create-container-config-section-header mb-1 pb-075'
                    />
                    <FormFieldRHF
                        variant='inline'
                        fieldType='checkbox'
                        label='Docker socket access'
                        name='mountDockerSocket'
                        value={config.mountDockerSocket}
                        onChange={(event) => {
                            if (!hasValueChangeTarget(event.target)) {
                                return;
                            }

                            const inputValue = event.target.value;
                            if (typeof inputValue === 'boolean') {
                                onConfigChange('mountDockerSocket', inputValue);
                                return;
                            }
                            onConfigChange('mountDockerSocket', inputValue === 'true');
                        }}
                    />
                    <p className='volt-text font-size-2 color-muted'>Mounts /var/run/docker.sock inside the container.</p>
                </div>
            </div>

            <div className='volt-container create-container-step-actions d-flex items-center content-between gap-1 mt-2'>
                <p className='volt-text font-size-2 color-secondary'>
                    {canProceed ? 'Required fields complete. Continue when you are ready.' : remainingItemsLabel}
                </p>
                <div className='volt-container d-flex gap-1 create-container-step-actions-buttons'>
                    <Button variant='outline' intent='neutral' onClick={onBack}>Back</Button>
                    <Button variant='solid' intent='brand' onClick={onNext} disabled={!canProceed}>Continue to review</Button>
                </div>
            </div>
        </div>
    );
};

export default ConfigurationStep;
