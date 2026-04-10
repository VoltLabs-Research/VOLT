import service from '@/modules/lammps/api/service';
import {
    buildKeys,
    createInvalidatingMutation,
    createMutation,
    createQuery
} from '@/shared/infrastructure/query';
import queryClient from '@/shared/infrastructure/query/query-client';
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
    LammpsExecution,
    LammpsFolder,
    LammpsScript,
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

interface LammpsQueryKeyMap extends Record<string, unknown> {
    packages: LammpsTeamScopedParams;
    runClusters: LammpsTeamScopedParams;
    containers: ListLammpsContainersParams;
    folders: ListLammpsFoldersParams;
    folder: GetLammpsFolderParams;
    scripts: ListLammpsScriptsParams;
    script: GetLammpsScriptParams;
    workspace: GetLammpsWorkspaceParams;
    files: GetLammpsScriptParams;
    file: ReadLammpsFileParams;
    scriptExecutions: ListLammpsScriptExecutionsParams;
    executions: ListLammpsExecutionsParams;
    execution: GetLammpsExecutionParams;
    executionGlb: GetLammpsExecutionGlbParams;
    dumps: ListLammpsDumpsParams;
}

const KEYS = buildKeys<LammpsQueryKeyMap>('lammps');

export const lammpsPackagesQueryKey = KEYS.packages;
export const lammpsRunClustersQueryKey = KEYS.runClusters;
export const lammpsContainersQueryKey = KEYS.containers;
export const lammpsScriptsQueryKey = KEYS.scripts;
export const lammpsWorkspaceQueryKey = KEYS.workspace;
export const lammpsExecutionsQueryKey = KEYS.executions;
export const lammpsExecutionQueryKey = KEYS.execution;
export const lammpsExecutionGlbQueryKey = KEYS.executionGlb;
export const lammpsExecutionDumpsQueryKey = KEYS.dumps;

export const lammpsPackagesQuery = createQuery(KEYS.packages, service.listPackages);
export const lammpsRunClustersQuery = createQuery(KEYS.runClusters, service.listRunClusters);
export const lammpsContainersQuery = createQuery(KEYS.containers, service.listContainers);
export const lammpsScriptsQuery = createQuery(KEYS.scripts, service.listScripts);
export const lammpsScriptQuery = createQuery(KEYS.script, service.getScript);
export const lammpsWorkspaceQuery = createQuery(KEYS.workspace, service.getWorkspace);
export const lammpsFilesQuery = createQuery(KEYS.files, service.listFiles);
export const lammpsFileContentQuery = createQuery(KEYS.file, service.readFile);
export const lammpsScriptExecutionsQuery = createQuery(KEYS.scriptExecutions, service.listScriptExecutions);
export const lammpsExecutionsQuery = createQuery(KEYS.executions, service.listExecutions);
export const lammpsExecutionQuery = createQuery(KEYS.execution, service.getExecution);
export const lammpsExecutionGlbQuery = createQuery(KEYS.executionGlb, service.getExecutionGlb);
export const lammpsExecutionDumpsQuery = createQuery(KEYS.dumps, service.listExecutionDumps);

export const invalidateLammpsPackagesQuery = (params: LammpsTeamScopedParams) => lammpsPackagesQuery.invalidate(params);
export const invalidateLammpsRunClustersQuery = (params: LammpsTeamScopedParams) => lammpsRunClustersQuery.invalidate(params);
export const invalidateLammpsContainersQuery = () => queryClient.invalidateQueries({ queryKey: KEYS.containers() });
export const invalidateLammpsScriptsQuery = () => queryClient.invalidateQueries({ queryKey: KEYS.scripts() });
export const invalidateLammpsWorkspaceQuery = (params: GetLammpsWorkspaceParams) => lammpsWorkspaceQuery.invalidate(params);
export const invalidateLammpsFilesQuery = (params: GetLammpsScriptParams) => lammpsFilesQuery.invalidate(params);
export const invalidateLammpsScriptExecutionsQuery = (params: ListLammpsScriptExecutionsParams) => lammpsScriptExecutionsQuery.invalidate(params);
export const invalidateLammpsExecutionsQuery = () => queryClient.invalidateQueries({ queryKey: KEYS.executions() });
export const invalidateLammpsExecutionQuery = (params: GetLammpsExecutionParams) => lammpsExecutionQuery.invalidate(params);
export const invalidateLammpsExecutionGlbQuery = (params: GetLammpsExecutionGlbParams) => lammpsExecutionGlbQuery.invalidate(params);
export const invalidateLammpsExecutionDumpsQuery = (params: ListLammpsDumpsParams) => lammpsExecutionDumpsQuery.invalidate(params);

export const lammpsFoldersQueryKey = KEYS.folders;
export const lammpsFolderQueryKey = KEYS.folder;
export const lammpsFoldersQuery = createQuery(KEYS.folders, service.listFolders);
export const lammpsFolderQuery = createQuery(KEYS.folder, service.getFolder);
export const invalidateLammpsFoldersQuery = () => queryClient.invalidateQueries({ queryKey: KEYS.folders() });
export const invalidateLammpsFolderQuery = (params: GetLammpsFolderParams) => lammpsFolderQuery.invalidate(params);

export const useCreateLammpsFolderMutation = createInvalidatingMutation<LammpsFolder, CreateLammpsFolderParams>(
    service.createFolder,
    [KEYS.folders(), KEYS.scripts()]
);

export const useUpdateLammpsFolderMutation = createInvalidatingMutation<LammpsFolder, UpdateLammpsFolderParams>(
    service.updateFolder,
    (_data, variables) => [
        KEYS.folders(),
        KEYS.scripts(),
        KEYS.folder({ teamId: variables.teamId, folderId: variables.folderId })
    ]
);

export const useDeleteLammpsFolderMutation = createInvalidatingMutation<void, DeleteLammpsFolderParams>(
    service.deleteFolder,
    (_data, variables) => [
        KEYS.folders(),
        KEYS.scripts(),
        KEYS.folder({ teamId: variables.teamId, folderId: variables.folderId })
    ]
);

export const useCreateLammpsContainerMutation = createInvalidatingMutation<LammpsContainer, CreateLammpsContainerParams>(
    service.createContainer,
    [KEYS.containers()]
);

export const useDeleteLammpsContainerMutation = createInvalidatingMutation<void, DeleteLammpsContainerParams>(
    service.deleteContainer,
    [KEYS.containers(), KEYS.scripts()]
);

export const useCreateLammpsScriptMutation = createInvalidatingMutation<LammpsScript, CreateLammpsScriptParams>(
    service.createScript,
    [KEYS.scripts()]
);

export const useUpdateLammpsScriptMutation = createInvalidatingMutation<LammpsScript, UpdateLammpsScriptParams>(
    service.updateScript,
    (_data, variables) => [
        KEYS.scripts(),
        KEYS.workspace(),
        KEYS.script({ teamId: variables.teamId, scriptId: variables.scriptId })
    ]
);

export const useMoveLammpsScriptMutation = createInvalidatingMutation<LammpsScript, MoveLammpsScriptParams>(
    service.moveScript,
    (_data, variables) => [
        KEYS.scripts(),
        KEYS.script({ teamId: variables.teamId, scriptId: variables.scriptId })
    ]
);

export const useDeleteLammpsScriptMutation = createInvalidatingMutation<void, DeleteLammpsScriptParams>(
    service.deleteScript,
    [KEYS.scripts(), KEYS.executions()]
);

export const useWriteLammpsFileMutation = createMutation<{ written: boolean }, WriteLammpsFileParams>(
    service.writeFile
);

export const useCreateLammpsEntryMutation = createMutation<{ created: boolean }, CreateLammpsEntryParams>(
    service.createEntry
);

export const useMoveLammpsEntryMutation = createMutation<{ moved: boolean }, MoveLammpsEntryParams>(
    service.moveEntry
);

export const useDeleteLammpsEntryMutation = createMutation<{ deleted: boolean }, DeleteLammpsEntryParams>(
    service.deleteEntry
);

export const useUploadLammpsFilesMutation = createMutation<{ uploaded: boolean }, UploadLammpsFilesParams>(
    service.uploadFiles
);

export const useStartLammpsExecutionMutation = createMutation<LammpsExecution, StartLammpsExecutionParams>(
    service.startExecution,
    (_data, variables) => {
        invalidateLammpsScriptExecutionsQuery({
            teamId: variables.teamId,
            scriptId: variables.scriptId
        });
        invalidateLammpsExecutionsQuery();
        invalidateLammpsWorkspaceQuery({
            teamId: variables.teamId,
            scriptId: variables.scriptId
        });
    }
);

export const useStopLammpsExecutionMutation = createMutation<{ accepted: boolean }, StopLammpsExecutionParams>(
    service.stopExecution
);

export const useKillLammpsExecutionMutation = createMutation<{ accepted: boolean }, KillLammpsExecutionParams>(
    service.killExecution
);

export const useDeleteLammpsExecutionMutation = createMutation<void, DeleteLammpsExecutionParams>(
    service.deleteExecution,
    (_data, variables) => {
        invalidateLammpsExecutionsQuery();
        invalidateLammpsExecutionQuery({
            teamId: variables.teamId,
            executionId: variables.executionId
        });
        invalidateLammpsExecutionDumpsQuery({
            teamId: variables.teamId,
            executionId: variables.executionId
        });
    }
);

export const useDownloadLammpsDumpMutation = createMutation<Blob, DownloadLammpsDumpParams>(
    service.downloadExecutionDump
);

export const useDeleteLammpsDumpMutation = createMutation<void, DeleteLammpsDumpParams>(
    service.deleteExecutionDump,
    (_data, variables) => {
        invalidateLammpsExecutionQuery({
            teamId: variables.teamId,
            executionId: variables.executionId
        });
        invalidateLammpsExecutionDumpsQuery({
            teamId: variables.teamId,
            executionId: variables.executionId
        });
    }
);

export const useImportLammpsExecutionAsTrajectoryMutation = createMutation<Record<string, unknown>, ImportLammpsExecutionAsTrajectoryParams>(
    service.importExecutionAsTrajectory,
    (_data, variables) => {
        invalidateLammpsExecutionsQuery();
        invalidateLammpsExecutionQuery({
            teamId: variables.teamId,
            executionId: variables.executionId
        });
    }
);
