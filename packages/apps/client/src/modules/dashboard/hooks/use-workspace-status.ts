import useClusterManagement from '@/modules/cluster/hooks/use-cluster-management';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import { resolveClusterMetricId } from '@/modules/cluster/utils/resolve-cluster-metric-id';
import useTeamMemberData from '@/modules/team/hooks/member/use-team-member-data';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { useTeamPresenceStore } from '@/modules/team/store/team/use-team-presence-store';
import { resolveTeamUserOnline } from '@/modules/team/utils/member/presence';
import { useMemo } from 'react';

export const CRITICAL_CPU_THRESHOLD = 85;

interface WorkspaceClusterMetrics {
    avgCpu: number;
    avgMemory: number;
    avgDisk: number;
    incoming: number;
    outgoing: number;
    hasCritical: boolean;
}

interface WorkspacePresence {
    online: number;
    total: number;
}

// The team's clusters, averaged over those reporting live metrics, and who on the team is online.
const useWorkspaceStatus = () => {
    const selectedTeam = useSelectedTeam();
    const { clusters: teamClusters } = useClusterManagement();
    const { clusters: liveClusters, isConnected } = useClusterMetrics();

    const clusterMetrics = useMemo<WorkspaceClusterMetrics | null>(() => {
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

    const presence = useMemo<WorkspacePresence>(() => {
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

    return { clusterMetrics, presence };
};

export default useWorkspaceStatus;
