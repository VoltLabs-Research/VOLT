import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { useClusterStore } from '@/modules/cluster/store/use-cluster-store';
import { resolveSelectedClusterId } from '@/modules/cluster/utils/resolve-selected-cluster-id';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import type { ContainerRuntimeAvailability } from '@/modules/cluster/contracts/host-capabilities';

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
