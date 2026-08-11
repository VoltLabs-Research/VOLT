import type {
    TeamClusterEffectiveCapabilitiesProps,
    TeamClusterHostCapabilitiesProps,
    TeamClusterQueueConcurrencyProps,
    TeamClusterQueueScopeLimitsProps,
    TeamClusterRuntimeRoleConfigProps,
    TeamClusterServiceProps,
    TeamClusterStatus
} from '@shared/contracts/types/TeamCluster';
import { toTeamClusterLike, type TeamCluster } from '@modules/cluster/contracts/team-cluster';
import {
    toClusterTransferJobLike,
    type ClusterTransferJob,
    type ClusterTransferJobProps
} from '@modules/cluster/contracts/cluster-transfer-job';
import { DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS } from '@modules/cluster/services/team-cluster/TeamClusterFactory';
import type TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import type ClusterTransferJobEntity from '@modules/cluster/models/ClusterTransferJob';

export interface ClusterTransferJobView extends ClusterTransferJobProps {
    _id: string;
}

interface TeamClusterServiceView {
    port: number | null;
}

export interface TeamClusterServicesView {
    postgres: TeamClusterServiceView;
    daemon: TeamClusterServiceView;
}

export interface TeamClusterCredentialServiceView extends TeamClusterServiceView {
    username: string;
    password: string;
}

export interface TeamClusterDaemonCredentialServiceView extends TeamClusterServiceView {
    password: string;
}

export interface TeamClusterCredentialServicesView {
    postgres: TeamClusterCredentialServiceView;
    daemon: TeamClusterDaemonCredentialServiceView;
}

export interface TeamClusterView {
    _id: string;
    name: string;
    team: string;
    createdBy: string;
    status: TeamClusterStatus;
    installedVersion: string | null;
    lastHeartbeatAt: Date | null;
    lastDisconnectAt: Date | null;
    services: TeamClusterServicesView;
    queueConcurrency: TeamClusterQueueConcurrencyProps;
    queueScopeLimits: TeamClusterQueueScopeLimitsProps;
    roleConfig: TeamClusterRuntimeRoleConfigProps;
    effectiveCapabilities: TeamClusterEffectiveCapabilitiesProps;
    hostCapabilities: TeamClusterHostCapabilitiesProps | null;
    activeTransfers?: ClusterTransferJobView[];
    createdAt: Date;
    updatedAt: Date;
}

const toServiceView = (service: TeamClusterServiceProps): TeamClusterServiceView => ({
    port: service.port
});

export const toTeamClusterView = (
    teamCluster: TeamCluster,
    options: {
        activeTransfers?: ClusterTransferJobView[];
    } = {}
): TeamClusterView => {
    const services = teamCluster.props.services;
    const roleConfig = teamCluster.props.roleConfig;

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
            postgres: toServiceView(services.postgres),
            daemon: toServiceView(services.daemon)
        },
        queueConcurrency: teamCluster.props.queueConcurrency,
        queueScopeLimits: teamCluster.props.queueScopeLimits ?? DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS,
        roleConfig: {
            ...roleConfig,
            lastAppliedAt: roleConfig.lastAppliedAt ?? null
        },
        effectiveCapabilities: teamCluster.effectiveCapabilities,
        hostCapabilities: teamCluster.props.hostCapabilities,
        ...(options.activeTransfers ? { activeTransfers: options.activeTransfers } : {}),
        createdAt: teamCluster.props.createdAt,
        updatedAt: teamCluster.props.updatedAt
    };
};

export const toTeamClusterViewFromEntity = (
    entity: TeamClusterEntity,
    options: {
        activeTransfers?: ClusterTransferJobView[];
    } = {}
): TeamClusterView => toTeamClusterView(toTeamClusterLike(entity), options);

export const toClusterTransferJobViewFromDomain = (job: ClusterTransferJob): ClusterTransferJobView => ({
    ...job.props,
    _id: job.id
});

export const toClusterTransferJobViewFromEntity = (
    entity: ClusterTransferJobEntity
): ClusterTransferJobView => toClusterTransferJobViewFromDomain(toClusterTransferJobLike(entity));
