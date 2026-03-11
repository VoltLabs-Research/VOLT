import useLatexWorkspace from '@/modules/latex/hooks/use-latex-workspace';
import { DASHBOARD_LAYOUT_EVENTS } from '@/modules/dashboard/utilities/layout-events';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import Avatar from '@/shared/presentation/components/Avatar';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import EditableTag from '@/shared/presentation/components/EditableTag';
import Loader from '@/shared/presentation/components/Loader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import LatexEditorPanel from './LatexEditorPanel';
import LatexFilePanel from './LatexFilePanel';
import LatexPreviewPanel from './LatexPreviewPanel';
import './LatexDocumentWorkspace.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileArchive, Save } from 'lucide-react';
import { useParams } from 'react-router-dom';
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

    const {
        latexDocument,
        documentId: resolvedDocumentId,
        isLoading,
        activeFile: activeLatexFile,
        editorContent,
        isDirty,
        isSaving,
        isExportingTex,
        isExportingZip,
        isCompiling,
        compiledPdfUrl,
        compileError,
        accessDenied,
        accessDeniedMessage,
        files,
        collaborators,
        handleEditorChange,
        handleRenameDocument,
        handleSave,
        handleInsertAssetRef,
        handleExportTex,
        handleExportZip,
        handleCompile,
        handleSelectFileById,
        handleCreateFile,
        handleDeleteFile,
        handleSetEntrypoint,
        handleMoveFile
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

    const activeFile = files.find((f) => f._id === activeLatexFile?._id);

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

    const saveButton = (
        <Button
            variant='solid'
            intent='brand'
            size='sm'
            shape='rounded'
            disabled={!isDirty || isSaving}
            onClick={handleSave}
        >
            <Save size={14} />
            {isSaving ? 'Saving...' : 'Save'}
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
                    {exportTexButton}
                    {exportZipButton}
                    {saveButton}
                </Container>
            </Container>

            <Container className='latex-workspace__layout d-flex flex-1 min-h-0'>
                <LatexFilePanel
                    documentId={resolvedDocumentId}
                    files={files}
                    onInsertRef={handleInsertAssetRef}
                    onFileSelect={handleSelectFileById}
                    onCreateFile={handleCreateFile}
                    onDeleteFile={handleDeleteFile}
                    onSetEntrypoint={handleSetEntrypoint}
                    onMoveFile={handleMoveFile}
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
                    activeFile={activeFile}
                    content={editorContent}
                    onChange={handleEditorChange}
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
                    onCompile={handleCompile}
                    width={panelWidths.preview}
                />
            </Container>
        </Container>
    );
};

export default LatexDocumentWorkspace;
