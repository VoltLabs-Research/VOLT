import './DashboardClusterHealth.css';
import DashboardCard from '@/modules/dashboard/components/atoms/DashboardCard';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import { getClusterMetricsRecoveryState } from '@/modules/cluster/utilities/cluster-live-metrics-status';
import { formatNetworkSpeed } from '@/modules/cluster/utilities/format-network';
import { resolveClusterMetricId } from '@/modules/cluster/utilities/resolve-cluster-metric-id';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import Title from '@/shared/presentation/components/Title';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { ArrowDown, ArrowUp, Clock3, Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { useMemo } from 'react';
import type { TeamClusterRole } from '@/modules/cluster/api/entities/team-cluster';
import type { ReactNode } from 'react';

const ROLE_LABELS: Record<TeamClusterRole, string> = {
    'cluster': 'Hybrid cluster',
    'storage-server': 'Storage server',
    'compute-node': 'Compute node'
};

const ROLE_PRIORITY: Record<TeamClusterRole, number> = {
    'storage-server': 0,
    'compute-node': 1,
    'cluster': 2
};

interface ClusterMetricStripProps {
    label: string;
    value: string;
    detail: string;
    percent: number;
    icon: ReactNode;
    stateClassName: string;
};

const clampPercent = (value: number): number => {
    return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
};

const getRoleClassName = (role: TeamClusterRole): string => {
    return role.replace(/[^a-z0-9]+/gi, '-');
};

const formatClusterLatency = (value: number | null): string | null => {
    if (value === null || !Number.isFinite(value)) {
        return null;
    }

    return `${Math.round(value)} ms`;
};

const getMetricStateClassName = (percent: number): string => {
    const clamped = clampPercent(percent);

    if (clamped >= 90) {
        return 'is-critical';
    }

    if (clamped >= 75) {
        return 'is-warning';
    }

    return 'is-neutral';
};

const ClusterMetricStrip = ({
    label,
    value,
    detail,
    percent,
    icon,
    stateClassName
}: ClusterMetricStripProps) => {
    const clamped = clampPercent(percent);

    return (
        <Container className='dashboard-cluster-metric-strip d-flex column gap-05'>
            <Container className='dashboard-cluster-metric-head d-flex items-center content-between gap-05'>
                <Container className='d-flex items-center gap-05 min-w-0'>
                    <span className='dashboard-cluster-metric-icon color-muted'>{icon}</span>
                    <span className='font-size-1 font-weight-5 color-primary'>{label}</span>
                </Container>
                <span className='font-size-1 font-weight-6 color-primary'>{value}</span>
            </Container>
            <Container className='dashboard-cluster-metric-track'>
                <span
                    className={`dashboard-cluster-metric-fill ${stateClassName}`}
                    style={{ width: `${clamped}%` }}
                />
            </Container>
            <span className='font-size-1 color-muted'>{detail}</span>
        </Container>
    );
};

const DashboardClusterHealth = () => {
    const selectedTeamId = useSelectedTeamId();
    const teamClustersQuery = useTeamClustersQuery(selectedTeamId ?? '', {
        enabled: Boolean(selectedTeamId)
    });
    const teamClusters = teamClustersQuery.data?.data ?? [];
    const { clusters, isConnected } = useClusterMetrics();

    const orderedClusters = useMemo(() => {
        return [...teamClusters].sort((a, b) => {
            const roleDiff = ROLE_PRIORITY[a.roleConfig.effectiveRole] - ROLE_PRIORITY[b.roleConfig.effectiveRole];
            if (roleDiff !== 0) {
                return roleDiff;
            }

            return a.name.localeCompare(b.name);
        });
    }, [teamClusters]);

    const metricsByClusterId = useMemo(() => {
        return new Map(clusters.map((cluster) => [resolveClusterMetricId(cluster), cluster]));
    }, [clusters]);

    const heroErrorMessage = teamClustersQuery.error instanceof Error
        ? teamClustersQuery.error.message
        : 'We could not load the team cluster overview right now.';

    if (teamClustersQuery.isLoading && teamClusters.length === 0) {
        return (
            <DashboardCard className='dashboard-cluster-card dashboard-cluster-card--hero d-flex flex-center' isRelative={true} overflowHidden={true}>
                <Loader scale={0.4} />
            </DashboardCard>
        );
    }

    if (teamClustersQuery.error && teamClusters.length === 0) {
        return (
            <DashboardCard className='dashboard-cluster-card dashboard-cluster-card--hero d-flex column' overflowHidden={true}>
                <RecoveryState
                    title='Unable to load cluster operations'
                    description={heroErrorMessage}
                    tone={RecoveryStateTone.Error}
                    className='dashboard-cluster-empty-state'
                />
            </DashboardCard>
        );
    }

    if (!orderedClusters.length) {
        return (
            <DashboardCard className='dashboard-cluster-card dashboard-cluster-card--hero d-flex column' overflowHidden={true}>
                <RecoveryState
                    title='No clusters connected yet'
                    description='Connect a storage server or compute node to monitor runtime health, queue capacity, and live resource usage from the dashboard.'
                    tone={RecoveryStateTone.Info}
                    className='dashboard-cluster-empty-state'
                />
            </DashboardCard>
        );
    }

    return (
        <DashboardCard className='dashboard-cluster-card dashboard-cluster-card--hero d-flex column' overflowHidden={true}>
                <Container className='dashboard-cluster-panels y-auto'>
                {orderedClusters.map((teamCluster) => {
                    const liveMetrics = metricsByClusterId.get(teamCluster._id) ?? null;
                    const metricsRecoveryState = getClusterMetricsRecoveryState({
                        clusterName: teamCluster.name,
                        isMetricsConnected: isConnected
                    });
                    const roleClassName = getRoleClassName(teamCluster.roleConfig.effectiveRole);
                    const clusterLatencyMs = liveMetrics?.responseTimes.self ?? null;
                    const clusterLatencyLabel = formatClusterLatency(clusterLatencyMs);
                    const networkIncomingLabel = liveMetrics ? formatNetworkSpeed(liveMetrics.network.incoming) : null;
                    const networkOutgoingLabel = liveMetrics ? formatNetworkSpeed(liveMetrics.network.outgoing) : null;

                    return (
                        <Container key={teamCluster._id} className={`dashboard-cluster-panel role-${roleClassName} d-flex column content-between`}>
                            <Container className='d-flex column gap-1'>
                                <Container className='d-flex column gap-025 min-w-0'>
                                    <Container className='cluster-card-title-container d-flex column w-max content-between gap-025'>
                                        <Title className='font-size-3 color-primary font-weight-6 text-truncate'>
                                            {teamCluster.name}
                                        </Title>
                                    </Container>
                                    <span className='font-size-1 color-muted'>
                                        {ROLE_LABELS[teamCluster.roleConfig.effectiveRole]}
                                    </span>
                                </Container>
                                {liveMetrics && (
                                    <Container className='dashboard-cluster-metric-grid'>
                                        <ClusterMetricStrip
                                            label='CPU'
                                            value={`${Math.round(liveMetrics.cpu.usage)}%`}
                                            detail={`${liveMetrics.cpu.cores} cores`}
                                            percent={liveMetrics.cpu.usage}
                                            icon={<Cpu size={12} strokeWidth={1.8} />}
                                            stateClassName={getMetricStateClassName(liveMetrics.cpu.usage)}
                                        />
                                        <ClusterMetricStrip
                                            label='Memory'
                                            value={`${liveMetrics.memory.used.toFixed(1)} / ${liveMetrics.memory.total.toFixed(1)} GB`}
                                            detail={`${liveMetrics.memory.free.toFixed(1)} GB free`}
                                            percent={liveMetrics.memory.usagePercent}
                                            icon={<MemoryStick size={12} strokeWidth={1.8} />}
                                            stateClassName={getMetricStateClassName(liveMetrics.memory.usagePercent)}
                                        />
                                        <ClusterMetricStrip
                                            label='Disk'
                                            value={`${liveMetrics.disk.used.toFixed(1)} / ${liveMetrics.disk.total.toFixed(1)} GB`}
                                            detail={`${liveMetrics.disk.free.toFixed(1)} GB free`}
                                            percent={liveMetrics.disk.usagePercent}
                                            icon={<HardDrive size={12} strokeWidth={1.8} />}
                                            stateClassName={getMetricStateClassName(liveMetrics.disk.usagePercent)}
                                        />
                                    </Container>
                                )}
                            </Container>
                                
                            {liveMetrics
                                ? (
                                    <Container className='dashboard-cluster-footer-metrics d-flex items-center gap-075 flex-shrink-0'>
                                        <span className='dashboard-cluster-title-metric font-size-1 color-muted'>
                                            <ArrowDown size={12} strokeWidth={1.8} />
                                            {networkIncomingLabel}
                                        </span>
                                        <span className='dashboard-cluster-title-metric font-size-1 color-muted'>
                                            <ArrowUp size={12} strokeWidth={1.8} />
                                            {networkOutgoingLabel}
                                        </span>
                                        {clusterLatencyLabel && (
                                            <span className='dashboard-cluster-title-metric font-size-1 color-muted'>
                                                <Clock3 size={12} strokeWidth={1.8} />
                                                {clusterLatencyLabel}
                                            </span>
                                        )}
                                    </Container>
                                )
                                : (
                                    <Container className='dashboard-cluster-panel-recovery'>
                                        <RecoveryState
                                            title={metricsRecoveryState.title}
                                            description={metricsRecoveryState.description}
                                            tone={metricsRecoveryState.tone}
                                        />
                                    </Container>
                                )}
                        </Container>
                    );
                })}
            </Container>
        </DashboardCard>
    );
};

export default DashboardClusterHealth;
