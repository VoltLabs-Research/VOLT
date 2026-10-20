import { get, post, patch } from '../../shared/routing';
import type { Endpoint } from '../../shared/routing';
import type {
    CreateTeamClusterInput,
    UpdateTeamClusterRoleInput,
    UpdateTeamClusterQueueConcurrencyInput,
    CreateTeamClusterTransferRequestInput,
    DeleteTeamClusterInput,
    RevealTeamClusterCredentialsInput,
    CreateTeamClusterRemoteAccessSessionInput,
    ProcessTeamClusterHealthcheckInput,
    GenerateTeamClusterInstallManifestInput
} from './http';
import type {
    CreateTeamClusterResponse,
    GetTeamClusterResponse,
    TeamCluster,
    DeleteTeamClusterResponse,
    UpdateTeamClusterRoleResponse,
    UpdateTeamClusterQueueConcurrencyResponse,
    RegenerateTeamClusterEnrollmentTokenResponse,
    RevealTeamClusterCredentialsResponse,
    ClusterResourceLimitsResponse,
    GetTeamClusterRuntimeSnapshotResponse,
    CreateTeamClusterTransferRequestResponse,
    ClusterTransferJob,
    CreateTeamClusterRemoteAccessSessionResponse,
    ListTeamClusterRemoteExplorerEntriesResponse,
    GetTeamClusterRemoteExplorerNodeResponse,
    GenerateTeamClusterInstallManifestResponse,
    ProcessTeamClusterHealthcheckResponse
} from './domain';

const head = <Output = void>(path: string): Endpoint<never, Output> => ({
    method: 'HEAD',
    path
});

const putStream = (path: string): Endpoint<never, void> => ({
    method: 'PUT',
    path
});

export const teamClusterRoutes = {
    list: get<TeamCluster>('/api/teams/:teamId/clusters'),
    create: post<CreateTeamClusterInput, CreateTeamClusterResponse>('/api/teams/:teamId/clusters'),

    getById: get<GetTeamClusterResponse>('/api/teams/:teamId/clusters/:teamClusterId'),
    getRuntimeSnapshot: get<GetTeamClusterRuntimeSnapshotResponse>('/api/teams/:teamId/clusters/:teamClusterId/runtime-snapshot'),
    updateQueueConcurrency: patch<UpdateTeamClusterQueueConcurrencyInput, UpdateTeamClusterQueueConcurrencyResponse>('/api/teams/:teamId/clusters/:teamClusterId/queue-concurrency'),
    updateRole: patch<UpdateTeamClusterRoleInput, UpdateTeamClusterRoleResponse>('/api/teams/:teamId/clusters/:teamClusterId/role'),

    listTransferJobs: get<ClusterTransferJob>('/api/teams/:teamId/clusters/:teamClusterId/transfers'),
    createTransferRequest: post<CreateTeamClusterTransferRequestInput, CreateTeamClusterTransferRequestResponse>('/api/teams/:teamId/clusters/:teamClusterId/transfers'),

    getResourceLimits: get<ClusterResourceLimitsResponse>('/api/teams/:teamId/clusters/:teamClusterId/resource-limits'),

    createRemoteAccessSession: post<CreateTeamClusterRemoteAccessSessionInput, CreateTeamClusterRemoteAccessSessionResponse>('/api/teams/:teamId/clusters/:teamClusterId/remote-access/sessions'),
    listRemoteExplorerEntries: get<ListTeamClusterRemoteExplorerEntriesResponse>('/api/teams/:teamId/clusters/:teamClusterId/remote-access/explorer/entries'),
    getRemoteExplorerNode: get<GetTeamClusterRemoteExplorerNodeResponse>('/api/teams/:teamId/clusters/:teamClusterId/remote-access/explorer/node'),
    downloadRemoteExplorerObject: get<void>('/api/teams/:teamId/clusters/:teamClusterId/remote-access/explorer/object'),

    regenerateEnrollmentToken: post<never, RegenerateTeamClusterEnrollmentTokenResponse>('/api/teams/:teamId/clusters/:teamClusterId/enrollment-tokens'),
    revealCredentials: post<RevealTeamClusterCredentialsInput, RevealTeamClusterCredentialsResponse>('/api/teams/:teamId/clusters/:teamClusterId/credentials'),
    deleteById: post<DeleteTeamClusterInput, DeleteTeamClusterResponse>('/api/teams/:teamId/clusters/:teamClusterId/delete-requests')
} as const;

export const clusterLifecycleRoutes = {
    processHealthcheck: post<ProcessTeamClusterHealthcheckInput, ProcessTeamClusterHealthcheckResponse>('/api/team-clusters/:teamClusterId/healthcheck'),
    generateInstallManifest: post<GenerateTeamClusterInstallManifestInput, GenerateTeamClusterInstallManifestResponse>('/api/team-clusters/:teamClusterId/install-manifest')
} as const;

export const clusterObjectRoutes = {
    write: putStream('/api/teams/:teamId/cluster-objects/:token'),
    readHead: head('/api/teams/:teamId/cluster-objects/:token'),
    read: get<void>('/api/teams/:teamId/cluster-objects/:token')
} as const;
