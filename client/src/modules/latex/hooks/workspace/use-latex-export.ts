import {
    useExportLatexDocumentTexMutation,
    useExportLatexDocumentZipMutation
} from '@/modules/latex/hooks/queries';
import {
    EXPORT_TEX_TOAST,
    EXPORT_ZIP_TOAST
} from '@/modules/latex/hooks/workspace/toasts';
import { showPromise } from '@/shared/ui/hooks/toast';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useCallback } from 'react';
import { sileo } from 'sileo';

interface UseLatexExportInput{
    documentId: string;
    documentTitle?: string;
    compiledPdfBlob: Blob | null;
    compileSilently: () => Promise<Blob | null>;
}

const buildDownloadName = (title: string | undefined, extension: string): string => (
    `${(title ?? 'document').replace(/[^a-zA-Z0-9._-]+/g, '-')}.${extension}`
);

/**
 * Download handlers for the three export formats. The PDF path reuses the
 * already-compiled blob when there is one and only compiles on demand.
 */
const useLatexExport = ({
    documentId,
    documentTitle,
    compiledPdfBlob,
    compileSilently
}: UseLatexExportInput) => {
    const { mutateAsync: exportTex, isPending: isExportingTex } = useExportLatexDocumentTexMutation();
    const { mutateAsync: exportZip, isPending: isExportingZip } = useExportLatexDocumentZipMutation();

    const handleExportTex = useCallback(async (): Promise<void> => {
        if(!documentId) return;

        try{
            const blob = await showPromise(exportTex({ documentId }), EXPORT_TEX_TOAST);
            triggerBrowserDownload(blob, buildDownloadName(documentTitle, 'tex'));
        }catch{
            // showPromise already surfaced the failure
        }
    }, [documentId, documentTitle, exportTex]);

    const handleExportZip = useCallback(async (): Promise<void> => {
        if(!documentId) return;

        try{
            const blob = await showPromise(exportZip({ documentId }), EXPORT_ZIP_TOAST);
            triggerBrowserDownload(blob, buildDownloadName(documentTitle, 'zip'));
        }catch{
            // showPromise already surfaced the failure
        }
    }, [documentId, documentTitle, exportZip]);

    const handleExportPdf = useCallback(async (): Promise<void> => {
        const blob = compiledPdfBlob ?? await compileSilently();
        if(!blob){
            sileo.error({ title: 'Failed to export PDF' });
            return;
        }

        triggerBrowserDownload(blob, buildDownloadName(documentTitle, 'pdf'));
    }, [compileSilently, compiledPdfBlob, documentTitle]);

    return {
        isExportingTex,
        isExportingZip,
        handleExportTex,
        handleExportZip,
        handleExportPdf
    };
};

export default useLatexExport;
