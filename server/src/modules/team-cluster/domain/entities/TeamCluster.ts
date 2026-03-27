export enum TeamClusterStatus {
    WaitingForConnection = 'waiting-for-connection',
    HealthcheckReceived = 'healthcheck-received',
    PreparingEnvironment = 'preparing-environment',
    DependenciesInstallationFailed = 'dependency-installation-failed',
    OperatingSystemNotSupported = 'operating-system-not-supported',
    Connected = 'connected',
    Disconnected = 'disconnected',
    Deleting = 'deleting',
    DeleteFailed = 'delete-failed',
    Updating = 'updating',
    UpdateFailed = 'update-failed'
};

export interface TeamClusterServiceProps {
    port: number | null;
    username?: string;
    password?: string;
};

export interface TeamClusterDaemonServiceProps {
    port: number | null;
    password?: string;
};

export interface TeamClusterServicesProps {
    minio: TeamClusterServiceProps;
    redis: TeamClusterServiceProps;
    mongodb: TeamClusterServiceProps;
    daemon: TeamClusterDaemonServiceProps;
};

export interface TeamClusterQueueConcurrencyProps {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    sshImport: number;
};

export type TeamClusterRole = 'cluster' | 'storage-server' | 'compute-node';

export interface TeamClusterRoleCapabilitiesProps {
    canStore: boolean;
    canCompute: boolean;
};

export interface TeamClusterRoleDrainProps {
    compute: boolean;
    storage: boolean;
};

export interface TeamClusterRuntimeRoleConfigProps {
    desiredRole: TeamClusterRole;
    effectiveRole: TeamClusterRole;
    runtimeVersion: number;
    draining: TeamClusterRoleDrainProps;
    lastAppliedAt?: Date | null;
};

export interface TeamClusterEffectiveCapabilitiesProps {
    acceptsComputeJobs: boolean;
    acceptsStorageWrites: boolean;
    servesStorageReads: boolean;
    servesArtifactDownloads: boolean;
};

export const DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY: TeamClusterQueueConcurrencyProps = {
    analysis: 5,
    rasterizer: 3,
    glbPreprocessing: 5,
    sshImport: 1
};

export const DEFAULT_TEAM_CLUSTER_ROLE: TeamClusterRole = 'cluster';

const TEAM_CLUSTER_ROLE_CAPABILITIES: Record<TeamClusterRole, TeamClusterRoleCapabilitiesProps> = {
    cluster: {
        canStore: true,
        canCompute: true
    },
    'storage-server': {
        canStore: true,
        canCompute: false
    },
    'compute-node': {
        canStore: false,
        canCompute: true
    }
};

export const resolveTeamClusterRoleCapabilities = (
    role: TeamClusterRole
): TeamClusterRoleCapabilitiesProps => {
    return { ...TEAM_CLUSTER_ROLE_CAPABILITIES[role] };
};

export const buildTeamClusterEffectiveCapabilities = (
    role: TeamClusterRole,
    draining: Partial<TeamClusterRoleDrainProps> = {}
): TeamClusterEffectiveCapabilitiesProps => {
    const capabilities = resolveTeamClusterRoleCapabilities(role);
    const computeDraining = draining.compute === true;
    const storageDraining = draining.storage === true;
    const servesResidualStorageReads = capabilities.canStore || capabilities.canCompute || storageDraining;

    return {
        acceptsComputeJobs: capabilities.canCompute && !computeDraining,
        acceptsStorageWrites: capabilities.canStore && !storageDraining,
        // Reads stay enabled on compute-node so clusters that were demoted from
        // storage-server can keep serving already-owned trajectories until the
        // user transfers them elsewhere.
        servesStorageReads: servesResidualStorageReads,
        servesArtifactDownloads: servesResidualStorageReads
    };
};

export const createDefaultTeamClusterRoleConfig = (
    role: TeamClusterRole = DEFAULT_TEAM_CLUSTER_ROLE
): TeamClusterRuntimeRoleConfigProps => {
    return {
        desiredRole: role,
        effectiveRole: role,
        runtimeVersion: 1,
        draining: {
            compute: false,
            storage: false
        },
        lastAppliedAt: null
    };
};

export const createDefaultTeamClusterEffectiveCapabilities = (
    role: TeamClusterRole = DEFAULT_TEAM_CLUSTER_ROLE
): TeamClusterEffectiveCapabilitiesProps => {
    return buildTeamClusterEffectiveCapabilities(role);
};

export const resolveEffectiveCapabilitiesFromRoleConfig = (
    roleConfig: Pick<TeamClusterRuntimeRoleConfigProps, 'effectiveRole' | 'draining'>
): TeamClusterEffectiveCapabilitiesProps => {
    return buildTeamClusterEffectiveCapabilities(
        roleConfig.effectiveRole,
        roleConfig.draining
    );
};

export interface TeamClusterProps {
    name: string;
    team: string;
    createdBy: string;
    status: TeamClusterStatus;
    enrollmentTokenHash: string | null;
    installedVersion: string | null;
    installRoot: string | null;
    lastHeartbeatAt: Date | null;
    lastDisconnectAt: Date | null;
    services: TeamClusterServicesProps;
    queueConcurrency: TeamClusterQueueConcurrencyProps;
    roleConfig: TeamClusterRuntimeRoleConfigProps;
    effectiveCapabilities?: TeamClusterEffectiveCapabilitiesProps;
    createdAt: Date;
    updatedAt: Date;
};

export default class TeamCluster {
    constructor(
        public readonly _id: string,
        public props: TeamClusterProps
    ){}

    public get id(): string {
        return this._id;
    }

    public get effectiveCapabilities(): TeamClusterEffectiveCapabilitiesProps {
        return resolveEffectiveCapabilitiesFromRoleConfig(this.props.roleConfig);
    }
};
