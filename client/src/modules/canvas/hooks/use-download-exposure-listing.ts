import { DEFAULT_LISTING_EXPORT_FORMAT } from '@/modules/plugin/api/services/listing-service';
import { useExportListingMutation } from '@/modules/plugin/hooks/listing/queries';
import { createCrudToastOptions } from '@/shared/ui/utils/toast-options';
import useBlobDownload from '@/shared/ui/hooks/use-blob-download';

import type { ExportPluginListingInput } from '@/modules/plugin/api/services/listing-service';

export type DownloadExposureListingParams = ExportPluginListingInput;

const DOWNLOAD_LISTING_TOAST = createCrudToastOptions({
    action: 'Downloading',
    subject: 'listing',
    success: 'Listing downloaded successfully'
});

const buildFilename = ({ pluginId, exposureId, analysisId, format }: DownloadExposureListingParams): string => {
    const extension = format ?? DEFAULT_LISTING_EXPORT_FORMAT;

    return `${pluginId}_${exposureId ?? 'all'}_${analysisId ?? 'all'}_listing.${extension}`;
};

const useDownloadExposureListing = () => {
    return useBlobDownload(useExportListingMutation(), {
        toast: DOWNLOAD_LISTING_TOAST,
        filename: buildFilename
    });
};

export default useDownloadExposureListing;
