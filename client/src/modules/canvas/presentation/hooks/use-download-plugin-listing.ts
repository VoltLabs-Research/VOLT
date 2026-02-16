import { useCallback, useState } from 'react';
import usePluginUseCases from '@/modules/plugin/presentation/hooks/use-plugin-use-cases';
import { triggerBrowserDownload } from '@/shared/utils/file';
import useToast from '@/shared/presentation/hooks/use-toast';

export interface DownloadPluginListingParams {
    pluginSlug: string;
    exposureId: string;
    analysisId?: string;
    trajectoryId?: string;
    listingSlug?: string;
}

const useDownloadPluginListing = () => {
    const { pluginListingRepository } = usePluginUseCases();
    const { showSuccess, showError } = useToast();

    const [isDownloading, setIsDownloading] = useState(false);

    const downloadListing = useCallback(async (params: DownloadPluginListingParams) => {
        const { pluginSlug, exposureId, analysisId, trajectoryId, listingSlug } = params;

        if (!pluginSlug || !exposureId) {
            return;
        }

        try {
            setIsDownloading(true);

            const payload = await pluginListingRepository.exportListing({
                pluginSlug,
                exposureId,
                analysisId,
                trajectoryId,
                listingSlug
            });

            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const analysisSegment = analysisId ?? 'all';
            const filename = `${pluginSlug}_${exposureId}_${analysisSegment}_listing.json`;

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
