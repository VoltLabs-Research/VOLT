import './DashboardClusterHealth.css';
import DashboardCard from '@/modules/dashboard/components/atoms/DashboardCard';
import DashboardClusterHealthGauge from '@/modules/dashboard/components/molecules/DashboardClusterHealthGauge';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utilities/team-cluster-status';
import { resolveClusterMetricId } from '@/modules/cluster/utilities/resolve-cluster-metric-id';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Select from '@/shared/presentation/components/Select';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@mui/material';
import { Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { GoArrowRight } from 'react-icons/go';
import type { SelectOption } from '@/shared/presentation/components/Select';

const statusToVariant = (status: string): string => {
    switch (status) {
        case 'Healthy': return 'ready';
        case 'Warning': return 'processing';
        case 'Critical': return 'failed';
        default: return status.toLowerCase();
    }
};

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

    useEffect(() => {
        requestHistory(5);
    }, [requestHistory]);

    const clusterOptions = useMemo<SelectOption[]>(() => {
        if (!teamClusters.length) {
            return [{ value: 'main-cluster', title: 'No clusters yet' }];
        }
        return teamClusters.map((cluster) => ({
            value: cluster._id,
            title: cluster.name,
            description: getTeamClusterStatusLabel(cluster.status)
        }));
    }, [teamClusters]);

    const selectedTeamCluster = useMemo(() => {
        return teamClusters.find((cluster) => cluster._id === selectedClusterId) ?? null;
    }, [teamClusters, selectedClusterId]);

    const isSelectedClusterConnected = useMemo(() => {
        return clusters.some((cluster) => resolveClusterMetricId(cluster) === selectedClusterId);
    }, [clusters, selectedClusterId]);

    const gauges = useMemo(() => {
        if (!metrics) return null;
        return [
            {
                label: 'CPU',
                percent: metrics.cpu.usage,
                icon: <Cpu size={12} strokeWidth={1.8} />,
                detail: `${metrics.cpu.cores} cores`
            },
            {
                label: 'RAM',
                percent: metrics.memory.usagePercent,
                icon: <MemoryStick size={12} strokeWidth={1.8} />,
                detail: `${metrics.memory.used.toFixed(1)} GB / ${metrics.memory.total.toFixed(1)} GB`
            },
            {
                label: 'Disk',
                percent: metrics.disk.usagePercent,
                icon: <HardDrive size={12} strokeWidth={1.8} />,
                detail: `${metrics.disk.free.toFixed(1)} GB free`
            }
        ];
    }, [metrics]);

    if (!isConnected || !metrics || !isSelectedClusterConnected) {
        return (
            <DashboardCard className='dashboard-cluster-card d-flex column'>
                <Container className='dashboard-cluster-header'>
                    <Select
                        options={clusterOptions}
                        value={selectedClusterId}
                        onChange={setSelectedClusterId}
                        className='dashboard-cluster-select'
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
                    <StatusBadge variant='inactive' size='compact'>
                        Metrics unavailable
                    </StatusBadge>
                </Container>
                <Container className='dashboard-cluster-gauges d-flex items-center content-around flex-1'>
                    {Array.from({ length: 3 }, (_, i) => (
                        <Container key={i} className='d-flex column items-center gap-05'>
                            <Skeleton variant='circular' width={68} height={68} />
                            <Skeleton variant='text' width={40} height={14} />
                            <Skeleton variant='text' width={60} height={12} />
                        </Container>
                    ))}
                </Container>
            </DashboardCard>
        );
    }

    return (
        <DashboardCard className='dashboard-cluster-card d-flex column'>
            <Container className='dashboard-cluster-header'>
                <Select
                    options={clusterOptions}
                    value={selectedClusterId}
                    onChange={setSelectedClusterId}
                    className='dashboard-cluster-select'
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
                {gauges!.map((g) => (
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
                <StatusBadge status={statusToVariant(metrics.status)} size='compact'>
                    {metrics.status}
                </StatusBadge>
            </Container>
        </DashboardCard>
    );
};

export default DashboardClusterHealth;
