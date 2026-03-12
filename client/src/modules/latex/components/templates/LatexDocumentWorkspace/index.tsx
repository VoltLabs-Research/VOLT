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
import LatexEditorPanel from './LatexEditorPanel';
import LatexFilePanel from './LatexFilePanel';
import LatexPreviewPanel from './LatexPreviewPanel';
import './LatexDocumentWorkspace.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileArchive, FileText, FolderUp, Sparkles } from 'lucide-react';
import { useParams } from 'react-router-dom';
import type { ChangeEvent } from 'react';
import type { PresenceUser } from '@/modules/socket/trajectory/api/entities/presence-user';

interface PanelWidths {
    files: number;
    preview: number;
};

interface DragState {
    panel: 'files' | 'preview';
    startX: number;
    startWidth: number;
};

const STORAGE_KEY = 'volt:latex-panel-widths';
const FILES_MIN = 160;
const FILES_MAX = 400;
const PREVIEW_MIN = 260;
const PREVIEW_MAX = 600;
const DEFAULT_WIDTHS: PanelWidths = { files: 220, preview: 340 };
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
            preview: Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, parsed.preview ?? DEFAULT_WIDTHS.preview))
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
        accessDenied,
        accessDeniedMessage,
        files,
        rawAssets,
        collaborators,
        fileInputRef,
        folderInputRef,
        handleEditorChange,
        handleRenameDocument,
        handleInsertAssetRef,
        handleExportTex,
        handleExportZip,
        handleExportPdf,
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
        handleMoveFile,
        handleMoveAsset,
        handleRenameFile,
        handleRenameAsset,
        handleWorkspaceFilesSelected,
        handleWorkspaceFoldersSelected
    } = useLatexWorkspace({ documentId });

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
            startWidth: panelWidths.files
        };
    }, [panelWidths.files]);

    /** Pointer Capture drag — preview panel handle. */
    const handlePreviewPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragStateRef.current = {
            panel: 'preview',
            startX: e.clientX,
            startWidth: panelWidths.preview
        };
    }, [panelWidths.preview]);

    /**
     * Shared pointermove for both handles.
     * Pointer capture guarantees events arrive here even when the mouse
     * is over the PDF iframe — no global listeners needed.
     */
    const handleDragPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
        const state = dragStateRef.current;
        if (!state || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const delta = e.clientX - state.startX;

        if (state.panel === 'files') {
            const w = Math.min(FILES_MAX, Math.max(FILES_MIN, state.startWidth + delta));
            setPanelWidths((prev) => ({ ...prev, files: w }));
        } else {
            const w = Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, state.startWidth - delta));
            setPanelWidths((prev) => ({ ...prev, preview: w }));
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

        const safeBaseName = (latexDocument?.title ?? 'document')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'document';

        try {
            await handleCreateFile(`${safeBaseName}.tex`, undefined, LATEX_TEMPLATE_CONTENT);
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
                    {collaboratorAvatars.length > 0 && (
                        <Container className='latex-workspace__collaborators d-flex items-center'>
                            {collaboratorAvatars}
                        </Container>
                    )}
                    {isDirty && <span className='latex-workspace__dirty-dot' title='Unsaved changes' />}
                    {isSaving && <span className='font-size-05 color-muted'>Saving…</span>}
                    {exportTexButton}
                    {exportPdfButton}
                    {exportZipButton}
                </Container>
            </Container>

            <Container className='latex-workspace__layout d-flex flex-1 min-h-0'>
                {shouldShowWorkspaceOnboarding ? (
                    <Container className='latex-workspace__empty-layout d-flex flex-1 items-center content-center p-2'>
                        <input
                            ref={fileInputRef}
                            type='file'
                            className='d-none'
                            multiple
                            onChange={handleWorkspaceFilesSelected}
                        />

                        <input
                            ref={folderInputRef}
                            type='file'
                            className='d-none'
                            onChange={(event) => {
                                void handleOnboardingFolderSelection(event);
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
                            onMoveFile={handleMoveFile}
                            onMoveAsset={handleMoveAsset}
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
                            onPointerDown={handleFilesPointerDown}
                            onPointerMove={handleDragPointerMove}
                            onPointerUp={handleDragPointerUp}
                            onPointerCancel={handleDragPointerCancel}
                        />

                        <LatexEditorPanel
                            activeSelection={selection}
                            openTabs={openTabs}
                            files={files}
                            assets={rawAssets}
                            dirtyFileIds={dirtyFileIds}
                            content={editorContent}
                            onChange={handleEditorChange}
                            onTabSelect={handleSelectTab}
                            onTabClose={handleCloseTab}
                        />

                        <div
                            className='latex-drag-handle'
                            role='separator'
                            aria-label='Resize preview panel'
                            aria-orientation='vertical'
                            onPointerDown={handlePreviewPointerDown}
                            onPointerMove={handleDragPointerMove}
                            onPointerUp={handleDragPointerUp}
                            onPointerCancel={handleDragPointerCancel}
                        />

                        <LatexPreviewPanel
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
