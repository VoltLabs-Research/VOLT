import useLammpsWorkspace from '@/modules/lammps/hooks/use-lammps-workspace';
import useDashboardWorkspaceChrome from '@/modules/dashboard/hooks/use-dashboard-workspace-chrome';
import Viewport from '@/modules/canvas/components/organisms/Viewport';
import useFractalSceneConfig from '@/modules/canvas/hooks/use-fractal-scene-config';
import LammpsPerformanceModal from '@/modules/lammps/components/molecules/LammpsPerformanceModal';
import LammpsTextPromptModal from '@/modules/lammps/components/molecules/LammpsTextPromptModal';
import WorkspaceTreeRow from '@/modules/latex/components/templates/LatexDocumentWorkspace/WorkspaceTreeRow';
import LatexEditorPanel from '@/modules/latex/components/templates/LatexDocumentWorkspace/LatexEditorPanel';
import LatexFilePanel from '@/modules/latex/components/templates/LatexDocumentWorkspace/LatexFilePanel';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import Avatar from '@/shared/presentation/components/Avatar';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Loader from '@/shared/presentation/components/Loader';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import Select from '@/shared/presentation/components/Select';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import Terminal from '@/shared/presentation/components/Terminal';
import ThemeToggleButton from '@/shared/presentation/components/ThemeToggleButton';
import WorkspaceToolbar from '@/shared/presentation/components/WorkspaceToolbar';
import { openModal } from '@/shared/presentation/components/Modal';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import '@/shared/presentation/styles/resize-handle.css';
import '@/modules/latex/components/templates/LatexDocumentWorkspace/LatexDocumentWorkspace.css';
import './LammpsScriptWorkspace.css';
import { Check, DatabaseZap, Download, FileCode, FolderOpen, Play, SlidersHorizontal, Square, Trash2, Waypoints } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { PresenceUser } from '@/modules/socket/trajectory/api/entities/presence-user';
import type { FractalSceneRef } from '@/modules/fractal/components/organisms/FractalScene';
import type { MenuOption } from '@/shared/presentation/types/menu';

const IMPORT_TRAJECTORY_MODAL_ID = 'lammps-workspace-import-trajectory-modal';
const PERFORMANCE_MODAL_ID = 'lammps-workspace-performance-modal';
const STORAGE_KEY = 'volt:lammps-workspace-panel-widths';
const FILES_MIN = 220;
const FILES_MAX = 420;
const PREVIEW_MIN = 280;
const PREVIEW_MAX = 720;
const EDITOR_GROUP_MIN = 200;
const DEFAULT_WIDTHS = {
    files: 280,
    preview: 420,
    editorTop: 320
};

interface PanelWidths {
    files: number;
    preview: number;
    editorTop: number;
}

interface DragState {
    panel: 'files' | 'preview' | 'editor';
    startX: number;
    startY: number;
    startDimension: number;
}

const loadPanelWidths = (): PanelWidths => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return DEFAULT_WIDTHS;
        }

        const parsed = JSON.parse(raw) as Partial<PanelWidths>;
        return {
            files: Math.min(FILES_MAX, Math.max(FILES_MIN, parsed.files ?? DEFAULT_WIDTHS.files)),
            preview: Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, parsed.preview ?? DEFAULT_WIDTHS.preview)),
            editorTop: Math.max(EDITOR_GROUP_MIN, parsed.editorTop ?? DEFAULT_WIDTHS.editorTop)
        };
    } catch {
        return DEFAULT_WIDTHS;
    }
};

const getPresenceInitials = (user: PresenceUser): string => {
    const first = user.firstName?.[0] ?? '';
    const last = user.lastName?.[0] ?? '';
    const initials = `${first}${last}`.toUpperCase();
    return initials || '?';
};

const normalizeTerminalOutput = (value: string): string => {
    return value.replace(/\r?\n/g, '\r\n');
};

const LammpsScriptWorkspace = () => {
    const { scriptId = '' } = useParams<{ scriptId: string }>();
    const vm = useLammpsWorkspace({ scriptId });
    const sceneConfig = useFractalSceneConfig();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const folderInputRef = useRef<HTMLInputElement | null>(null);
    const editorStackRef = useRef<HTMLDivElement | null>(null);
    const previewSceneRef = useRef<FractalSceneRef | null>(null);
    const dragStateRef = useRef<DragState | null>(null);
    const [panelWidths, setPanelWidths] = useState<PanelWidths>(loadPanelWidths);

    useDashboardWorkspaceChrome({ collapseSidebar: true, hideHeader: true });
    usePageTitle(vm.scriptTitle);

    const handleFilesPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStateRef.current = {
            panel: 'files',
            startX: event.clientX,
            startY: event.clientY,
            startDimension: panelWidths.files
        };
    }, [panelWidths.files]);

    const handlePreviewPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStateRef.current = {
            panel: 'preview',
            startX: event.clientX,
            startY: event.clientY,
            startDimension: panelWidths.preview
        };
    }, [panelWidths.preview]);

    const handleEditorSplitPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStateRef.current = {
            panel: 'editor',
            startX: event.clientX,
            startY: event.clientY,
            startDimension: panelWidths.editorTop
        };
    }, [panelWidths.editorTop]);

    const handleDragPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const state = dragStateRef.current;
        if (!state || !event.currentTarget.hasPointerCapture(event.pointerId)) {
            return;
        }

        if (state.panel === 'files') {
            const delta = event.clientX - state.startX;
            const nextWidth = Math.min(FILES_MAX, Math.max(FILES_MIN, state.startDimension + delta));
            setPanelWidths((current) => ({ ...current, files: nextWidth }));
            return;
        }

        if (state.panel === 'preview') {
            const delta = event.clientX - state.startX;
            const nextWidth = Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, state.startDimension - delta));
            setPanelWidths((current) => ({ ...current, preview: nextWidth }));
            return;
        }

        if (state.panel === 'editor') {
            const hostHeight = editorStackRef.current?.getBoundingClientRect().height ?? 0;
            const maxHeight = Math.max(EDITOR_GROUP_MIN, hostHeight - EDITOR_GROUP_MIN - 8);
            const delta = event.clientY - state.startY;
            const nextHeight = Math.min(maxHeight, Math.max(EDITOR_GROUP_MIN, state.startDimension + delta));
            setPanelWidths((current) => ({ ...current, editorTop: nextHeight }));
        }
    }, []);

    const handleDragPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStateRef.current) {
            return;
        }

        event.currentTarget.releasePointerCapture(event.pointerId);
        dragStateRef.current = null;
        setPanelWidths((current) => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
            return current;
        });
    }, []);

    const handleDragPointerCancel = useCallback(() => {
        dragStateRef.current = null;
    }, []);

    const executionOptions = useMemo(() => {
        return vm.executions.map((execution) => ({
            value: execution._id,
            title: `${execution.status} · ${execution._id.slice(0, 8)}`,
            description: typeof execution.startedAt === 'string' || execution.startedAt instanceof Date
                ? new Date(execution.startedAt).toLocaleString()
                : 'Pending'
        }));
    }, [vm.executions]);

    const runClusterOptions = useMemo(() => {
        return vm.availableRunClusters.map((cluster) => ({
            value: cluster._id,
            title: cluster.name,
            description: cluster.effectiveRole
        }));
    }, [vm.availableRunClusters]);

    const collaboratorAvatars = useMemo(() => {
        return vm.collaborators.map((user) => (
            <Avatar
                key={user.id}
                size='xs'
                fallback={getPresenceInitials(user)}
                alt={`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Collaborator'}
                className='latex-workspace__collaborator-avatar'
            />
        ));
    }, [vm.collaborators]);

    const getDumpMenuOptions = useCallback((dump: typeof vm.dumps[number]): MenuOption[] => {
        const isReady = dump.status === 'ready';

        return [
            {
                label: 'Select',
                icon: Check,
                onClick: () => vm.handleSelectDumpTimestep(dump.timestep),
                disabled: !isReady
            },
            {
                label: 'Download',
                icon: Download,
                onClick: () => vm.handleDownloadDump(dump),
                disabled: !isReady
            },
            {
                label: 'Delete',
                icon: Trash2,
                onClick: () => vm.handleDeleteDump(dump),
                destructive: true
            }
        ];
    }, [vm]);

    const runButton = vm.isExecutionActive ? (
        <Button
            variant='ghost'
            intent='neutral'
            size='sm'
            shape='rounded'
            onClick={() => {
                void vm.handleRunAction();
            }}
            title='Stop execution. Double-click within 500ms to force-kill it.'
        >
            <Square size={14} />
            Stop
        </Button>
    ) : (
        <Button
            variant='ghost'
            intent='neutral'
            size='sm'
            shape='rounded'
            disabled={!vm.selectedRunClusterId || vm.isRunActionPending}
            isLoading={vm.isRunActionPending}
            onClick={() => {
                void vm.handleRunAction();
            }}
            title='Run simulation'
        >
            <Play size={14} />
            Run
        </Button>
    );

    if (vm.isLoading) {
        return <Loader scale={0.5} isFixed={false} />;
    }

    if (vm.accessDenied) {
        return <AccessDenied description={vm.accessDeniedMessage} showBack={false} className='h-max w-max' />;
    }

    return (
        <>
            <Container className='latex-workspace d-flex column'>
                <WorkspaceToolbar
                    title={<span className='latex-workspace__toolbar-title color-primary'>{vm.scriptTitle}</span>}
                    actions={(
                        <Container className='lammps-workspace__toolbar-actions d-flex items-center gap-075'>
                            <ThemeToggleButton className='latex-workspace__theme-toggle' />
                            {collaboratorAvatars.length > 0 && (
                                <Container className='latex-workspace__collaborators d-flex items-center'>
                                    {collaboratorAvatars}
                                </Container>
                            )}
                            {vm.isDirty && <span className='latex-workspace__dirty-dot' title='Unsaved changes' />}
                            <span className='latex-workspace__status-text color-muted' aria-live='polite'>
                                {vm.isSaving ? 'Saving…' : vm.isDirty ? 'Unsaved changes' : 'Saved'}
                            </span>
                            {/*vm.selectedExecution && <StatusBadge status={vm.selectedExecution.status} />*/}
                            <Container className='lammps-workspace__toolbar-field'>
                                <Select
                                    options={executionOptions}
                                    value={vm.selectedExecution?._id ?? null}
                                    onChange={vm.handleExecutionSelection}
                                    placeholder='No executions'
                                    disabled={executionOptions.length === 0}
                                />
                            </Container>
                            <Container className='lammps-workspace__toolbar-field'>
                                <Select
                                    options={runClusterOptions}
                                    value={vm.selectedRunClusterId}
                                    onChange={vm.handleRunClusterSelection}
                                    placeholder='Select cluster'
                                    disabled={runClusterOptions.length === 0 || vm.isExecutionActive}
                                />
                            </Container>
                            <Button
                                variant='ghost'
                                intent='neutral'
                                size='sm'
                                shape='rounded'
                                onClick={() => openModal(PERFORMANCE_MODAL_ID)}
                                title='Adjust script performance'
                            >
                                <SlidersHorizontal size={14} />
                                Performance
                            </Button>
                            {runButton}
                            <Button
                                variant='ghost'
                                intent='neutral'
                                size='sm'
                                shape='rounded'
                                disabled={vm.selectedExecution?.status !== 'completed' || vm.isImportingTrajectory}
                                onClick={() => openModal(IMPORT_TRAJECTORY_MODAL_ID)}
                                title='Import execution dumps as trajectory'
                            >
                                <Waypoints size={14} />
                                Import as trajectory
                            </Button>
                        </Container>
                    )}
                />

                <Container className='latex-workspace__layout d-flex flex-1 min-h-0'>
                    <Container className='lammps-workspace__left-stack d-flex column min-h-0' style={{ width: panelWidths.files }}>
                        <LatexFilePanel
                            documentId={scriptId}
                            files={vm.files}
                            assets={[]}
                            folders={vm.folders}
                            selectedAssetId={null}
                            width={panelWidths.files}
                            fileInputRef={fileInputRef}
                            folderInputRef={folderInputRef}
                            isUploading={vm.isUploading}
                            onFileSelect={vm.handleSelectFileById}
                            onAssetSelect={() => undefined}
                            onCreateFile={vm.handleCreateFile}
                            onCreateFolder={vm.handleCreateFolder}
                            onDeleteFile={vm.handleDeleteFile}
                            onDeleteAsset={async () => undefined}
                            onDeleteFileDirect={vm.handleDeleteFileDirect}
                            onDeleteAssetDirect={async () => undefined}
                            onUpdateFileDirect={vm.handleUpdateFileDirect}
                            onUpdateAssetDirect={vm.handleUpdateAssetDirect}
                            onMoveFolderDirect={vm.handleMoveFolderDirect}
                            onDeleteFolderDirect={vm.handleDeleteFolderDirect}
                            onRenameFile={vm.handleRenameFile}
                            onRenameAsset={async () => undefined}
                            onSetEntrypoint={async () => undefined}
                            onInsertRef={() => undefined}
                            onUploadEntries={vm.handleUploadEntries}
                            onUploadFiles={vm.handleUploadFilesSelected}
                            onUploadFolders={vm.handleUploadFoldersSelected}
                        />

                        <Container className='lammps-workspace__dumps d-flex column min-h-0'>
                            <PanelHeader
                                variant='compact'
                                icon={<span className='d-flex items-center color-muted'><FolderOpen size={14} /></span>}
                                title='Dumps'
                            />
                            <Container className='lammps-workspace__dump-list d-flex column flex-1 min-h-0'>
                                {vm.dumps.length === 0 ? (
                                    <EmptyState
                                        title='No dumps yet'
                                        description='Run the simulation to stream dump exports into this list.'
                                        icon={<DatabaseZap size={24} />}
                                        className='flex-1'
                                        headingLevel='h3'
                                    />
                                ) : (
                                    <Container className='latex-workspace__tree-surface d-flex column flex-1 min-h-0'>
                                        <Container className='latex-workspace__tree-root'>
                                            {vm.dumps.map((dump) => {
                                                const isReady = dump.status === 'ready';

                                                return (
                                                    <ContextMenuPopover
                                                        key={dump._id}
                                                        id={`lammps-dump-ctx-${dump._id}`}
                                                        size='sm'
                                                        options={getDumpMenuOptions(dump)}
                                                        trigger={(
                                                            <WorkspaceTreeRow
                                                                depth={0}
                                                                icon={<FileCode size={13} />}
                                                                label={dump.fileName}
                                                                selected={dump.timestep === vm.currentTimestep}
                                                                ariaLabel={`Dump file ${dump.fileName}`}
                                                                aria-disabled={isReady ? undefined : true}
                                                                tabIndex={isReady ? 0 : -1}
                                                                className={isReady ? 'lammps-workspace__dump-row' : 'lammps-workspace__dump-row is-disabled'}
                                                                onClick={() => {
                                                                    if (!isReady) {
                                                                        return;
                                                                    }

                                                                    vm.handleSelectDumpTimestep(dump.timestep);
                                                                }}
                                                                onKeyDown={(event) => {
                                                                    if (!isReady || (event.key !== 'Enter' && event.key !== ' ')) {
                                                                        return;
                                                                    }

                                                                    event.preventDefault();
                                                                    vm.handleSelectDumpTimestep(dump.timestep);
                                                                }}
                                                            />
                                                        )}
                                                    />
                                                );
                                            })}
                                        </Container>
                                    </Container>
                                )}
                            </Container>
                        </Container>
                    </Container>

                    <div
                        className='latex-drag-handle'
                        role='separator'
                        aria-orientation='vertical'
                        aria-label='Resize workspace sidebar'
                        tabIndex={0}
                        onPointerDown={handleFilesPointerDown}
                        onPointerMove={handleDragPointerMove}
                        onPointerUp={handleDragPointerUp}
                        onPointerCancel={handleDragPointerCancel}
                    >
                        <span className='latex-drag-handle__grip volt-resize-handle__grip volt-resize-handle__grip--horizontal' aria-hidden='true' />
                    </div>

                    <Container className='lammps-workspace__main-content d-flex column flex-1 min-w-0'>
                        <Container
                            ref={editorStackRef}
                            className='d-flex column flex-1 min-h-0'
                            onPointerMove={handleDragPointerMove}
                            onPointerUp={handleDragPointerUp}
                            onPointerCancel={handleDragPointerCancel}
                        >
                            <Container className='d-flex min-h-0' style={{ height: panelWidths.editorTop }}>
                                <LatexEditorPanel
                                    groupId={vm.activeEditorGroupId}
                                    isGroupActive
                                    isSplitView={false}
                                    activeSelection={vm.editorGroups[0]?.selection ?? null}
                                    openTabs={vm.editorGroups[0]?.openTabs ?? []}
                                    files={vm.files}
                                    assets={[]}
                                    dirtyFileIds={vm.dirtyFileIds}
                                    hasPendingRemoteUpdate={vm.hasPendingRemoteUpdate}
                                    content={vm.editorContent}
                                    onFocusGroup={vm.handleFocusEditorGroup}
                                    onChange={vm.handleEditorChange}
                                    onApplyRemoteUpdate={vm.handleApplyRemoteUpdate}
                                    onDismissRemoteUpdate={vm.handleDismissRemoteUpdate}
                                    onTabSelect={vm.handleSelectTab}
                                    onTabClose={vm.handleTabClose}
                                    onTabReorder={vm.handleReorderTabs}
                                />
                            </Container>

                            <div
                                className='latex-drag-handle-horizontal'
                                role='separator'
                                aria-orientation='horizontal'
                                aria-label='Resize terminal panel'
                                tabIndex={0}
                                onPointerDown={handleEditorSplitPointerDown}
                                onPointerMove={handleDragPointerMove}
                                onPointerUp={handleDragPointerUp}
                                onPointerCancel={handleDragPointerCancel}
                            >
                                <span className='latex-drag-handle__grip volt-resize-handle__grip volt-resize-handle__grip--vertical' aria-hidden='true' />
                            </div>

                            <Container className='lammps-workspace__terminal d-flex column flex-1 min-h-0'>
                                <PanelHeader
                                    variant='compact'
                                    title='Terminal'
                                    actions={vm.selectedExecution ? <StatusBadge status={vm.selectedExecution.status} size='compact' /> : undefined}
                                />
                                <Container className='lammps-workspace__terminal-body flex-1 min-h-0'>
                                    <Terminal
                                        ariaLabel='LAMMPS execution output'
                                        value={normalizeTerminalOutput(vm.terminalBuffer)}
                                    />
                                </Container>
                            </Container>
                        </Container>
                    </Container>

                    <div
                        className='latex-drag-handle'
                        role='separator'
                        aria-orientation='vertical'
                        aria-label='Resize preview panel'
                        tabIndex={0}
                        onPointerDown={handlePreviewPointerDown}
                        onPointerMove={handleDragPointerMove}
                        onPointerUp={handleDragPointerUp}
                        onPointerCancel={handleDragPointerCancel}
                    >
                        <span className='latex-drag-handle__grip volt-resize-handle__grip volt-resize-handle__grip--horizontal' aria-hidden='true' />
                    </div>

                    <Container className='lammps-workspace__preview d-flex column min-h-0' style={{ width: panelWidths.preview }}>
                        <PanelHeader
                            variant='compact'
                            title='Preview'
                            actions={vm.selectedDump ? <span className='lammps-workspace__preview-stage'>Timestep {vm.selectedDump.timestep}</span> : undefined}
                        />
                        <Container className='lammps-workspace__preview-body flex-1 min-h-0'>
                            {(vm.previewGlbUrl || vm.isPreviewLoading) ? (
                                <Viewport
                                    trajectory={null}
                                    currentTimestep={vm.selectedDump?.timestep}
                                    sceneConfig={sceneConfig}
                                    analysisId={undefined}
                                    forcedGlbUrl={vm.previewGlbUrl}
                                    showGrid={false}
                                    showGizmo
                                    isLoading={vm.isPreviewLoading}
                                    sceneRef={previewSceneRef}
                                    showHeader={false}
                                    showSceneActions={false}
                                    hideGradient
                                />
                            ) : vm.previewErrorMessage ? (
                                <EmptyState
                                    title='Preview unavailable'
                                    description={vm.previewErrorMessage}
                                    icon={<Waypoints size={28} />}
                                    className='h-max w-max'
                                />
                            ) : (
                                <EmptyState
                                    title='No preview available'
                                    description='Run the script and wait for a dump export to generate the GLB preview.'
                                    icon={<Waypoints size={28} />}
                                    className='h-max w-max'
                                />
                            )}
                        </Container>
                    </Container>
                </Container>
            </Container>

            <LammpsTextPromptModal
                id={IMPORT_TRAJECTORY_MODAL_ID}
                title='Import Execution as Trajectory'
                description='This will create a trajectory using every dump generated by the selected completed execution.'
                fieldLabel='Trajectory name'
                placeholder='Enter a trajectory name'
                submitLabel='Import'
                value={vm.selectedExecution ? `${vm.scriptTitle}-${vm.selectedExecution._id.slice(0, 6)}` : ''}
                onSubmit={vm.handleImportExecutionAsTrajectory}
            />

            <LammpsPerformanceModal
                id={PERFORMANCE_MODAL_ID}
                mpiRanks={vm.performanceMpiRanks}
                openmpThreads={vm.performanceOpenmpThreads}
                maxCpus={vm.maxPerformanceCpus}
                clusterName={vm.performanceClusterName}
                isLoadingLimits={vm.isLoadingPerformanceLimits}
                isSubmitting={vm.isUpdatingPerformance}
                onSubmit={vm.handleUpdatePerformanceConfig}
            />
        </>
    );
};

export default LammpsScriptWorkspace;
