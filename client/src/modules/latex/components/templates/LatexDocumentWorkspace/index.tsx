import useLatexWorkspace from '@/modules/latex/hooks/use-latex-workspace';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import Avatar from '@/shared/presentation/components/Avatar';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import Paragraph from '@/shared/presentation/components/Paragraph';
import LatexEditorPanel from './LatexEditorPanel';
import LatexFilePanel from './LatexFilePanel';
import LatexPreviewPanel from './LatexPreviewPanel';
import './LatexDocumentWorkspace.css';
import { Download, FileArchive, Save } from 'lucide-react';
import { useParams } from 'react-router-dom';
import type { PresenceUser } from '@/modules/socket/trajectory/api/entities/presence-user';

/** Returns "FL" initials from a PresenceUser, falling back to "?" for anonymous users. */
const getPresenceInitials = (user: PresenceUser): string => {
    const first = user.firstName?.[0] ?? '';
    const last = user.lastName?.[0] ?? '';
    const initials = `${first}${last}`.toUpperCase();
    return initials || '?';
};

const LatexDocumentWorkspace = () => {
    const { documentId = '' } = useParams<{ documentId: string }>();

    const {
        document,
        documentId: resolvedDocumentId,
        isLoading,
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
        handleSave,
        handleInsertAssetRef,
        handleExportTex,
        handleExportZip,
        handleCompile
    } = useLatexWorkspace({ documentId });

    const activeFile = files.find((f) => f.isSelected);

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
                <span className='latex-workspace__toolbar-title color-primary'>
                    {document?.title ?? 'LaTeX Document'}
                </span>
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
                />
                <LatexEditorPanel
                    activeFile={activeFile}
                    content={editorContent}
                    onChange={handleEditorChange}
                />
                <LatexPreviewPanel
                    content={editorContent}
                    isCompiling={isCompiling}
                    compiledPdfUrl={compiledPdfUrl}
                    compileError={compileError}
                    onCompile={handleCompile}
                />
            </Container>
        </Container>
    );
};

export default LatexDocumentWorkspace;

