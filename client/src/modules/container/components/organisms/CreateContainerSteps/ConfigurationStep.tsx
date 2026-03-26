import Button from '@/shared/presentation/components/Button';
import ClusterResourceSelectionPanel from '@/modules/container/components/molecules/ClusterResourceSelectionPanel';
import Container from '@/shared/presentation/components/Container';
import EditableKeyValueCard from '@/shared/presentation/components/EditableKeyValueCard';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Paragraph from '@/shared/presentation/components/Paragraph';
import SettingsSectionHeader from '@/shared/presentation/components/SettingsSectionHeader';
import Title from '@/shared/presentation/components/Title';
import { getCustomFieldValidationError } from '../../../hooks/use-create-container-form';
import { ContainerTemplateCustomFieldType } from '../../../api/entities/container-template';
import type { ContainerConfig } from '../../../hooks/use-create-container-form';
import type { ClusterResourceLimits } from '../../../api/entities/cluster-resource-limits';
import type { ContainerTemplateCustomField } from '../../../api/entities/container-template';
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

const CONTAINER_USERNAME_ENV_KEY = 'CONTAINER_USERNAME';

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

interface ValidationMessage {
    key: string;
    label: string;
};

interface CustomFieldValidationMessage {
    key: string;
    label: string;
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

const getCustomFieldValidationMessages = (
    customFields: ContainerTemplateCustomField[],
    customFieldValues: ContainerConfig['customFieldValues']
): CustomFieldValidationMessage[] => {
    return customFields.reduce<CustomFieldValidationMessage[]>((messages, customField) => {
        const customFieldValue = customFieldValues[customField.id] ?? '';
        const validationError = getCustomFieldValidationError(customField, customFieldValue);
        if (!validationError) {
            return messages;
        }

        messages.push({
            key: customField.id,
            label: validationError
        });

        return messages;
    }, []);
};

const getCustomFieldType = (customField: ContainerTemplateCustomField) => {
    if (customField.type === ContainerTemplateCustomFieldType.Password) {
        return 'password';
    }

    return 'text';
};

const getCustomFieldInputProps = (customField: ContainerTemplateCustomField) => {
    if (customField.env?.key !== CONTAINER_USERNAME_ENV_KEY) {
        return undefined;
    }

    return {
        autoComplete: 'username',
        autoCapitalize: 'none',
        spellCheck: false,
        pattern: customField.pattern
    };
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
            <Container key={customField.id} className='d-flex column gap-05'>
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
                            : 'off',
                        ...getCustomFieldInputProps(customField)
                    }}
                    className='w-full'
                />
                {customField.description && (
                    <Paragraph className='font-size-2 color-muted'>{customField.description}</Paragraph>
                )}
            </Container>
        );
    };

    const hasContainerUsernameField = customFields.some((customField) => customField.env?.key === CONTAINER_USERNAME_ENV_KEY);

    return (
        <Container className='create-container-config-card full-width radius-md d-flex column gap-1 p-1-5'>
            <SettingsSectionHeader
                title='Template settings'
                description='These options come from the selected template.'
                className='create-container-config-section-header mb-1 pb-075'
            />
            {hasContainerUsernameField && (
                <Paragraph className='font-size-2 color-secondary'>The shared password will be used for the Linux user inside the container and for VNC remote desktop access.</Paragraph>
            )}
            <Container className='d-flex column gap-1'>
                {customFields.map(renderCustomField)}
            </Container>
        </Container>
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
    const validationMessages: ValidationMessage[] = [];
    const teamFieldError = getTeamFieldError(selectedTeamId, teams);
    const teamOptions: SelectOption[] = teams.map((team) => ({
        value: team._id,
        title: team.name
    }));
    const customFieldValidationMessages = getCustomFieldValidationMessages(config.customFields, config.customFieldValues);
    if (!config.name.trim()) {
        validationMessages.push({
            key: 'name',
            label: 'Add a container name'
        });
    }

    if (teamFieldError) {
        validationMessages.push({
            key: 'team',
            label: teamFieldError
        });
    }

    if (!selectedTeamId || !selectedTeamClusterId) {
        validationMessages.push({
            key: 'cluster',
            label: 'Select a cluster to continue.'
        });
    }

    if (selectedTeamClusterId && !isLoadingResourceLimits && (!clusterResourceLimits?.maxCpus || !clusterResourceLimits?.maxMemoryMB)) {
        validationMessages.push({
            key: 'clusterMetrics',
            label: 'Wait for cluster resource metrics before continuing.'
        });
    }

    validationMessages.push(...customFieldValidationMessages);

    const remainingItemsLabel = `${validationMessages.length} required item${validationMessages.length === 1 ? '' : 's'} remaining before review.`;

    return (
        <Container className='create-container-step d-flex column gap-2'>
            <Container className='d-flex column gap-05'>
                <Title className='font-size-5 font-weight-6'>Configuration</Title>
                <Paragraph className='font-size-3 color-secondary create-container-step-copy'>Fill in the required deployment details, then adjust optional settings only if needed.</Paragraph>
            </Container>

            {validationMessages.length > 0 && (
                <Container className='create-container-validation-notice d-flex column gap-05 radius-sm p-1' role='status' aria-live='polite'>
                    <Title as='h3' className='font-size-2-5 font-weight-6'>Finish these before review</Title>
                    <ul className='create-container-validation-list d-flex column gap-025'>
                        {validationMessages.map((message) => (
                            <li key={message.key} className='font-size-2 color-secondary'>{message.label}</li>
                        ))}
                    </ul>
                </Container>
            )}

            <Container className='create-container-config-grid gap-1-5 mt-1-5'>
                <Container className='create-container-config-card full-width radius-md d-flex column gap-1 p-1-5'>
                    <SettingsSectionHeader
                        title='Deployment details'
                        description='These fields are required before you can continue to review.'
                        className='create-container-config-section-header mb-1 pb-075'
                    />
                    <Container className='create-container-deployment-fields'>
                        <Container className='create-container-deployment-name'>
                            <FormFieldRHF
                                label='Name'
                                placeholder='my-container-app'
                                value={config.name}
                                onChange={(e) => onConfigChange('name', e.target.value)}
                                error={!config.name.trim() ? 'A container name is required before review.' : undefined}
                                className='w-full'
                            />
                        </Container>
                        <Container className='create-container-deployment-selects d-flex gap-1 column'>
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
                            <FormFieldRHF
                                fieldType='select'
                                label='Cluster'
                                name='teamCluster'
                                value={selectedTeamClusterId || ''}
                                onChange={(e) => onTeamClusterChange(e.target.value || null)}
                                options={teamClusters.map((teamCluster) => ({
                                    value: teamCluster._id,
                                    title: teamCluster.name
                                }))}
                                placeholder='Select a cluster'
                                error={!selectedTeamId || selectedTeamClusterId ? undefined : 'Select a cluster to continue.'}
                                disabled={!selectedTeamId || teamClusters.length === 0}
                            />
                        </Container>
                    </Container>
                </Container>

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

                <Container className='create-container-config-card radius-md d-flex column gap-1 p-1-5'>
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
                </Container>

                <Container className='create-container-config-card radius-md d-flex column gap-1 p-1-5'>
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
                </Container>

                {renderCustomFieldsSection(config.customFields, config.customFieldValues, onConfigChange)}

                <Container className='create-container-config-card full-width radius-md d-flex column gap-1 p-1-5'>
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
                    <Paragraph className='font-size-2 color-muted'>Mounts /var/run/docker.sock inside the container.</Paragraph>
                </Container>
            </Container>

            <Container className='create-container-step-actions d-flex items-center content-between gap-1 mt-2'>
                <Paragraph className='font-size-2 color-secondary'>
                    {canProceed ? 'Required fields complete. Continue when you are ready.' : remainingItemsLabel}
                </Paragraph>
                <Container className='d-flex gap-1 create-container-step-actions-buttons'>
                    <Button variant='outline' intent='neutral' onClick={onBack}>Back</Button>
                    <Button variant='solid' intent='brand' onClick={onNext} disabled={!canProceed}>Continue to review</Button>
                </Container>
            </Container>
        </Container>
    );
};

export default ConfigurationStep;
