import './DashboardClusterHealth.css';
import DashboardCard from '@/modules/dashboard/components/atoms/DashboardCard';
import DashboardClusterHealthGauge from '@/modules/dashboard/components/molecules/DashboardClusterHealthGauge';
import { getClusterLiveMetricsStatus, getClusterMetricsRecoveryState } from '@/modules/cluster/utilities/cluster-live-metrics-status';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utilities/team-cluster-status';
import { resolveClusterMetricId } from '@/modules/cluster/utilities/resolve-cluster-metric-id';
import { resolveSelectedClusterId } from '@/modules/cluster/utilities/resolve-selected-cluster-id';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import Select from '@/shared/presentation/components/Select';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { GoArrowRight } from 'react-icons/go';
import type { SelectOption } from '@/shared/presentation/components/Select';

const DashboardClusterHealth = () => {
    const navigate = useNavigate();
    const selectedTeamId = useSelectedTeamId();
    const teamClustersQuery = useTeamClustersQuery(selectedTeamId ?? '', {
        enabled: Boolean(selectedTeamId)
    });
    const teamClusters = teamClustersQuery.data?.data ?? [];
    const {
        metrics,
        clusters,
        selectedClusterId,
        setSelectedClusterId,
        isConnected,
        requestHistory
    } = useClusterMetrics();
    const resolvedSelectedClusterId = useMemo(() => {
        return resolveSelectedClusterId(selectedClusterId, teamClusters);
    }, [selectedClusterId, teamClusters]);

    useEffect(() => {
        if (!isConnected || !resolvedSelectedClusterId) {
            return;
        }

        requestHistory(5, resolvedSelectedClusterId);
    }, [isConnected, requestHistory, resolvedSelectedClusterId]);

    useEffect(() => {
        if (selectedClusterId !== resolvedSelectedClusterId) {
            setSelectedClusterId(resolvedSelectedClusterId);
        }
    }, [resolvedSelectedClusterId, selectedClusterId, setSelectedClusterId]);

    const clusterOptions = useMemo<SelectOption[]>(() => {
        return teamClusters.map((cluster) => ({
            value: cluster._id,
            title: cluster.name,
            description: getTeamClusterStatusLabel(cluster.status)
        }));
    }, [teamClusters]);

    const selectedTeamCluster = useMemo(() => {
        return teamClusters.find((cluster) => cluster._id === resolvedSelectedClusterId) ?? null;
    }, [resolvedSelectedClusterId, teamClusters]);

    const isSelectedClusterConnected = useMemo(() => {
        return clusters.some((cluster) => resolveClusterMetricId(cluster) === resolvedSelectedClusterId);
    }, [clusters, resolvedSelectedClusterId]);

    const liveMetrics = useMemo(() => {
        if (!isConnected || !isSelectedClusterConnected) {
            return null;
        }

        return metrics;
    }, [isConnected, isSelectedClusterConnected, metrics]);

    const unavailableState = useMemo(() => {
        if (liveMetrics) {
            return null;
        }

        if (!selectedTeamCluster) {
            return {
                title: 'Select a cluster',
                description: 'Choose a cluster to view live resource usage.',
                tone: RecoveryStateTone.Info
            };
        }

        if (!isConnected) {
            return getClusterMetricsRecoveryState({
                clusterName: selectedTeamCluster.name,
                isMetricsConnected: false
            });
        }

        return getClusterMetricsRecoveryState({
            clusterName: selectedTeamCluster.name,
            isMetricsConnected: true
        });
    }, [isConnected, liveMetrics, selectedTeamCluster]);

    const liveMetricsStatus = useMemo(() => {
        return getClusterLiveMetricsStatus({
            metrics: liveMetrics,
            isMetricsConnected: isConnected
        });
    }, [isConnected, liveMetrics]);

    const gauges = useMemo(() => {
        if (!liveMetrics) return null;

        return [
            {
                label: 'CPU',
                percent: liveMetrics.cpu.usage,
                icon: <Cpu size={12} strokeWidth={1.8} />,
                detail: `${liveMetrics.cpu.cores} cores`
            },
            {
                label: 'RAM',
                percent: liveMetrics.memory.usagePercent,
                icon: <MemoryStick size={12} strokeWidth={1.8} />,
                detail: `${liveMetrics.memory.used.toFixed(1)} GB / ${liveMetrics.memory.total.toFixed(1)} GB`
            },
            {
                label: 'Disk',
                percent: liveMetrics.disk.usagePercent,
                icon: <HardDrive size={12} strokeWidth={1.8} />,
                detail: `${liveMetrics.disk.free.toFixed(1)} GB free`
            }
        ];
    }, [liveMetrics]);
    const resolvedMetrics = liveMetrics;

    if (unavailableState || !resolvedMetrics || !gauges) {
        return (
            <DashboardCard className='dashboard-cluster-card d-flex column'>
                <Container className='dashboard-cluster-header'>
                    <Select
                        options={clusterOptions}
                        value={resolvedSelectedClusterId}
                        onChange={setSelectedClusterId}
                        className='dashboard-cluster-select'
                        placeholder='No clusters yet'
                        disabled={!clusterOptions.length}
                    />
                </Container>
                {selectedTeamCluster && (
                    <Container className='dashboard-cluster-status-row'>
                        <StatusBadge variant={getTeamClusterStatusVariant(selectedTeamCluster.status)} size='compact'>
                            {getTeamClusterStatusLabel(selectedTeamCluster.status)}
                        </StatusBadge>
                    </Container>
                )}
                <Container className='dashboard-cluster-footer'>
                    <StatusBadge variant={liveMetricsStatus.variant} size='compact'>
                        {liveMetricsStatus.label}
                    </StatusBadge>
                </Container>
                <Container className='dashboard-cluster-gauges d-flex items-center content-center flex-1'>
                    <RecoveryState
                        title={unavailableState?.title ?? 'Metrics unavailable'}
                        description={unavailableState?.description ?? 'Live cluster metrics are not available right now.'}
                        tone={unavailableState?.tone ?? RecoveryStateTone.Info}
                    />
                </Container>
            </DashboardCard>
        );
    }

    return (
        <DashboardCard className='dashboard-cluster-card d-flex column'>
            <Container className='dashboard-cluster-header'>
                <Select
                    options={clusterOptions}
                    value={resolvedSelectedClusterId}
                    onChange={setSelectedClusterId}
                    className='dashboard-cluster-select'
                    placeholder='No clusters yet'
                    disabled={!clusterOptions.length}
                />
                <Button
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    onClick={() => navigate('/dashboard/clusters')}
                    rightIcon={<GoArrowRight size={12} />}
                >
                    View clusters
                </Button>
            </Container>

            {selectedTeamCluster && (
                <Container className='dashboard-cluster-status-row'>
                    <StatusBadge variant={getTeamClusterStatusVariant(selectedTeamCluster.status)} size='compact'>
                        {getTeamClusterStatusLabel(selectedTeamCluster.status)}
                    </StatusBadge>
                </Container>
            )}

            <Container className='dashboard-cluster-gauges d-flex items-center content-around flex-1'>
                {gauges.map((g) => (
                    <DashboardClusterHealthGauge
                        key={g.label}
                        label={g.label}
                        percent={g.percent}
                        icon={g.icon}
                        detail={g.detail}
                    />
                ))}
            </Container>

            <Container className='dashboard-cluster-footer'>
                <StatusBadge variant={liveMetricsStatus.variant} size='compact'>
                    {liveMetricsStatus.label}
                </StatusBadge>
            </Container>
        </DashboardCard>
    );
};

export default DashboardClusterHealth;
