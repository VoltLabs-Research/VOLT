import { http } from '@/app/core/http/utilities/create-client';
import { custom, del, get, paginated, patch, post, request } from '@/app/core/http/utilities/create-service';
import { defineServiceModule } from '@/shared/api/service-module';
import { buildFileFormData } from '@/shared/utils/file';
import type { VoltClient } from '@voltstack/voltclient';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type {
    CreateLammpsContainerParams,
    CreateLammpsEntryParams,
    CreateLammpsFolderParams,
    CreateLammpsScriptParams,
    DeleteLammpsDumpParams,
    DeleteLammpsContainerParams,
    DeleteLammpsEntryParams,
    DeleteLammpsExecutionParams,
    DeleteLammpsFolderParams,
    DeleteLammpsScriptParams,
    DownloadLammpsDumpParams,
    GetLammpsExecutionParams,
    GetLammpsExecutionGlbParams,
    GetLammpsFolderParams,
    GetLammpsScriptParams,
    GetLammpsWorkspaceParams,
    ImportLammpsExecutionAsTrajectoryParams,
    KillLammpsExecutionParams,
    LammpsContainer,
    LammpsDump,
    LammpsExecution,
    LammpsFolder,
    LammpsRunCluster,
    LammpsScript,
    LammpsScriptFileEntry,
    LammpsWorkspace,
    ListLammpsContainersParams,
    ListLammpsDumpsParams,
    ListLammpsExecutionsParams,
    ListLammpsFoldersParams,
    ListLammpsScriptExecutionsParams,
    ListLammpsScriptsParams,
    LammpsTeamScopedParams,
    MoveLammpsEntryParams,
    MoveLammpsScriptParams,
    ReadLammpsFileParams,
    StartLammpsExecutionParams,
    StopLammpsExecutionParams,
    UpdateLammpsFolderParams,
    UpdateLammpsScriptParams,
    UploadLammpsFilesParams,
    WriteLammpsFileParams
} from '@/modules/lammps/api/types';

type RequestArgsWithTimeout = NonNullable<Parameters<VoltClient['request']>[2]> & {
    timeoutMs: number;
};

const endpoints = {
    listPackages: get<LammpsTeamScopedParams, string[]>('/packages'),
    listRunClusters: get<LammpsTeamScopedParams, LammpsRunCluster[]>('/run-clusters'),
    listContainers: paginated<ListLammpsContainersParams, PaginatedResponse<LammpsContainer>>('/containers'),
    createContainer: post<CreateLammpsContainerParams, LammpsContainer>('/containers', {
        body: ({ name, packages, teamClusterId, cpus }) => ({
            name,
            packages,
            teamClusterId,
            cpus
        })
    }),
    deleteContainer: del<DeleteLammpsContainerParams>('/containers/:containerId'),
    listFolders: paginated<ListLammpsFoldersParams, PaginatedResponse<LammpsFolder>>('/folders'),
    getFolder: get<GetLammpsFolderParams, LammpsFolder>('/folders/:folderId'),
    createFolder: post<CreateLammpsFolderParams, LammpsFolder>('/folders', {
        body: ({ title, parentId }) => ({ title, parentId })
    }),
    updateFolder: patch<UpdateLammpsFolderParams, LammpsFolder>('/folders/:folderId', {
        body: ({ title }) => ({ title })
    }),
    deleteFolder: del<DeleteLammpsFolderParams>('/folders/:folderId'),
    listScripts: paginated<ListLammpsScriptsParams, PaginatedResponse<LammpsScript>>('/scripts'),
    createScript: post<CreateLammpsScriptParams, LammpsScript>('/scripts', {
        body: ({ title, folderId, containerId }) => ({
            title,
            folderId,
            containerId
        })
    }),
    getScript: get<GetLammpsScriptParams, LammpsScript>('/scripts/:scriptId'),
    updateScript: patch<UpdateLammpsScriptParams, LammpsScript>('/scripts/:scriptId', {
        body: ({ title, mpiRanks, openmpThreads, threads }) => ({
            ...(typeof title === 'string' ? { title } : {}),
            ...(typeof mpiRanks === 'number' ? { mpiRanks } : {}),
            ...(typeof openmpThreads === 'number' ? { openmpThreads } : {}),
            ...(typeof threads === 'number' ? { threads } : {})
        })
    }),
    deleteScript: del<DeleteLammpsScriptParams>('/scripts/:scriptId'),
    moveScript: patch<MoveLammpsScriptParams, LammpsScript>('/scripts/:scriptId/folder', {
        body: ({ folderId }) => ({ folderId })
    }),
    getWorkspace: get<GetLammpsWorkspaceParams, LammpsWorkspace>('/scripts/:scriptId/workspace'),
    listFiles: get<GetLammpsScriptParams, LammpsScriptFileEntry[]>('/scripts/:scriptId/files'),
    readFile: get<ReadLammpsFileParams, { contents: string }>('/scripts/:scriptId/files/content'),
    writeFile: custom<WriteLammpsFileParams, { written: boolean }>(async (_context, params) => {
        return http.request({
            method: 'PUT' as never,
            url: `/lammps/${params.teamId}/scripts/${params.scriptId}/files/content`,
            body: {
                path: params.path,
                content: params.content
            }
        });
    }),
    createEntry: post<CreateLammpsEntryParams, { created: boolean }>('/scripts/:scriptId/files', {
        body: ({ path, kind, content }) => ({ path, kind, content })
    }),
    moveEntry: patch<MoveLammpsEntryParams, { moved: boolean }>('/scripts/:scriptId/files/move', {
        body: ({ sourcePath, destinationPath }) => ({
            sourcePath,
            destinationPath
        })
    }),
    deleteEntry: custom<DeleteLammpsEntryParams, { deleted: boolean }>(async (_context, params) => {
        return http.request({
            method: 'DELETE',
            url: `/lammps/${params.teamId}/scripts/${params.scriptId}/files`,
            body: {
                path: params.path
            }
        });
    }),
    uploadFiles: request<UploadLammpsFilesParams, { uploaded: boolean }>('POST', '/scripts/:scriptId/files/upload', {
        body: ({ files, destinationPath }) => buildFileFormData(
            files.map((file) => ({ name: 'files', file })),
            destinationPath ? { destinationPath } : undefined
        ),
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    listScriptExecutions: get<ListLammpsScriptExecutionsParams, LammpsExecution[]>('/scripts/:scriptId/executions'),
    startExecution: post<StartLammpsExecutionParams, LammpsExecution>('/scripts/:scriptId/executions', {
        body: ({ teamClusterId }) => ({ teamClusterId })
    }),
    listExecutions: paginated<ListLammpsExecutionsParams, PaginatedResponse<LammpsExecution>>('/executions'),
    getExecution: get<GetLammpsExecutionParams, LammpsExecution>('/executions/:executionId'),
    getExecutionGlb: custom<GetLammpsExecutionGlbParams, Blob>(async ({ getClient }, params) => {
        const requestArgs: RequestArgsWithTimeout = {
            responseType: 'blob',
            timeoutMs: 0
        };

        return getClient().request('GET', `/executions/${params.executionId}/dumps/${params.timestep}/glb`, requestArgs);
    }),
    downloadExecutionDump: custom<DownloadLammpsDumpParams, Blob>(async ({ getClient }, params) => {
        const requestArgs: RequestArgsWithTimeout = {
            responseType: 'blob',
            timeoutMs: 0
        };

        return getClient().request('GET', `/executions/${params.executionId}/dumps/${params.dumpId}/download`, requestArgs);
    }),
    deleteExecution: del<DeleteLammpsExecutionParams>('/executions/:executionId'),
    deleteExecutionDump: del<DeleteLammpsDumpParams>('/executions/:executionId/dumps/:dumpId'),
    listExecutionDumps: get<ListLammpsDumpsParams, LammpsDump[]>('/executions/:executionId/dumps'),
    stopExecution: post<StopLammpsExecutionParams, { accepted: boolean }>('/executions/:executionId/stop'),
    killExecution: post<KillLammpsExecutionParams, { accepted: boolean }>('/executions/:executionId/kill'),
    importExecutionAsTrajectory: post<ImportLammpsExecutionAsTrajectoryParams, Record<string, unknown>>(
        '/executions/:executionId/import-trajectory',
        { body: ({ name }) => ({ name }) }
    )
};

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/lammps',
            useRBAC: true
        }
    },
    endpoints
});
