import { useImportLatexDocumentMutation } from '@/modules/latex/hooks/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useCallback, useRef } from 'react';

const IMPORT_TOAST = {
    loading: { title: 'Importing document...' },
    success: { title: 'Document imported successfully' },
    error: { title: 'Failed to import document' }
};

const ACCEPTED_TYPES = '.tex,.zip,.pdf';

/**
 * Provides an import action that opens a hidden file input for `.tex`, `.zip`,
 * or `.pdf` selection, uploads the file, and invalidates the documents cache on success.
 */
const useImportLatexDocument = (folderId?: string | null) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const { mutateAsync: importDocument } = useImportLatexDocumentMutation();

    const handleFileSelected = useCallback(async (input: HTMLInputElement) => {
        const file = input.files?.[0];
        if (!file) return;

        input.value = '';

        await showPromise(
            importDocument({ file, folderId }),
            IMPORT_TOAST
        );
    }, [folderId, importDocument]);

    const openFilePicker = useCallback(() => {
        if (!fileInputRef.current) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = ACCEPTED_TYPES;
            input.style.display = 'none';
            document.body.appendChild(input);
            fileInputRef.current = input;
        }

        fileInputRef.current.onchange = () => {
            if (fileInputRef.current) {
                handleFileSelected(fileInputRef.current);
            }
        };
        fileInputRef.current.click();
    }, [handleFileSelected]);

    return { openFilePicker };
};

export default useImportLatexDocument;
