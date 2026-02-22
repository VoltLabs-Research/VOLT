import { useCallback, useState } from 'react';
import usePluginUseCases from '@/modules/plugin/presentation/hooks/use-plugin-use-cases';
import { triggerBrowserDownload } from '@/shared/utils/file';
import useToast from '@/shared/presentation/hooks/use-toast';
import { ExportType } from '@/shared/domain/export/types';

export interface DownloadPluginListingParams {
    pluginId: string;
    exposureId: string;
    analysisId?: string;
    trajectoryId?: string;
    exposureName?: string;
    format?: ExportType;
}

const useDownloadPluginListing = () => {
    const { pluginListingRepository } = usePluginUseCases();
    const { showSuccess, showError } = useToast();

    const [isDownloading, setIsDownloading] = useState(false);

    const downloadListing = useCallback(async (params: DownloadPluginListingParams) => {
        const { pluginId, exposureId, analysisId, trajectoryId, exposureName, format = 'json' } = params;

        if (!pluginId || !exposureId) {
            return;
        }

        try {
            setIsDownloading(true);

            const blob = await pluginListingRepository.exportListing({
                pluginId,
                exposureId,
                analysisId,
                trajectoryId,
                exposureName,
                format
            });
            const analysisSegment = analysisId ?? 'all';
            const filename = `${pluginId}_${exposureId}_${analysisSegment}_listing.${format}`;

            triggerBrowserDownload(blob, filename);
            showSuccess('Listing downloaded successfully');
        } catch (error: any) {
            console.error('Failed to download listing:', error);
            showError(error?.response?.data?.message || 'Failed to download listing');
        } finally {
            setIsDownloading(false);
        }
    }, [pluginListingRepository, showSuccess, showError]);

    return { isDownloading, downloadListing };
};

export default useDownloadPluginListing;
