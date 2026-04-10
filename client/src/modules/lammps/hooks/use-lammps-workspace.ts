import {
    invalidateLammpsFilesQuery,
    invalidateLammpsWorkspaceQuery,
    lammpsFileContentQuery,
    lammpsWorkspaceQuery,
    useCreateLammpsEntryMutation,
    useDeleteLammpsDumpMutation,
    useDeleteLammpsEntryMutation,
    useDownloadLammpsDumpMutation,
    useImportLammpsExecutionAsTrajectoryMutation,
    useKillLammpsExecutionMutation,
    useMoveLammpsEntryMutation,
    useStartLammpsExecutionMutation,
    useStopLammpsExecutionMutation,
    useUpdateLammpsScriptMutation,
    useUploadLammpsFilesMutation,
    useWriteLammpsFileMutation
} from '@/modules/lammps/hooks/queries';
import useLammpsExecutionGlbPreview from '@/modules/lammps/hooks/use-lammps-execution-glb-preview';
import useLammpsExecutionSocket from '@/modules/lammps/hooks/use-lammps-execution-socket';
import useLammpsScriptSocket from '@/modules/lammps/hooks/use-lammps-script-socket';
import { useClusterResourceLimitsQuery } from '@/modules/container/hooks/queries';
import {
    joinWorkspacePath,
    normalizeWorkspaceFolderPath,
    normalizeWorkspaceRelativePath,
    splitWorkspacePath
} from '@/modules/latex/utilities/workspace';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { createCrudToastOptions, createPromiseToastOptions } from '@/shared/presentation/toast-options';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sileo } from 'sileo';
import type {
    LammpsDump,
    LammpsDumpUpdatedEvent,
    LammpsExecution,
    LammpsExecutionUpdatedEvent,
    LammpsRunCluster,
    LammpsScriptFileEntry
} from '@/modules/lammps/api/types';
import type {
    LatexEditorGroup,
    LatexEditorGroupId,
    LatexFileEntry,
    LatexWorkspaceSelection,
    LatexWorkspaceTab
} from '@/modules/latex/hooks/use-latex-workspace';
import type { ChangeEvent } from 'react';
import type { FileWithPath } from '@/shared/utils/file';

interface UseLammpsWorkspaceInput {
    scriptId: string;
}

interface FileEditorState {
    content: string;
    lastSavedContent: string;
    remoteContent: string;
    isDirty: boolean;
}

interface PendingRemoteFileUpdate {
    content: string;
    timestamp: number;
}

interface UseLammpsWorkspaceResult {
    accessDenied: boolean;
    accessDeniedMessage?: string;
    activeEditorGroupId: LatexEditorGroupId;
    availableRunClusters: LammpsRunCluster[];
    collaborators: ReturnType<typeof useLammpsScriptSocket>['collaborators'];
    currentTimestep: number;
    dirtyFileIds: string[];
    dumps: LammpsDump[];
    editorContent: string;
    editorGroups: LatexEditorGroup[];
    executions: LammpsExecution[];
    files: LatexFileEntry[];
    folders: string[];
    isDirty: boolean;
    isExecutionActive: boolean;
    isImportingTrajectory: boolean;
    isLoading: boolean;
    isPreviewLoading: boolean;
    isUpdatingPerformance: boolean;
    isRunActionPending: boolean;
    isSaving: boolean;
    isLoadingPerformanceLimits: boolean;
    isUploading: boolean;
    performanceClusterName: string | null;
    performanceMpiRanks: number;
    performanceOpenmpThreads: number;
    maxPerformanceCpus: number | null;
    previewGlbUrl: string | null;
    previewErrorMessage: string | null;
    scriptTitle: string;
    selectedExecution: LammpsExecution | null;
    selectedRunClusterId: string | null;
    selectedDump: LammpsDump | null;
    terminalBuffer: string;
    handleApplyRemoteUpdate: () => void;
    handleCreateFile: (name: string, path?: string, content?: string) => Promise<unknown>;
    handleCreateFolder: (folderPath: string) => Promise<void>;
    handleDeleteFile: (fileId: string) => Promise<void>;
    handleDeleteFileDirect: (input: { documentId: string; fileId: string }) => Promise<unknown>;
    handleDeleteDump: (dump: LammpsDump) => Promise<void>;
    handleDeleteFolderDirect: (folderPath: string) => Promise<unknown>;
    handleDownloadDump: (dump: LammpsDump) => Promise<void>;
    handleDismissRemoteUpdate: () => void;
    handleEditorChange: (value: string | undefined) => void;
    handleExecutionSelection: (executionId: string) => void;
    handleFocusEditorGroup: () => void;
    handleImportExecutionAsTrajectory: (name: string) => Promise<void>;
    handleMoveFolderDirect: (sourceFolderPath: string, targetFolderPath: string) => Promise<unknown>;
    handleRenameFile: (fileId: string, name: string) => Promise<void>;
    handleReorderTabs: (activeTab: LatexWorkspaceTab, overTab: LatexWorkspaceTab | null, position: 'before' | 'after' | 'end') => void;
    handleRunAction: () => Promise<void>;
    handleRunClusterSelection: (clusterId: string) => void;
    handleSelectDumpTimestep: (timestep: number) => void;
    handleSelectFileById: (fileId: string) => void;
    handleSelectTab: (tab: LatexWorkspaceTab) => void;
    handleTabClose: (tab: LatexWorkspaceTab) => void;
    handleUpdatePerformanceConfig: (config: {
        mpiRanks: number;
        openmpThreads: number;
    }) => Promise<void>;
    handleUpdateAssetDirect: (input: { documentId: string; assetId: string; path: string }) => Promise<unknown>;
    handleUpdateFileDirect: (input: { documentId: string; fileId: string; path?: string; name?: string; content?: string }) => Promise<unknown>;
    handleUploadEntries: (entries: FileWithPath[]) => Promise<void>;
    handleUploadFilesSelected: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
    handleUploadFoldersSelected: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
    hasPendingRemoteUpdate: boolean;
}

const AUTOSAVE_DELAY = 500;
const STOP_DOUBLE_CLICK_MS = 500;
const PRIMARY_EDITOR_GROUP_ID: LatexEditorGroupId = 'primary';
const ACTIVE_EXECUTION_STATUSES = new Set(['pending', 'starting', 'created', 'running', 'stopping', 'killing']);
const STOPPABLE_EXECUTION_STATUSES = new Set(['pending', 'starting', 'created', 'running']);
const TERMINAL_EXECUTION_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const RUN_EXECUTION_TOAST = createPromiseToastOptions({
    loading: 'Starting LAMMPS execution...',
    success: 'LAMMPS execution started',
    error: 'Failed to start LAMMPS execution'
});
const STOP_EXECUTION_TOAST = createPromiseToastOptions({
    loading: 'Stopping LAMMPS execution...',
    success: 'Stop requested',
    error: 'Failed to stop LAMMPS execution'
});
const KILL_EXECUTION_TOAST = createPromiseToastOptions({
    loading: 'Force-killing LAMMPS execution...',
    success: 'Execution was force-killed',
    error: 'Failed to force-kill LAMMPS execution'
});
const IMPORT_EXECUTION_TOAST = createCrudToastOptions({
    action: 'Importing',
    subject: 'Trajectory',
    success: 'Trajectory imported successfully',
    error: 'Failed to import trajectory'
});
const DOWNLOAD_DUMP_TOAST = createPromiseToastOptions({
    loading: 'Downloading dump...',
    success: 'Dump downloaded',
    error: 'Failed to download dump'
});
const DELETE_DUMP_TOAST = createCrudToastOptions({
    action: 'Deleting',
    subject: 'Dump',
    success: 'Dump deleted successfully',
    error: 'Failed to delete dump'
});
const UPDATE_PERFORMANCE_TOAST = createCrudToastOptions({
    action: 'Updating',
    subject: 'Performance',
    success: 'Performance updated successfully',
    error: 'Failed to update performance'
});

const createEditorGroup = (): LatexEditorGroup => ({
    id: PRIMARY_EDITOR_GROUP_ID,
    selection: null,
    openTabs: []
});

const createFileEditorState = (content: string): FileEditorState => ({
    content,
    lastSavedContent: content,
    remoteContent: content,
    isDirty: false
});

const isSameTab = (left: LatexWorkspaceTab, right: LatexWorkspaceTab): boolean => {
    return left.type === right.type && left.id === right.id;
};

const ensureLineBreak = (value: string): string => {
    return value.endsWith('\n') ? value : `${value}\n`;
};

const getModelId = (value: unknown): string | null => {
    if (!value) {
        return null;
    }

    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'object' && '_id' in value && typeof value._id === 'string') {
        return value._id;
    }

    return null;
};

const getNextSelectionAfterClose = (
    tabs: LatexWorkspaceTab[],
    tabToClose: LatexWorkspaceTab,
    currentSelection: LatexWorkspaceSelection
): LatexWorkspaceSelection => {
    if (!currentSelection || currentSelection.type !== tabToClose.type || currentSelection.id !== tabToClose.id) {
        return currentSelection;
    }

    const tabIndex = tabs.findIndex((tab) => isSameTab(tab, tabToClose));
    if (tabIndex < 0) {
        return currentSelection;
    }

    const nextTabs = tabs.filter((_, index) => index !== tabIndex);
    return nextTabs[tabIndex] ?? nextTabs[tabIndex - 1] ?? null;
};

const sortDumps = (dumps: LammpsDump[]): LammpsDump[] => {
    return [...dumps].sort((left, right) => left.timestep - right.timestep);
};

const mergeExecution = (current: LammpsExecution | null, incoming: LammpsExecution | null): LammpsExecution | null => {
    if (!incoming) {
        return current;
    }

    if (!current || current._id !== incoming._id) {
        return incoming;
    }

    const shouldTrustIncomingBuffer = TERMINAL_EXECUTION_STATUSES.has(incoming.status);

    return {
        ...current,
        ...incoming,
        terminalBuffer: shouldTrustIncomingBuffer || (incoming.terminalBuffer?.length ?? 0) >= (current.terminalBuffer?.length ?? 0)
            ? incoming.terminalBuffer
            : current.terminalBuffer
    };
};

const mergeExecutionLists = (current: LammpsExecution[], incoming: LammpsExecution[]): LammpsExecution[] => {
    if (current.length === 0) {
        return incoming;
    }

    const currentById = new Map(current.map((execution) => [execution._id, execution]));
    const merged = incoming.map((execution) => ({
        ...currentById.get(execution._id),
        ...execution,
        terminalBuffer: TERMINAL_EXECUTION_STATUSES.has(execution.status)
            || (execution.terminalBuffer?.length ?? 0) >= (currentById.get(execution._id)?.terminalBuffer?.length ?? 0)
            ? execution.terminalBuffer
            : currentById.get(execution._id)?.terminalBuffer ?? execution.terminalBuffer
    }));

    for (const execution of current) {
        if (!currentById.has(execution._id) || incoming.some((incomingExecution) => incomingExecution._id === execution._id)) {
            continue;
        }

        merged.push(execution);
    }

    return merged;
};

const mergeDumps = (current: LammpsDump[], incoming: LammpsDump[]): LammpsDump[] => {
    if (current.length === 0) {
        return incoming;
    }

    const dumpsById = new Map<string, LammpsDump>();

    for (const dump of current) {
        dumpsById.set(dump._id, dump);
    }

    for (const dump of incoming) {
        dumpsById.set(dump._id, {
            ...dumpsById.get(dump._id),
            ...dump
        });
    }

    return sortDumps(Array.from(dumpsById.values()));
};

const toLatexFileEntry = (
    entry: LammpsScriptFileEntry,
    editorState: FileEditorState | undefined,
    entryFilePath: string
): LatexFileEntry => {
    return {
        _id: entry.relativePath,
        name: entry.name,
        path: normalizeWorkspaceFolderPath(entry.parentPath ?? ''),
        content: editorState?.content ?? '',
        isEntrypoint: normalizeWorkspaceRelativePath(entry.relativePath) === normalizeWorkspaceRelativePath(entryFilePath),
        isSelected: false
    };
};

const buildFolderAncestors = (filePath: string): string[] => {
    const normalized = normalizeWorkspaceRelativePath(filePath);
    const { path } = splitWorkspacePath(normalized);
    if (!path) {
        return [];
    }

    const segments = path.replace(/\/$/, '').split('/').filter(Boolean);
    const folders: string[] = [];
    let current = '';

    for (const segment of segments) {
        current = current ? `${current}/${segment}` : segment;
        folders.push(current);
    }

    return folders;
};

const useLammpsWorkspace = ({
    scriptId
}: UseLammpsWorkspaceInput): UseLammpsWorkspaceResult => {
    const socketService = useSocket();
    const teamId = useSelectedTeamId();
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();
    const { searchParams, updateSearchParams, setParam } = useSearchParamsState();
    const selectedExecutionId = searchParams.get('selectedExec') || undefined;
    const timestepParam = searchParams.get('timestep');
    const requestedTimestep = timestepParam === null || timestepParam.trim() === ''
        ? null
        : Number(timestepParam);
    const workspaceQueryResult = lammpsWorkspaceQuery({
        teamId: teamId ?? '',
        scriptId,
        selectedExec: selectedExecutionId
    }, {
        enabled: Boolean(teamId && scriptId)
    });

    const activeEditorGroupId: LatexEditorGroupId = PRIMARY_EDITOR_GROUP_ID;
    const [editorGroup, setEditorGroup] = useState<LatexEditorGroup>(createEditorGroup);
    const [fileEditorStates, setFileEditorStates] = useState<Record<string, FileEditorState>>({});
    const [pendingRemoteUpdates, setPendingRemoteUpdates] = useState<Record<string, PendingRemoteFileUpdate>>({});
    const [selectedRunClusterId, setSelectedRunClusterId] = useState<string | null>(null);
    const [executions, setExecutions] = useState<LammpsExecution[]>([]);
    const [selectedExecution, setSelectedExecution] = useState<LammpsExecution | null>(null);
    const [dumps, setDumps] = useState<LammpsDump[]>([]);
    const [terminalBuffer, setTerminalBuffer] = useState('');
    const [savingCount, setSavingCount] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [isImportingTrajectory, setIsImportingTrajectory] = useState(false);

    const fileEditorStatesRef = useRef<Record<string, FileEditorState>>({});
    const autosaveTimersRef = useRef<Record<string, number>>({});
    const fileEntriesRef = useRef<LammpsScriptFileEntry[]>([]);
    const didBootstrapSelectionRef = useRef(false);
    const lastStopIntentAtRef = useRef(0);
    const lastExecutionEventKeyRef = useRef<string | null>(null);
    const hydratedExecutionIdRef = useRef<string | null>(null);
    const selectedExecutionIdRef = useRef<string | null>(null);

    const createEntryMutation = useCreateLammpsEntryMutation();
    const moveEntryMutation = useMoveLammpsEntryMutation();
    const deleteEntryMutation = useDeleteLammpsEntryMutation();
    const uploadFilesMutation = useUploadLammpsFilesMutation();
    const writeFileMutation = useWriteLammpsFileMutation();
    const updateScriptMutation = useUpdateLammpsScriptMutation();
    const startExecutionMutation = useStartLammpsExecutionMutation();
    const stopExecutionMutation = useStopLammpsExecutionMutation();
    const killExecutionMutation = useKillLammpsExecutionMutation();
    const downloadDumpMutation = useDownloadLammpsDumpMutation();
    const deleteDumpMutation = useDeleteLammpsDumpMutation();
    const importExecutionMutation = useImportLammpsExecutionAsTrajectoryMutation();

    const workspace = workspaceQueryResult.data;
    const script = workspace?.script ?? null;
    const performanceClusterId = useMemo(() => {
        if (!script?.container || typeof script.container === 'string') {
            return null;
        }

        return getModelId(script.container.teamClusterId);
    }, [script?.container]);
    const performanceClusterName = useMemo(() => {
        if (!script?.container || typeof script.container === 'string') {
            return null;
        }

        const cluster = script.container.teamClusterId;
        if (cluster && typeof cluster === 'object' && 'name' in cluster && typeof cluster.name === 'string') {
            return cluster.name;
        }

        return null;
    }, [script?.container]);
    const performanceLimitsQuery = useClusterResourceLimitsQuery({
        teamId: teamId ?? '',
        teamClusterId: performanceClusterId ?? ''
    }, {
        enabled: Boolean(teamId) && Boolean(performanceClusterId)
    });
    const availableRunClusters = useMemo(() => {
        return (workspace?.availableRunClusters ?? []).filter((cluster) => cluster.acceptsComputeJobs);
    }, [workspace?.availableRunClusters]);
    const scriptFiles = useMemo(() => {
        return (workspace?.files ?? []).filter((entry): entry is LammpsScriptFileEntry => entry.kind === 'file');
    }, [workspace?.files]);
    const directoryEntries = useMemo(() => {
        return (workspace?.files ?? []).filter((entry): entry is LammpsScriptFileEntry => entry.kind === 'directory');
    }, [workspace?.files]);

    const files = useMemo<LatexFileEntry[]>(() => {
        return scriptFiles.map((entry) => toLatexFileEntry(
            entry,
            fileEditorStates[entry.relativePath],
            script?.entryFilePath ?? ''
        ));
    }, [fileEditorStates, script?.entryFilePath, scriptFiles]);

    const folders = useMemo(() => {
        return directoryEntries.map((entry) => normalizeWorkspaceFolderPath(entry.relativePath));
    }, [directoryEntries]);

    const activeFile = useMemo(() => {
        if (!editorGroup.selection || editorGroup.selection.type !== 'file') {
            return null;
        }

        return files.find((file) => file._id === editorGroup.selection?.id) ?? null;
    }, [editorGroup.selection, files]);

    const activePendingRemoteUpdate = activeFile
        ? pendingRemoteUpdates[activeFile._id] ?? null
        : null;
    const dirtyFileIds = useMemo(() => {
        return Object.entries(fileEditorStates)
            .filter(([, state]) => state.isDirty)
            .map(([fileId]) => fileId);
    }, [fileEditorStates]);
    const editorContent = activeFile
        ? fileEditorStates[activeFile._id]?.content ?? ''
        : '';
    const isDirty = dirtyFileIds.length > 0;
    const isSaving = savingCount > 0;
    const performanceMpiRanks = useMemo(() => {
        const rawMpiRanks = script?.mpiRanks ?? script?.threads;
        if (typeof rawMpiRanks !== 'number' || !Number.isFinite(rawMpiRanks) || rawMpiRanks < 1) {
            return 1;
        }

        return Math.max(1, Math.floor(rawMpiRanks));
    }, [script?.mpiRanks, script?.threads]);
    const performanceOpenmpThreads = useMemo(() => {
        const rawOpenmpThreads = script?.openmpThreads;
        if (typeof rawOpenmpThreads !== 'number' || !Number.isFinite(rawOpenmpThreads) || rawOpenmpThreads < 1) {
            return 1;
        }

        return Math.max(1, Math.floor(rawOpenmpThreads));
    }, [script?.openmpThreads]);
    const maxPerformanceCpus = useMemo(() => {
        const maxCpus = performanceLimitsQuery.data?.maxCpus;
        if (typeof maxCpus !== 'number' || !Number.isFinite(maxCpus) || maxCpus < 1) {
            return null;
        }

        return Math.max(1, Math.floor(maxCpus));
    }, [performanceLimitsQuery.data?.maxCpus]);

    const selectedDump = useMemo(() => {
        if (dumps.length === 0) {
            return null;
        }

        if (typeof requestedTimestep === 'number' && Number.isFinite(requestedTimestep)) {
            return dumps.find((dump) => dump.timestep === requestedTimestep) ?? dumps[dumps.length - 1] ?? null;
        }

        return dumps[dumps.length - 1] ?? null;
    }, [dumps, requestedTimestep]);
    const currentTimestep = selectedDump?.timestep ?? (
        typeof requestedTimestep === 'number' && Number.isFinite(requestedTimestep)
            ? requestedTimestep
            : 0
    );
    const {
        previewGlbUrl,
        isLoading: isPreviewLoading,
        errorMessage: previewErrorMessage
    } = useLammpsExecutionGlbPreview({
        teamId: teamId ?? undefined,
        executionId: selectedExecution?._id ?? null,
        timestep: selectedDump?.timestep ?? null,
        enabled: Boolean(teamId && selectedExecution?._id && selectedDump)
    });
    const isExecutionActive = Boolean(selectedExecution && ACTIVE_EXECUTION_STATUSES.has(selectedExecution.status));
    const isUpdatingPerformance = updateScriptMutation.isPending;
    const isLoadingPerformanceLimits = performanceLimitsQuery.isLoading;
    const isRunActionPending = startExecutionMutation.isPending
        || stopExecutionMutation.isPending
        || killExecutionMutation.isPending;

    const appendExecutionTerminalLine = useCallback((executionId: string, line: string) => {
        const nextLine = ensureLineBreak(line);

        setExecutions((current) => current.map((execution) => execution._id === executionId
            ? {
                ...execution,
                terminalBuffer: `${execution.terminalBuffer ?? ''}${nextLine}`
            }
            : execution
        ));

        setSelectedExecution((current) => current && current._id === executionId
            ? {
                ...current,
                terminalBuffer: `${current.terminalBuffer ?? ''}${nextLine}`
            }
            : current
        );

        if (selectedExecutionIdRef.current === executionId) {
            setTerminalBuffer((current) => `${current}${nextLine}`);
        }
    }, []);

    const refetchWorkspace = useCallback(() => {
        if (!teamId) {
            return Promise.resolve();
        }

        invalidateLammpsFilesQuery({ teamId, scriptId });
        invalidateLammpsWorkspaceQuery({
            teamId,
            scriptId,
            selectedExec: selectedExecutionId
        });
        return workspaceQueryResult.refetch().then(() => undefined);
    }, [scriptId, selectedExecutionId, teamId, workspaceQueryResult]);

    const clearAutosaveTimer = useCallback((fileId: string) => {
        const timerId = autosaveTimersRef.current[fileId];
        if (!timerId) {
            return;
        }

        window.clearTimeout(timerId);
        delete autosaveTimersRef.current[fileId];
    }, []);

    const persistFileContent = useCallback(async (fileId: string, content: string) => {
        if (!teamId || !scriptId) {
            return;
        }

        setSavingCount((current) => current + 1);

        try {
            await writeFileMutation.mutateAsync({
                teamId,
                scriptId,
                path: fileId,
                content
            });

            setFileEditorStates((current) => {
                const state = current[fileId];
                if (!state) {
                    return current;
                }

                return {
                    ...current,
                    [fileId]: {
                        ...state,
                        lastSavedContent: content,
                        isDirty: state.content !== content
                    }
                };
            });
        } catch (error) {
            checkAccessDeniedError(error);
            throw error;
        } finally {
            setSavingCount((current) => Math.max(0, current - 1));
        }
    }, [checkAccessDeniedError, scriptId, teamId, writeFileMutation]);

    const flushDirtyFiles = useCallback(async () => {
        const dirtyEntries = Object.entries(fileEditorStatesRef.current)
            .filter(([, state]) => state.isDirty);

        for (const [fileId] of dirtyEntries) {
            clearAutosaveTimer(fileId);
        }

        await Promise.all(dirtyEntries.map(async ([fileId, state]) => {
            if (!state.isDirty || state.content === state.lastSavedContent) {
                return;
            }

            await persistFileContent(fileId, state.content);
        }));
    }, [clearAutosaveTimer, persistFileContent]);

    const scheduleFileAutosave = useCallback((fileId: string, content: string) => {
        clearAutosaveTimer(fileId);

        const currentState = fileEditorStatesRef.current[fileId];
        if (!currentState || content === currentState.lastSavedContent) {
            return;
        }

        autosaveTimersRef.current[fileId] = window.setTimeout(() => {
            void persistFileContent(fileId, content)
                .catch((error) => {
                    const userError = reportError(error, {
                        surface: ErrorSurface.Silent,
                        fallbackTitle: 'Failed to save file'
                    });
                    sileo.error({
                        title: userError.title,
                        description: userError.description
                    });
                })
                .finally(() => {
                    delete autosaveTimersRef.current[fileId];
                });
        }, AUTOSAVE_DELAY);
    }, [clearAutosaveTimer, persistFileContent]);

    const loadFileContent = useCallback(async (fileId: string): Promise<string> => {
        if (!teamId || !scriptId) {
            return '';
        }

        const existingState = fileEditorStatesRef.current[fileId];
        if (existingState) {
            return existingState.content;
        }

        const response = await lammpsFileContentQuery.fetch({
            teamId,
            scriptId,
            path: fileId
        });
        const content = response.contents ?? '';

        setFileEditorStates((current) => ({
            ...current,
            [fileId]: createFileEditorState(content)
        }));

        return content;
    }, [scriptId, teamId]);

    const openFile = useCallback(async (fileId: string) => {
        const fileExists = fileEntriesRef.current.some((entry) => entry.relativePath === fileId);
        if (!fileExists) {
            return;
        }

        await loadFileContent(fileId);

        setEditorGroup((current) => {
            const nextTab: LatexWorkspaceTab = { type: 'file', id: fileId };
            const nextTabs = current.openTabs.some((tab) => isSameTab(tab, nextTab))
                ? current.openTabs
                : [...current.openTabs, nextTab];

            return {
                ...current,
                openTabs: nextTabs,
                selection: nextTab
            };
        });
    }, [loadFileContent]);

    const renameFileState = useCallback((sourcePath: string, destinationPath: string) => {
        setFileEditorStates((current) => {
            if (!current[sourcePath]) {
                return current;
            }

            const next = { ...current };
            next[destinationPath] = next[sourcePath];
            delete next[sourcePath];
            return next;
        });

        setPendingRemoteUpdates((current) => {
            if (!current[sourcePath]) {
                return current;
            }

            const next = { ...current };
            next[destinationPath] = next[sourcePath];
            delete next[sourcePath];
            return next;
        });

        setEditorGroup((current) => {
            const nextTabs = current.openTabs.map((tab) => {
                if (tab.type === 'file' && tab.id === sourcePath) {
                    return { ...tab, id: destinationPath };
                }

                return tab;
            });
            const nextSelection = current.selection?.type === 'file' && current.selection.id === sourcePath
                ? { ...current.selection, id: destinationPath }
                : current.selection;

            return {
                ...current,
                openTabs: nextTabs,
                selection: nextSelection
            };
        });
    }, []);

    const renameFolderState = useCallback((sourceFolderPath: string, targetFolderPath: string) => {
        const sourcePrefix = normalizeWorkspaceFolderPath(sourceFolderPath);
        const targetPrefix = normalizeWorkspaceFolderPath(targetFolderPath);
        if (!sourcePrefix || !targetPrefix) {
            return;
        }

        setFileEditorStates((current) => {
            const entries = Object.entries(current);
            if (!entries.some(([key]) => key.startsWith(sourcePrefix))) {
                return current;
            }

            const next: Record<string, FileEditorState> = {};
            for (const [key, value] of entries) {
                if (key.startsWith(sourcePrefix)) {
                    next[`${targetPrefix}${key.slice(sourcePrefix.length)}`] = value;
                } else {
                    next[key] = value;
                }
            }
            return next;
        });

        setPendingRemoteUpdates((current) => {
            const entries = Object.entries(current);
            if (!entries.some(([key]) => key.startsWith(sourcePrefix))) {
                return current;
            }

            const next: Record<string, PendingRemoteFileUpdate> = {};
            for (const [key, value] of entries) {
                if (key.startsWith(sourcePrefix)) {
                    next[`${targetPrefix}${key.slice(sourcePrefix.length)}`] = value;
                } else {
                    next[key] = value;
                }
            }
            return next;
        });

        setEditorGroup((current) => {
            const nextTabs = current.openTabs.map((tab) => {
                if (tab.type === 'file' && tab.id.startsWith(sourcePrefix)) {
                    return {
                        ...tab,
                        id: `${targetPrefix}${tab.id.slice(sourcePrefix.length)}`
                    };
                }

                return tab;
            });
            const nextSelection = current.selection?.type === 'file' && current.selection.id.startsWith(sourcePrefix)
                ? {
                    ...current.selection,
                    id: `${targetPrefix}${current.selection.id.slice(sourcePrefix.length)}`
                }
                : current.selection;

            return {
                ...current,
                openTabs: nextTabs,
                selection: nextSelection
            };
        });
    }, []);

    const removeFileState = useCallback((fileId: string) => {
        clearAutosaveTimer(fileId);

        setFileEditorStates((current) => {
            if (!(fileId in current)) {
                return current;
            }

            const next = { ...current };
            delete next[fileId];
            return next;
        });

        setPendingRemoteUpdates((current) => {
            if (!(fileId in current)) {
                return current;
            }

            const next = { ...current };
            delete next[fileId];
            return next;
        });

        setEditorGroup((current) => {
            const targetTab: LatexWorkspaceTab = { type: 'file', id: fileId };
            return {
                ...current,
                openTabs: current.openTabs.filter((tab) => !isSameTab(tab, targetTab)),
                selection: getNextSelectionAfterClose(current.openTabs, targetTab, current.selection)
            };
        });
    }, [clearAutosaveTimer]);

    const removeFolderState = useCallback((folderPath: string) => {
        const normalizedFolderPath = normalizeWorkspaceFolderPath(folderPath);
        if (!normalizedFolderPath) {
            return;
        }

        setFileEditorStates((current) => {
            const next: Record<string, FileEditorState> = {};
            let changed = false;

            for (const [key, value] of Object.entries(current)) {
                if (key.startsWith(normalizedFolderPath)) {
                    changed = true;
                    continue;
                }

                next[key] = value;
            }

            return changed ? next : current;
        });

        setPendingRemoteUpdates((current) => {
            const next: Record<string, PendingRemoteFileUpdate> = {};
            let changed = false;

            for (const [key, value] of Object.entries(current)) {
                if (key.startsWith(normalizedFolderPath)) {
                    changed = true;
                    continue;
                }

                next[key] = value;
            }

            return changed ? next : current;
        });

        setEditorGroup((current) => {
            const nextTabs = current.openTabs.filter((tab) => tab.type !== 'file' || !tab.id.startsWith(normalizedFolderPath));
            const nextSelection = current.selection?.type === 'file' && current.selection.id.startsWith(normalizedFolderPath)
                ? nextTabs[0] ?? null
                : current.selection;

            return {
                ...current,
                openTabs: nextTabs,
                selection: nextSelection
            };
        });
    }, []);

    const handleCreateFile = useCallback(async (name: string, path?: string, content = '') => {
        if (!teamId || !scriptId) {
            return;
        }

        const relativePath = normalizeWorkspaceRelativePath(joinWorkspacePath(path ?? '', name));
        await createEntryMutation.mutateAsync({
            teamId,
            scriptId,
            path: relativePath,
            kind: 'file',
            content
        });
        await refetchWorkspace();
        await openFile(relativePath);
    }, [createEntryMutation, openFile, refetchWorkspace, scriptId, teamId]);

    const handleCreateFolder = useCallback(async (folderPath: string) => {
        if (!teamId || !scriptId) {
            return;
        }

        await createEntryMutation.mutateAsync({
            teamId,
            scriptId,
            path: normalizeWorkspaceRelativePath(folderPath),
            kind: 'directory'
        });
        await refetchWorkspace();
    }, [createEntryMutation, refetchWorkspace, scriptId, teamId]);

    const handleDeleteFileDirect = useCallback(async ({ fileId }: { documentId: string; fileId: string }) => {
        if (!teamId || !scriptId) {
            return;
        }

        await deleteEntryMutation.mutateAsync({
            teamId,
            scriptId,
            path: fileId
        });
        removeFileState(fileId);
        await refetchWorkspace();
    }, [deleteEntryMutation, refetchWorkspace, removeFileState, scriptId, teamId]);

    const handleDeleteFile = useCallback(async (fileId: string) => {
        await handleDeleteFileDirect({
            documentId: scriptId,
            fileId
        });
    }, [handleDeleteFileDirect, scriptId]);

    const handleDeleteFolderDirect = useCallback(async (folderPath: string) => {
        if (!teamId || !scriptId) {
            return;
        }

        await deleteEntryMutation.mutateAsync({
            teamId,
            scriptId,
            path: normalizeWorkspaceRelativePath(folderPath)
        });
        removeFolderState(folderPath);
        await refetchWorkspace();
    }, [deleteEntryMutation, refetchWorkspace, removeFolderState, scriptId, teamId]);

    const handleRenameFile = useCallback(async (fileId: string, name: string) => {
        if (!teamId || !scriptId) {
            return;
        }

        const currentFile = fileEntriesRef.current.find((entry) => entry.relativePath === fileId);
        if (!currentFile) {
            return;
        }

        const destinationPath = normalizeWorkspaceRelativePath(joinWorkspacePath(
            normalizeWorkspaceFolderPath(currentFile.parentPath ?? ''),
            name
        ));

        await moveEntryMutation.mutateAsync({
            teamId,
            scriptId,
            sourcePath: fileId,
            destinationPath
        });
        renameFileState(fileId, destinationPath);
        await refetchWorkspace();
    }, [moveEntryMutation, refetchWorkspace, renameFileState, scriptId, teamId]);

    const handleUpdateFileDirect = useCallback(async (
        {
            fileId,
            path,
            name,
            content
        }: {
            documentId: string;
            fileId: string;
            path?: string;
            name?: string;
            content?: string;
        }
    ) => {
        if (!teamId || !scriptId) {
            return;
        }

        if (typeof content === 'string') {
            clearAutosaveTimer(fileId);
            await persistFileContent(fileId, content);
            return;
        }

        const currentFile = fileEntriesRef.current.find((entry) => entry.relativePath === fileId);
        if (!currentFile) {
            return;
        }

        const nextName = name?.trim() || currentFile.name;
        const nextFolderPath = path ?? normalizeWorkspaceFolderPath(currentFile.parentPath ?? '');
        const destinationPath = normalizeWorkspaceRelativePath(joinWorkspacePath(nextFolderPath, nextName));

        if (destinationPath === fileId) {
            return;
        }

        await moveEntryMutation.mutateAsync({
            teamId,
            scriptId,
            sourcePath: fileId,
            destinationPath
        });
        renameFileState(fileId, destinationPath);
        await refetchWorkspace();
    }, [clearAutosaveTimer, moveEntryMutation, persistFileContent, refetchWorkspace, renameFileState, scriptId, teamId]);

    const handleMoveFolderDirect = useCallback(async (sourceFolderPath: string, targetFolderPath: string) => {
        if (!teamId || !scriptId) {
            return;
        }

        await moveEntryMutation.mutateAsync({
            teamId,
            scriptId,
            sourcePath: normalizeWorkspaceRelativePath(sourceFolderPath),
            destinationPath: normalizeWorkspaceRelativePath(targetFolderPath)
        });
        renameFolderState(sourceFolderPath, targetFolderPath);
        await refetchWorkspace();
    }, [moveEntryMutation, refetchWorkspace, renameFolderState, scriptId, teamId]);

    const handleUpdateAssetDirect = useCallback(async (_input: { documentId: string; assetId: string; path: string }) => undefined, []);

    const handleUploadEntries = useCallback(async (entries: FileWithPath[]) => {
        if (!teamId || !scriptId || entries.length === 0) {
            return;
        }

        setIsUploading(true);

        try {
            const normalizedEntries = entries.map((entry) => ({
                file: entry.file,
                path: normalizeWorkspaceRelativePath(entry.path)
            }));

            const existingDirectories = new Set(
                directoryEntries.map((entry) => normalizeWorkspaceRelativePath(entry.relativePath))
            );
            const pendingDirectories = new Set<string>();

            for (const entry of normalizedEntries) {
                for (const folder of buildFolderAncestors(entry.path)) {
                    if (!existingDirectories.has(folder)) {
                        pendingDirectories.add(folder);
                    }
                }
            }

            const sortedDirectories = [...pendingDirectories].sort((left, right) => left.split('/').length - right.split('/').length);
            for (const folder of sortedDirectories) {
                await createEntryMutation.mutateAsync({
                    teamId,
                    scriptId,
                    path: folder,
                    kind: 'directory'
                });
            }

            const groupedByFolder = normalizedEntries.reduce<Record<string, File[]>>((groups, entry) => {
                const { path } = splitWorkspacePath(entry.path);
                const folderPath = normalizeWorkspaceRelativePath(path);
                groups[folderPath] = groups[folderPath] ?? [];
                groups[folderPath].push(entry.file);
                return groups;
            }, {});

            for (const [destinationPath, filesToUpload] of Object.entries(groupedByFolder)) {
                await uploadFilesMutation.mutateAsync({
                    teamId,
                    scriptId,
                    destinationPath,
                    files: filesToUpload
                });
            }

            await refetchWorkspace();
        } catch (error) {
            const userError = reportError(error, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to upload workspace files'
            });
            sileo.error({
                title: userError.title,
                description: userError.description
            });
            throw error;
        } finally {
            setIsUploading(false);
        }
    }, [createEntryMutation, directoryEntries, refetchWorkspace, scriptId, teamId, uploadFilesMutation]);

    const handleUploadFilesSelected = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';

        if (files.length === 0) {
            return;
        }

        await handleUploadEntries(files.map((file) => ({
            file,
            path: file.name
        })));
    }, [handleUploadEntries]);

    const handleUploadFoldersSelected = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';

        if (files.length === 0) {
            return;
        }

        await handleUploadEntries(files.map((file) => ({
            file,
            path: file.webkitRelativePath || file.name
        })));
    }, [handleUploadEntries]);

    const handleRemoteContentUpdate = useCallback((content: string, timestamp: number, fileId: string) => {
        const fileExists = fileEntriesRef.current.some((entry) => entry.relativePath === fileId);
        if (!fileExists) {
            void refetchWorkspace();
            return;
        }

        setFileEditorStates((current) => {
            const currentState = current[fileId] ?? createFileEditorState(content);
            const hasConflict = currentState.isDirty && currentState.content !== content;

            if (hasConflict) {
                setPendingRemoteUpdates((pending) => ({
                    ...pending,
                    [fileId]: {
                        content,
                        timestamp
                    }
                }));
                return current;
            }

            clearAutosaveTimer(fileId);

            setPendingRemoteUpdates((pending) => {
                if (!(fileId in pending)) {
                    return pending;
                }

                const next = { ...pending };
                delete next[fileId];
                return next;
            });

            return {
                ...current,
                [fileId]: {
                    ...currentState,
                    content,
                    lastSavedContent: content,
                    remoteContent: content,
                    isDirty: false
                }
            };
        });
    }, [clearAutosaveTimer, refetchWorkspace]);

    const { collaborators, sendContentUpdate } = useLammpsScriptSocket({
        scriptId,
        teamId: teamId ?? undefined,
        enabled: Boolean(teamId && scriptId),
        onRemoteContentUpdate: handleRemoteContentUpdate
    });

    const handleEditorChange = useCallback((value: string | undefined) => {
        if (!editorGroup.selection || editorGroup.selection.type !== 'file') {
            return;
        }

        const fileId = editorGroup.selection.id;
        const nextContent = value ?? '';
        const currentState = fileEditorStatesRef.current[fileId] ?? createFileEditorState(nextContent);
        const isRemoteEcho = nextContent === currentState.remoteContent;

        setFileEditorStates((current) => ({
            ...current,
            [fileId]: {
                ...currentState,
                content: nextContent,
                isDirty: nextContent !== currentState.lastSavedContent,
                remoteContent: isRemoteEcho ? '' : currentState.remoteContent
            }
        }));

        if (!isRemoteEcho) {
            sendContentUpdate(nextContent, fileId);
        }

        scheduleFileAutosave(fileId, nextContent);
    }, [editorGroup.selection, scheduleFileAutosave, sendContentUpdate]);

    const handleSelectFileById = useCallback((fileId: string) => {
        void openFile(fileId);
    }, [openFile]);

    const handleSelectTab = useCallback((tab: LatexWorkspaceTab) => {
        if (tab.type !== 'file') {
            return;
        }

        void openFile(tab.id);
    }, [openFile]);

    const handleTabClose = useCallback((tabToClose: LatexWorkspaceTab) => {
        setEditorGroup((current) => ({
            ...current,
            openTabs: current.openTabs.filter((tab) => !isSameTab(tab, tabToClose)),
            selection: getNextSelectionAfterClose(current.openTabs, tabToClose, current.selection)
        }));
    }, []);

    const handleReorderTabs = useCallback((activeTab: LatexWorkspaceTab, overTab: LatexWorkspaceTab | null, position: 'before' | 'after' | 'end') => {
        setEditorGroup((current) => {
            const nextTabs = [...current.openTabs];
            const activeIndex = nextTabs.findIndex((tab) => isSameTab(tab, activeTab));
            if (activeIndex < 0) {
                return current;
            }

            const [movedTab] = nextTabs.splice(activeIndex, 1);
            if (!movedTab) {
                return current;
            }

            if (!overTab || position === 'end') {
                nextTabs.push(movedTab);
            } else {
                const overIndex = nextTabs.findIndex((tab) => isSameTab(tab, overTab));
                if (overIndex < 0) {
                    nextTabs.push(movedTab);
                } else {
                    const targetIndex = position === 'before' ? overIndex : overIndex + 1;
                    nextTabs.splice(targetIndex, 0, movedTab);
                }
            }

            return {
                ...current,
                openTabs: nextTabs
            };
        });
    }, []);

    const handleApplyRemoteUpdate = useCallback(() => {
        if (!activeFile) {
            return;
        }

        const pending = pendingRemoteUpdates[activeFile._id];
        if (!pending) {
            return;
        }

        clearAutosaveTimer(activeFile._id);
        setPendingRemoteUpdates((current) => {
            const next = { ...current };
            delete next[activeFile._id];
            return next;
        });
        setFileEditorStates((current) => ({
            ...current,
            [activeFile._id]: {
                ...(current[activeFile._id] ?? createFileEditorState(pending.content)),
                content: pending.content,
                lastSavedContent: pending.content,
                remoteContent: pending.content,
                isDirty: false
            }
        }));
    }, [activeFile, clearAutosaveTimer, pendingRemoteUpdates]);

    const handleDismissRemoteUpdate = useCallback(() => {
        if (!activeFile) {
            return;
        }

        setPendingRemoteUpdates((current) => {
            if (!(activeFile._id in current)) {
                return current;
            }

            const next = { ...current };
            delete next[activeFile._id];
            return next;
        });
    }, [activeFile]);

    const handleExecutionUpdated = useCallback((payload: LammpsExecutionUpdatedEvent) => {
        const eventKey = `${payload.executionId}:${payload.status}:${payload.stage ?? ''}:${payload.step ?? ''}:${payload.timestamp}`;
        if (lastExecutionEventKeyRef.current === eventKey) {
            return;
        }

        lastExecutionEventKeyRef.current = eventKey;

        setExecutions((current) => {
            const nextExecution = current.find((execution) => execution._id === payload.executionId);
            if (!nextExecution) {
                void refetchWorkspace();
                return current;
            }

            return current.map((execution) => execution._id === payload.executionId
                ? {
                    ...execution,
                    status: payload.status,
                    lastTimestep: payload.lastTimestep ?? execution.lastTimestep,
                    dumpCount: payload.dumpCount,
                    startedAt: payload.startedAt ?? execution.startedAt,
                    finishedAt: payload.finishedAt ?? execution.finishedAt,
                    exitCode: payload.exitCode ?? execution.exitCode,
                    errorMessage: payload.errorMessage ?? execution.errorMessage,
                    updatedAt: payload.timestamp
                }
                : execution
            );
        });

        setSelectedExecution((current) => current && current._id === payload.executionId
            ? {
                ...current,
                status: payload.status,
                lastTimestep: payload.lastTimestep ?? current.lastTimestep,
                dumpCount: payload.dumpCount,
                startedAt: payload.startedAt ?? current.startedAt,
                finishedAt: payload.finishedAt ?? current.finishedAt,
                exitCode: payload.exitCode ?? current.exitCode,
                errorMessage: payload.errorMessage ?? current.errorMessage,
                updatedAt: payload.timestamp
            }
            : current
        );

        const fragments: string[] = [payload.status];
        if (payload.stage) {
            fragments.push(payload.stage);
        }
        if (payload.step) {
            fragments.push(payload.step);
        }

        appendExecutionTerminalLine(payload.executionId, `[event] ${fragments.join(' · ')}`);

        if (TERMINAL_EXECUTION_STATUSES.has(payload.status)) {
            void refetchWorkspace();
        }
    }, [appendExecutionTerminalLine, refetchWorkspace]);

    const handleDumpUpdated = useCallback((payload: LammpsDumpUpdatedEvent) => {
        setDumps((current) => {
            const nextDump: LammpsDump = {
                _id: payload.dumpId,
                execution: payload.executionId,
                team: teamId ?? undefined,
                script: scriptId,
                stagedTrajectoryId: selectedExecution?.stagedTrajectoryId ?? '',
                timestep: payload.timestep,
                fileName: payload.fileName,
                dumpObjectKey: payload.dumpObjectKey,
                modelObjectKey: payload.modelObjectKey,
                sizeBytes: payload.sizeBytes,
                natoms: payload.natoms,
                simulationCell: payload.simulationCell ?? null,
                status: 'ready',
                createdAt: payload.timestamp,
                updatedAt: payload.timestamp
            };
            const existingIndex = current.findIndex((dump) => dump._id === payload.dumpId || dump.timestep === payload.timestep);
            if (existingIndex < 0) {
                return sortDumps([...current, nextDump]);
            }

            const next = [...current];
            next[existingIndex] = {
                ...next[existingIndex],
                ...nextDump
            };
            return sortDumps(next);
        });

        setSelectedExecution((current) => current && current._id === payload.executionId
            ? {
                ...current,
                lastTimestep: payload.timestep,
                dumpCount: current.lastTimestep === payload.timestep
                    ? current.dumpCount
                    : current.dumpCount + 1
            }
            : current
        );

        setParam('timestep', String(payload.timestep), { replace: true });
        appendExecutionTerminalLine(payload.executionId, `[dump] Exported ${payload.fileName} (${payload.timestep})`);
    }, [appendExecutionTerminalLine, scriptId, selectedExecution?.stagedTrajectoryId, setParam, teamId]);

    useLammpsExecutionSocket({
        teamId: teamId ?? undefined,
        executionId: selectedExecution?._id ?? null,
        enabled: Boolean(teamId && selectedExecution?._id),
        onExecutionUpdated: handleExecutionUpdated,
        onExecutionLog: (payload) => {
            appendExecutionTerminalLine(payload.executionId, payload.line);
        },
        onDumpUpdated: handleDumpUpdated
    });

    useEffect(() => {
        const unsubscribe = socketService.on('lammps_execution_updated', (payload) => {
            const typedPayload = payload as Partial<LammpsExecutionUpdatedEvent>;
            if (typedPayload.scriptId === scriptId && typeof typedPayload.executionId === 'string' && typeof typedPayload.status === 'string') {
                handleExecutionUpdated(typedPayload as LammpsExecutionUpdatedEvent);
            }
        });

        return unsubscribe;
    }, [handleExecutionUpdated, scriptId, socketService]);

    const handleExecutionSelection = useCallback((executionId: string) => {
        updateSearchParams({
            selectedExec: executionId,
            timestep: 0
        });
    }, [updateSearchParams]);

    const handleSelectDumpTimestep = useCallback((timestep: number) => {
        setParam('timestep', String(timestep));
    }, [setParam]);

    const handleDownloadDump = useCallback(async (dump: LammpsDump) => {
        if (!teamId || !selectedExecution || dump.status !== 'ready') {
            return;
        }

        const blob = await showPromise(downloadDumpMutation.mutateAsync({
            teamId,
            executionId: selectedExecution._id,
            dumpId: dump._id
        }), DOWNLOAD_DUMP_TOAST);

        triggerBrowserDownload(blob, `timestep-${dump.timestep}-${dump.fileName}`);
    }, [downloadDumpMutation, selectedExecution, teamId]);

    const handleDeleteDump = useCallback(async (dump: LammpsDump) => {
        if (!teamId || !selectedExecution) {
            return;
        }

        const remainingDumps = dumps.filter((entry) => entry._id !== dump._id);
        const nextSelectedDump = remainingDumps[remainingDumps.length - 1] ?? null;

        await showPromise(deleteDumpMutation.mutateAsync({
            teamId,
            executionId: selectedExecution._id,
            dumpId: dump._id
        }), DELETE_DUMP_TOAST);

        setDumps(remainingDumps);

        if (dump.timestep === currentTimestep) {
            setParam('timestep', String(nextSelectedDump?.timestep ?? 0), { replace: true });
        }

        await refetchWorkspace();
    }, [currentTimestep, deleteDumpMutation, dumps, refetchWorkspace, selectedExecution, setParam, teamId]);

    const handleRunClusterSelection = useCallback((clusterId: string) => {
        setSelectedRunClusterId(clusterId);
    }, []);

    const handleUpdatePerformanceConfig = useCallback(async (config: {
        mpiRanks: number;
        openmpThreads: number;
    }) => {
        if (!teamId || !scriptId) {
            return;
        }

        const normalizedMpiRanks = Math.max(
            1,
            Math.floor(
                typeof maxPerformanceCpus === 'number'
                    ? Math.min(config.mpiRanks, maxPerformanceCpus)
                    : config.mpiRanks
            )
        );
        const maxOpenmpThreads = typeof maxPerformanceCpus === 'number'
            ? Math.max(1, Math.floor(maxPerformanceCpus / normalizedMpiRanks))
            : config.openmpThreads;
        const normalizedOpenmpThreads = Math.max(
            1,
            Math.floor(
                typeof maxPerformanceCpus === 'number'
                    ? Math.min(config.openmpThreads, maxOpenmpThreads)
                    : config.openmpThreads
            )
        );

        await showPromise(updateScriptMutation.mutateAsync({
            teamId,
            scriptId,
            mpiRanks: normalizedMpiRanks,
            openmpThreads: normalizedOpenmpThreads
        }), UPDATE_PERFORMANCE_TOAST);

        await refetchWorkspace();
    }, [maxPerformanceCpus, refetchWorkspace, scriptId, teamId, updateScriptMutation]);

    const handleImportExecutionAsTrajectory = useCallback(async (name: string) => {
        if (!teamId || !selectedExecution) {
            return;
        }

        setIsImportingTrajectory(true);
        try {
            await showPromise(importExecutionMutation.mutateAsync({
                teamId,
                executionId: selectedExecution._id,
                name
            }), IMPORT_EXECUTION_TOAST);
        } finally {
            setIsImportingTrajectory(false);
        }
    }, [importExecutionMutation, selectedExecution, teamId]);

    const handleRunAction = useCallback(async () => {
        if (!teamId || !scriptId) {
            return;
        }

        if (selectedExecution && ACTIVE_EXECUTION_STATUSES.has(selectedExecution.status)) {
            const now = Date.now();

            if (now - lastStopIntentAtRef.current <= STOP_DOUBLE_CLICK_MS && selectedExecution.status !== 'killing') {
                lastStopIntentAtRef.current = 0;
                await showPromise(killExecutionMutation.mutateAsync({
                    teamId,
                    executionId: selectedExecution._id
                }), KILL_EXECUTION_TOAST);
                return;
            }

            if (STOPPABLE_EXECUTION_STATUSES.has(selectedExecution.status)) {
                lastStopIntentAtRef.current = now;
                await showPromise(stopExecutionMutation.mutateAsync({
                    teamId,
                    executionId: selectedExecution._id
                }), STOP_EXECUTION_TOAST);
            }
            return;
        }

        lastStopIntentAtRef.current = 0;
        await flushDirtyFiles();

        const nextExecution = await showPromise(startExecutionMutation.mutateAsync({
            teamId,
            scriptId,
            teamClusterId: selectedRunClusterId ?? undefined
        }), RUN_EXECUTION_TOAST);

        setExecutions((current) => [nextExecution, ...current.filter((execution) => execution._id !== nextExecution._id)]);
        setSelectedExecution(nextExecution);
        setDumps([]);
        setTerminalBuffer(nextExecution.terminalBuffer ?? '');
        updateSearchParams({
            selectedExec: nextExecution._id,
            timestep: 0
        });
    }, [
        flushDirtyFiles,
        killExecutionMutation,
        scriptId,
        selectedExecution,
        selectedRunClusterId,
        startExecutionMutation,
        stopExecutionMutation,
        teamId,
        updateSearchParams
    ]);

    useEffect(() => {
        fileEditorStatesRef.current = fileEditorStates;
    }, [fileEditorStates]);

    useEffect(() => {
        selectedExecutionIdRef.current = selectedExecution?._id ?? null;
    }, [selectedExecution?._id]);

    useEffect(() => {
        fileEntriesRef.current = scriptFiles;
    }, [scriptFiles]);

    useEffect(() => {
        didBootstrapSelectionRef.current = false;
        lastStopIntentAtRef.current = 0;
        lastExecutionEventKeyRef.current = null;
        hydratedExecutionIdRef.current = null;
        setEditorGroup(createEditorGroup());
        setFileEditorStates({});
        setPendingRemoteUpdates({});
        setExecutions([]);
        setSelectedExecution(null);
        setDumps([]);
        setTerminalBuffer('');

        Object.values(autosaveTimersRef.current).forEach((timerId) => {
            window.clearTimeout(timerId);
        });
        autosaveTimersRef.current = {};
    }, [scriptId, teamId]);

    useEffect(() => {
        if (!workspaceQueryResult.error) {
            return;
        }

        checkAccessDeniedError(workspaceQueryResult.error);
    }, [checkAccessDeniedError, workspaceQueryResult.error]);

    useEffect(() => {
        return () => {
            Object.values(autosaveTimersRef.current).forEach((timerId) => {
                window.clearTimeout(timerId);
            });
        };
    }, []);

    useEffect(() => {
        if (!workspace) {
            return;
        }

        const nextSelectedExecutionId = workspace.selectedExecution?._id ?? null;
        const selectedExecutionChanged = hydratedExecutionIdRef.current !== nextSelectedExecutionId;

        setExecutions((current) => mergeExecutionLists(current, workspace.executions ?? []));
        setSelectedExecution((current) => {
            if (!workspace.selectedExecution) {
                return selectedExecutionChanged ? null : current;
            }

            return mergeExecution(current, workspace.selectedExecution);
        });
        setDumps((current) => {
            const nextDumps = sortDumps(workspace.dumps ?? []);
            return selectedExecutionChanged
                ? nextDumps
                : mergeDumps(current, nextDumps);
        });
        setTerminalBuffer((current) => {
            const nextBuffer = workspace.selectedExecution?.terminalBuffer ?? '';
            const shouldTrustIncomingBuffer = TERMINAL_EXECUTION_STATUSES.has(workspace.selectedExecution?.status ?? '');

            if (selectedExecutionChanged || shouldTrustIncomingBuffer) {
                return nextBuffer;
            }

            return nextBuffer.length >= current.length
                ? nextBuffer
                : current;
        });
        hydratedExecutionIdRef.current = nextSelectedExecutionId;

        setFileEditorStates((current) => {
            const validFileIds = new Set(scriptFiles.map((entry) => entry.relativePath));
            const nextEntries = Object.entries(current)
                .filter(([fileId]) => validFileIds.has(fileId));

            if (nextEntries.length === Object.keys(current).length) {
                return current;
            }

            return Object.fromEntries(nextEntries);
        });

        setPendingRemoteUpdates((current) => {
            const validFileIds = new Set(scriptFiles.map((entry) => entry.relativePath));
            const nextEntries = Object.entries(current)
                .filter(([fileId]) => validFileIds.has(fileId));

            if (nextEntries.length === Object.keys(current).length) {
                return current;
            }

            return Object.fromEntries(nextEntries);
        });

        setEditorGroup((current) => {
            const validFileIds = new Set(scriptFiles.map((entry) => entry.relativePath));
            const nextTabs = current.openTabs.filter((tab) => tab.type !== 'file' || validFileIds.has(tab.id));
            const nextSelection = current.selection?.type === 'file' && validFileIds.has(current.selection.id)
                ? current.selection
                : nextTabs[0] ?? null;

            return {
                ...current,
                openTabs: nextTabs,
                selection: nextSelection
            };
        });
    }, [scriptFiles, workspace]);

    useEffect(() => {
        if (!workspace?.selectedExecution?._id || selectedExecutionId) {
            return;
        }

        updateSearchParams({
            selectedExec: workspace.selectedExecution._id,
            timestep: workspace.selectedExecution.lastTimestep ?? 0
        }, { replace: true });
    }, [selectedExecutionId, updateSearchParams, workspace?.selectedExecution]);

    useEffect(() => {
        const availableIds = new Set(availableRunClusters.map((cluster) => cluster._id));
        const preferredClusterId = getModelId(selectedExecution?.computeClusterId) ?? availableRunClusters[0]?._id ?? null;

        setSelectedRunClusterId((current) => {
            if (current && availableIds.has(current)) {
                return current;
            }

            return preferredClusterId;
        });
    }, [availableRunClusters, selectedExecution?.computeClusterId]);

    useEffect(() => {
        if (didBootstrapSelectionRef.current || scriptFiles.length === 0) {
            return;
        }

        const bootstrapTarget = script?.entryFilePath && scriptFiles.some((entry) => entry.relativePath === script.entryFilePath)
            ? script.entryFilePath
            : scriptFiles[0]?.relativePath;

        if (!bootstrapTarget) {
            return;
        }

        didBootstrapSelectionRef.current = true;
        void openFile(bootstrapTarget);
    }, [openFile, script?.entryFilePath, scriptFiles]);

    return {
        accessDenied,
        accessDeniedMessage,
        activeEditorGroupId,
        availableRunClusters,
        collaborators,
        currentTimestep,
        dirtyFileIds,
        dumps,
        editorContent,
        editorGroups: [editorGroup],
        executions,
        files,
        folders,
        isDirty,
        isExecutionActive,
        isImportingTrajectory,
        isLoading: workspaceQueryResult.isLoading,
        isLoadingPerformanceLimits,
        isPreviewLoading,
        isUpdatingPerformance,
        isRunActionPending,
        isSaving,
        isUploading,
        performanceClusterName,
        performanceMpiRanks,
        performanceOpenmpThreads,
        maxPerformanceCpus,
        previewGlbUrl,
        previewErrorMessage,
        scriptTitle: script?.title ?? 'LAMMPS Script',
        selectedExecution,
        selectedRunClusterId,
        selectedDump,
        terminalBuffer,
        handleApplyRemoteUpdate,
        handleCreateFile,
        handleCreateFolder,
        handleDeleteFile,
        handleDeleteFileDirect,
        handleDeleteDump,
        handleDeleteFolderDirect,
        handleDownloadDump,
        handleDismissRemoteUpdate,
        handleEditorChange,
        handleExecutionSelection,
        handleFocusEditorGroup: () => undefined,
        handleImportExecutionAsTrajectory,
        handleMoveFolderDirect,
        handleRenameFile,
        handleReorderTabs,
        handleRunAction,
        handleRunClusterSelection,
        handleSelectDumpTimestep,
        handleSelectFileById,
        handleSelectTab,
        handleTabClose,
        handleUpdatePerformanceConfig,
        handleUpdateAssetDirect,
        handleUpdateFileDirect,
        handleUploadEntries,
        handleUploadFilesSelected,
        handleUploadFoldersSelected,
        hasPendingRemoteUpdate: Boolean(activePendingRemoteUpdate)
    };
};

export default useLammpsWorkspace;
