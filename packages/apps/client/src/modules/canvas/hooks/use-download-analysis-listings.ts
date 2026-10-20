import { useExportListingByAnalysisMutation } from '@/modules/plugin/hooks/listing/queries';
import { createCrudToastOptions } from '@/shared/ui/utils/toast-options';
import useBlobDownload from '@/shared/ui/hooks/use-blob-download';

const DOWNLOAD_ANALYSIS_LISTINGS_TOAST = createCrudToastOptions({
    action: 'Downloading',
    subject: 'analysis listings',
    success: 'Analysis listings downloaded successfully'
});

const buildFilename = ({ analysisId }: { analysisId: string }, blob: Blob): string => {
    const extension = blob.type.includes('zip') ? 'zip' : 'csv';

    return `AnalysisID-${analysisId}.${extension}`;
};

const useDownloadAnalysisListings = () => {
    return useBlobDownload(useExportListingByAnalysisMutation(), {
        toast: DOWNLOAD_ANALYSIS_LISTINGS_TOAST,
        filename: buildFilename
    });
};

export default useDownloadAnalysisListings;
