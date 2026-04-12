import { TeamClusterRemoteAccessTarget } from '@/modules/cluster/api/entities/team-cluster-remote-access';

const TEAM_CLUSTER_REMOTE_ACCESS_LABELS: Record<TeamClusterRemoteAccessTarget, string> = {
    [TeamClusterRemoteAccessTarget.MongoDocuments]: 'Explore Mongo Documents',
    [TeamClusterRemoteAccessTarget.RedisData]: 'Explore Redis Data',
    [TeamClusterRemoteAccessTarget.Minio]: 'Explore MinIO'
};

const TEAM_CLUSTER_REMOTE_ACCESS_DESCRIPTIONS: Record<TeamClusterRemoteAccessTarget, string> = {
    [TeamClusterRemoteAccessTarget.MongoDocuments]: 'Confirm your password to inspect the MongoDB collections and documents exposed by this cluster.',
    [TeamClusterRemoteAccessTarget.RedisData]: 'Confirm your password to inspect Redis databases and keys exposed by this cluster.',
    [TeamClusterRemoteAccessTarget.Minio]: 'Confirm your password to inspect buckets and objects stored in this cluster MinIO instance.'
};

export const getTeamClusterRemoteAccessLabel = (target: TeamClusterRemoteAccessTarget): string => {
    return TEAM_CLUSTER_REMOTE_ACCESS_LABELS[target];
};

export const getTeamClusterRemoteAccessDescription = (target: TeamClusterRemoteAccessTarget): string => {
    return TEAM_CLUSTER_REMOTE_ACCESS_DESCRIPTIONS[target];
};
