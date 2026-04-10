import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type { User } from '@/modules/auth/api/entities/user';

export type LammpsContainerStatus = 'provisioning' | 'ready' | 'failed' | 'deleting';
export type LammpsExecutionStatus =
    | 'pending'
    | 'starting'
    | 'created'
    | 'running'
    | 'stopping'
    | 'killing'
    | 'completed'
    | 'failed'
    | 'cancelled';
export type LammpsDumpStatus = 'ready' | 'failed';

export interface LammpsContainerProgressEvent {
    lammpsContainerId: string;
    operationId?: string;
    teamClusterId: string;
    status: LammpsContainerStatus;
    stage: string;
    step?: string;
    imageTag?: string;
    imageHash?: string;
    workspaceContainerId?: string;
    workspaceContainerName?: string;
    message?: string;
    timestamp: string;
}

export interface LammpsContainer {
    _id: string;
    team?: string;
    name: string;
    packages: string[];
    cpus?: number;
    teamClusterId?: TeamCluster | string | null;
    storageClusterId?: TeamCluster | string | null;
    operationId?: string;
    status: LammpsContainerStatus;
    imageTag?: string;
    imageHash?: string;
    workspaceContainerId?: string;
    workspaceContainerName?: string;
    workspaceRootPath?: string;
    lastError?: string;
    createdBy?: User | string;
    createdAt: string | Date;
    updatedAt: string | Date;
}

export interface LammpsFolder {
    _id: string;
    title: string;
    parent: string | null;
    createdBy?: User | string | null;
    createdAt: string | Date;
    updatedAt: string | Date;
}

export interface LammpsScript {
    _id: string;
    title: string;
    mpiRanks?: number;
    openmpThreads?: number;
    threads?: number;
    folder: string | null;
    container?: LammpsContainer | string | null;
    rootPath: string;
    entryFilePath: string;
    createdBy?: User | string;
    lastEditedBy?: User | string | null;
    createdAt: string | Date;
    updatedAt: string | Date;
}

export interface LammpsScriptFileEntry {
    _id: string;
    kind: 'file' | 'directory';
    name: string;
    path: string;
    relativePath: string;
    parentPath: string | null;
    size: number | null;
    permissions?: string;
    owner?: string;
    group?: string;
    date?: string;
}

export interface LammpsRunCluster {
    _id: string;
    name: string;
    status: string;
    effectiveRole: string;
    acceptsComputeJobs: boolean;
    acceptsStorageWrites: boolean;
}

export interface LammpsExecution {
    _id: string;
    team?: string;
    script?: Pick<LammpsScript, '_id' | 'title'> | string;
    container?: Pick<LammpsContainer, '_id' | 'name' | 'status'> | string;
    requestedBy?: User | string;
    computeClusterId?: TeamCluster | string;
    storageClusterId?: TeamCluster | string;
    runtimeRunId?: string;
    stagedTrajectoryId: string;
    status: LammpsExecutionStatus;
    terminalBuffer: string;
    lastTimestep?: number;
    dumpCount: number;
    startedAt?: string | Date;
    finishedAt?: string | Date;
    exitCode?: number | null;
    errorMessage?: string;
    importedTrajectoryId?: string | null;
    createdAt: string | Date;
    updatedAt: string | Date;
}

export interface LammpsSimulationCell {
    boundingBox?: {
        width: number;
        height: number;
        length: number;
    };
    geometry?: {
        cell_vectors: number[][];
        cell_origin: number[];
        periodic_boundary_conditions: {
            x: boolean;
            y: boolean;
            z: boolean;
        };
    };
}

export interface LammpsDump {
    _id: string;
    team?: string;
    script?: string;
    execution: string;
    stagedTrajectoryId: string;
    timestep: number;
    fileName: string;
    dumpObjectKey: string;
    modelObjectKey?: string;
    storageClusterId?: TeamCluster | string;
    sizeBytes?: number;
    natoms?: number;
    simulationCell?: LammpsSimulationCell | null;
    status: LammpsDumpStatus;
    exportedAt?: string | Date;
    createdAt: string | Date;
    updatedAt: string | Date;
}

export interface LammpsWorkspace {
    script: LammpsScript;
    files: LammpsScriptFileEntry[];
    executions: LammpsExecution[];
    selectedExecution: LammpsExecution | null;
    dumps: LammpsDump[];
    availableRunClusters: LammpsRunCluster[];
}

export interface LammpsExecutionUpdatedEvent {
    executionId: string;
    scriptId: string;
    runtimeRunId?: string;
    status: LammpsExecutionStatus;
    lastTimestep?: number;
    dumpCount: number;
    startedAt?: string | Date;
    finishedAt?: string | Date;
    exitCode?: number | null;
    errorMessage?: string;
    stage?: string;
    step?: string;
    timestamp: string;
}

export interface LammpsExecutionLogEvent {
    executionId: string;
    stream: string;
    line: string;
    timestamp: string;
}

export interface LammpsDumpUpdatedEvent {
    executionId: string;
    dumpId: string;
    timestep: number;
    fileName: string;
    dumpObjectKey: string;
    modelObjectKey?: string;
    natoms?: number;
    simulationCell?: LammpsSimulationCell | null;
    sizeBytes?: number;
    timestamp: string;
}

export interface LammpsTeamScopedParams {
    teamId: string;
}

export interface ListLammpsContainersParams extends LammpsTeamScopedParams {
    page: number;
    limit: number;
    search?: string;
}

export interface CreateLammpsContainerParams extends LammpsTeamScopedParams {
    name: string;
    packages: string[];
    cpus: number;
    teamClusterId?: string;
}

export interface DeleteLammpsContainerParams extends LammpsTeamScopedParams {
    containerId: string;
}

export interface ListLammpsFoldersParams extends LammpsTeamScopedParams {
    page: number;
    limit: number;
    parentId?: string | null;
}

export interface GetLammpsFolderParams extends LammpsTeamScopedParams {
    folderId: string;
}

export interface CreateLammpsFolderParams extends LammpsTeamScopedParams {
    title: string;
    parentId?: string | null;
}

export interface UpdateLammpsFolderParams extends LammpsTeamScopedParams {
    folderId: string;
    title: string;
}

export interface DeleteLammpsFolderParams extends LammpsTeamScopedParams {
    folderId: string;
}

export interface ListLammpsScriptsParams extends LammpsTeamScopedParams {
    page: number;
    limit: number;
    search?: string;
    folderId?: string | null;
}

export interface CreateLammpsScriptParams extends LammpsTeamScopedParams {
    title: string;
    containerId: string;
    folderId?: string | null;
}

export interface GetLammpsScriptParams extends LammpsTeamScopedParams {
    scriptId: string;
}

export interface UpdateLammpsScriptParams extends LammpsTeamScopedParams {
    scriptId: string;
    title?: string;
    mpiRanks?: number;
    openmpThreads?: number;
    threads?: number;
}

export interface DeleteLammpsScriptParams extends LammpsTeamScopedParams {
    scriptId: string;
}

export interface MoveLammpsScriptParams extends LammpsTeamScopedParams {
    scriptId: string;
    folderId?: string | null;
}

export interface GetLammpsWorkspaceParams extends LammpsTeamScopedParams {
    scriptId: string;
    selectedExec?: string;
}

export interface ReadLammpsFileParams extends LammpsTeamScopedParams {
    scriptId: string;
    path: string;
}

export interface WriteLammpsFileParams extends LammpsTeamScopedParams {
    scriptId: string;
    path: string;
    content: string;
}

export interface CreateLammpsEntryParams extends LammpsTeamScopedParams {
    scriptId: string;
    path: string;
    kind: 'file' | 'directory';
    content?: string;
}

export interface MoveLammpsEntryParams extends LammpsTeamScopedParams {
    scriptId: string;
    sourcePath: string;
    destinationPath: string;
}

export interface DeleteLammpsEntryParams extends LammpsTeamScopedParams {
    scriptId: string;
    path: string;
}

export interface UploadLammpsFilesParams extends LammpsTeamScopedParams {
    scriptId: string;
    destinationPath?: string;
    files: File[];
}

export interface ListLammpsScriptExecutionsParams extends LammpsTeamScopedParams {
    scriptId: string;
}

export interface StartLammpsExecutionParams extends LammpsTeamScopedParams {
    scriptId: string;
    teamClusterId?: string;
}

export interface ListLammpsExecutionsParams extends LammpsTeamScopedParams {
    page: number;
    limit: number;
    search?: string;
}

export interface GetLammpsExecutionParams extends LammpsTeamScopedParams {
    executionId: string;
}

export interface GetLammpsExecutionGlbParams extends LammpsTeamScopedParams {
    executionId: string;
    timestep: number;
}

export interface DownloadLammpsDumpParams extends LammpsTeamScopedParams {
    executionId: string;
    dumpId: string;
}

export interface DeleteLammpsExecutionParams extends LammpsTeamScopedParams {
    executionId: string;
}

export interface DeleteLammpsDumpParams extends LammpsTeamScopedParams {
    executionId: string;
    dumpId: string;
}

export interface StopLammpsExecutionParams extends LammpsTeamScopedParams {
    executionId: string;
}

export interface KillLammpsExecutionParams extends LammpsTeamScopedParams {
    executionId: string;
}

export interface ListLammpsDumpsParams extends LammpsTeamScopedParams {
    executionId: string;
}

export interface ImportLammpsExecutionAsTrajectoryParams extends LammpsTeamScopedParams {
    executionId: string;
    name: string;
}
