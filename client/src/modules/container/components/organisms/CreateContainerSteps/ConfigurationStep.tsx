import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import EditableKeyValueCard from '@/shared/presentation/components/EditableKeyValueCard';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Paragraph from '@/shared/presentation/components/Paragraph';
import SettingsSectionHeader from '@/shared/presentation/components/SettingsSectionHeader';
import Slider from '@/shared/presentation/components/Slider';
import Title from '@/shared/presentation/components/Title';
import { Cpu, HardDrive } from 'lucide-react';
import type { ContainerConfig } from '../../../hooks/use-create-container-form';
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

const MAX_CPU = 8;
const MAX_MEMORY = 8192;

interface ValueChangeTarget {
    value: string | boolean;
};

interface ConfigurationStepProps {
    config: ContainerConfig;
    teams: Team[];
    teamClusters: TeamClusterOption[];
    selectedTeamId: string | null;
    selectedTeamClusterId: string | null;
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

interface ResourceSummary {
    title: string;
    value: string;
    minLabel: string;
    maxLabel: string;
    icon: typeof Cpu;
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

const getClusterFieldError = (selectedTeamId: string | null, selectedTeamClusterId: string | null, teamClusters: TeamClusterOption[]) => {
    if (!selectedTeamId || selectedTeamClusterId) {
        return undefined;
    }

    if (teamClusters.length === 0) {
        return 'No clusters are available for the selected team.';
    }

    return 'Select a cluster to continue.';
};

const hasValueChangeTarget = (value: unknown): value is ValueChangeTarget => {
    return typeof value === 'object' && value !== null && 'value' in value;
};

const ConfigurationStep = ({
    config,
    teams,
    teamClusters,
    selectedTeamId,
    selectedTeamClusterId,
    canProceed,
    onConfigChange,
    onTeamChange,
    onTeamClusterChange,
    onBack,
    onNext
}: ConfigurationStepProps) => {
    const portItems: PortMappingFormItem[] = config.ports.map((item) => ({
        private: item.private,
        public: item.public
    }));
    const envItems: EnvVariableFormItem[] = config.env.map((item) => ({
        key: item.key,
        value: item.value
    }));
    const validationMessages: ValidationMessage[] = [];
    const teamFieldError = getTeamFieldError(selectedTeamId, teams);
    const clusterFieldError = getClusterFieldError(selectedTeamId, selectedTeamClusterId, teamClusters);
    const teamOptions: SelectOption[] = teams.map((team) => ({
        value: team._id,
        title: team.name
    }));
    const teamClusterOptions: SelectOption[] = teamClusters.map((teamCluster) => ({
        value: teamCluster._id,
        title: teamCluster.name
    }));
    const cpuResourceSummary: ResourceSummary = {
        title: 'CPU cores',
        value: `${config.cpus} vCPU`,
        minLabel: '0.5 vCPU',
        maxLabel: `${MAX_CPU} vCPU max`,
        icon: Cpu
    };
    const memoryResourceSummary: ResourceSummary = {
        title: 'Memory',
        value: `${config.memory} MB`,
        minLabel: '128 MB',
        maxLabel: `${MAX_MEMORY} MB max`,
        icon: HardDrive
    };
    const CpuResourceIcon = cpuResourceSummary.icon;
    const MemoryResourceIcon = memoryResourceSummary.icon;
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

    if (clusterFieldError) {
        validationMessages.push({
            key: 'cluster',
            label: clusterFieldError
        });
    }

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
                                options={teamClusterOptions}
                                placeholder='Select a cluster'
                                error={clusterFieldError}
                                disabled={!selectedTeamId || teamClusters.length === 0}
                            />
                        </Container>
                    </Container>
                </Container>

                <Container className='create-container-config-card full-width radius-md d-flex column gap-1 p-1-5'>
                    <SettingsSectionHeader
                        title='Resources'
                        description='Defaults work for most containers. Increase only when the workload needs it.'
                        className='create-container-config-section-header mb-1 pb-075'
                    />
                    <Container className='create-container-resource-row radius-sm p-1 mb-075'>
                        <Container className='d-flex content-between items-center create-container-resource-header mb-075'>
                            <span className='d-flex items-center gap-05 font-size-2 font-weight-5 color-secondary'>
                                <CpuResourceIcon size={16} /> {cpuResourceSummary.title}
                            </span>
                            <span className='create-container-resource-value radius-full font-weight-6'>{cpuResourceSummary.value}</span>
                        </Container>
                        <Slider
                            min={0.5}
                            max={MAX_CPU}
                            step={0.5}
                            value={config.cpus}
                            onChange={(val) => onConfigChange('cpus', val)}
                        />
                        <Container className='d-flex content-between font-size-1 color-muted'>
                            <span>{cpuResourceSummary.minLabel}</span>
                            <span>{cpuResourceSummary.maxLabel}</span>
                        </Container>
                    </Container>
                    <Container className='create-container-resource-row radius-sm p-1'>
                        <Container className='d-flex content-between items-center create-container-resource-header mb-075'>
                            <span className='d-flex items-center gap-05 font-size-2 font-weight-5 color-secondary'>
                                <MemoryResourceIcon size={16} /> {memoryResourceSummary.title}
                            </span>
                            <span className='create-container-resource-value radius-full font-weight-6'>{memoryResourceSummary.value}</span>
                        </Container>
                        <Slider
                            min={128}
                            max={MAX_MEMORY}
                            step={128}
                            value={config.memory}
                            onChange={(val) => onConfigChange('memory', val)}
                        />
                        <Container className='d-flex content-between font-size-1 color-muted'>
                            <span>{memoryResourceSummary.minLabel}</span>
                            <span>{memoryResourceSummary.maxLabel}</span>
                        </Container>
                    </Container>
                </Container>

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
                        onChange={(items) => onConfigChange('ports', items)}
                        createEmpty={() => ({ private: 80, public: 0 })}
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
