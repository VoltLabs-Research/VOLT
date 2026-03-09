import { Cpu, HardDrive } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Slider from '@/shared/presentation/components/Slider';
import EditableKeyValueCard from '@/shared/presentation/components/EditableKeyValueCard';
import SettingsSectionHeader from '@/shared/presentation/components/SettingsSectionHeader';
import Title from '@/shared/presentation/components/Title';
import type { Team } from '@/modules/team/api/entities/team/team';
import type { TeamClusterOption } from '@/modules/container/api/entities/team-cluster-option';
import type { ContainerConfig, EnvVariable, PortMapping } from '../../../hooks/use-create-container-form';

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
    onConfigChange: <K extends keyof ContainerConfig>(key: K, value: ContainerConfig[K]) => void;
    onTeamChange: (teamId: string | null) => void;
    onTeamClusterChange: (teamClusterId: string | null) => void;
    onBack: () => void;
    onNext: () => void;
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
    onConfigChange,
    onTeamChange,
    onTeamClusterChange,
    onBack,
    onNext
}: ConfigurationStepProps) => {
    return (
        <Container className='create-container-step d-flex column gap-2'>
            <Title className='font-size-5 font-weight-6'>Configure Container</Title>
            <Container className='create-container-config-grid gap-1-5 mt-1-5'>
                <Container className='create-container-config-section'>
                    <SettingsSectionHeader title='Basic Information' description={undefined} action={undefined} className='mb-1 pb-075' />
                    <Container className='create-container-field'>
                        <FormFieldRHF
                            label='Container Name'
                            placeholder='my-container-app'
                            value={config.name}
                            onChange={(e) => onConfigChange('name', e.target.value)}
                        />
                    </Container>
                </Container>

                <Container className='create-container-config-section select'>
                    <SettingsSectionHeader title='Team' description={undefined} action={undefined} className='mb-1 pb-075' />
                    <FormFieldRHF
                        variant='inline'
                        fieldType='select'
                        label='Assign to Team'
                        name='team'
                        value={selectedTeamId || ''}
                        onChange={(e) => onTeamChange(e.target.value || null)}
                        options={teams.map((team) => ({
                            value: team._id,
                            title: team.name
                        }))}
                        placeholder='Select a team'
                    />
                </Container>

                <Container className='create-container-config-section select'>
                    <SettingsSectionHeader title='Cluster' description={undefined} action={undefined} className='mb-1 pb-075' />
                    <FormFieldRHF
                        variant='inline'
                        fieldType='select'
                        label='Deploy to Cluster'
                        name='teamCluster'
                        value={selectedTeamClusterId || ''}
                        onChange={(e) => onTeamClusterChange(e.target.value || null)}
                        options={teamClusters.map((teamCluster) => ({
                            value: teamCluster._id,
                            title: teamCluster.name
                        }))}
                        placeholder='Select a cluster'
                    />
                </Container>

                <Container className='create-container-config-section full-width'>
                    <SettingsSectionHeader title='Resources' description={undefined} action={undefined} className='mb-1 pb-075' />
                    <Container className='create-container-resource-row radius-sm p-1 mb-075'>
                        <Container className='d-flex content-between items-center create-container-resource-header mb-075'>
                            <span className='d-flex items-center gap-05 font-size-2 font-weight-5 color-secondary'>
                                <Cpu size={16} /> CPU Cores
                            </span>
                            <span className='create-container-resource-value radius-full font-weight-6'>{config.cpus} vCPU</span>
                        </Container>
                        <Slider
                            min={0.5}
                            max={MAX_CPU}
                            step={0.5}
                            value={config.cpus}
                            onChange={(val) => onConfigChange('cpus', val)}
                        />
                        <Container className='d-flex content-between font-size-1 color-muted'>
                            <span>0.5 vCPU</span>
                            <span>{MAX_CPU} vCPU (Max)</span>
                        </Container>
                    </Container>
                    <Container className='create-container-resource-row radius-sm p-1'>
                        <Container className='d-flex content-between items-center create-container-resource-header mb-075'>
                            <span className='d-flex items-center gap-05 font-size-2 font-weight-5 color-secondary'>
                                <HardDrive size={16} /> Memory
                            </span>
                            <span className='create-container-resource-value radius-full font-weight-6'>{config.memory} MB</span>
                        </Container>
                        <Slider
                            min={128}
                            max={MAX_MEMORY}
                            step={128}
                            value={config.memory}
                            onChange={(val) => onConfigChange('memory', val)}
                        />
                        <Container className='d-flex content-between font-size-1 color-muted'>
                            <span>128 MB</span>
                            <span>{MAX_MEMORY} MB (Max)</span>
                        </Container>
                    </Container>
                </Container>

                <Container className='create-container-config-section'>
                    <EditableKeyValueCard<PortMapping>
                        title='Port Mapping'
                        items={config.ports}
                        fields={[
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
                        ]}
                        alwaysEditing
                        showCard={false}
                        onChange={(items) => onConfigChange('ports', items)}
                        createEmpty={() => ({ private: 80, public: 0 })}
                        emptyMessage='No ports exposed'
                    />
                </Container>

                <Container className='create-container-config-section'>
                    <EditableKeyValueCard<EnvVariable>
                        title='Environment Variables'
                        items={config.env}
                        fields={[
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
                        ]}
                        alwaysEditing
                        showCard={false}
                        onChange={(items) => onConfigChange('env', items)}
                        createEmpty={() => ({ key: '', value: '' })}
                        emptyMessage='No environment variables'
                    />
                </Container>

                <Container className='create-container-config-card radius-md d-flex column gap-05 p-1-5'>
                    <FormFieldRHF
                        variant='inline'
                        fieldType='checkbox'
                        label='Enable Docker Access'
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
                    <Paragraph className='font-size-2 color-muted'>Mounts /var/run/docker.sock to allow container management</Paragraph>
                </Container>
            </Container>

            <Container className='d-flex content-end gap-1 create-container-step-actions mt-2'>
                <Button variant='outline' intent='neutral' onClick={onBack}>Back</Button>
                <Button variant='solid' intent='brand' onClick={onNext}>Next: Review</Button>
            </Container>
        </Container>
    );
};

export default ConfigurationStep;
