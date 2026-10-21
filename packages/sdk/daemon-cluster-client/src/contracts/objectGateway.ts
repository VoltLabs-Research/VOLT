import type { TeamClusterServiceExposureAccessMode } from './exposure';

export const TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH = '/internal/team-cluster/object-store/v1';
export const TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER = 'x-team-cluster-id';
export const TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER = 'x-team-cluster-daemon-password';
export const TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX = 'x-object-meta-';
export const TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER = 'x-volt-object-store-skip-metadata';
export const TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER = 'x-team-cluster-direct-access-token';

export const TEAM_CLUSTER_OBJECT_STORE_BUCKET = Object.freeze({
    Dumps: 'volt-dumps',
    Models: 'volt-models',
    Plugins: 'volt-plugins',
    Rasterizer: 'volt-rasterizer',
    AnalysisLogs: 'volt-analysis-logs',
    Whiteboards: 'volt-whiteboards',
    Trajectories: 'volt-trajectories'
});

export type TeamClusterObjectStoreBucket = typeof TEAM_CLUSTER_OBJECT_STORE_BUCKET[keyof typeof TEAM_CLUSTER_OBJECT_STORE_BUCKET];

// JSON bodies of the object gateway's list endpoint and error responses.
export interface TeamClusterObjectGatewayJsonListEntry {
    key: string;
    contentLength?: number;
    etag?: string;
    lastModified?: string;
};

export interface TeamClusterObjectGatewayJsonListResponse {
    keys: string[];
    objects: TeamClusterObjectGatewayJsonListEntry[];
    nextCursor?: string;
};

export interface TeamClusterObjectGatewayJsonError {
    code?: string;
    message?: string;
};

// Claims of the short-lived JWT the server signs for direct (non-relayed) exposure access.
export interface TeamClusterDirectAccessTokenClaims {
    requesterKind: 'daemon' | 'server';
    requesterId: string;
    ownerClusterId: string;
    teamId: string;
    exposureId: string;
    exposureName: string;
    accessMode: TeamClusterServiceExposureAccessMode;
    iat?: number;
    exp?: number;
};
