import TeamCluster, {
    TeamClusterDaemonServiceProps,
    TeamClusterServiceProps,
    TeamClusterServicesProps,
    TeamClusterStatus
} from '@modules/team-cluster/domain/entities/TeamCluster';

export interface TeamClusterServiceDTO {
    port: number | null;
};

export interface TeamClusterServicesDTO {
    minio: TeamClusterServiceDTO;
    redis: TeamClusterServiceDTO;
    mongodb: TeamClusterServiceDTO;
    daemon: TeamClusterServiceDTO;
};

export interface TeamClusterCredentialServiceDTO extends TeamClusterServiceDTO {
    username: string;
    password: string;
};

export interface TeamClusterDaemonCredentialServiceDTO extends TeamClusterServiceDTO {
    password: string;
};

export interface TeamClusterCredentialServicesDTO {
    minio: TeamClusterCredentialServiceDTO;
    redis: TeamClusterCredentialServiceDTO;
    mongodb: TeamClusterCredentialServiceDTO;
    daemon: TeamClusterDaemonCredentialServiceDTO;
};

export interface TeamClusterQueueConcurrencyDTO {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    sshImport: number;
};

export interface TeamClusterDTO {
    _id: string;
    name: string;
    team: string;
    createdBy: string;
    status: TeamClusterStatus;
    installedVersion: string | null;
    lastHeartbeatAt: Date | null;
    lastDisconnectAt: Date | null;
    services: TeamClusterServicesDTO;
    queueConcurrency: TeamClusterQueueConcurrencyDTO;
    createdAt: Date;
    updatedAt: Date;
};

const toServiceDTO = (service: TeamClusterServiceProps | TeamClusterDaemonServiceProps): TeamClusterServiceDTO => {
    return {
        port: service.port
    };
};

export const toTeamClusterDTO = (teamCluster: TeamCluster): TeamClusterDTO => {
    const services: TeamClusterServicesProps = teamCluster.props.services;

    return {
        _id: teamCluster._id,
        name: teamCluster.props.name,
        team: teamCluster.props.team,
        createdBy: teamCluster.props.createdBy,
        status: teamCluster.props.status,
        installedVersion: teamCluster.props.installedVersion,
        lastHeartbeatAt: teamCluster.props.lastHeartbeatAt,
        lastDisconnectAt: teamCluster.props.lastDisconnectAt,
        services: {
            minio: toServiceDTO(services.minio),
            redis: toServiceDTO(services.redis),
            mongodb: toServiceDTO(services.mongodb),
            daemon: toServiceDTO(services.daemon)
        },
        queueConcurrency: {
            ...teamCluster.props.queueConcurrency
        },
        createdAt: teamCluster.props.createdAt,
        updatedAt: teamCluster.props.updatedAt
    };
};
