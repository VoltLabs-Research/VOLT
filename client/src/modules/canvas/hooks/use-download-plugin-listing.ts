import { useCallback } from 'react';
import { useExportListingMutation, useExportListingByAnalysisMutation } from '@/modules/plugin/hooks/listing/queries';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { ExportType } from '@/shared/domain/export/types';
import ApiError from '@/shared/errors/ApiError';

export interface DownloadPluginListingParams {
    pluginId: string;
    exposureId: string;
    analysisId?: string;
    trajectoryId?: string;
    exposureName?: string;
    format?: ExportType;
}

export interface DownloadAnalysisListingParams {
    analysisId: string;
    format?: ExportType;
}

const useDownloadPluginListing = () => {
    const exportListingMutation = useExportListingMutation();
    const exportListingByAnalysisMutation = useExportListingByAnalysisMutation();

    const isDownloading = exportListingMutation.isPending || exportListingByAnalysisMutation.isPending;

    const getExtensionFromBlob = useCallback((blob: Blob, fallback: string): string => {
        if (blob.type.includes('zip')) return 'zip';
        if (blob.type.includes('csv')) return 'csv';
        return fallback;
    }, []);

    const downloadListing = useCallback(async (params: DownloadPluginListingParams) => {
        const { pluginId, exposureId, analysisId, trajectoryId, exposureName, format = 'json' } = params;

        if (!pluginId || !exposureId) {
            return;
        }

        try {
            await showPromise(
                (async () => {
                    const blob = await exportListingMutation.mutateAsync({
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
        } catch(error: unknown) {
            if(ApiError.isRBACError(error)) return;
        }
    }, [exportListingMutation]);

    const downloadAnalysisListings = useCallback(async (params: DownloadAnalysisListingParams) => {
        const { analysisId, format = 'csv' } = params;

        if (!analysisId) {
            return;
        }

        try {
            await showPromise(
                (async () => {
                    const blob = await exportListingByAnalysisMutation.mutateAsync({
                        analysisId,
                        format
                    });
                    const extension = getExtensionFromBlob(blob, format);
                    triggerBrowserDownload(blob, `${analysisId}_analysis_listings.${extension}`);
                    return blob;
                })(),
                {
                    loading: { title: 'Downloading analysis listings...' },
                    success: { title: 'Analysis listings downloaded successfully' },
                    error: { title: 'Failed to download analysis listings' }
                }
            );
        } catch(error: unknown) {
            if(ApiError.isRBACError(error)) return;
        }
    }, [getExtensionFromBlob, exportListingByAnalysisMutation]);

    return { isDownloading, downloadListing, downloadAnalysisListings };
};

export default useDownloadPluginListing;
