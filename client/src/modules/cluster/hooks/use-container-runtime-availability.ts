import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { useClusterStore } from '@/modules/cluster/store/use-cluster-store';
import { resolveSelectedClusterId } from '@/modules/cluster/utils/resolve-selected-cluster-id';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import type { ContainerRuntimeAvailability } from '@/modules/cluster/contracts/host-capabilities';

/**
 * Whether the cluster this user is working against can run containers.
 *
 * The daemon reports it on every heartbeat, so a user who installs Docker after
 * the fact gets the features back on the next beat without reloading. Read from
 * the cluster list already in the query cache, which is what the sidebar renders
 * from, so this adds no request.
 */
export const useContainerRuntimeAvailability = (): ContainerRuntimeAvailability => {
    const selectedTeamId = useSelectedTeamId();
    const selectedClusterId = useClusterStore((state) => state.selectedClusterId);

    const { data } = useTeamClustersQuery(selectedTeamId ?? '');
    const clusters = data?.data ?? [];

    const clusterId = resolveSelectedClusterId(selectedClusterId, clusters);
    const cluster = clusters.find((candidate) => candidate._id === clusterId);

    if(!cluster?.hostCapabilities) return 'unknown';

    return cluster.hostCapabilities.containerRuntime ? 'available' : 'unavailable';
};
