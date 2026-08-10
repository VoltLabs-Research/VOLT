import EditableKeyValueCard from '@/shared/ui/components/EditableKeyValueCard';
import { Divider, KeyValueList, KeyValueRow } from '@voltstack/bravais';
import { formatSize } from '@/shared/utils/format';
import ContainerMetricTile from '../ContainerMetricTile';
import ContainerInspectorList from '../ContainerInspectorList';
import ContainerPortBindingsCard from './ContainerPortBindingsCard';
import useContainerMetricsHistory from '@/modules/container/hooks/use-container-metrics-history';
import { buildContainerInspectorRows } from '@/modules/container/utils/build-container-inspector-rows';
import useTip from '@/shared/tips/use-tip';
import type { Container as ContainerEntity } from '@volt/contracts/modules/container/domain';
import type { EnvVariable } from '@volt/contracts/modules/container/domain';
import type { PortMapping } from '@volt/contracts/modules/container/domain';
import type { ContainerStatsViewData } from '@/modules/container/services/container-stats-view';
import type { EnvVariableFormItem } from '@/modules/container/contracts/forms';
import './ContainerOverview.css';

const METRIC_COLOR = 'var(--color-text-muted)';

const BYTES_PER_MB = 1024 * 1024;

interface ContainerOverviewProps {
    container: ContainerEntity;
    stats: ContainerStatsViewData;
    onUpdateEnv: (env: EnvVariable[]) => Promise<void>;
    onUpdatePorts: (ports: PortMapping[]) => Promise<void>;
}

const ContainerOverview = ({ container, stats, onUpdateEnv, onUpdatePorts }: ContainerOverviewProps) => {
    useTip('container-env-vars');

    const isRunning = container.status === 'running';
    const history = useContainerMetricsHistory(stats);

    const envItems: EnvVariableFormItem[] = container.env.map((item) => ({
        key: item.key,
        value: item.value
    }));

    return (
        <div className='flex flex-col container-overview'>
            <div className='container-overview-metrics'>
                <ContainerMetricTile
                    label='CPU'
                    value={stats.cpu ? `${stats.cpu.usage.toFixed(1)}%` : '—'}
                    badge={stats.cpu ? `${stats.cpu.cores} ${stats.cpu.cores === 1 ? 'core' : 'cores'}` : undefined}
                    history={history.cpu.values}
                    color={METRIC_COLOR}
                    isLoading={!isRunning}
                    secondary={[
                        {
                            label: 'Peak',
                            value: `${history.cpu.peak.toFixed(1)}%`
                        },
                        {
                            label: 'Avg',
                            value: `${history.cpu.avg.toFixed(1)}%`
                        }
                    ]}
                />

                <ContainerMetricTile
                    label='Memory'
                    value={stats.memory ? formatSize(stats.memory.used * BYTES_PER_MB) : '—'}
                    badge={stats.memory ? `of ${formatSize(stats.memory.total * BYTES_PER_MB)}` : undefined}
                    history={history.memory.values}
                    color={METRIC_COLOR}
                    isLoading={!isRunning}
                    secondary={[
                        {
                            label: 'Peak',
                            value: formatSize(history.memory.peak * BYTES_PER_MB)
                        },
                        {
                            label: 'Avg',
                            value: formatSize(history.memory.avg * BYTES_PER_MB)
                        }
                    ]}
                />

                <ContainerMetricTile
                    label='Network'
                    value={stats.network ? formatSize(stats.network.rx + stats.network.tx) : '—'}
                    history={history.network.values}
                    color={METRIC_COLOR}
                    isLoading={!isRunning}
                    secondary={[
                        {
                            label: 'Rx',
                            value: stats.network ? formatSize(stats.network.rx) : '0 B'
                        },
                        {
                            label: 'Tx',
                            value: stats.network ? formatSize(stats.network.tx) : '0 B'
                        }
                    ]}
                />
            </div>

            <Divider className='mt-8 mb-8' />

            <div className='container-overview-inspector'>
                <ContainerInspectorList title='Information' rows={buildContainerInspectorRows(container)} />

                <div className='container-overview-inspector-side'>
                    <EditableKeyValueCard<EnvVariableFormItem>
                        title='Environment Variables'
                        titleClassName='container-overview-section-title'
                        items={envItems}
                        fields={[
                            {
                                key: 'key',
                                placeholder: 'Key'
                            },
                            {
                                key: 'value',
                                placeholder: 'Value'
                            }
                        ]}
                        emptyMessage='No environment variables'
                        onSave={onUpdateEnv}
                        createEmpty={() => ({
                            key: '',
                            value: ''
                        })}
                        showCard={false}
                        className='flex flex-col'
                        renderItem={(item, i) => (
                            <KeyValueList key={i}>
                                <KeyValueRow label={item.key} value={item.value} />
                            </KeyValueList>
                        )}
                    />

                    <ContainerPortBindingsCard container={container} onUpdatePorts={onUpdatePorts} />
                </div>
            </div>
        </div>
    );
};

export default ContainerOverview;
