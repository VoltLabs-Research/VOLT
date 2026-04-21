import { useEffect, useMemo, useRef } from 'react';
import { format, formatDistanceStrict } from 'date-fns';
import Container from '@/shared/presentation/components/Container';
import EditableKeyValueCard from '@/shared/presentation/components/EditableKeyValueCard';
import Button from '@/shared/presentation/components/Button';
import Title from '@/shared/presentation/components/Title';
import { formatSize } from '@/shared/utils/format';
import ContainerMetricTile from '../../molecules/ContainerMetricTile';
import ContainerInspectorList from '../../molecules/ContainerInspectorList';
import useTimeSeriesBuffer from '@/modules/container/hooks/use-time-series-buffer';
import { useOpenContainerPort } from '@/modules/container/hooks/use-open-container-port';
import useTip from '@/shared/tips/use-tip';
import type { Container as ContainerEntity } from '@/modules/container/api/entities/container';
import type { EnvVariable } from '@/modules/container/api/entities/env-variable';
import type { PortMapping } from '@/modules/container/api/entities/port-mapping';
import type { ContainerStatsViewData } from '@/modules/container/services/container-stats-view';
import type { InspectorRow } from '../../molecules/ContainerInspectorList';
import './ContainerOverview.css';

const HISTORY_POINTS = 60;

const METRIC_COLOR = 'var(--color-text-muted)';

interface EnvVariableFormItem extends Record<string, unknown> {
    key: string;
    value: string;
};

interface PortMappingFormItem extends Record<string, unknown> {
    private: number;
    public?: number;
};

interface MetricPoint {
    v: number;
};

interface ContainerOverviewProps {
    container: ContainerEntity;
    stats: ContainerStatsViewData;
    onUpdateEnv: (env: EnvVariable[]) => Promise<void>;
    onUpdatePorts: (ports: PortMapping[]) => Promise<void>;
};

const formatMb = (value: number): string => {
    if (value >= 1024) {
        return `${(value / 1024).toFixed(1)} GB`;
    }
    return `${value.toFixed(0)} MB`;
};

const computePeakAvg = (values: number[]) => {
    if (!values.length) return { peak: 0, avg: 0 };
    const peak = Math.max(...values);
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    return { peak, avg };
};

const ContainerOverview = ({ container, stats, onUpdateEnv, onUpdatePorts }: ContainerOverviewProps) => {
    useTip('container-env-vars');

    const isRunning = container.status === 'running';
    const { openPort, openingPort } = useOpenContainerPort();

    const cpuBuffer = useTimeSeriesBuffer<MetricPoint>({ maxPoints: HISTORY_POINTS });
    const memoryBuffer = useTimeSeriesBuffer<MetricPoint>({ maxPoints: HISTORY_POINTS });
    const networkBuffer = useTimeSeriesBuffer<MetricPoint>({ maxPoints: HISTORY_POINTS });
    const prevNetworkRef = useRef<{ rx: number; tx: number } | null>(null);

    useEffect(() => {
        if (!stats.cpu) return;
        cpuBuffer.pushPoint({ v: stats.cpu.usage });
    }, [stats.cpu, cpuBuffer]);

    useEffect(() => {
        if (!stats.memory) return;
        memoryBuffer.pushPoint({ v: stats.memory.used });
    }, [stats.memory, memoryBuffer]);

    useEffect(() => {
        if (!stats.network) return;
        const prev = prevNetworkRef.current;
        if (prev) {
            const deltaRx = Math.max(0, stats.network.rx - prev.rx);
            const deltaTx = Math.max(0, stats.network.tx - prev.tx);
            networkBuffer.pushPoint({ v: deltaRx + deltaTx });
        }
        prevNetworkRef.current = { rx: stats.network.rx, tx: stats.network.tx };
    }, [stats.network, networkBuffer]);

    const cpuValues = useMemo(() => cpuBuffer.history.map((p) => p.v), [cpuBuffer.history]);
    const memoryValues = useMemo(() => memoryBuffer.history.map((p) => p.v), [memoryBuffer.history]);
    const networkValues = useMemo(() => networkBuffer.history.map((p) => p.v), [networkBuffer.history]);

    const cpuDerived = useMemo(() => computePeakAvg(cpuValues), [cpuValues]);
    const memoryDerived = useMemo(() => computePeakAvg(memoryValues), [memoryValues]);

    const cpuValue = stats.cpu ? `${stats.cpu.usage.toFixed(1)}%` : '—';
    const memoryValue = stats.memory ? formatMb(stats.memory.used) : '—';
    const networkValue = stats.network ? formatSize(stats.network.rx + stats.network.tx) : '—';

    const inspectorRows: InspectorRow[] = [
        {
            label: 'Image',
            value: container.image,
            copyValue: container.image
        },
        {
            label: 'Container ID',
            value: container.containerId.substring(0, 12),
            copyValue: container.containerId
        },
        ...(container.internalIp
            ? [{ label: 'Internal IP', value: container.internalIp, copyValue: container.internalIp }]
            : []),
        {
            label: 'CPU limit',
            value: `${container.cpus} ${container.cpus === 1 ? 'core' : 'cores'}`
        },
        {
            label: 'Memory limit',
            value: formatMb(container.memory)
        },
        ...(container.network ? [{ label: 'Network', value: container.network }] : []),
        ...(container.volume ? [{ label: 'Volume', value: container.volume }] : []),
        {
            label: 'Created',
            value: format(new Date(container.createdAt), 'PP · p')
        },
        ...(isRunning
            ? [{ label: 'Uptime', value: formatDistanceStrict(new Date(container.createdAt), new Date()) }]
            : [])
    ];

    const envItems: EnvVariableFormItem[] = (container.env || []).map((item) => ({
        key: item.key,
        value: item.value
    }));

    const portItems: PortMappingFormItem[] = container.ports.map((item) => ({
        private: item.private,
        public: item.public
    }));

    return (
        <Container className='container-overview p-1-5 d-flex column'>
            <Container className='container-overview-metrics'>
                <ContainerMetricTile
                    label='CPU'
                    value={cpuValue}
                    badge={stats.cpu ? `${stats.cpu.cores} ${stats.cpu.cores === 1 ? 'core' : 'cores'}` : undefined}
                    history={cpuValues}
                    color={METRIC_COLOR}
                    isLoading={!isRunning}
                    secondary={[
                        { label: 'Peak', value: `${cpuDerived.peak.toFixed(1)}%` },
                        { label: 'Avg', value: `${cpuDerived.avg.toFixed(1)}%` }
                    ]}
                />

                <ContainerMetricTile
                    label='Memory'
                    value={memoryValue}
                    badge={stats.memory ? `of ${formatMb(stats.memory.total)}` : undefined}
                    history={memoryValues}
                    color={METRIC_COLOR}
                    isLoading={!isRunning}
                    secondary={[
                        { label: 'Peak', value: formatMb(memoryDerived.peak) },
                        { label: 'Avg', value: formatMb(memoryDerived.avg) }
                    ]}
                />

                <ContainerMetricTile
                    label='Network'
                    value={networkValue}
                    history={networkValues}
                    color={METRIC_COLOR}
                    isLoading={!isRunning}
                    secondary={[
                        { label: 'Rx', value: stats.network ? formatSize(stats.network.rx) : '0 B' },
                        { label: 'Tx', value: stats.network ? formatSize(stats.network.tx) : '0 B' }
                    ]}
                />
            </Container>

            <hr className='container-overview-divider' />

            <ContainerInspectorList title='Information' rows={inspectorRows} />

            <hr className='container-overview-divider' />

            <Container className='d-flex column'>
                <Title as='h3' className='container-overview-section-title'>Environment Variables</Title>
                <EditableKeyValueCard<EnvVariableFormItem>
                    items={envItems}
                    fields={[
                        { key: 'key', placeholder: 'Key' },
                        { key: 'value', placeholder: 'Value' }
                    ]}
                    emptyMessage='No environment variables'
                    onSave={onUpdateEnv}
                    createEmpty={() => ({ key: '', value: '' })}
                    showCard={false}
                    className='d-flex column'
                    renderItem={(item, i) => (
                        <Container key={i} className='container-overview-env-row d-flex items-center content-between'>
                            <span className='container-overview-env-key'>{item.key}</span>
                            <span className='container-overview-env-value'>{item.value}</span>
                        </Container>
                    )}
                />
            </Container>

            <hr className='container-overview-divider' />

            <Container className='d-flex column'>
                <Title as='h3' className='container-overview-section-title'>Port Bindings</Title>
                <EditableKeyValueCard<PortMappingFormItem>
                    items={portItems}
                    fields={[
                        { key: 'private', placeholder: 'Container Port', type: 'number' },
                        { key: 'public', placeholder: 'Host Port', type: 'number' }
                    ]}
                    emptyMessage='No ports exposed'
                    onSave={onUpdatePorts}
                    createEmpty={() => ({ private: 0 })}
                    showCard={false}
                    className='d-flex column'
                    renderItem={(item, i) => {
                        const resolvedPublicPort = typeof item.public === 'number' && item.public > 0
                            ? item.public
                            : null;
                        const accessiblePort = container.accessiblePorts?.find((port) => port.private === item.private);
                        const canOpen = accessiblePort?.browserAccessible && accessiblePort.status === 'available';

                        return (
                            <Container key={i} className='container-overview-port-row d-flex content-between items-center'>
                                <Container className='d-flex gap-075 items-center'>
                                    <span className='container-overview-port-label'>{item.private}/tcp</span>
                                    {resolvedPublicPort !== null && (
                                        <Container className='d-flex gap-05 items-center'>
                                            <span className='color-muted'>→</span>
                                            <span className='container-overview-port-mapping'>{resolvedPublicPort}</span>
                                        </Container>
                                    )}
                                </Container>
                                <Container className='d-flex gap-05 items-center'>
                                    {canOpen && (
                                        <Button
                                            variant='ghost'
                                            intent='brand'
                                            size='sm'
                                            onClick={() => openPort(container._id, item.private)}
                                            isLoading={openingPort === item.private}
                                        >
                                            Open
                                        </Button>
                                    )}
                                    {!canOpen && accessiblePort?.status === 'unavailable' && (
                                        <span className='font-size-1 color-muted'>Unavailable</span>
                                    )}
                                    {!canOpen && accessiblePort?.status !== 'unavailable' && (
                                        <span className='font-size-1 color-muted'>TCP only</span>
                                    )}
                                </Container>
                            </Container>
                        );
                    }}
                />
            </Container>
        </Container>
    );
};

export default ContainerOverview;
