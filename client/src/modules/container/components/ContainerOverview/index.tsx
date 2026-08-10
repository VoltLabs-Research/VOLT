import EditableKeyValueCard from '@/shared/ui/components/EditableKeyValueCard';
import { Separator } from '@heroui/react';
import { formatSize } from '@/shared/utils/format';
import ContainerMetricTile from '../ContainerMetricTile';
import ContainerInspectorList from '../ContainerInspectorList';
import ContainerPortBindingsCard from './ContainerPortBindingsCard';
import { ContainerKeyValueList, ContainerKeyValueRow } from '../ContainerKeyValueList';
import { OVERVIEW_SECTION_TITLE_CLASS_NAMES } from './section-title';
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

/**
 * `ContainerOverview.css` was the one sheet in this module the inventory flagged
 * bespoke, for the hairline between the three metric tiles:
 *
 *   .container-overview-metrics > * + *::before {
 *       content: ''; position: absolute; top: 0; bottom: 0;
 *       left: calc(-1.25rem - 0.5px); width: 1px; background: var(--color-border-soft);
 *   }
 *
 * It needs the adjacent-sibling combinator *and* a pseudo-element, and the
 * half-pixel calc is what lands it on the centre of the 2.5rem gap. Both are
 * reachable from a class after all — an arbitrary child variant composed with
 * Tailwind's `before:` variant — so it stays at the call site rather than moving
 * into the global sheet. Under 820px the same rule turns 90°: the divider becomes
 * a horizontal hairline sitting on the centre of the 1.25rem gap, which is why the
 * `max-[820px]:` arm restates `inset-x-0`, `bottom-auto`, `w-auto` and `h-px`.
 *
 * `animation: animate-fade-in 0.3s ease-out` was a bravais keyframe (opacity 0→1
 * plus `translateY(10px)→0`). `tw-animate-css` ships with `@heroui/styles`, so
 * `animate-in fade-in-0 slide-in-from-bottom-[10px]` is the same animation with no
 * keyframes to declare, and `motion-reduce:animate-none` restates the sheet's own
 * `prefers-reduced-motion` opt-out.
 */
const OVERVIEW_CLASS_NAMES = 'mx-auto flex w-full max-w-[1400px] flex-col px-10 py-8 max-[820px]:px-5 max-[820px]:py-5 animate-in fade-in-0 slide-in-from-bottom-[10px] duration-300 ease-out motion-reduce:animate-none';

const METRICS_GRID_CLASS_NAMES = 'relative grid grid-cols-3 gap-10 max-[820px]:grid-cols-1 max-[820px]:gap-5 [&>*]:relative [&>*+*]:before:absolute [&>*+*]:before:inset-y-0 [&>*+*]:before:left-[calc(-1.25rem-0.5px)] [&>*+*]:before:w-px [&>*+*]:before:bg-border [&>*+*]:before:content-[""] max-[820px]:[&>*+*]:before:inset-x-0 max-[820px]:[&>*+*]:before:bottom-auto max-[820px]:[&>*+*]:before:top-[calc(-0.625rem-0.5px)] max-[820px]:[&>*+*]:before:h-px max-[820px]:[&>*+*]:before:w-auto';

const INSPECTOR_GRID_CLASS_NAMES = 'grid grid-cols-[minmax(0,5fr)_minmax(0,4fr)] items-start gap-14 max-[1100px]:grid-cols-1 max-[1100px]:gap-8';

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
        <div className={OVERVIEW_CLASS_NAMES}>
            <div className={METRICS_GRID_CLASS_NAMES}>
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

            <div className={INSPECTOR_GRID_CLASS_NAMES}>
                <ContainerInspectorList title='Information' rows={buildContainerInspectorRows(container)} />

                <div className='flex flex-col gap-8'>
                    <EditableKeyValueCard<EnvVariableFormItem>
                        title='Environment Variables'
                        titleClassName={OVERVIEW_SECTION_TITLE_CLASS_NAMES}
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
