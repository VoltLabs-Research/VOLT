import { useCallback, useState } from 'react';
import usePluginUseCases from '@/modules/plugin/presentation/hooks/use-plugin-use-cases';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { showPromise } from '@/shared/presentation/hooks/toast';
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
    const [isDownloading, setIsDownloading] = useState(false);

    const downloadListing = useCallback(async (params: DownloadPluginListingParams) => {
        const { pluginId, exposureId, analysisId, trajectoryId, exposureName, format = 'json' } = params;

        if (!pluginId || !exposureId) {
            return;
        }

        setIsDownloading(true);
        try {
            await showPromise(
                (async () => {
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
                    return blob;
                })(),
                {
                    loading: { title: 'Downloading listing...' },
                    success: { title: 'Listing downloaded successfully' },
                    error: { title: 'Failed to download listing' }
                }
            );
        } finally {
            setIsDownloading(false);
        }
    }, [pluginListingRepository]);

    return { isDownloading, downloadListing };
};

export default useDownloadPluginListing;
