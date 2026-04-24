import ClusterResourceSelectionPanel from '@/modules/container/components/ClusterResourceSelectionPanel';
import EditableKeyValueCard from '@/shared/presentation/components/EditableKeyValueCard';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import SettingsSectionHeader from '@/shared/presentation/components/SettingsSectionHeader';
import Box from '@/shared/presentation/primitives/Box';
import Button from '@/shared/presentation/primitives/Button';
import Heading from '@/shared/presentation/primitives/Heading';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import { getCustomFieldValidationError } from '../../hooks/use-create-container-form';
import { ContainerTemplateCustomFieldType } from '../../api/entities/container-template';
import type { ContainerConfig } from '../../hooks/use-create-container-form';
import type { ClusterResourceLimits } from '../../api/entities/cluster-resource-limits';
import type { ContainerTemplateCustomField } from '../../api/entities/container-template';
import type { FieldConfig } from '@/shared/presentation/components/EditableKeyValueCard';
import type { SelectOption } from '@/shared/presentation/components/FormFieldRHF';
import type { Team } from '@/modules/team/api/entities/team/team';
import type { TeamClusterOption } from '@/modules/container/api/entities/team-cluster-option';
import { useDemoClusterStore } from '@/modules/cluster/stores/use-demo-cluster-store';

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
            <Stack key={customField.id} gap='05'>
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
                    <Text as='p' size='md' tone='muted'>{customField.description}</Text>
                )}
            </Stack>
        );
    };

    return (
        <Stack className='create-container-config-card full-width' radius='md' gap='1' p='1-5'>
            <SettingsSectionHeader
                title='Template settings'
                description='These options come from the selected template.'
                className='create-container-config-section-header mb-1 pb-075'
            />
            <Stack gap='1'>
                {customFields.map(renderCustomField)}
            </Stack>
        </Stack>
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
    const isDemoCluster = useDemoClusterStore((state) => state.isDemo);
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
        <Stack className='create-container-step' gap='2'>
            <Stack gap='05'>
                <Heading level={3} size='xl' weight='bold'>Configuration</Heading>
                <Text as='p' size='lg' tone='secondary' className='create-container-step-copy'>Fill in the required deployment details, then adjust optional settings only if needed.</Text>
            </Stack>

            <Box className='create-container-config-grid gap-1-5 mt-1-5'>
                <Stack className='create-container-config-card full-width' radius='md' gap='1' p='1-5'>
                    <SettingsSectionHeader
                        title='Deployment details'
                        description='These fields are required before you can continue to review.'
                        className='create-container-config-section-header mb-1 pb-075'
                    />
                    <Box className='create-container-deployment-fields'>
                        <Box className='create-container-deployment-name'>
                            <FormFieldRHF
                                label='Name'
                                placeholder='my-container-app'
                                value={config.name}
                                onChange={(e) => onConfigChange('name', e.target.value)}
                                error={!config.name.trim() ? 'A container name is required before review.' : undefined}
                                className='w-full'
                            />
                        </Box>
                        <Stack className='create-container-deployment-selects' gap='1'>
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
                        </Stack>
                    </Box>
                </Stack>

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

                <Stack className='create-container-config-card' radius='md' gap='1' p='1-5'>
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
                </Stack>

                <Stack className='create-container-config-card' radius='md' gap='1' p='1-5'>
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
                </Stack>

                {renderCustomFieldsSection(config.customFields, config.customFieldValues, onConfigChange)}

                <Stack className='create-container-config-card full-width' radius='md' gap='1' p='1-5'>
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
                        value={isDemoCluster ? false : config.mountDockerSocket}
                        disabled={isDemoCluster}
                        onChange={(event) => {
                            if (isDemoCluster) return;
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
                    <Text as='p' size='md' tone='muted'>
                        {isDemoCluster
                            ? 'Disabled in demo mode — connect your own cluster to enable this option.'
                            : 'Mounts /var/run/docker.sock inside the container.'}
                    </Text>
                </Stack>
            </Box>

            <Row className='create-container-step-actions mt-2' justify='between' gap='1'>
                <Text as='p' size='md' tone='secondary'>
                    {canProceed ? 'Required fields complete. Continue when you are ready.' : remainingItemsLabel}
                </Text>
                <Row className='create-container-step-actions-buttons' gap='1'>
                    <Button variant='outline' intent='neutral' onClick={onBack}>Back</Button>
                    <Button variant='solid' intent='brand' onClick={onNext} disabled={!canProceed}>Continue to review</Button>
                </Row>
            </Row>
        </Stack>
    );
};

export default ConfigurationStep;
