import CpuChart from '../../molecules/CpuChart';
import MemoryChart from '../../molecules/MemoryChart';
import Container from '@/shared/presentation/components/Container';
import NetworkChart from '@/shared/presentation/components/NetworkChart';
import Title from '@/shared/presentation/components/Title';
import EditableKeyValueCard from '@/shared/presentation/components/EditableKeyValueCard';
import type { Container as ContainerEntity } from '@/modules/container/api/entities/container';
import type { EnvVariable } from '@/modules/container/api/entities/env-variable';
import type { PortMapping } from '@/modules/container/api/entities/port-mapping';
import type { ContainerStatsViewData } from '@/modules/container/services/container-stats-view';

interface EnvVariableFormItem extends Record<string, unknown> {
    key: string;
    value: string;
};

interface PortMappingFormItem extends Record<string, unknown> {
    private: number;
    public?: number;
};

interface ContainerOverviewProps {
    container: ContainerEntity;
    stats: ContainerStatsViewData;
    onUpdateEnv: (env: EnvVariable[]) => Promise<void>;
    onUpdatePorts: (ports: PortMapping[]) => Promise<void>;
};

const ContainerOverview = ({ container, stats, onUpdateEnv, onUpdatePorts }: ContainerOverviewProps) => {
    const isRunning = container.status === 'running';
    const envItems: EnvVariableFormItem[] = (container.env || []).map((item) => ({
        key: item.key,
        value: item.value
    }));
    const portItems: PortMappingFormItem[] = container.ports.map((item) => ({
        private: item.private,
        public: item.public
    }));

    return (
        <Container className='container-details-pane p-1 d-flex column gap-2 h-max'>
            <Container className='d-flex content-between container-details-pane-header'>
                <Title className='font-size-4 font-weight-6'>Overview</Title>
                <Container className='d-flex gap-075 container-details-meta-tags'>
                    <span className='d-flex items-center gap-05 container-details-tag font-family-mono font-size-1 font-weight-5 color-muted'>
                        ID: {container.containerId.substring(0, 12)}
                    </span>
                    <span className='d-flex items-center gap-05 container-details-tag font-size-1 font-weight-5 color-muted'>
                        Image: {container.image}
                    </span>
                    <span className='d-flex items-center gap-05 container-details-tag font-size-1 font-weight-5 color-muted'>
                        Created: {new Date(container.createdAt).toLocaleDateString()}
                    </span>
                </Container>
            </Container>

            <Container className='container-details-stats-grid gap-2'>
                <CpuChart data={stats.cpu} isLoading={!isRunning} />
                <MemoryChart data={stats.memory} isLoading={!isRunning} unit='MB' />
            </Container>

            <Container className='container-details-stats-grid gap-2'>
                <NetworkChart data={stats.network} isLoading={!isRunning} />
            </Container>

            <Container className='container-details-config-grid gap-2'>
                <EditableKeyValueCard<EnvVariableFormItem>
                    title='Environment Variables'
                    items={envItems}
                    fields={[
                        { key: 'key', placeholder: 'Key' },
                        { key: 'value', placeholder: 'Value' }
                    ]}
                    emptyMessage='No environment variables'
                    onSave={onUpdateEnv}
                    createEmpty={() => ({ key: '', value: '' })}
                    renderItem={(item, i) => (
                        <Container key={i} className='editable-kv-display-row d-flex content-between'>
                            <span className='font-weight-6'>{item.key}</span>
                            <span className='color-muted font-family-mono'>{item.value}</span>
                        </Container>
                    )}
                />

                <EditableKeyValueCard<PortMappingFormItem>
                    title='Port Bindings'
                    items={portItems}
                    fields={[
                        {
                            key: 'private',
                            placeholder: 'Container Port',
                            type: 'number'
                        },
                        {
                            key: 'public',
                            placeholder: 'Host Port',
                            type: 'number'
                        }
                    ]}
                    emptyMessage='No ports exposed'
                    onSave={onUpdatePorts}
                    createEmpty={() => ({ private: 0 })}
                    renderItem={(item, i) => {
                        const resolvedPublicPort = typeof item.public === 'number' && item.public > 0
                            ? item.public
                            : null;

                        return (
                            <Container key={i} className='editable-kv-display-row d-flex content-between'>
                                <span className='color-secondary font-weight-6 font-family-mono'>{item.private}/tcp</span>
                                {resolvedPublicPort !== null && (
                                    <Container className='d-flex gap-05 items-center'>
                                        <span className='color-muted'>→</span>
                                        <span className='font-family-mono'>{resolvedPublicPort}</span>
                                    </Container>
                                )}
                            </Container>
                        );
                    }}
                />
            </Container>
        </Container>
    );
};

export default ContainerOverview;
