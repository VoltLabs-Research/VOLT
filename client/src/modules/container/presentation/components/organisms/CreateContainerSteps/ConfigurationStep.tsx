import { Cpu, HardDrive } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import FormField from '@/shared/presentation/components/FormField';
import Slider from '@/shared/presentation/components/Slider';
import EditableKeyValueCard from '@/shared/presentation/components/EditableKeyValueCard';
import type { ContainerConfig, PortMapping, EnvVariable } from '../../../hooks/use-create-container-form';

const MAX_CPU = 8;
const MAX_MEMORY = 8192;

interface ConfigurationStepProps{
    config: ContainerConfig;
    teams: { _id: string; name: string }[];
    selectedTeamId: string | null;
    onConfigChange: <K extends keyof ContainerConfig>(key: K, value: ContainerConfig[K]) => void;
    onTeamChange: (teamId: string | null) => void;
    onBack: () => void;
    onNext: () => void;
}

const ConfigurationStep = ({
    config,
    teams,
    selectedTeamId,
    onConfigChange,
    onTeamChange,
    onBack,
    onNext
}: ConfigurationStepProps) => {
    return (
        <Container className='create-container-step d-flex column gap-2'>
            <Title className='font-size-5 font-weight-6'>Configure Container</Title>
            <Container className='create-container-config-grid gap-1-5 mt-1-5'>
                <Container className='create-container-config-section'>
                    <Container className='create-container-config-section-header mb-1 pb-075'>
                        <Title className='font-size-3 font-weight-6'>Basic Information</Title>
                    </Container>
                    <Container className='create-container-field'>
                        <FormField
                            label='Container Name'
                            placeholder='my-container-app'
                            value={config.name}
                            onChange={(e) => onConfigChange('name', e.target.value)}
                        />
                    </Container>
                </Container>

                <Container className='create-container-config-section select'>
                    <Container className='create-container-config-section-header mb-1 pb-075'>
                        <Title className='font-size-3 font-weight-6'>Team</Title>
                    </Container>
                    <FormField
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

                <Container className='create-container-config-section full-width'>
                    <Container className='create-container-config-section-header mb-1 pb-075'>
                        <Title className='font-size-3 font-weight-6'>Resources</Title>
                    </Container>
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
                            { key: 'private', placeholder: 'Container', type: 'number', label: 'Private' },
                            { key: 'public', placeholder: 'Auto', type: 'number', label: 'Public' }
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
                            { key: 'key', placeholder: 'KEY', type: 'text', label: 'Key' },
                            { key: 'value', placeholder: 'VALUE', type: 'text', label: 'Value' }
                        ]}
                        alwaysEditing
                        showCard={false}
                        onChange={(items) => onConfigChange('env', items)}
                        createEmpty={() => ({ key: '', value: '' })}
                        emptyMessage='No environment variables'
                    />
                </Container>

                <Container className='create-container-config-card radius-md d-flex column gap-05 p-1-5'>
                    <FormField
                        variant='inline'
                        fieldType='checkbox'
                        label='Enable Docker Access'
                        name='mountDockerSocket'
                        value={config.mountDockerSocket}
                        onChange={(e) => onConfigChange('mountDockerSocket', e.target.checked)}
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
