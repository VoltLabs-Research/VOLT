import { TeamClusterRole } from '@/modules/cluster/api/entities/team-cluster';

export const CLUSTER_ROLE_OPTIONS: { value: TeamClusterRole; label: string; title: string }[] = [
    { value: TeamClusterRole.Cluster, label: 'Cluster (compute + storage)', title: 'Cluster (compute + storage)' },
    { value: TeamClusterRole.ComputeNode, label: 'Compute Node (algorithms only)', title: 'Compute Node (algorithms only)' },
    { value: TeamClusterRole.StorageServer, label: 'Storage Server (data only)', title: 'Storage Server (data only)' }
];
