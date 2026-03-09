import type { TeamClusterServicesProps } from '@modules/team-cluster/domain/entities/TeamCluster';

export interface ResolvedTeamClusterDaemonConnection {
    teamClusterId: string;
};

export interface ResolvedTeamClusterRedisConnection {
    teamClusterId: string;
    host: string;
    port: number;
    username: string;
    password: string;
    db: number;
};

export interface ResolvedTeamClusterMinioConnection {
    teamClusterId: string;
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
};

export interface ResolvedTeamClusterServices {
    daemon: ResolvedTeamClusterDaemonConnection;
    redis: ResolvedTeamClusterRedisConnection;
    minio: ResolvedTeamClusterMinioConnection;
    services: TeamClusterServicesProps;
};
