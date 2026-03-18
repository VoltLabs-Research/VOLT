import useLatexWorkspace from '@/modules/latex/hooks/use-latex-workspace';
import { DASHBOARD_LAYOUT_EVENTS } from '@/modules/dashboard/utilities/layout-events';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import Avatar from '@/shared/presentation/components/Avatar';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import EditableTag from '@/shared/presentation/components/EditableTag';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Loader from '@/shared/presentation/components/Loader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import ThemeToggleButton from '@/shared/presentation/components/ThemeToggleButton';
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
import type { PresenceUser } from '@/modules/socket/trajectory/api/entities/presence-user';

const LatexAIPanel = lazy(() => import('./LatexAIPanel'));

interface PanelWidths {
    files: number;
    preview: number;
    ai: number;
};

interface DragState {
    panel: 'files' | 'preview' | 'ai';
    startX: number;
    startY: number;
    startDimension: number;
};

interface KeyboardResizeConfig {
    panel: DragState['panel'];
    key: string;
};

const STORAGE_KEY = 'volt:latex-panel-widths';
const FILES_MIN = 160;
const FILES_MAX = 400;
const PREVIEW_MIN = 260;
const PREVIEW_MAX = 600;
const AI_MIN = 100;
const AI_MAX = 600;
const DEFAULT_WIDTHS: PanelWidths = { files: 220, preview: PREVIEW_MAX, ai: 300 };
const LATEX_TEMPLATE_CONTENT = `\\documentclass{article}

\\begin{document}

Hello, world!

\\end{document}
`;

const loadPanelWidths = (): PanelWidths => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return DEFAULT_WIDTHS;
        const parsed = JSON.parse(saved) as Partial<PanelWidths>;
        return {
            files: Math.min(FILES_MAX, Math.max(FILES_MIN, parsed.files ?? DEFAULT_WIDTHS.files)),
            preview: Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, parsed.preview ?? DEFAULT_WIDTHS.preview)),
            ai: Math.min(AI_MAX, Math.max(AI_MIN, parsed.ai ?? DEFAULT_WIDTHS.ai))
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
    const [hasEnteredWorkspace, setHasEnteredWorkspace] = useState(false);
    const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
    const [isImportingProject, setIsImportingProject] = useState(false);
    const [isAIPanelOpen, setIsAIPanelOpen] = useState(true);
    const initialWorkspaceVisibilityResolvedRef = useRef(false);

    const {
        latexDocument,
        isLoading,
        selection,
        openTabs,
        editorContent,
        isDirty,
        dirtyFileIds,
        isSaving,
        isUploading,
        isExportingTex,
        isExportingZip,
        isCompiling,
        compiledPdfUrl,
        compileError,
        activePendingRemoteUpdate,
        accessDenied,
        accessDeniedMessage,
        files,
        rawAssets,
        selectedAssetId,
        collaborators,
        fileInputRef,
        folderInputRef,
        handleEditorChange,
        handleRenameDocument,
        handleInsertAssetRef,
        handleExportTex,
        handleExportZip,
        handleExportPdf,
        handleCompile,
        applyPendingRemoteUpdate,
        dismissPendingRemoteUpdate,
        handleSelectFileById,
        handleSelectAssetById,
        handleSelectTab,
        handleCloseTab,
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
        handleWorkspaceFilesSelected,
        handleWorkspaceFoldersSelected
    } = useLatexWorkspace({ documentId });

    usePageTitle(latexDocument?.title ?? 'LaTeX Workspace');

    /** Collapse the dashboard sidebar while the editor is mounted. */
    useEffect(() => {
        window.dispatchEvent(new CustomEvent(DASHBOARD_LAYOUT_EVENTS.requestSidebarCollapse));
        window.dispatchEvent(new CustomEvent(DASHBOARD_LAYOUT_EVENTS.requestHeaderHide));

        return () => {
            window.dispatchEvent(new CustomEvent(DASHBOARD_LAYOUT_EVENTS.requestSidebarExpand));
            window.dispatchEvent(new CustomEvent(DASHBOARD_LAYOUT_EVENTS.requestHeaderShow));
        };
    }, []);

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

    const hasWorkspaceContent = files.length > 0 || rawAssets.length > 0;

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
            await handleCreateFile('main.tex', undefined, LATEX_TEMPLATE_CONTENT);
            setHasEnteredWorkspace(true);
        } catch {
            setHasEnteredWorkspace(false);
        } finally {
            setIsCreatingTemplate(false);
        }
    }, [handleCreateFile, latexDocument?.title]);

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
            await handleWorkspaceFoldersSelected(event);
            setHasEnteredWorkspace(true);
        } catch {
            setHasEnteredWorkspace(false);
        } finally {
            setIsImportingProject(false);
        }
    }, [handleWorkspaceFoldersSelected]);

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
            <Container className='d-flex column flex-center items-center gap-1 h-max'>
                <Loader scale={0.6} isFixed={false} />
                <Paragraph className='color-muted'>Loading document...</Paragraph>
            </Container>
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
        <Container className='latex-workspace d-flex column'>
            <Container className='latex-workspace__toolbar d-flex items-center content-between gap-1'>
                <EditableTag
                    as='span'
                    className='latex-workspace__toolbar-title color-primary'
                    onSave={handleRenameDocument}
                    title='Double-click to rename'
                >
                    {latexDocument?.title ?? 'LaTeX Document'}
                </EditableTag>
                <Container className='d-flex items-center gap-075'>
                    <ThemeToggleButton className='latex-workspace__theme-toggle' />
                    {collaboratorAvatars.length > 0 && (
                        <Container className='latex-workspace__collaborators d-flex items-center'>
                            {collaboratorAvatars}
                        </Container>
                    )}
                    {isDirty && <span className='latex-workspace__dirty-dot' title='Unsaved changes' />}
                    <span className='latex-workspace__status-text color-muted' aria-live='polite'>
                        {isSaving ? 'Saving…' : isDirty ? 'Unsaved changes' : 'Saved'}
                    </span>
                    {writeWithAIButton}
                    {compileButton}
                    {exportTexButton}
                    {exportPdfButton}
                    {exportZipButton}
                </Container>
            </Container>

            <div className='latex-workspace__sr-only' aria-live='polite'>
                {saveStatusMessage}
            </div>
            <div className='latex-workspace__sr-only' aria-live='polite'>
                {compileStatusMessage}
            </div>

            <Container className='latex-workspace__layout d-flex flex-1 min-h-0'>
                {shouldShowWorkspaceOnboarding ? (
                    <Container className='latex-workspace__empty-layout d-flex flex-1 items-center content-center p-2'>
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

                        <Container className='latex-workspace__empty-shell d-flex column items-center gap-1'>
                            <EmptyState
                                title='Start your LaTeX project'
                                description='Create a starter .tex file from a template or upload an existing project folder to begin working.'
                                icon={<FileText size={28} />}
                            />
                            <Container className='d-flex items-center gap-075'>
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
                            </Container>
                        </Container>
                    </Container>
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
                        />

                        <Container className='latex-workspace__main-content d-flex column flex-1 min-w-0'>
                            <LatexEditorPanel
                                activeSelection={selection}
                                openTabs={openTabs}
                                files={files}
                                assets={rawAssets}
                                dirtyFileIds={dirtyFileIds}
                                hasPendingRemoteUpdate={Boolean(selection?.type === 'file' && activePendingRemoteUpdate)}
                                content={editorContent}
                                onChange={handleEditorChange}
                                onApplyRemoteUpdate={() => {
                                    if (selection?.type !== 'file') {
                                        return;
                                    }

                                    applyPendingRemoteUpdate(selection.id);
                                }}
                                onDismissRemoteUpdate={() => {
                                    if (selection?.type !== 'file') {
                                        return;
                                    }

                                    dismissPendingRemoteUpdate(selection.id);
                                }}
                                onTabSelect={handleSelectTab}
                                onTabClose={handleCloseTab}
                            />

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
                                    />
                                    <Suspense fallback={
                                        <Container id='latex-ai-panel' className='latex-ai-panel d-flex column flex-center items-center' style={{ height: panelWidths.ai }}>
                                            <Loader scale={0.5} isFixed={false} />
                                        </Container>
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
                        </Container>

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
                        />

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
            </Container>
        </Container>
    );
};

export default LatexDocumentWorkspace;
