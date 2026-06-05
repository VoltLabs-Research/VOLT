import useLatexWorkspace from '@/modules/latex/hooks/use-latex-workspace';
import useDashboardWorkspaceChrome from '@/modules/dashboard/hooks/use-dashboard-workspace-chrome';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import EditableTag from '@/shared/presentation/components/EditableTag';
import EmptyState from '@/shared/presentation/primitives/EmptyState';
import ThemeToggleButton from '@/shared/presentation/components/ThemeToggleButton';
import Row from '@/shared/presentation/primitives/Row';
import Avatar from '@/shared/presentation/primitives/Avatar';
import Box from '@/shared/presentation/primitives/Box';
import Button from '@/shared/presentation/primitives/Button';
import Loader from '@/shared/presentation/primitives/Loader';
import SaveStatusIndicator from '@/shared/presentation/primitives/SaveStatusIndicator';
import Skeleton from '@/shared/presentation/primitives/Skeleton';
import Stack from '@/shared/presentation/primitives/Stack';
import '@/shared/presentation/assets/stylesheets/resize-handle.css';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import useTip from '@/shared/tips/use-tip';
import LatexEditorPanel from './LatexEditorPanel';
import LatexFilePanel from './LatexFilePanel';
import LatexPreviewPanel from './LatexPreviewPanel';
import './LatexDocumentWorkspace.css';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileArchive, FileText, FolderUp, Play, Sparkles } from 'lucide-react';
import { IoSparklesOutline } from 'react-icons/io5';
import { useParams } from 'react-router-dom';
import type { ChangeEvent } from 'react';
import type { PresenceUser } from '@/modules/socket/types/presence-user';

const LatexAIPanel = lazy(() => import('./LatexAIPanel'));

interface PanelWidths {
    files: number;
    preview: number;
    ai: number;
    editorTop: number;
}

interface DragState {
    panel: 'files' | 'preview' | 'ai' | 'editor';
    startX: number;
    startY: number;
    startDimension: number;
}

interface KeyboardResizeConfig {
    panel: DragState['panel'];
    key: string;
}

interface LoadingPlaceholderBlock {
    key: string;
    width: string;
}

interface LoadingSkeletonProps {
    width: string | number;
    height: string | number;
    borderRadius?: string | number;
}

const STORAGE_KEY = 'volt:latex-panel-widths';
const FILES_MIN = 160;
const FILES_MAX = 400;
const PREVIEW_MIN = 260;
const PREVIEW_MAX = 600;
const AI_MIN = 100;
const AI_MAX = 600;
const EDITOR_GROUP_MIN = 180;
const DEFAULT_WIDTHS: PanelWidths = { files: 220, preview: PREVIEW_MAX, ai: 300, editorTop: 260 };
const LOADING_FILE_PANEL_BLOCKS: LoadingPlaceholderBlock[] = [
    { key: 'file-1', width: '72%' },
    { key: 'file-2', width: '88%' },
    { key: 'file-3', width: '64%' },
    { key: 'file-4', width: '81%' }
];
const LOADING_EDITOR_BLOCKS: LoadingPlaceholderBlock[] = [
    { key: 'editor-1', width: '94%' },
    { key: 'editor-2', width: '86%' },
    { key: 'editor-3', width: '91%' },
    { key: 'editor-4', width: '67%' }
];
const LOADING_PREVIEW_BLOCKS: LoadingPlaceholderBlock[] = [
    { key: 'preview-1', width: '100%' },
    { key: 'preview-2', width: '100%' },
    { key: 'preview-3', width: '82%' }
];

const LoadingSkeleton = ({
    width,
    height,
    borderRadius = '999px'
}: LoadingSkeletonProps) => (
    <Skeleton
        variant='rectangular'
        animation='wave'
        width={width}
        height={height}
        style={{
            borderRadius,
            backgroundColor: 'var(--color-surface-tertiary, rgba(127, 127, 127, 0.18))'
        }}
    />
);

const LATEX_TEMPLATE_CONTENT = `\\documentclass{article}

\\begin{document}

Hello, world!

\\end{document}
`;

const LEGACY_PLACEHOLDER_ENTRYPOINT_NAME = 'main.tex';

const loadPanelWidths = (): PanelWidths => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return DEFAULT_WIDTHS;
        const parsed = JSON.parse(saved) as Partial<PanelWidths>;
        return {
            files: Math.min(FILES_MAX, Math.max(FILES_MIN, parsed.files ?? DEFAULT_WIDTHS.files)),
            preview: Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, parsed.preview ?? DEFAULT_WIDTHS.preview)),
            ai: Math.min(AI_MAX, Math.max(AI_MIN, parsed.ai ?? DEFAULT_WIDTHS.ai)),
            editorTop: Math.max(EDITOR_GROUP_MIN, parsed.editorTop ?? DEFAULT_WIDTHS.editorTop)
        };
    } catch {
        return DEFAULT_WIDTHS;
    }
};

/** Returns "FL" initials from a PresenceUser, falling back to "?" for anonymous users. */
const getPresenceInitials = (user: PresenceUser): string => {
    const first = user.firstName?.[0] ?? '';
    const last = user.lastName?.[0] ?? '';
    const initials = `${first}${last}`.toUpperCase();
    return initials || '?';
};

const LatexDocumentWorkspace = () => {
    const { documentId = '' } = useParams<{ documentId: string }>();
    const [panelWidths, setPanelWidths] = useState<PanelWidths>(loadPanelWidths);
    const dragStateRef = useRef<DragState | null>(null);
    const editorStackRef = useRef<HTMLDivElement | null>(null);
    const [hasEnteredWorkspace, setHasEnteredWorkspace] = useState(false);
    const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
    const [isImportingProject, setIsImportingProject] = useState(false);
    const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
    const initialWorkspaceVisibilityResolvedRef = useRef(false);

    const {
        latexDocument,
        isLoading,
        activeEditorGroupId,
        isEditorSplit,
        editorGroups,
        isDirty,
        dirtyFileIds,
        isSaving,
        isUploading,
        isExportingTex,
        isExportingZip,
        isCompiling,
        compiledPdfUrl,
        compileError,
        accessDenied,
        accessDeniedMessage,
        files,
        rawAssets,
        selectedAssetId,
        collaborators,
        fileInputRef,
        folderInputRef,
        handleEditorChangeForGroup,
        handleRenameDocument,
        handleInsertAssetRef,
        handleExportTex,
        handleExportZip,
        handleExportPdf,
        handleCompile,
        getEditorContentForSelection,
        getPendingRemoteUpdateForSelection,
        applyPendingRemoteUpdate,
        dismissPendingRemoteUpdate,
        handleFocusEditorGroup,
        handleSelectFileById,
        handleSelectAssetById,
        handleSelectTab,
        handleCloseTab,
        handleSplitEditorDown,
        handleDuplicateTabToOtherGroup,
        handleCloseSecondaryEditorGroup,
        handleReorderTabs,
        handleCreateFile,
        handleCreateFolder,
        handleDeleteFile,
        deleteFile,
        handleDeleteAsset,
        deleteAsset,
        updateFile,
        updateAsset,
        handleRenameFile,
        handleRenameAsset,
        handleSetEntrypoint,
        handleUploadWorkspaceEntries,
        handleWorkspaceFilesSelected,
        handleWorkspaceFoldersSelected
    } = useLatexWorkspace({ documentId });

    const legacyPlaceholderFile = files.length === 1
        && rawAssets.length === 0
        && files[0]?.isEntrypoint
        && files[0]?.name === LEGACY_PLACEHOLDER_ENTRYPOINT_NAME
        && files[0]?.path === ''
        && files[0]?.content.trim() === ''
        ? files[0]
        : null;

    usePageTitle(latexDocument?.title ?? 'LaTeX Workspace');
    useDashboardWorkspaceChrome({ collapseSidebar: true, hideHeader: true });

    useEffect(() => {
        setHasEnteredWorkspace(false);
        setIsCreatingTemplate(false);
        setIsImportingProject(false);
        initialWorkspaceVisibilityResolvedRef.current = false;
    }, [documentId]);

    /** Pointer Capture drag — files panel handle. */
    const handleFilesPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragStateRef.current = {
            panel: 'files',
            startX: e.clientX,
            startY: e.clientY,
            startDimension: panelWidths.files
        };
    }, [panelWidths.files]);

    /** Pointer Capture drag — preview panel handle. */
    const handlePreviewPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragStateRef.current = {
            panel: 'preview',
            startX: e.clientX,
            startY: e.clientY,
            startDimension: panelWidths.preview
        };
    }, [panelWidths.preview]);

    /** Pointer Capture drag — AI panel handle (vertical). */
    const handleAiPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragStateRef.current = {
            panel: 'ai',
            startX: e.clientX,
            startY: e.clientY,
            startDimension: panelWidths.ai
        };
    }, [panelWidths.ai]);

    const handleEditorSplitPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragStateRef.current = {
            panel: 'editor',
            startX: e.clientX,
            startY: e.clientY,
            startDimension: panelWidths.editorTop
        };
    }, [panelWidths.editorTop]);

    /**
     * Shared pointermove for both handles.
     * Pointer capture guarantees events arrive here even when the mouse
     * is over the PDF iframe — no global listeners needed.
     */
    const handleDragPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
        const state = dragStateRef.current;
        if (!state || !e.currentTarget.hasPointerCapture(e.pointerId)) return;

        if (state.panel === 'files') {
            const delta = e.clientX - state.startX;
            const w = Math.min(FILES_MAX, Math.max(FILES_MIN, state.startDimension + delta));
            setPanelWidths((prev) => ({ ...prev, files: w }));
        } else if (state.panel === 'preview') {
            const delta = e.clientX - state.startX;
            const w = Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, state.startDimension - delta));
            setPanelWidths((prev) => ({ ...prev, preview: w }));
        } else if (state.panel === 'ai') {
            const delta = e.clientY - state.startY;
            const h = Math.min(AI_MAX, Math.max(AI_MIN, state.startDimension - delta));
            setPanelWidths((prev) => ({ ...prev, ai: h }));
        } else if (state.panel === 'editor') {
            const hostHeight = editorStackRef.current?.getBoundingClientRect().height ?? 0;
            const maxHeight = Math.max(EDITOR_GROUP_MIN, hostHeight - EDITOR_GROUP_MIN - 8);
            const delta = e.clientY - state.startY;
            const h = Math.min(maxHeight, Math.max(EDITOR_GROUP_MIN, state.startDimension + delta));
            setPanelWidths((prev) => ({ ...prev, editorTop: h }));
        }
    }, []);

    /** Shared pointerup: releases capture and persists widths to localStorage. */
    const handleDragPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
        if (!dragStateRef.current) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        dragStateRef.current = null;
        setPanelWidths((prev) => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
            return prev;
        });
    }, []);

    /** pointercancel fires if the browser forcibly cancels capture (e.g. touch interrupted). */
    const handleDragPointerCancel = useCallback((): void => {
        dragStateRef.current = null;
    }, []);

    useEffect(() => {
        if (!isEditorSplit) {
            return;
        }

        const host = editorStackRef.current;
        if (!host) {
            return;
        }

        const clampEditorSplit = (): void => {
            const hostHeight = host.getBoundingClientRect().height;
            const maxHeight = Math.max(EDITOR_GROUP_MIN, hostHeight - EDITOR_GROUP_MIN - 8);

            setPanelWidths((prev) => {
                const nextEditorTop = Math.min(maxHeight, Math.max(EDITOR_GROUP_MIN, prev.editorTop));
                return nextEditorTop === prev.editorTop
                    ? prev
                    : { ...prev, editorTop: nextEditorTop };
            });
        };

        clampEditorSplit();

        const observer = new ResizeObserver(() => {
            clampEditorSplit();
        });

        observer.observe(host);
        return () => observer.disconnect();
    }, [isEditorSplit]);

    const hasWorkspaceContent = rawAssets.length > 0 || (files.length > 0 && !legacyPlaceholderFile);

    useEffect(() => {
        if (initialWorkspaceVisibilityResolvedRef.current || isLoading) {
            return;
        }

        setHasEnteredWorkspace(hasWorkspaceContent);
        initialWorkspaceVisibilityResolvedRef.current = true;
    }, [hasWorkspaceContent, isLoading]);

    const handleStartFromTemplate = useCallback(async (): Promise<void> => {
        setIsCreatingTemplate(true);

        try {
            if (legacyPlaceholderFile) {
                await updateFile({
                    documentId,
                    fileId: legacyPlaceholderFile._id,
                    content: LATEX_TEMPLATE_CONTENT
                });
                handleSelectFileById(legacyPlaceholderFile._id);
            } else {
                await handleCreateFile('main.tex', undefined, LATEX_TEMPLATE_CONTENT);
            }
            setHasEnteredWorkspace(true);
        } catch {
            setHasEnteredWorkspace(false);
        } finally {
            setIsCreatingTemplate(false);
        }
    }, [documentId, handleCreateFile, handleSelectFileById, legacyPlaceholderFile, updateFile]);

    const handleUploadProject = useCallback((): void => {
        folderInputRef.current?.click();
    }, [folderInputRef]);

    const handleOnboardingFolderSelection = useCallback(async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
        const fileList = event.target.files;

        if (!fileList || fileList.length === 0) {
            return;
        }

        setIsImportingProject(true);

        try {
            if (legacyPlaceholderFile) {
                await deleteFile({
                    documentId,
                    fileId: legacyPlaceholderFile._id
                });
            }
            await handleWorkspaceFoldersSelected(event);
            setHasEnteredWorkspace(true);
        } catch {
            setHasEnteredWorkspace(false);
        } finally {
            setIsImportingProject(false);
        }
    }, [deleteFile, documentId, handleWorkspaceFoldersSelected, legacyPlaceholderFile]);

    const shouldShowWorkspaceOnboarding = !hasWorkspaceContent && !hasEnteredWorkspace;

    useTip('latex-workspace-layout', {
        enabled: !isLoading && !accessDenied && !shouldShowWorkspaceOnboarding
    });

    const toggleAIPanel = useCallback(() => {
        setIsAIPanelOpen((current) => !current);
    }, []);

    const saveStatusMessage = isSaving
        ? 'Saving document changes.'
        : isDirty
            ? 'Unsaved document changes.'
            : 'All document changes saved.';

    let compileStatusMessage = 'Preview is ready.';
    if (isCompiling) {
        compileStatusMessage = 'Compiling PDF preview.';
    } else if (compileError) {
        compileStatusMessage = 'PDF compilation failed.';
    } else if (!compiledPdfUrl) {
        compileStatusMessage = 'Waiting for the first successful compile.';
    }

    const secondaryEditorGroup = editorGroups.find((group) => group.id === 'secondary') ?? null;

    const handleKeyboardResize = useCallback(({ panel, key }: KeyboardResizeConfig): void => {
        const isDecrease = key === 'ArrowLeft' || key === 'ArrowUp';
        const isIncrease = key === 'ArrowRight' || key === 'ArrowDown';

        if (!isDecrease && !isIncrease) {
            return;
        }

        const step = 24;

        setPanelWidths((prev) => {
            const next = { ...prev };

            if (panel === 'files') {
                const delta = isDecrease ? -step : step;
                next.files = Math.min(FILES_MAX, Math.max(FILES_MIN, prev.files + delta));
            }

            if (panel === 'preview') {
                const delta = isDecrease ? step : -step;
                next.preview = Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, prev.preview + delta));
            }

            if (panel === 'ai') {
                const delta = isDecrease ? step : -step;
                next.ai = Math.min(AI_MAX, Math.max(AI_MIN, prev.ai + delta));
            }

            if (panel === 'editor') {
                const hostHeight = editorStackRef.current?.getBoundingClientRect().height ?? 0;
                const maxHeight = Math.max(EDITOR_GROUP_MIN, hostHeight - EDITOR_GROUP_MIN - 8);
                const delta = isDecrease ? -step : step;
                next.editorTop = Math.min(maxHeight, Math.max(EDITOR_GROUP_MIN, prev.editorTop + delta));
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const handleSeparatorKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>, panel: DragState['panel']): void => {
        const supportedKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

        if (!supportedKeys.includes(event.key)) {
            return;
        }

        event.preventDefault();
        handleKeyboardResize({ panel, key: event.key });
    }, [handleKeyboardResize]);

    if (isLoading) {
        return (
            <Stack className='latex-workspace'>
                <Row justify='between' gap='1' className='latex-workspace__toolbar'>
                    <Stack gap='025'>
                        <LoadingSkeleton width='13rem' height='1rem' />
                        <LoadingSkeleton width='18rem' height='0.875rem' />
                    </Stack>
                    <Row gap='075'>
                        <LoadingSkeleton width='6.5rem' height='2rem' borderRadius='999px' />
                        <LoadingSkeleton width='7.5rem' height='2rem' borderRadius='999px' />
                        <LoadingSkeleton width='5.5rem' height='2rem' borderRadius='999px' />
                    </Row>
                </Row>

                <Box display='flex' flex='1' minH='0' className='latex-workspace__layout'>
                    <Stack gap='1' minH='0' style={{
                            width: panelWidths.files,
                            padding: '1rem',
                            borderRight: '1px solid var(--color-border-primary, rgba(127, 127, 127, 0.2))'
                        }}>
                        <LoadingSkeleton width='5.5rem' height='0.875rem' />
                        {LOADING_FILE_PANEL_BLOCKS.map((block) => <div
                            key={block.key}
                            style={{
                                width: block.width,
                                height: '0.875rem',
                                borderRadius: '999px',
                                background: 'var(--color-surface-tertiary, rgba(127, 127, 127, 0.18))'
                            }}
                        />)}
                    </Stack>

                    <Stack flex='1' minW='0' className='latex-workspace__main-content'>
                        <Stack gap='1' flex='1' minH='0' style={{ padding: '1.5rem' }}>
                            <LoadingSkeleton width='11rem' height='1rem' />
                            <LoadingSkeleton width='100%' height='2.5rem' borderRadius='0.85rem' />
                            <LoadingSkeleton width='100%' height='100%' borderRadius='1rem' />
                            <Stack gap='075' width='max' style={{ maxWidth: '42rem' }}>
                                {LOADING_EDITOR_BLOCKS.map((block) => <div
                                    key={block.key}
                                    style={{
                                        width: block.width,
                                        height: '0.9rem',
                                        borderRadius: '999px',
                                        background: 'var(--color-surface-tertiary, rgba(127, 127, 127, 0.18))'
                                    }}
                                />)}
                            </Stack>
                        </Stack>

                        {isAIPanelOpen && (
                            <Stack id='latex-ai-panel' gap='075' className='latex-ai-panel' style={{
                                    height: panelWidths.ai,
                                    padding: '1rem',
                                    borderTop: '1px solid var(--color-border-primary, rgba(127, 127, 127, 0.2))'
                                }}>
                                <LoadingSkeleton width='5rem' height='0.875rem' />
                                <div
                                    style={{
                                        width: '42%',
                                        height: '0.875rem',
                                        borderRadius: '999px',
                                        background: 'var(--color-surface-tertiary, rgba(127, 127, 127, 0.18))'
                                    }}
                                />
                                <div
                                    style={{
                                        width: '75%',
                                        height: '0.875rem',
                                        borderRadius: '999px',
                                        background: 'var(--color-surface-tertiary, rgba(127, 127, 127, 0.18))'
                                    }}
                                />
                            </Stack>
                        )}
                    </Stack>

                    <Stack gap='1' minH='0' style={{
                            width: panelWidths.preview,
                            padding: '1rem',
                            borderLeft: '1px solid var(--color-border-primary, rgba(127, 127, 127, 0.2))'
                        }}>
                        <LoadingSkeleton width='5.75rem' height='0.875rem' />
                        {LOADING_PREVIEW_BLOCKS.map((block) => <div
                            key={block.key}
                            style={{
                                width: block.width,
                                height: block.key === 'preview-1' ? '9rem' : '1rem',
                                borderRadius: '0.75rem',
                                background: 'var(--color-surface-tertiary, rgba(127, 127, 127, 0.18))'
                            }}
                        />)}
                    </Stack>
                </Box>
            </Stack>
        );
    }

    if (accessDenied) {
        return (
            <AccessDenied description={accessDeniedMessage} showBack={false} className='h-max w-max' />
        );
    }

    const aiTriggerClassName = isAIPanelOpen
        ? 'latex-workspace__ai-trigger is-active'
        : 'latex-workspace__ai-trigger';

    const writeWithAIButton = (
        <Button
            variant='ghost'
            intent='neutral'
            size='sm'
            shape='rounded'
            className={aiTriggerClassName}
            onClick={toggleAIPanel}
            title='Write with Volt AI'
        >
            <IoSparklesOutline size={14} />
            Write with AI
        </Button>
    );

    const compileButton = (
        <Button
            variant='ghost'
            intent='neutral'
            size='sm'
            shape='rounded'
            disabled={isCompiling}
            onClick={handleCompile}
            title='Compile PDF'
        >
            <Play size={14} />
            Compile
        </Button>
    );

    const exportTexButton = (
        <Button
            variant='ghost'
            intent='neutral'
            size='sm'
            shape='rounded'
            disabled={isExportingTex}
            onClick={handleExportTex}
            title='Export as .tex'
        >
            <Download size={14} />
            .tex
        </Button>
    );

    const exportZipButton = (
        <Button
            variant='ghost'
            intent='neutral'
            size='sm'
            shape='rounded'
            disabled={isExportingZip}
            onClick={handleExportZip}
            title='Export as .zip (with assets)'
        >
            <FileArchive size={14} />
            .zip
        </Button>
    );

    const exportPdfButton = (
        <Button
            variant='ghost'
            intent='neutral'
            size='sm'
            shape='rounded'
            disabled={isCompiling}
            onClick={handleExportPdf}
            title='Export as .pdf'
        >
            <FileText size={14} />
            .pdf
        </Button>
    );

    const collaboratorAvatars = collaborators.map((user) => (
        <Avatar
            key={user.id}
            size='xs'
            fallback={getPresenceInitials(user)}
            alt={`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Collaborator'}
            className='latex-workspace__collaborator-avatar'
        />
    ));

    return (
        <Stack className='latex-workspace'>
            <Row justify='between' gap='1' className='latex-workspace__toolbar'>
                <Row minW='0'>
                    <EditableTag
                        as='span'
                        className='latex-workspace__toolbar-title color-primary'
                        onSave={handleRenameDocument}
                        title='Double-click to rename'
                    >
                        {latexDocument?.title ?? 'LaTeX Document'}
                    </EditableTag>
                </Row>
                <Row gap='075'>
                    <ThemeToggleButton className='latex-workspace__theme-toggle' />
                    {collaboratorAvatars.length > 0 && (
                        <Row className='latex-workspace__collaborators'>
                            {collaboratorAvatars}
                        </Row>
                    )}
                    {isDirty && <span className='latex-workspace__dirty-dot' title='Unsaved changes' />}
                    {isDirty && !isSaving ? (
                        <span className='latex-workspace__status-text color-muted' aria-live='polite'>
                            Unsaved changes
                        </span>
                    ) : (
                        <SaveStatusIndicator
                            status={isSaving ? 'saving' : 'saved'}
                            hideIdle={false}
                            className='latex-workspace__status-text color-muted'
                        />
                    )}
                    {writeWithAIButton}
                    {compileButton}
                    {exportTexButton}
                    {exportPdfButton}
                    {exportZipButton}
                </Row>
            </Row>

            <div className='latex-workspace__sr-only' aria-live='polite'>
                {saveStatusMessage}
            </div>
            <div className='latex-workspace__sr-only' aria-live='polite'>
                {compileStatusMessage}
            </div>

            <Box display='flex' flex='1' minH='0' className='latex-workspace__layout'>
                {shouldShowWorkspaceOnboarding ? (
                    <Box display='flex' flex='1' align='center' justify='center' p='2' className='latex-workspace__empty-layout'>
                        <input
                            ref={fileInputRef}
                            type='file'
                            className='d-none'
                            multiple
                            aria-label='Upload files to the LaTeX workspace'
                            onChange={handleWorkspaceFilesSelected}
                        />

                        <input
                            ref={folderInputRef}
                            type='file'
                            className='d-none'
                            aria-label='Upload a folder to the LaTeX workspace'
                            onChange={(event) => {
                                handleOnboardingFolderSelection(event);
                            }}
                            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                        />

                        <Stack align='center' gap='1' className='latex-workspace__empty-shell'>
                            <EmptyState
                                title='Start your LaTeX project'
                                description='Create a starter .tex file from a template or upload an existing project folder to begin working.'
                                icon={<FileText size={28} />}
                            />
                            <Row gap='075'>
                                <Button
                                    variant='ghost'
                                    intent='neutral'
                                    size='md'
                                    shape='pill'
                                    onClick={handleStartFromTemplate}
                                    isLoading={isCreatingTemplate}
                                    leftIcon={<Sparkles size={14} />}
                                >
                                    Start from a template
                                </Button>
                                <Button
                                    variant='solid'
                                    intent='white'
                                    size='md'
                                    shape='pill'
                                    onClick={handleUploadProject}
                                    disabled={isUploading || isImportingProject}
                                    isLoading={isImportingProject}
                                    leftIcon={<FolderUp size={14} />}
                                >
                                    Upload Project
                                </Button>
                            </Row>
                        </Stack>
                    </Box>
                ) : (
                    <>
                        <LatexFilePanel
                            documentId={documentId}
                            files={files}
                            assets={rawAssets}
                            selectedAssetId={selectedAssetId}
                            fileInputRef={fileInputRef}
                            folderInputRef={folderInputRef}
                            isUploading={isUploading}
                            onInsertRef={handleInsertAssetRef}
                            onFileSelect={handleSelectFileById}
                            onAssetSelect={handleSelectAssetById}
                            onCreateFile={handleCreateFile}
                            onCreateFolder={handleCreateFolder}
                            onDeleteFile={handleDeleteFile}
                            onDeleteAsset={handleDeleteAsset}
                            onDeleteFileDirect={deleteFile}
                            onDeleteAssetDirect={deleteAsset}
                            onUpdateFileDirect={updateFile}
                            onUpdateAssetDirect={updateAsset}
                            onRenameFile={handleRenameFile}
                            onRenameAsset={handleRenameAsset}
                            onSetEntrypoint={handleSetEntrypoint}
                            onUploadEntries={handleUploadWorkspaceEntries}
                            onUploadFiles={handleWorkspaceFilesSelected}
                            onUploadFolders={handleWorkspaceFoldersSelected}
                            width={panelWidths.files}
                        />

                        <div
                            className='latex-drag-handle'
                            role='separator'
                            aria-label='Resize file panel'
                            aria-orientation='vertical'
                            aria-controls='latex-file-panel'
                            aria-valuemin={FILES_MIN}
                            aria-valuemax={FILES_MAX}
                            aria-valuenow={panelWidths.files}
                            tabIndex={0}
                            onPointerDown={handleFilesPointerDown}
                            onPointerMove={handleDragPointerMove}
                            onPointerUp={handleDragPointerUp}
                            onPointerCancel={handleDragPointerCancel}
                            onKeyDown={(event) => handleSeparatorKeyDown(event, 'files')}
                        >
                            <span className='latex-drag-handle__grip volt-resize-handle__grip volt-resize-handle__grip--horizontal' aria-hidden='true' />
                        </div>

                        <Stack flex='1' minW='0' className='latex-workspace__main-content'>
                            <div ref={editorStackRef} className='latex-workspace__editor-stack d-flex column flex-1 min-h-0'>
                                <Stack minH='0' className='latex-workspace__editor-group-shell' style={isEditorSplit ? { height: panelWidths.editorTop, flex: '0 0 auto' } : { flex: '1 1 0%' }}>
                                    <LatexEditorPanel
                                        groupId='primary'
                                        isGroupActive={activeEditorGroupId === 'primary'}
                                        isSplitView={isEditorSplit}
                                        activeSelection={editorGroups[0]?.selection ?? null}
                                        openTabs={editorGroups[0]?.openTabs ?? []}
                                        files={files}
                                        assets={rawAssets}
                                        dirtyFileIds={dirtyFileIds}
                                        hasPendingRemoteUpdate={Boolean(getPendingRemoteUpdateForSelection(editorGroups[0]?.selection ?? null))}
                                        content={getEditorContentForSelection(editorGroups[0]?.selection ?? null)}
                                        onFocusGroup={() => handleFocusEditorGroup('primary')}
                                        onChange={(value) => handleEditorChangeForGroup('primary', value)}
                                        onApplyRemoteUpdate={() => {
                                            const groupSelection = editorGroups[0]?.selection;
                                            if (groupSelection?.type !== 'file') {
                                                return;
                                            }

                                            applyPendingRemoteUpdate(groupSelection.id);
                                        }}
                                        onDismissRemoteUpdate={() => {
                                            const groupSelection = editorGroups[0]?.selection;
                                            if (groupSelection?.type !== 'file') {
                                                return;
                                            }

                                            dismissPendingRemoteUpdate(groupSelection.id);
                                        }}
                                        onTabSelect={(tab) => handleSelectTab('primary', tab)}
                                        onTabClose={(tab) => handleCloseTab('primary', tab)}
                                        onTabReorder={(activeTab, overTab, position) => handleReorderTabs('primary', activeTab, overTab, position)}
                                        onSplitDown={handleSplitEditorDown}
                                        onDuplicateTabToOtherGroup={(tab) => handleDuplicateTabToOtherGroup('primary', tab)}
                                    />
                                </Stack>

                                {isEditorSplit && secondaryEditorGroup && (
                                    <>
                                        <div
                                            className='latex-drag-handle-horizontal latex-workspace__editor-split-handle'
                                            role='separator'
                                            aria-label='Resize editor groups'
                                            aria-orientation='horizontal'
                                            aria-valuemin={EDITOR_GROUP_MIN}
                                            aria-valuenow={panelWidths.editorTop}
                                            tabIndex={0}
                                            onPointerDown={handleEditorSplitPointerDown}
                                            onPointerMove={handleDragPointerMove}
                                            onPointerUp={handleDragPointerUp}
                                            onPointerCancel={handleDragPointerCancel}
                                            onKeyDown={(event) => handleSeparatorKeyDown(event, 'editor')}
                                        >
                                            <span className='latex-drag-handle__grip volt-resize-handle__grip volt-resize-handle__grip--vertical' aria-hidden='true' />
                                        </div>

                                        <Stack flex='1' minH='0' className='latex-workspace__editor-group-shell'>
                                            <LatexEditorPanel
                                                groupId='secondary'
                                                isGroupActive={activeEditorGroupId === 'secondary'}
                                                isSplitView={isEditorSplit}
                                                activeSelection={secondaryEditorGroup.selection}
                                                openTabs={secondaryEditorGroup.openTabs}
                                                files={files}
                                                assets={rawAssets}
                                                dirtyFileIds={dirtyFileIds}
                                                hasPendingRemoteUpdate={Boolean(getPendingRemoteUpdateForSelection(secondaryEditorGroup.selection))}
                                                content={getEditorContentForSelection(secondaryEditorGroup.selection)}
                                                onFocusGroup={() => handleFocusEditorGroup('secondary')}
                                                onChange={(value) => handleEditorChangeForGroup('secondary', value)}
                                                onApplyRemoteUpdate={() => {
                                                    if (secondaryEditorGroup.selection?.type !== 'file') {
                                                        return;
                                                    }

                                                    applyPendingRemoteUpdate(secondaryEditorGroup.selection.id);
                                                }}
                                                onDismissRemoteUpdate={() => {
                                                    if (secondaryEditorGroup.selection?.type !== 'file') {
                                                        return;
                                                    }

                                                    dismissPendingRemoteUpdate(secondaryEditorGroup.selection.id);
                                                }}
                                                onTabSelect={(tab) => handleSelectTab('secondary', tab)}
                                                onTabClose={(tab) => handleCloseTab('secondary', tab)}
                                                onTabReorder={(activeTab, overTab, position) => handleReorderTabs('secondary', activeTab, overTab, position)}
                                                onSplitDown={handleSplitEditorDown}
                                                onDuplicateTabToOtherGroup={(tab) => handleDuplicateTabToOtherGroup('secondary', tab)}
                                                onCloseGroup={handleCloseSecondaryEditorGroup}
                                            />
                                        </Stack>
                                    </>
                                )}
                            </div>

                            {isAIPanelOpen && (
                                <>
                                    <div
                                        className='latex-drag-handle-horizontal'
                                        role='separator'
                                        aria-label='Resize AI panel'
                                        aria-orientation='horizontal'
                                        aria-controls='latex-ai-panel'
                                        aria-valuemin={AI_MIN}
                                        aria-valuemax={AI_MAX}
                                        aria-valuenow={panelWidths.ai}
                                        tabIndex={0}
                                        onPointerDown={handleAiPointerDown}
                                        onPointerMove={handleDragPointerMove}
                                        onPointerUp={handleDragPointerUp}
                                        onPointerCancel={handleDragPointerCancel}
                                        onKeyDown={(event) => handleSeparatorKeyDown(event, 'ai')}
                                    >
                                        <span className='latex-drag-handle__grip volt-resize-handle__grip volt-resize-handle__grip--vertical' aria-hidden='true' />
                                    </div>
                                    <Suspense fallback={
                                        <Stack id='latex-ai-panel' align='center' className='latex-ai-panel flex-center' style={{ height: panelWidths.ai }}>
                                            <Loader scale={0.5} isFixed={false} />
                                        </Stack>
                                    }>
                                        <LatexAIPanel
                                            documentId={documentId}
                                            documentTitle={latexDocument?.title ?? 'LaTeX Document'}
                                            files={files}
                                            height={panelWidths.ai}
                                            onClose={toggleAIPanel}
                                        />
                                    </Suspense>
                                </>
                            )}
                        </Stack>

                        <div
                            className='latex-drag-handle'
                            role='separator'
                            aria-label='Resize preview panel'
                            aria-orientation='vertical'
                            aria-controls='latex-preview-panel'
                            aria-valuemin={PREVIEW_MIN}
                            aria-valuemax={PREVIEW_MAX}
                            aria-valuenow={panelWidths.preview}
                            tabIndex={0}
                            onPointerDown={handlePreviewPointerDown}
                            onPointerMove={handleDragPointerMove}
                            onPointerUp={handleDragPointerUp}
                            onPointerCancel={handleDragPointerCancel}
                            onKeyDown={(event) => handleSeparatorKeyDown(event, 'preview')}
                        >
                            <span className='latex-drag-handle__grip volt-resize-handle__grip volt-resize-handle__grip--horizontal' aria-hidden='true' />
                        </div>

                        <LatexPreviewPanel
                            panelId='latex-preview-panel'
                            isCompiling={isCompiling}
                            compiledPdfUrl={compiledPdfUrl}
                            compileError={compileError}
                            onExportPdf={handleExportPdf}
                            width={panelWidths.preview}
                        />
                    </>
                )}
            </Box>
        </Stack>
    );
};

export default LatexDocumentWorkspace;
