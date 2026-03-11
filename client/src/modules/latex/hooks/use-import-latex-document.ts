import { useImportLatexDocumentMutation } from '@/modules/latex/hooks/queries';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useCallback, useRef } from 'react';

const IMPORT_TOAST = {
    loading: { title: 'Importing document...' },
    success: { title: 'Document imported successfully' },
    error: { title: 'Failed to import document' }
};

const ACCEPTED_TYPES = '.tex,.zip';

/**
 * Provides an import action that opens a hidden file input for `.tex` / `.zip`
 * selection, uploads the file, and invalidates the documents cache on success.
 */
const useImportLatexDocument = () => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const { mutateAsync: importDocument } = useImportLatexDocumentMutation();

    const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        event.target.value = '';

        await showPromise(
            importDocument({ file }),
            IMPORT_TOAST
        );
    }, [importDocument]);

    const openFilePicker = useCallback(() => {
        if (!fileInputRef.current) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = ACCEPTED_TYPES;
            input.style.display = 'none';
            input.addEventListener('change', (e) => {
                handleFileChange(e as unknown as React.ChangeEvent<HTMLInputElement>);
            });
            document.body.appendChild(input);
            fileInputRef.current = input;
        }

        fileInputRef.current.click();
    }, [handleFileChange]);

    return { openFilePicker };
};

export default useImportLatexDocument;
