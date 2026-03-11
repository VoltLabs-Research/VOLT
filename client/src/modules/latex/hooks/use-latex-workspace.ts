import { latexDocumentQuery, useUpdateLatexDocumentMutation } from '@/modules/latex/hooks/queries';
import useLatexDocumentSocket from '@/modules/latex/hooks/use-latex-document-socket';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseLatexWorkspaceInput {
    documentId: string;
};

/** Virtual file entry shown in the left panel. In Phase 2 the document has a single file: main.tex. */
export interface LatexFileEntry {
    name: string;
    isSelected: boolean;
};

const SAVE_TOAST = {
    loading: { title: 'Saving document...' },
    success: { title: 'Document saved' },
    error: { title: 'Failed to save document' }
};

const MAIN_FILE_NAME = 'main.tex';

const useLatexWorkspace = ({ documentId }: UseLatexWorkspaceInput) => {
    const teamId = useSelectedTeamId();
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();

    const documentQueryResult = latexDocumentQuery({ documentId }, { enabled: !!documentId });

    const document = documentQueryResult.data;
    const isLoading = documentQueryResult.isLoading;

    const [editorContent, setEditorContent] = useState<string>('');
    const [isDirty, setIsDirty] = useState(false);

    /**
     * Tracks the content value of the last remote update applied.
     * Used to avoid re-broadcasting content back over the socket when
     * Monaco fires onChange in response to a programmatic value change.
     */
    const remoteContentRef = useRef<string>('');

    const { mutateAsync: updateDocument, isPending: isSaving } = useUpdateLatexDocumentMutation();

    useEffect(() => {
        if (!documentQueryResult.error) return;
        checkAccessDeniedError(documentQueryResult.error);
    }, [checkAccessDeniedError, documentQueryResult.error]);

    useEffect(() => {
        if (!document) return;
        setEditorContent(document.content ?? '');
        setIsDirty(false);
    }, [document]);

    const handleRemoteContentUpdate = useCallback((content: string): void => {
        remoteContentRef.current = content;
        setEditorContent(content);
        setIsDirty(false);
    }, []);

    const { collaborators, sendContentUpdate } = useLatexDocumentSocket({
        documentId,
        teamId: teamId ?? undefined,
        enabled: !!documentId && !!teamId,
        onRemoteContentUpdate: handleRemoteContentUpdate
    });

    const handleEditorChange = useCallback((value: string | undefined): void => {
        const content = value ?? '';
        setEditorContent(content);
        setIsDirty(true);

        // Skip broadcasting if this onChange was triggered by applying a remote update,
        // preventing an echo loop back to the server.
        if (content === remoteContentRef.current) {
            remoteContentRef.current = '';
            return;
        }

        sendContentUpdate(content);
    }, [sendContentUpdate]);

    const handleSave = useCallback(async (): Promise<void> => {
        if (!documentId || isSaving) return;

        try {
            await showPromise(
                updateDocument({ documentId, content: editorContent }),
                SAVE_TOAST
            );
            setIsDirty(false);
        } catch (error) {
            checkAccessDeniedError(error);
        }
    }, [checkAccessDeniedError, documentId, editorContent, isSaving, updateDocument]);

    const handleInsertAssetRef = useCallback((ref: string): void => {
        const next = `${editorContent}\n${ref}`;
        setEditorContent(next);
        setIsDirty(true);
        sendContentUpdate(next);
    }, [editorContent, sendContentUpdate]);

    const files: LatexFileEntry[] = [
        { name: MAIN_FILE_NAME, isSelected: true }
    ];

    return {
        document,
        documentId,
        isLoading,
        editorContent,
        isDirty,
        isSaving,
        accessDenied,
        accessDeniedMessage,
        files,
        collaborators,
        handleEditorChange,
        handleSave,
        handleInsertAssetRef
    };
};

export default useLatexWorkspace;

