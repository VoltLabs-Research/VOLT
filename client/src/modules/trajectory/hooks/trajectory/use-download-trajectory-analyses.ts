import { useDownloadTrajectoryAnalysesMutation } from './queries';
import { isAccessDeniedError } from '@/shared/errors/core';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { useCallback } from 'react';

import type { DownloadTrajectoryAnalysesInputDTO } from '../../api/services/trajectory-service';

interface UseDownloadTrajectoryAnalysesReturn {
    downloadTrajectoryAnalyses: (params: DownloadTrajectoryAnalysesInputDTO) => Promise<void>;
    isDownloading: boolean;
}

const useDownloadTrajectoryAnalyses = (): UseDownloadTrajectoryAnalysesReturn => {
    const downloadTrajectoryAnalysesMutation = useDownloadTrajectoryAnalysesMutation();

    const downloadTrajectoryAnalyses = useCallback(async (params: DownloadTrajectoryAnalysesInputDTO) => {
        try {
            await showPromise(
                (async () => {
                    const blob = await downloadTrajectoryAnalysesMutation.mutateAsync(params);
                    const filename = `${params.filename || params.trajectoryId}-analyses.zip`;

                    triggerBrowserDownload(blob, filename);
                    return blob;
                })(),
                {
                    loading: { title: 'Downloading analyses...' },
                    success: { title: 'Analyses downloaded successfully' },
                    error: { title: 'Failed to download analyses' }
                }
            );
        } catch (error: unknown) {
            if (isAccessDeniedError(error)) return;
        }
    }, [downloadTrajectoryAnalysesMutation]);

    return {
        downloadTrajectoryAnalyses,
        isDownloading: downloadTrajectoryAnalysesMutation.isPending
    };
};

export default useDownloadTrajectoryAnalyses;
