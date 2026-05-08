export enum ObjectBucketName {
    Dumps = 'volt-dumps',
    Models = 'volt-models',
    Plugins = 'volt-plugins',
    Rasterizer = 'volt-rasterizer',
    Trajectories = 'volt-trajectories'
}

export const TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH = '/internal/team-cluster/object-store/v1';
export const TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER = 'x-team-cluster-id';
export const TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER = 'x-team-cluster-daemon-password';
export const TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX = 'x-object-meta-';
export const TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER = 'x-volt-object-store-skip-metadata';
export const TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER = 'x-team-cluster-direct-access-token';
export const VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID = '__volt_server__';
