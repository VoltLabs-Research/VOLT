import { useExportListingMutation, useExportListingByAnalysisMutation } from '@/modules/plugin/hooks/listing/queries';
import { isAccessDeniedError } from '@/shared/errors/core';
import { ExportType } from '@/shared/domain/export/types';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useCallback } from 'react';

export interface DownloadPluginListingParams {
    pluginId: string;
    exposureId: string;
    analysisId?: string;
    trajectoryId?: string;
    exposureName?: string;
    format?: ExportType;
};

export interface DownloadAnalysisListingParams {
    analysisId: string;
    format?: ExportType;
    includeConfig?: boolean;
    selectedListingIds?: string[];
    selectedSubListingIds?: string[];
};

const useDownloadPluginListing = () => {
    const exportListingMutation = useExportListingMutation();
    const exportListingByAnalysisMutation = useExportListingByAnalysisMutation();

    const isDownloading = exportListingMutation.isPending || exportListingByAnalysisMutation.isPending;

    const getExtensionFromBlob = useCallback((blob: Blob, fallback: string): string => {
        if (blob.type.includes('zip')) return 'zip';
        if (blob.type.includes('csv')) return 'csv';
        return fallback;
    }, []);

    const downloadListing = useCallback(async (params: DownloadPluginListingParams): Promise<boolean> => {
        const { pluginId, exposureId, analysisId, trajectoryId, exposureName, format = 'json' } = params;

        if (!pluginId || !exposureId) {
            return false;
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
            return true;
        } catch(error: unknown) {
            if (isAccessDeniedError(error)) {
                return false;
            }

            return false;
        }
    }, [exportListingMutation]);

    const downloadAnalysisListings = useCallback(async (params: DownloadAnalysisListingParams): Promise<boolean> => {
        const {
            analysisId,
            format = 'csv',
            includeConfig,
            selectedListingIds,
            selectedSubListingIds
        } = params;

        if (!analysisId) {
            return false;
        }

        try {
            await showPromise(
                (async () => {
                    const blob = await exportListingByAnalysisMutation.mutateAsync({
                        analysisId,
                        format,
                        ...(includeConfig !== undefined ? { includeConfig } : {}),
                        ...(selectedListingIds ? { selectedListingIds } : {}),
                        ...(selectedSubListingIds ? { selectedSubListingIds } : {})
                    });
                    const extension = getExtensionFromBlob(blob, format);
                    triggerBrowserDownload(blob, `AnalysisID-${analysisId}.${extension}`);
                    return blob;
                })(),
                {
                    loading: { title: 'Downloading analysis listings...' },
                    success: { title: 'Analysis listings downloaded successfully' },
                    error: { title: 'Failed to download analysis listings' }
                }
            );
            return true;
        } catch(error: unknown) {
            if (isAccessDeniedError(error)) {
                return false;
            }

            return false;
        }
    }, [getExtensionFromBlob, exportListingByAnalysisMutation]);

    return { isDownloading, downloadListing, downloadAnalysisListings };
};

export default useDownloadPluginListing;
