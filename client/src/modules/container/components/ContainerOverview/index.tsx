import EditableKeyValueCard from '@/shared/ui/components/EditableKeyValueCard';
import { Separator } from '@heroui/react';
import { formatSize } from '@/shared/utils/format';
import ContainerMetricTile from '../ContainerMetricTile';
import ContainerInspectorList from '../ContainerInspectorList';
import ContainerPortBindingsCard from './ContainerPortBindingsCard';
import { ContainerKeyValueList, ContainerKeyValueRow } from '../ContainerKeyValueList';
import useContainerMetricsHistory from '@/modules/container/hooks/use-container-metrics-history';
import { buildContainerInspectorRows } from '@/modules/container/utils/build-container-inspector-rows';
import useTip from '@/shared/tips/use-tip';
import type { Container as ContainerEntity } from '@volt/contracts/modules/container/domain';
import type { EnvVariable } from '@volt/contracts/modules/container/domain';
import type { PortMapping } from '@volt/contracts/modules/container/domain';
import type { ContainerStatsViewData } from '@/modules/container/services/container-stats-view';
import type { EnvVariableFormItem } from '@/modules/container/contracts/forms';

const METRIC_COLOR = 'var(--muted)';

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
        <div className='mx-auto flex w-full max-w-[1400px] flex-col px-10 py-8 max-[820px]:px-5 max-[820px]:py-5 animate-in fade-in-0 slide-in-from-bottom-[10px] duration-300 ease-out motion-reduce:animate-none'>
            <div className='relative grid grid-cols-3 gap-10 max-[820px]:grid-cols-1 max-[820px]:gap-5 [&>*]:relative [&>*+*]:before:absolute [&>*+*]:before:inset-y-0 [&>*+*]:before:left-[calc(-1.25rem-0.5px)] [&>*+*]:before:w-px [&>*+*]:before:bg-border [&>*+*]:before:content-[""] max-[820px]:[&>*+*]:before:inset-x-0 max-[820px]:[&>*+*]:before:bottom-auto max-[820px]:[&>*+*]:before:top-[calc(-0.625rem-0.5px)] max-[820px]:[&>*+*]:before:h-px max-[820px]:[&>*+*]:before:w-auto'>
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
            <Separator className='mt-8 mb-8' />
            <div className='grid grid-cols-[minmax(0,5fr)_minmax(0,4fr)] items-start gap-14 max-[1100px]:grid-cols-1 max-[1100px]:gap-8'>
                <ContainerInspectorList title='Information' rows={buildContainerInspectorRows(container)} />
                <div className='flex flex-col gap-8'>
                    <EditableKeyValueCard<EnvVariableFormItem>
                        title='Environment Variables'
                        titleClassName='mt-0 mb-2 text-[0.9375rem] font-semibold tracking-[-0.01em] text-foreground'
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
                            <ContainerKeyValueList key={i}>
                                <ContainerKeyValueRow label={item.key} value={item.value} />
                            </ContainerKeyValueList>
                        )}
                    />
                    <ContainerPortBindingsCard container={container} onUpdatePorts={onUpdatePorts} />
                </div>
            </div>
        </div>
    );
};

export default ContainerOverview;
