import ClusterResourceSelectionPanel from '@/modules/container/components/ClusterResourceSelectionPanel';
import EditableKeyValueCard from '@/shared/ui/components/EditableKeyValueCard';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import SettingsSectionHeader from '@/shared/ui/components/SettingsSectionHeader';
import { Box, Button, CollapsibleSection, Heading, Row, Stack, Tag, Text } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { getCustomFieldValidationError } from '../../utilities/container-form';
import { ContainerTemplateCustomFieldType } from '../../api/types/container-template';
import type { ContainerConfig } from '../../hooks/use-create-container-form';
import type { ClusterResourceLimits } from '../../api/types/cluster-resource-limits';
import type { ContainerTemplateCustomField } from '../../api/types/container-template';
import type { FieldConfig } from '@/shared/ui/components/EditableKeyValueCard';
import type { Team } from '@/modules/team/api/types/team/team';
import type { TeamClusterOption } from '@/modules/container/api/types/team-cluster-option';
import { useDemoClusterStore } from '@/modules/cluster/stores/use-demo-cluster-store';

interface PortMappingFormItem extends Record<string, unknown> {
    private: number;
    public?: number;
}

interface EnvVariableFormItem extends Record<string, unknown> {
    key: string;
    value: string;
}

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
}

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

interface OptionalConfigSectionProps {
    title: string;
    description: string;
    defaultExpanded?: boolean;
    errorCount?: number;
    children: ReactNode;
}

/**
 * Collapsible card for optional configuration. Surfaces an error indicator on the
 * header and auto-expands when it contains validation errors so problems are never
 * hidden behind a collapsed section.
 */
const OptionalConfigSection = ({
    title,
    description,
    defaultExpanded = false,
    errorCount = 0,
    children
}: OptionalConfigSectionProps) => {
    const hasError = errorCount > 0;
    const [isExpanded, setIsExpanded] = useState(defaultExpanded || hasError);

    const expanded = isExpanded || hasError;

    return (
        <Stack className='create-container-config-card full-width' radius='md' gap='1' p='1-5'>
            <CollapsibleSection
                title={title}
                expanded={expanded}
                onExpandedChange={setIsExpanded}
                useDefaultHeaderStyles={false}
                headerAction={hasError
                    ? (
                        <Tag tone='danger' size='xs' variant='soft'>
                            {`${errorCount} to fix`}
                        </Tag>
                    )
                    : undefined}
                bodyClassName='mt-075'
            >
                <Stack gap='1'>
                    <Text as='p' size='md' tone='muted'>{description}</Text>
                    {children}
                </Stack>
            </CollapsibleSection>
        </Stack>
    );
};

const hasRequiredCustomField = (customFields: ContainerTemplateCustomField[]): boolean => {
    return customFields.some((customField) => customField.required);
};

const renderCustomFields = (
    customFields: ContainerTemplateCustomField[],
    customFieldValues: ContainerConfig['customFieldValues'],
    onConfigChange: <K extends keyof ContainerConfig>(key: K, value: ContainerConfig[K]) => void
) => {
    const handleCustomFieldChange = (customFieldId: string, value: string) => {
        onConfigChange('customFieldValues', {
            ...customFieldValues,
            [customFieldId]: value
        });
    };

    const renderCustomField = (customField: ContainerTemplateCustomField) => {
        const fieldValue = customFieldValues[customField.id] ?? '';
        const fieldError = getCustomFieldValidationError(customField, fieldValue) ?? undefined;
        const fieldLabel = customField.required ? `${customField.label} (required)` : customField.label;

        return (
            <Stack key={customField.id} gap='05'>
                <FormFieldRHF
                    label={fieldLabel}
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
        <Stack gap='1'>
            {customFields.map(renderCustomField)}
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
    const customFieldErrorCount = getCustomFieldValidationErrorCount(config.customFields, config.customFieldValues);
    const hasCustomFields = config.customFields.length > 0;
    const templateSettingsDefaultExpanded = hasRequiredCustomField(config.customFields);

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
                                label='Container Name'
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

                {hasCustomFields && (
                    <OptionalConfigSection
                        title='Template settings'
                        description='These options come from the selected template.'
                        defaultExpanded={templateSettingsDefaultExpanded}
                        errorCount={customFieldErrorCount}
                    >
                        {renderCustomFields(config.customFields, config.customFieldValues, onConfigChange)}
                    </OptionalConfigSection>
                )}

                <OptionalConfigSection
                    title='Network'
                    description='Optional public port mappings.'
                >
                    <EditableKeyValueCard<PortMappingFormItem>
                        items={portItems}
                        fields={PORT_FIELDS}
                        alwaysEditing
                        showCard={false}
                        onChange={(items) => onConfigChange('ports', items.map(getPortMappingFormItem))}
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
                        createEmpty={() => ({ key: '', value: '' })}
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
                </OptionalConfigSection>
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
