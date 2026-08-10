import { cn } from '@heroui/react';
import './DashboardBottomBar.css';
import { Divider, openModal } from '@voltstack/bravais';
import StatusCounts from '@/modules/canvas/components/StatusCounts';
import useJobStatusCounts from '@/modules/canvas/hooks/use-job-status-counts';
import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import { resolveClusterMetricId } from '@/modules/cluster/utils/resolve-cluster-metric-id';
import { formatNetworkSpeed } from '@/modules/cluster/utils/format-network';
import useTeamMemberData from '@/modules/team/hooks/member/use-team-member-data';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';
import { useTeamPresenceStore } from '@/modules/team/store/team/use-team-presence-store';
import { resolveTeamUserOnline } from '@/modules/team/utils/member/presence';
import { DASHBOARD_DRAWER_IDS, useJobsDrawerStore } from '@/modules/dashboard/store/use-jobs-drawer-store';
import { useMemo } from 'react';
import { ArrowDown, ArrowUp, Cpu, HardDrive, MemoryStick, Users } from 'lucide-react';
import type { ReactNode } from 'react';

const CRITICAL_CPU_THRESHOLD = 85;

interface BottomBarSegmentProps {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    children: ReactNode;
}

const BottomBarSegment = ({ label, icon, onClick, children }: BottomBarSegmentProps) => (
    <button
        type='button'
        className='dashboard-bottom-bar-segment'
        onClick={onClick}
        aria-label={`Open ${label}`}
    >
        {icon && <span className='dashboard-bottom-bar-segment-icon' aria-hidden='true'>{icon}</span>}
        {children}
    </button>
);

interface BottomBarMetricProps {
    icon: ReactNode;
    value: string;
    critical?: boolean;
}

const BottomBarMetric = ({ icon, value, critical }: BottomBarMetricProps) => (
    <span className='flex flex-row items-center gap-1'>
        <span className='dashboard-bottom-bar-metric-icon' aria-hidden='true'>{icon}</span>
        <span className={cn('text-xs text-muted', critical ? 'dashboard-bottom-bar-critical' : undefined)}>
            {value}
        </span>
    </span>
);

const DashboardBottomBar = () => {
    const selectedTeam = useSelectedTeam();
    const singleTenant = useSingleTenant();
    const setJobsScope = useJobsDrawerStore((state) => state.setScope);

    const jobCounts = useJobStatusCounts();

    const clusterManagement = useClusterManagement();
    const { clusters: liveClusters, isConnected } = useClusterMetrics();
    const teamClusters = clusterManagement.clusters;

    const clusterMetrics = useMemo(() => {
        const metricsByClusterId = new Map(liveClusters.map((cluster) => [resolveClusterMetricId(cluster), cluster]));
        let cpuSum = 0;
        let memorySum = 0;
        let diskSum = 0;
        let incomingSum = 0;
        let outgoingSum = 0;
        let samples = 0;
        let hasCritical = false;

        for (const teamCluster of teamClusters) {
            const liveMetrics = isConnected ? metricsByClusterId.get(teamCluster._id) ?? null : null;
            if (!liveMetrics) {
                continue;
            }

            cpuSum += liveMetrics.cpu.usage;
            memorySum += liveMetrics.memory.usagePercent;
            diskSum += liveMetrics.disk.usagePercent;
            incomingSum += liveMetrics.network.incoming;
            outgoingSum += liveMetrics.network.outgoing;
            samples += 1;

            if (liveMetrics.cpu.usage >= CRITICAL_CPU_THRESHOLD) {
                hasCritical = true;
            }
        }

        if (samples === 0) {
            return null;
        }

        return {
            avgCpu: Math.round(cpuSum / samples),
            avgMemory: Math.round(memorySum / samples),
            avgDisk: Math.round(diskSum / samples),
            incoming: incomingSum,
            outgoing: outgoingSum,
            hasCritical
        };
    }, [teamClusters, liveClusters, isConnected]);

    const { members } = useTeamMemberData({ teamId: selectedTeam?._id });
    const onlineUserIds = useTeamPresenceStore((s) => s.onlineUserIds);
    const hasPresenceSnapshot = useTeamPresenceStore((s) => s.hasPresenceSnapshot);

    const presenceCounts = useMemo(() => {
        let online = 0;
        for (const member of members) {
            if (resolveTeamUserOnline(member.user, onlineUserIds, hasPresenceSnapshot)) {
                online += 1;
            }
        }
        return {
            online,
            total: members.length
        };
    }, [members, onlineUserIds, hasPresenceSnapshot]);

    const showClusters = clusterMetrics !== null;
    const showPresence = !singleTenant && presenceCounts.total > 0;

    const openJobsDrawer = () => {
        setJobsScope({ trajectoryId: null });
        openModal(DASHBOARD_DRAWER_IDS.jobs);
    };

    return (
        <footer className='dashboard-bottom-bar bg-surface border border-border' aria-label='Workspace status'>
            <div className='flex flex-row items-center gap-2 dashboard-bottom-bar-inner'>
                <BottomBarSegment label='compute jobs' onClick={openJobsDrawer}>
                    <StatusCounts
                        queued={jobCounts.queued}
                        running={jobCounts.running}
                        completed={jobCounts.completed}
                        failed={jobCounts.failed}
                    />
                </BottomBarSegment>

                {showClusters && <Divider orientation='vertical' className='dashboard-bottom-bar-divider' />}

                {showClusters && (
                    <BottomBarSegment label='clusters' onClick={() => openModal(DASHBOARD_DRAWER_IDS.clusters)}>
                        <BottomBarMetric
                            icon={<Cpu size={13} />}
                            value={`${clusterMetrics.avgCpu}%`}
                            critical={clusterMetrics.hasCritical}
                        />
                        <BottomBarMetric icon={<MemoryStick size={13} />} value={`${clusterMetrics.avgMemory}%`} />
                        <BottomBarMetric icon={<HardDrive size={13} />} value={`${clusterMetrics.avgDisk}%`} />
                        <BottomBarMetric icon={<ArrowDown size={13} />} value={formatNetworkSpeed(clusterMetrics.incoming)} />
                        <BottomBarMetric icon={<ArrowUp size={13} />} value={formatNetworkSpeed(clusterMetrics.outgoing)} />
                    </BottomBarSegment>
                )}

                {showPresence && <Divider orientation='vertical' className='dashboard-bottom-bar-divider' />}

                {showPresence && (
                    <BottomBarSegment label='team presence' icon={<Users size={13} />} onClick={() => openModal(DASHBOARD_DRAWER_IDS.presence)}>
                        <span className='text-xs text-muted'>
                            <span className={`dashboard-bottom-bar-presence-dot ${presenceCounts.online > 0 ? 'is-online' : 'is-offline'}`} aria-hidden='true' />
                            {presenceCounts.online} / {presenceCounts.total} online
                        </span>
                    </BottomBarSegment>
                )}
            </div>
        </footer>
    );
};

export default DashboardBottomBar;
